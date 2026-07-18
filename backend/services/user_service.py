"""User service — database operations for users with role support."""

import bcrypt
import asyncpg
from typing import List, Optional
from backend.dtos.user_dto import UserCreateRequest, UserUpdateRequest


async def get_users(db_pool: asyncpg.Pool) -> List[dict]:
    async with db_pool.acquire() as conn:
        records = await conn.fetch(
            """
            SELECT u.id, u.username, u.role_id, r.name AS role_name, u.created_at, u.is_sso
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC
            """
        )
        return [dict(r) for r in records]


async def create_user(req: UserCreateRequest, db_pool: asyncpg.Pool) -> dict:
    hashed_pwd = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    async with db_pool.acquire() as conn:
        # If no role_id provided, default to 'guest'
        role_id = req.role_id
        if role_id is None:
            role_id = await conn.fetchval("SELECT id FROM roles WHERE name = 'guest'")

        try:
            record = await conn.fetchrow(
                """
                INSERT INTO users (username, password_hash, role_id)
                VALUES ($1, $2, $3)
                RETURNING id, username, role_id, created_at
                """,
                req.username,
                hashed_pwd,
                role_id,
            )
            result = dict(record)
            # Fetch role name
            role_name = await conn.fetchval(
                "SELECT name FROM roles WHERE id = $1", result["role_id"]
            )
            result["role_name"] = role_name
            return result
        except asyncpg.UniqueViolationError:
            raise ValueError("Username already exists")


async def update_user(user_id: int, req: UserUpdateRequest, db_pool: asyncpg.Pool) -> Optional[dict]:
    updates = []
    values = []
    idx = 1

    if req.username is not None:
        updates.append(f"username = ${idx}")
        values.append(req.username)
        idx += 1

    if req.password is not None and req.password.strip():
        hashed_pwd = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        updates.append(f"password_hash = ${idx}")
        values.append(hashed_pwd)
        idx += 1

    if req.role_id is not None:
        updates.append(f"role_id = ${idx}")
        values.append(req.role_id)
        idx += 1

    if not updates:
        # No changes requested — just return current data
        async with db_pool.acquire() as conn:
            record = await conn.fetchrow(
                """
                SELECT u.id, u.username, u.role_id, r.name AS role_name, u.created_at, u.is_sso
                FROM users u LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = $1
                """,
                user_id,
            )
            return dict(record) if record else None

    values.append(user_id)
    set_clause = ", ".join(updates)
    query = f"""
        UPDATE users SET {set_clause}
        WHERE id = ${idx}
        RETURNING id, username, role_id, created_at
    """

    async with db_pool.acquire() as conn:
        try:
            record = await conn.fetchrow(query, *values)
            if not record:
                return None
            result = dict(record)
            role_name = await conn.fetchval(
                "SELECT name FROM roles WHERE id = $1", result["role_id"]
            )
            result["role_name"] = role_name
            return result
        except asyncpg.UniqueViolationError:
            raise ValueError("Username already exists")


async def delete_user(user_id: int, db_pool: asyncpg.Pool) -> bool:
    async with db_pool.acquire() as conn:
        result = await conn.execute("DELETE FROM users WHERE id = $1", user_id)
        return result == "DELETE 1"
