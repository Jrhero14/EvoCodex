import asyncio
import sys
import asyncpg
from pgvector.asyncpg import register_vector
from cocoindex.ops.litellm import LiteLLMEmbedder

from backend.core.config import DATABASE_URL, EMBED_MODEL, TABLE_NAME, TOP_K, PROJECT_NAME

async def query_once(
    pool: asyncpg.Pool,
    embedder: LiteLLMEmbedder,
    query: str,
    *,
    top_k: int = TOP_K,
    project_name: str | None = None,
) -> None:
    query_vec = await embedder.embed(query)
    async with pool.acquire() as conn:
        if project_name:
            rows = await conn.fetch(
                f"""
                SELECT filename, code, embedding <=> $1 AS distance, start_line, end_line
                FROM "{TABLE_NAME}"
                WHERE project_name = $3
                ORDER BY distance ASC
                LIMIT $2
                """,
                query_vec,
                top_k,
                project_name,
            )
        else:
            rows = await conn.fetch(
                f"""
                SELECT filename, code, embedding <=> $1 AS distance, start_line, end_line
                FROM "{TABLE_NAME}"
                ORDER BY distance ASC
                LIMIT $2
                """,
                query_vec,
                top_k,
            )

    for r in rows:
        score = 1.0 - float(r["distance"])
        print(f"[{score:.3f}] {r['filename']} (L{r['start_line']}-L{r['end_line']})")
        print(f"    {r['code']}")
        print("---")

async def query(initial_query: str | None = None) -> None:
    embedder = LiteLLMEmbedder(EMBED_MODEL)
    async with asyncpg.create_pool(DATABASE_URL, init=register_vector) as pool:
        print(f"--- Querying against project: {PROJECT_NAME} ---")
        if initial_query is not None:
            await query_once(pool, embedder, initial_query, project_name=PROJECT_NAME)
            return

        while True:
            q = input("Enter search query (or Enter to quit): ").strip()
            if not q:
                break
            await query_once(pool, embedder, q, project_name=PROJECT_NAME)

if __name__ == "__main__":
    initial = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None
    asyncio.run(query(initial))
