import asyncio
import asyncpg
import sys
import pathlib

# Add project root to sys.path
sys.path.append(str(pathlib.Path(__file__).parent.parent.parent))

from backend.database.migrations import run_migrations
from backend.core.config import DATABASE_URL

async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await run_migrations(conn)
        print("Migrations ran successfully.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
