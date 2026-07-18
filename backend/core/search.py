import re
import asyncpg
from pgvector.asyncpg import register_vector
from typing import Any

from backend.core.config import DATABASE_URL, EMBED_MODEL, TABLE_NAME, TOP_K

async def execute_search(
    pool: asyncpg.Pool,
    embedder: Any,
    query_text: str, 
    project_name: str | None = None, 
    branch: str | None = None, 
    top_k: int = TOP_K,
    search_mode: str = "hybrid"
) -> list[dict]:
    query_vec = await embedder.embed(query_text)
    
    # Convert natural language query to an OR-based tsquery string
    words = [w for w in re.findall(r'\w+', query_text) if not w.isnumeric()]
    fts_query = ' | '.join(words) if words else "''"

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Force exact search (seq scan) for 100% recall.
            # ANN indexes (HNSW/IVFFlat) often return incomplete results when combined
            # with pre-filters (WHERE project = ...) or on small datasets.
            await conn.execute("SET LOCAL enable_indexscan = off;")
            
            # Check if table exists to avoid errors on empty db
            table_exists = await conn.fetchval(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
                TABLE_NAME
            )
            if not table_exists:
                return []

            def get_order_clause(fts_param_index: int) -> str:
                if search_mode == "vector":
                    return "(1.0 - (embedding <=> $1)) DESC"
                elif search_mode == "fts":
                    return f"ts_rank_cd(fts_vector, to_tsquery('english', ${fts_param_index})) DESC"
                else:
                    return f"((1.0 - (embedding <=> $1)) * 0.7) + (ts_rank_cd(fts_vector, to_tsquery('english', ${fts_param_index})) * 0.5) DESC"

            if project_name and branch:
                rows = await conn.fetch(
                    f"""
                    SELECT 
                        filename, 
                        code, 
                        start_line, 
                        end_line,
                        (1.0 - (embedding <=> $1)) AS vector_score,
                        ts_rank_cd(fts_vector, to_tsquery('english', $5)) AS fts_score
                    FROM "{TABLE_NAME}"
                    WHERE project_name = $3 AND branch = $4
                    ORDER BY {get_order_clause(5)}
                    LIMIT $2
                    """,
                    query_vec,
                    top_k,
                    project_name,
                    branch,
                    fts_query,
                )
            elif project_name:
                rows = await conn.fetch(
                    f"""
                    SELECT 
                        filename, 
                        code, 
                        start_line, 
                        end_line,
                        (1.0 - (embedding <=> $1)) AS vector_score,
                        ts_rank_cd(fts_vector, to_tsquery('english', $4)) AS fts_score
                    FROM "{TABLE_NAME}"
                    WHERE project_name = $3
                    ORDER BY {get_order_clause(4)}
                    LIMIT $2
                    """,
                    query_vec,
                    top_k,
                    project_name,
                    fts_query,
                )
            else:
                rows = await conn.fetch(
                    f"""
                    SELECT 
                        filename, 
                        code, 
                        start_line, 
                        end_line,
                        (1.0 - (embedding <=> $1)) AS vector_score,
                        ts_rank_cd(fts_vector, to_tsquery('english', $3)) AS fts_score
                    FROM "{TABLE_NAME}"
                    ORDER BY {get_order_clause(3)}
                    LIMIT $2
                    """,
                    query_vec,
                    top_k,
                    fts_query,
                )

    def calc_score(r):
        v = float(r["vector_score"])
        f = float(r["fts_score"])
        if search_mode == "vector": return v
        if search_mode == "fts": return f
        return v * 0.7 + f * 0.5

    return [
        {
            "filename": r["filename"],
            "code": r["code"],
            "score": calc_score(r),
            "vector_score": float(r["vector_score"]),
            "fts_score": float(r["fts_score"]),
            "start_line": r["start_line"],
            "end_line": r["end_line"],
        }
        for r in rows
    ]
