import asyncio
import logging
import time
from typing import Optional, Callable, Awaitable
import httpx

logger = logging.getLogger(__name__)

class Throttler:
    """
    Asynchronous rate limiter and concurrency controller per provider.
    Enforces:
    1. Maximum requests per second (minimum interval between requests).
    2. Maximum concurrent requests (asyncio.Semaphore).
    """

    def __init__(self, requests_per_second: float = 3.0, max_concurrency: int = 1):
        self.req_per_second = max(0.1, requests_per_second)
        self.interval = 1.0 / self.req_per_second
        self.max_concurrency = max(1, max_concurrency)
        self.semaphore = asyncio.Semaphore(self.max_concurrency)
        self.lock = asyncio.Lock()
        self.last_call = 0.0

    async def __aenter__(self):
        await self.semaphore.acquire()
        async with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_call
            wait_time = self.interval - elapsed
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self.last_call = time.monotonic()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.semaphore.release()


async def execute_with_retry(
    request_func: Callable[[], Awaitable[httpx.Response]],
    throttler: Optional[Throttler] = None,
    max_retries: int = 3,
    base_backoff: float = 1.0,
    provider_name: str = "provider"
) -> httpx.Response:
    """
    Eksekusi HTTP request dengan rate limiting dan exponential retry backoff pada HTTP 429.
    Mendukung header Retry-After dan maksimal `max_retries` percobaan ulang (default: 3).
    """
    last_response: Optional[httpx.Response] = None

    for attempt in range(max_retries + 1):
        try:
            if throttler is not None:
                async with throttler:
                    resp = await request_func()
            else:
                resp = await request_func()

            last_response = resp

            if resp.status_code == 429 and attempt < max_retries:
                retry_after_hdr = resp.headers.get("Retry-After")
                wait_seconds = base_backoff * (2 ** attempt)

                if retry_after_hdr:
                    try:
                        parsed_hdr = float(retry_after_hdr)
                        if 0 < parsed_hdr <= 15:
                            wait_seconds = parsed_hdr
                    except ValueError:
                        pass

                logger.warning(
                    f"[{provider_name}] HTTP 429 (Rate Limit). Menunggu {wait_seconds:.2f}s "
                    f"sebelum retry ({attempt + 1}/{max_retries})..."
                )
                await asyncio.sleep(wait_seconds)
                continue

            return resp

        except (httpx.TimeoutException, httpx.NetworkError) as net_err:
            if attempt < max_retries:
                wait_seconds = base_backoff * (2 ** attempt)
                logger.warning(
                    f"[{provider_name}] Network/Timeout error: {net_err}. "
                    f"Retry dalam {wait_seconds:.2f}s ({attempt + 1}/{max_retries})..."
                )
                await asyncio.sleep(wait_seconds)
                continue
            raise net_err

    if last_response is not None:
        return last_response
    raise RuntimeError(f"[{provider_name}] Request gagal setelah {max_retries} percobaan.")
