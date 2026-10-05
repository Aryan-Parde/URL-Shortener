from typing import Optional

from sqlalchemy import text

from app.database import engine


async def record_click(
    link_id: int,
    referrer: Optional[str],
) -> None:
    async with engine.begin() as connection:
        await connection.execute(
            text(
                """
                INSERT INTO clicks (link_id, referrer, country)
                VALUES (:link_id, :referrer, NULL)
                """
            ),
            {"link_id": link_id, "referrer": referrer},
        )
