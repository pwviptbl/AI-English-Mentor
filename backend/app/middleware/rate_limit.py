from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request

from app.core.config import settings


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        now = monotonic()
        with self._lock:
            bucket = self._buckets[key]
            while bucket and now - bucket[0] > window_seconds:
                bucket.popleft()

            if len(bucket) >= limit:
                return False

            bucket.append(now)
            return True


rate_limiter = InMemoryRateLimiter()


def rate_limit_dependency(limit: int) -> Callable:
    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"
        allowed = rate_limiter.check(key, limit=limit, window_seconds=settings.rate_limit_window_seconds)
        if not allowed:
            raise HTTPException(status_code=429, detail="rate limit exceeded")

    return dependency
