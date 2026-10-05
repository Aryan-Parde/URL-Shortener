from typing import Optional

from redis.asyncio import Redis

from app.config import REDIS_URL

# Create a Redis client instance
redis_client: Redis = Redis.from_url(
    REDIS_URL,
    decode_responses=True,
)
CACHE_TTL_SECONDS = 24 * 60 * 60

# FastAPI -> redis_client -> Redis server -> redis_client -> FastAPI

async def get_cached_url(short_code: str) -> Optional[str]:
    return await redis_client.get(f"short:{short_code}")

async def cache_url(short_code: str, long_url: str) -> None:
    await redis_client.set(
        f"short:{short_code}",
        long_url,
        ex=CACHE_TTL_SECONDS,
    )
