#!/usr/bin/env python3
"""Simple load test for /api/v1/chat/send with P95 calculation.

Usage:
  python ops/scripts/chat_p95_load.py --base-url http://localhost:8000/api/v1 --users 10 --requests-per-user 5
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import random
import string
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass(slots=True)
class UserContext:
    token: str
    session_id: str


@dataclass(slots=True)
class WorkerResult:
    latencies_ms: list[float]
    failures: int


def _request_json(
    method: str,
    url: str,
    payload: dict | None = None,
    token: str | None = None,
    timeout_seconds: int = 30,
) -> tuple[int, dict, float]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url=url, data=body, headers=headers, method=method)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            return response.status, data, (time.perf_counter() - start) * 1000
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"detail": raw}
        return exc.code, data, (time.perf_counter() - start) * 1000
    except Exception as exc:
        return 0, {"detail": str(exc)}, (time.perf_counter() - start) * 1000


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, math.ceil((p / 100.0) * len(ordered)) - 1))
    return ordered[idx]


def _bootstrap_user(base_url: str, run_id: str, index: int, password: str, timeout_seconds: int) -> UserContext:
    email = f"load_{run_id}_{index}@example.com"
    register_payload = {
        "full_name": f"Load User {index}",
        "email": email,
        "password": password,
    }
    status, body, _ = _request_json(
        "POST",
        f"{base_url}/auth/register",
        payload=register_payload,
        timeout_seconds=timeout_seconds,
    )
    if status not in (200, 409):
        raise RuntimeError(f"register failed for {email}: status={status} body={body}")

    status, body, _ = _request_json(
        "POST",
        f"{base_url}/auth/login",
        payload={"email": email, "password": password},
        timeout_seconds=timeout_seconds,
    )
    if status != 200 or "access_token" not in body:
        raise RuntimeError(f"login failed for {email}: status={status} body={body}")
    token = body["access_token"]

    status, body, _ = _request_json(
        "POST",
        f"{base_url}/sessions",
        payload={
            "topic": f"Load Test {index}",
            "persona_prompt": "You are concise and helpful.",
        },
        token=token,
        timeout_seconds=timeout_seconds,
    )
    if status != 200 or "id" not in body:
        raise RuntimeError(f"session create failed for {email}: status={status} body={body}")

    return UserContext(token=token, session_id=body["id"])


def _run_user_workload(
    user_context: UserContext,
    base_url: str,
    requests_per_user: int,
    timeout_seconds: int,
) -> WorkerResult:
    latencies: list[float] = []
    failures = 0

    for _ in range(requests_per_user):
        status, _body, latency_ms = _request_json(
            "POST",
            f"{base_url}/chat/send",
            payload={
                "session_id": user_context.session_id,
                "text_raw": "Eu acho que we need to go agora",
            },
            token=user_context.token,
            timeout_seconds=timeout_seconds,
        )
        if status == 200:
            latencies.append(latency_ms)
        else:
            failures += 1

    return WorkerResult(latencies_ms=latencies, failures=failures)


def main() -> int:
    parser = argparse.ArgumentParser(description="Load test for chat endpoint with P95 output")
    parser.add_argument("--base-url", default="http://localhost:8000/api/v1")
    parser.add_argument("--users", type=int, default=10)
    parser.add_argument("--requests-per-user", type=int, default=5)
    parser.add_argument("--timeout-seconds", type=int, default=40)
    parser.add_argument("--target-p95-ms", type=float, default=3000.0)
    args = parser.parse_args()

    run_id = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    password = "secret1234"

    users: list[UserContext] = []
    for idx in range(args.users):
        users.append(_bootstrap_user(args.base_url, run_id, idx, password, args.timeout_seconds))

    total_requests = args.users * args.requests_per_user
    start = time.perf_counter()

    all_latencies: list[float] = []
    failures = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.users) as executor:
        futures = [
            executor.submit(
                _run_user_workload,
                user_context=user,
                base_url=args.base_url,
                requests_per_user=args.requests_per_user,
                timeout_seconds=args.timeout_seconds,
            )
            for user in users
        ]
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            all_latencies.extend(result.latencies_ms)
            failures += result.failures

    elapsed_s = time.perf_counter() - start
    success = len(all_latencies)

    p50 = _percentile(all_latencies, 50)
    p95 = _percentile(all_latencies, 95)
    p99 = _percentile(all_latencies, 99)

    summary = {
        "users": args.users,
        "requests_per_user": args.requests_per_user,
        "total_requests": total_requests,
        "success": success,
        "failures": failures,
        "success_rate": round((success / total_requests) * 100, 2) if total_requests else 0.0,
        "duration_seconds": round(elapsed_s, 3),
        "throughput_rps": round(success / elapsed_s, 2) if elapsed_s > 0 else 0.0,
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
        "target_p95_ms": args.target_p95_ms,
        "target_met": failures == 0 and p95 <= args.target_p95_ms,
    }

    print(json.dumps(summary, indent=2))

    if summary["target_met"]:
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
