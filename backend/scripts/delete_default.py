import asyncio
import asyncpg
import sys
import pathlib

sys.path.append(str(pathlib.Path(__file__).parent.parent.parent))
from backend.core.config import DATABASE_URL

async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("DELETE FROM code_embeddings WHERE project_name = 'default'")
        print("Deleted default data successfully")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
