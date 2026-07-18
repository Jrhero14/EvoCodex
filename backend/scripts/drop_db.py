import asyncio
import asyncpg

from backend.core.config import DATABASE_URL, TABLE_NAME

async def drop():
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute(f'DROP TABLE IF EXISTS "{TABLE_NAME}" CASCADE')
    print("Table dropped.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(drop())
