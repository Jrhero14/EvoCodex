"""Role service — database operations for roles."""

import asyncpg
from typing import List


async def get_roles(db_pool: asyncpg.Pool) -> List[dict]:
    """Return all roles ordered by id."""
    async with db_pool.acquire() as conn:
        records = await conn.fetch(
            "SELECT id, name, description, created_at FROM roles ORDER BY id"
        )
        return [dict(r) for r in records]


async def get_role_by_name(role_name: str, db_pool: asyncpg.Pool) -> dict | None:
    """Return a single role by name."""
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(
            "SELECT id, name, description, created_at FROM roles WHERE name = $1",
            role_name,
        )
        return dict(record) if record else None
