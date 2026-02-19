import argparse
import json
import time
import webbrowser
from datetime import UTC, datetime

import requests

from app.core.config import settings
from app.providers.copilot_token_manager import CopilotTokenManager

GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98"
GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"


def _write_oauth_token(access_token: str) -> None:
    payload = {
        "access_token": access_token,
        "created_at": datetime.now(UTC).isoformat(),
    }
    settings.copilot_token_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    settings.copilot_token_file.chmod(0o600)


def login() -> int:
    response = requests.post(
        GITHUB_DEVICE_CODE_URL,
        data={"client_id": GITHUB_CLIENT_ID, "scope": "read:user user:email copilot"},
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=10,
    )

    if response.status_code != 200:
        print(f"Failed to start device flow: {response.status_code} {response.text}")
        return 1

    data = response.json()
    device_code = data["device_code"]
    user_code = data["user_code"]
    verification_uri = data["verification_uri"]
    expires_in = int(data.get("expires_in", 900))
    interval = int(data.get("interval", 5))

    print("GitHub Copilot OAuth Device Flow")
    print(f"1) Open: {verification_uri}")
    print(f"2) Enter code: {user_code}")

    try:
        webbrowser.open(verification_uri)
    except Exception:
        pass

    deadline = time.time() + expires_in
    while time.time() < deadline:
        time.sleep(interval)
        poll_response = requests.post(
            GITHUB_ACCESS_TOKEN_URL,
            data={
                "client_id": GITHUB_CLIENT_ID,
                "device_code": device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=10,
        )

        if poll_response.status_code != 200:
            print(f"Polling failed: {poll_response.status_code} {poll_response.text}")
            return 1

        token_data = poll_response.json()
        token = token_data.get("access_token")
        if token:
            _write_oauth_token(token)
            print(f"OAuth token saved at {settings.copilot_token_file}")
            manager = CopilotTokenManager()
            try:
                manager.get_internal_token()
                print(f"Copilot internal token cached at {settings.copilot_cache_file}")
            except Exception as exc:
                print(f"OAuth success, but failed to cache copilot token: {exc}")
            return 0

        error = token_data.get("error")
        if error == "authorization_pending":
            print("Waiting for authorization...")
            continue
        if error == "slow_down":
            interval += 2
            continue

        print(f"Device flow error: {error}")
        return 1

    print("Timed out waiting for authorization")
    return 1


def status() -> int:
    manager = CopilotTokenManager()
    print(f"OAuth file: {settings.copilot_token_file} exists={settings.copilot_token_file.exists()}")
    print(f"Cache file: {settings.copilot_cache_file} exists={settings.copilot_cache_file.exists()}")
    print(f"OAuth token present: {manager.has_oauth_token()}")
    try:
        token = manager.get_internal_token()
        print(f"Copilot internal token available: yes ({len(token)} chars)")
        return 0
    except Exception as exc:
        print(f"Copilot internal token available: no ({exc})")
        return 1


def logout() -> int:
    removed = 0
    for path in [settings.copilot_token_file, settings.copilot_cache_file]:
        if path.exists():
            path.unlink()
            removed += 1
    print(f"Removed {removed} credential files")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="GitHub Copilot auth helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("login", help="start OAuth Device Flow")
    subparsers.add_parser("status", help="show OAuth/Copilot token status")
    subparsers.add_parser("logout", help="remove local token cache")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "login":
        return login()
    if args.command == "status":
        return status()
    if args.command == "logout":
        return logout()
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
