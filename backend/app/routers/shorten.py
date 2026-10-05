from fastapi import APIRouter, Depends, Request, status
from pydantic import AnyHttpUrl, BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.database import get_connection
from app.encoding import encode_base62

router = APIRouter()


class ShortenRequest(BaseModel):
    long_url: AnyHttpUrl


@router.post("/shorten", status_code=status.HTTP_201_CREATED)
async def shorten_url(
    payload: ShortenRequest,
    request: Request,
    connection: AsyncConnection = Depends(get_connection),
) -> dict[str, str]:
    async with connection.begin():
        result = await connection.execute(text("SELECT nextval('links_id_seq')"))
        link_id = result.scalar_one()
        short_code = encode_base62(link_id)
        await connection.execute(
            text(
                """
                INSERT INTO links (id, short_code, long_url)
                VALUES (:id, :short_code, :long_url)
                """
            ),
            {
                "id": link_id,
                "short_code": short_code,
                "long_url": str(payload.long_url),
            },
        )

    return {
        "short_code": short_code,
        "short_url": str(request.base_url) + f"r/{short_code}",
    }
