"""Database service — query the code_embeddings table for the UI."""

import asyncpg


async def get_code_embeddings(
    db_pool: asyncpg.Pool,
    limit: int = 100,
    offset: int = 0,
    project_name: str | None = None,
    branch: str | None = None,
) -> tuple[list[dict], int]:
    """
    Fetch paginated code embeddings with optional project/branch filter.

    Returns (data_list, total_count).
    """
    async with db_pool.acquire() as conn:
        try:
            total_count = 0
            if project_name and branch:
                total_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM code_embeddings "
                    "WHERE project_name = $1 AND branch = $2",
                    project_name,
                    branch,
                )
                records = await conn.fetch(
                    """
                    SELECT id::text, project_name, branch, filename, code,
                           embedding::text as embedding_str, start_line, end_line
                    FROM code_embeddings
                    WHERE project_name = $1 AND branch = $2
                    ORDER BY id ASC
                    LIMIT $3 OFFSET $4
                    """,
                    project_name,
                    branch,
                    limit,
                    offset,
                )
            else:
                total_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM code_embeddings"
                )
                records = await conn.fetch(
                    """
                    SELECT id::text, project_name, branch, filename, code,
                           embedding::text as embedding_str, start_line, end_line
                    FROM code_embeddings
                    ORDER BY id ASC
                    LIMIT $1 OFFSET $2
                    """,
                    limit,
                    offset,
                )
        except Exception:
            # Table doesn't exist yet
            return [], 0

    data = []
    for r in records:
        # Truncate embedding string for UI performance
        emb_str = r["embedding_str"]
        if emb_str and len(emb_str) > 50:
            parts = emb_str.split(",")
            if len(parts) > 2:
                emb_str = parts[0] + "," + parts[1] + "...]"

        data.append(
            {
                "id": r["id"],
                "project_name": r["project_name"],
                "branch": r["branch"],
                "filename": r["filename"],
                "code": (
                    r["code"][:100] + "..."
                    if r["code"] and len(r["code"]) > 100
                    else r["code"]
                ),
                "embedding": emb_str,
                "start_line": r["start_line"],
                "end_line": r["end_line"],
            }
        )

    return data, total_count


async def get_code_embedding_by_id(
    db_pool: asyncpg.Pool, row_id: str
) -> dict | None:
    """Fetch a single code embedding row by its ID."""
    async with db_pool.acquire() as conn:
        try:
            record = await conn.fetchrow(
                """
                SELECT id::text, project_name, branch, filename, code,
                       embedding::text as embedding_str, start_line, end_line
                FROM code_embeddings
                WHERE id = $1
                """,
                str(row_id),
            )
        except Exception:
            return None

    if not record:
        return None

    emb_str = record["embedding_str"]
    if emb_str and len(emb_str) > 50:
        parts = emb_str.split(",")
        if len(parts) > 2:
            emb_str = parts[0] + "," + parts[1] + "...]"

    return {
        "id": record["id"],
        "project_name": record["project_name"],
        "branch": record["branch"],
        "filename": record["filename"],
        "code": record["code"],
        "embedding": emb_str,
        "start_line": record["start_line"],
        "end_line": record["end_line"],
    }
