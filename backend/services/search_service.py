"""Search service — vector similarity search on code embeddings."""

import asyncpg
from cocoindex.ops.litellm import LiteLLMEmbedder

from backend.core.search import execute_search


async def search_code(
    db_pool: asyncpg.Pool,
    embedder: LiteLLMEmbedder,
    query: str,
    project_name: str | None = None,
    branch: str | None = None,
    top_k: int = 10,
    search_mode: str = "hybrid",
) -> list[dict]:
    """Execute a vector similarity search against code embeddings."""
    return await execute_search(db_pool, embedder, query, project_name, branch, top_k, search_mode)
