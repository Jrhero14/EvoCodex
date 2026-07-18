"""Service layer for managing project templates."""

import asyncpg

from backend.dtos.template_dto import TemplateCreate, TemplateUpdate


async def get_all_templates(db_pool: asyncpg.Pool) -> list[dict]:
    async with db_pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM project_templates ORDER BY created_at ASC")
        return [dict(r) for r in records]


async def create_template(db_pool: asyncpg.Pool, data: TemplateCreate) -> dict:
    if " " in data.template_code:
        raise ValueError("template_code cannot contain spaces.")
    async with db_pool.acquire() as conn:
        try:
            record = await conn.fetchrow(
                """
                INSERT INTO project_templates (name, template_code, included_patterns, excluded_patterns)
                VALUES ($1, $2, $3, $4)
                RETURNING *
                """,
                data.name,
                data.template_code,
                data.included_patterns,
                data.excluded_patterns,
            )
            return dict(record)
        except asyncpg.UniqueViolationError:
            raise ValueError(f"Template with name '{data.name}' already exists.")


async def update_template(db_pool: asyncpg.Pool, template_id: int, data: TemplateUpdate) -> dict:
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow("SELECT * FROM project_templates WHERE id = $1", template_id)
        if not record:
            raise ValueError(f"Template with ID {template_id} not found.")

        name = data.name if data.name is not None else record["name"]
        template_code = data.template_code if data.template_code is not None else record["template_code"]
        included = data.included_patterns if data.included_patterns is not None else record["included_patterns"]
        excluded = data.excluded_patterns if data.excluded_patterns is not None else record["excluded_patterns"]
        
        if template_code and " " in template_code:
            raise ValueError("template_code cannot contain spaces.")

        try:
            updated_record = await conn.fetchrow(
                """
                UPDATE project_templates
                SET name = $1, template_code = $2, included_patterns = $3, excluded_patterns = $4
                WHERE id = $5
                RETURNING *
                """,
                name,
                template_code,
                included,
                excluded,
                template_id,
            )
            return dict(updated_record)
        except asyncpg.UniqueViolationError:
            raise ValueError(f"Template with name '{name}' already exists.")


async def delete_template(db_pool: asyncpg.Pool, template_id: int) -> None:
    async with db_pool.acquire() as conn:
        result = await conn.execute("DELETE FROM project_templates WHERE id = $1", template_id)
        if result == "DELETE 0":
            raise ValueError(f"Template with ID {template_id} not found.")
