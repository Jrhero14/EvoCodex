"""Monitoring service — indexing history and database reset."""

import pathlib
import shutil

import asyncpg

from backend.scripts.drop_db import drop


async def get_indexing_history(db_pool: asyncpg.Pool) -> list[dict]:
    """Fetch the last 50 indexing history records."""
    async with db_pool.acquire() as conn:
        records = await conn.fetch(
            """
            SELECT id, project_name, branch, commit_hash, status,
                   error_message, log_output, indexed_at
            FROM indexing_history
            ORDER BY indexed_at DESC
            LIMIT 50
            """
        )

    history = []
    for r in records:
        history.append(
            {
                "id": r["id"],
                "project_name": r["project_name"],
                "branch": r["branch"],
                "commit_hash": (
                    r["commit_hash"][:7] if r["commit_hash"] else None
                ),
                "status": r["status"],
                "error_message": r["error_message"],
                "log_output": r["log_output"],
                "indexed_at": (
                    (r["indexed_at"].isoformat() + "Z") if r["indexed_at"] else None
                ),
            }
        )

    return history


async def reset_database() -> dict:
    """Drop the code_embeddings table and clean local CocoIndex caches."""
    await drop()

    project_root = pathlib.Path(__file__).parent.parent.parent
    db_path = project_root / "cocoindex.db"
    sys_db_path = project_root / ".cocoindex.db"

    if db_path.exists():
        shutil.rmtree(db_path, ignore_errors=True)
    if sys_db_path.exists():
        shutil.rmtree(sys_db_path, ignore_errors=True)

    return {"message": "Database and local states have been completely reset."}
