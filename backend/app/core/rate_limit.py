from __future__ import annotations

from collections import deque
from collections.abc import Callable
from threading import Lock
from time import monotonic


class InMemoryRateLimiter:
    def __init__(self, *, max_requests: int, window_seconds: int, clock: Callable[[], float] = monotonic) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        if self.max_requests <= 0 or self.window_seconds <= 0:
            return True

        now = self._clock()
        cutoff = now - self.window_seconds

        with self._lock:
            bucket = self._events.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                return False

            bucket.append(now)
            if not bucket:
                self._events.pop(key, None)
            return True
