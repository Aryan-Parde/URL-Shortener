from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from app.config import DATABASE_URL

# Database configuration
# Create an asynchronous engine for the database connection
engine: AsyncEngine = create_async_engine(DATABASE_URL, pool_pre_ping=True)

# Get a database connection
async def get_connection() -> AsyncIterator[AsyncConnection]:
    async with engine.connect() as connection:
        yield connection
