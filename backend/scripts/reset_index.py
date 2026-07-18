import asyncio
import asyncpg
import sys
import os
import pathlib

# Add project root to sys.path
sys.path.append(str(pathlib.Path(__file__).parent.parent.parent))
from backend.core.config import DATABASE_URL, TABLE_NAME

async def reset_index():
    print(f"Connecting to {DATABASE_URL}...")
    pool = await asyncpg.create_pool(DATABASE_URL)
    
    async with pool.acquire() as conn:
        print(f"WARNING: This will delete all rows in the '{TABLE_NAME}' table.")
        if "--force" not in sys.argv:
            confirm = input("Are you sure you want to proceed? (y/n): ")
            if confirm.lower() != 'y':
                print("Aborted.")
                return

        print(f"Deleting all records from {TABLE_NAME}...")
        await conn.execute(f'TRUNCATE TABLE "{TABLE_NAME}"')
        
        print("Database cleared. You can now re-run the indexing pipeline with the new embedding model.")

if __name__ == "__main__":
    asyncio.run(reset_index())
