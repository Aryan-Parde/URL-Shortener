import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.cache import cache_url, get_cached_url
from app.database import get_connection
from app.analytics import record_click
from app.encoding import decode_base62

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/r/{short_code}")
async def redirect_short_url(
    short_code: str,
    request: Request,
    background_tasks: BackgroundTasks,
    connection: AsyncConnection = Depends(get_connection),
) -> RedirectResponse:
    try:
        cached_url = await get_cached_url(short_code)
    except RedisError:
        logger.exception("Redis lookup failed for short code %s", short_code)
        cached_url = None

    if cached_url is not None:
        try:
            link_id = decode_base62(short_code)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Short code not found",
            )
        background_tasks.add_task(
            record_click,
            link_id=link_id,
            referrer=request.headers.get("referer"),
        )
        return RedirectResponse(cached_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    result = await connection.execute(
        text("SELECT id, long_url FROM links WHERE short_code = :short_code"),
        {"short_code": short_code},
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Short code not found")

    link_id, long_url = row
    try:
        await cache_url(short_code, long_url)
    except RedisError:
        logger.exception("Redis cache write failed for short code %s", short_code)

    background_tasks.add_task(
        record_click,
        link_id=link_id,
        referrer=request.headers.get("referer"),
    )
    return RedirectResponse(long_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
