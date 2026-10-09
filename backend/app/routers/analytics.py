from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.database import get_connection

router = APIRouter(prefix="/analytics")


async def _get_link_id(
    short_code: str,
    connection: AsyncConnection,
) -> int:
    result = await connection.execute(
        text("SELECT id FROM links WHERE short_code = :short_code"),
        {"short_code": short_code},
    )
    link_id = result.scalar_one_or_none()
    if link_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Short code not found",
        )
    return link_id


@router.get("/{short_code}/info")
async def link_info(
    short_code: str,
    request: Request,
    connection: AsyncConnection = Depends(get_connection),
) -> Dict[str, str]:
    result = await connection.execute(
        text("SELECT long_url FROM links WHERE short_code = :short_code"),
        {"short_code": short_code},
    )
    long_url = result.scalar_one_or_none()
    if long_url is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Short code not found",
        )
    return {
        "short_code": short_code,
        "long_url": long_url,
        "short_url": str(request.base_url) + f"r/{short_code}",
    }


@router.get("/{short_code}/total")
async def total_clicks(
    short_code: str,
    connection: AsyncConnection = Depends(get_connection),
) -> Dict[str, Union[int, str]]:
    link_id = await _get_link_id(short_code, connection)
    result = await connection.execute(
        text("SELECT COUNT(*) FROM clicks WHERE link_id = :link_id"),
        {"link_id": link_id},
    )
    return {"short_code": short_code, "clicks": result.scalar_one()}


@router.get("/{short_code}/daily")
async def daily_clicks(
    short_code: str,
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    connection: AsyncConnection = Depends(get_connection),
) -> List[Dict[str, Union[int, str]]]:
    if from_date is not None and to_date is not None and from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The from date must not be later than the to date",
        )

    link_id = await _get_link_id(short_code, connection)
    from_timestamp = (
        datetime.combine(from_date, time.min, tzinfo=timezone.utc)
        if from_date is not None
        else None
    )
    to_timestamp = (
        datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        if to_date is not None
        else None
    )
    result = await connection.execute(
        text(
            """
            SELECT CAST(clicked_at AS DATE) AS click_date, COUNT(*) AS clicks
            FROM clicks
            WHERE link_id = :link_id
              AND (
                  CAST(:from_timestamp AS TIMESTAMPTZ) IS NULL
                  OR clicked_at >= CAST(:from_timestamp AS TIMESTAMPTZ)
              )
              AND (
                  CAST(:to_timestamp AS TIMESTAMPTZ) IS NULL
                  OR clicked_at < CAST(:to_timestamp AS TIMESTAMPTZ)
              )
            GROUP BY click_date
            ORDER BY click_date
            """
        ),
        {
            "link_id": link_id,
            "from_timestamp": from_timestamp,
            "to_timestamp": to_timestamp,
        },
    )
    return [
        {"date": row.click_date.isoformat(), "clicks": row.clicks}
        for row in result
    ]
