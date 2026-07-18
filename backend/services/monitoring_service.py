"""Monitoring service — indexing history and database reset."""

import pathlib
import shutil

import json
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


async def get_webhook_logs(db_pool: asyncpg.Pool, limit: int = 50, offset: int = 0) -> list[dict]:
    async with db_pool.acquire() as conn:
        records = await conn.fetch(
            """
            SELECT id, request_ip, headers, payload, status_code, response, created_at
            FROM webhook_logs
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset
        )
        
        # Get total count
        count_record = await conn.fetchrow("SELECT COUNT(*) as total FROM webhook_logs")
        total = count_record["total"] if count_record else 0

    logs = []
    for r in records:
        logs.append(
            {
                "id": r["id"],
                "request_ip": r["request_ip"],
                "headers": json.loads(r["headers"]) if r["headers"] else {},
                "payload": json.loads(r["payload"]) if r["payload"] else None,
                "status_code": r["status_code"],
                "response": json.loads(r["response"]) if r["response"] else {},
                "created_at": (
                    (r["created_at"].isoformat() + "Z") if r["created_at"] else None
                ),
            }
        )
    return {"logs": logs, "total": total}


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
