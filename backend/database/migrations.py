"""Database schema migrations — run once during application startup."""

import asyncpg
import bcrypt


async def run_migrations(conn: asyncpg.Connection) -> None:
    """Create all required tables and apply schema migrations."""

    # ── Extensions ──────────────────────────────────────────────────────────
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # ── indexing_history ────────────────────────────────────────────────────
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS indexing_history (
            id SERIAL PRIMARY KEY,
            project_name TEXT NOT NULL,
            branch TEXT NOT NULL,
            commit_hash TEXT,
            status TEXT NOT NULL,
            error_message TEXT,
            log_output TEXT,
            indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await conn.execute(
        "ALTER TABLE indexing_history ADD COLUMN IF NOT EXISTS log_output TEXT;"
    )

    # ── code_embeddings ─────────────────────────────────────────────────────
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS code_embeddings (
            id VARCHAR(36) PRIMARY KEY,
            project_name TEXT NOT NULL,
            branch TEXT NOT NULL,
            filename TEXT NOT NULL,
            code TEXT NOT NULL,
            embedding VECTOR(768),
            start_line BIGINT NOT NULL,
            end_line BIGINT NOT NULL
        )
    """)
    
    # Add fts_vector column if missing
    await conn.execute("""
        ALTER TABLE code_embeddings
        ADD COLUMN IF NOT EXISTS fts_vector tsvector 
        GENERATED ALWAYS AS (to_tsvector('english', code)) STORED;
    """)
    
    # Create GIN index for fts_vector
    await conn.execute("""
        CREATE INDEX IF NOT EXISTS code_embeddings_fts_idx 
        ON code_embeddings USING GIN (fts_vector);
    """)

    # Migrate id column to VARCHAR if it was previously BIGINT
    try:
        await conn.execute(
            "ALTER TABLE code_embeddings ALTER COLUMN id TYPE VARCHAR(36);"
        )
    except Exception:
        pass

    # ── roles ───────────────────────────────────────────────────────────────
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Seed default roles
    default_roles = [
        ("admin", "Full access to all menus and operations"),
        ("maintener", "Can create, edit, delete — but no access to Users menu"),
        ("guest", "View-only access to Query, Database, and Projects"),
    ]
    for role_name, role_desc in default_roles:
        await conn.execute(
            """
            INSERT INTO roles (name, description) VALUES ($1, $2)
            ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
            """,
            role_name,
            role_desc,
        )

    # ── users ───────────────────────────────────────────────────────────────
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_sso BOOLEAN DEFAULT FALSE
        )
    """)

    # Add role_id and is_sso columns if missing
    await conn.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);"
    )
    await conn.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sso BOOLEAN DEFAULT FALSE;"
    )

    # Set default role_id to 'guest' for any users that don't have a role yet
    guest_role_id = await conn.fetchval("SELECT id FROM roles WHERE name = 'guest'")
    if guest_role_id:
        await conn.execute(
            "UPDATE users SET role_id = $1 WHERE role_id IS NULL", guest_role_id
        )

    # Seed default admin user
    admin_role_id = await conn.fetchval("SELECT id FROM roles WHERE name = 'admin'")
    admin_exists = await conn.fetchval(
        "SELECT id FROM users WHERE username = 'admin'"
    )
    if not admin_exists:
        hashed_pwd = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
        await conn.execute(
            "INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3)",
            "admin",
            hashed_pwd,
            admin_role_id,
        )
    else:
        # Ensure existing admin user has admin role
        if admin_role_id:
            await conn.execute(
                "UPDATE users SET role_id = $1 WHERE username = 'admin'", admin_role_id
            )

    # ── projects ────────────────────────────────────────────────────────────
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            project_id VARCHAR(50) NOT NULL,
            project_name VARCHAR(255) NOT NULL,
            path VARCHAR(255) NOT NULL,
            namespace VARCHAR(255) NOT NULL,
            path_with_namespace VARCHAR(255) NOT NULL,
            gitlab_url VARCHAR(255) NOT NULL,
            repository_url VARCHAR(255) NOT NULL,
            default_branch VARCHAR(100) NOT NULL,
            current_branch VARCHAR(100),
            last_activity_at TIMESTAMP,
            commit_sha VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, current_branch)
        )
    """)

    # Ensure updated_at exists if table was already created without it
    await conn.execute(
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
    )

    # Ensure pattern columns exist
    await conn.execute(
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS included_patterns TEXT DEFAULT '**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.sass,**/*.html';"
    )
    await conn.execute(
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS excluded_patterns TEXT DEFAULT '**/.*,**/*.md,**/target,**/node_modules,**/scripts,**/internal,**/tests';"
    )

    # Migrate old unique constraint if exists
    try:
        await conn.execute(
            "ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_id_key;"
        )
    except Exception:
        pass

    try:
        await conn.execute(
            "ALTER TABLE projects ADD CONSTRAINT projects_project_id_current_branch_key "
            "UNIQUE (project_id, current_branch);"
        )
    except Exception:
        pass

    # ── project_templates ───────────────────────────────────────────────────
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS project_templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            template_code VARCHAR(50) UNIQUE,
            included_patterns TEXT,
            excluded_patterns TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    await conn.execute(
        "ALTER TABLE project_templates ADD COLUMN IF NOT EXISTS template_code VARCHAR(50) UNIQUE;"
    )

    # Seed default React JS template
    default_included = "**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.sass,**/*.html"
    default_excluded = "**/.*,**/*.md,**/target,**/node_modules,**/scripts,**/internal,**/tests"
    
    await conn.execute(
        """
        INSERT INTO project_templates (name, template_code, included_patterns, excluded_patterns) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE 
        SET template_code = EXCLUDED.template_code,
            included_patterns = EXCLUDED.included_patterns,
            excluded_patterns = EXCLUDED.excluded_patterns
        """,
        "React JS Template",
        "react-js",
        default_included,
        default_excluded,
    )
