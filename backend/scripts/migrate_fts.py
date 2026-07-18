import asyncio
import asyncpg
import sys
import os
import pathlib

# Add project root to sys.path
sys.path.append(str(pathlib.Path(__file__).parent.parent.parent))
from backend.core.config import DATABASE_URL, TABLE_NAME

async def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    pool = await asyncpg.create_pool(DATABASE_URL)
    
    async with pool.acquire() as conn:
        print("Adding fts_vector column to code_embeddings...")
        await conn.execute(f"""
            ALTER TABLE "{TABLE_NAME}"
            ADD COLUMN IF NOT EXISTS fts_vector tsvector 
            GENERATED ALWAYS AS (to_tsvector('english', code)) STORED;
        """)
        
        print("Creating GIN index on fts_vector...")
        await conn.execute(f"""
            CREATE INDEX IF NOT EXISTS {TABLE_NAME}_fts_idx 
            ON "{TABLE_NAME}" USING GIN (fts_vector);
        """)
        
        print("Migration successful!")

if __name__ == "__main__":
    asyncio.run(migrate())
