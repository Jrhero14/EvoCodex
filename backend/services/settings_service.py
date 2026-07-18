"""Application settings service — manages config stored in database."""

import os
import secrets

import asyncpg

# In-memory cache for config values
_settings_cache: dict[str, str] = {}

# Definition of all settings with their metadata
SETTINGS_DEFINITIONS = [
    {"key": "GITLAB_PAT", "category": "gitlab", "is_sensitive": True, "is_regenerable": False, "description": "GitLab Personal Access Token"},
    {"key": "GITLAB_WEBHOOK_SECRET", "category": "gitlab", "is_sensitive": True, "is_regenerable": True, "description": "GitLab Webhook Secret Token"},
    {"key": "HF_TOKEN", "category": "ai", "is_sensitive": True, "is_regenerable": False, "description": "HuggingFace API Token"},
    {"key": "GOOGLE_CLOUD_PROJECT", "category": "ai", "is_sensitive": False, "is_regenerable": False, "description": "Google Cloud Project ID"},
    {"key": "VERTEX_PROJECT", "category": "ai", "is_sensitive": False, "is_regenerable": False, "description": "Vertex AI Project ID"},
    {"key": "COCOINDEX_EMBEDDING_PROVIDER", "category": "ai", "is_sensitive": False, "is_regenerable": False, "description": "Embedding Provider (vertex or local)"},
    {"key": "JWT_SECRET_KEY", "category": "auth", "is_sensitive": True, "is_regenerable": False, "description": "JWT Signing Secret Key"},
    {"key": "AGENT_API_KEY", "category": "auth", "is_sensitive": True, "is_regenerable": True, "description": "Agent M2M API Key"},
    {"key": "OAUTH_PROVIDER", "category": "oauth", "is_sensitive": False, "is_regenerable": False, "description": "OAuth Provider (e.g. keycloak, google)"},
    {"key": "OAUTH_CLIENT_ID", "category": "oauth", "is_sensitive": False, "is_regenerable": False, "description": "OAuth Client ID"},
    {"key": "OAUTH_CLIENT_SECRET", "category": "oauth", "is_sensitive": True, "is_regenerable": False, "description": "OAuth Client Secret"},
    {"key": "OAUTH_WELL_KNOWN_URL", "category": "oauth", "is_sensitive": False, "is_regenerable": False, "description": "OIDC Well-Known URL (e.g. https://.../.well-known/openid-configuration)"},
    {"key": "OAUTH_DOMAIN", "category": "oauth", "is_sensitive": False, "is_regenerable": False, "description": "OAuth Domain URL (Fallback)"},
    {"key": "OAUTH_REALM", "category": "oauth", "is_sensitive": False, "is_regenerable": False, "description": "OAuth Realm Name (Fallback)"},
    {"key": "ENABLE_OAUTH", "category": "oauth", "is_sensitive": False, "is_regenerable": False, "description": "Enable OAuth SSO Login (true/false)"},
]


async def seed_settings_from_env(pool: asyncpg.Pool) -> None:
    """Seed settings from environment variables if not already in DB."""
    async with pool.acquire() as conn:
        for defn in SETTINGS_DEFINITIONS:
            exists = await conn.fetchval(
                "SELECT 1 FROM app_settings WHERE key = $1", defn["key"]
            )
            if not exists:
                env_value = os.getenv(defn["key"], "")
                await conn.execute(
                    """
                    INSERT INTO app_settings (key, value, category, is_sensitive, is_regenerable, description)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    defn["key"], env_value, defn["category"],
                    defn["is_sensitive"], defn["is_regenerable"], defn["description"],
                )
    await refresh_cache(pool)


async def refresh_cache(pool: asyncpg.Pool) -> None:
    """Reload all settings from DB into in-memory cache."""
    global _settings_cache
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT key, value FROM app_settings")
        _settings_cache = {row["key"]: row["value"] for row in rows}


def get_config(key: str, default: str = "") -> str:
    """Get a config value: cache -> env -> default."""
    val = _settings_cache.get(key)
    if val is not None:
        return val
    return os.getenv(key, default)


async def get_all_settings(pool: asyncpg.Pool) -> list[dict]:
    """Fetch all settings."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT key, value, category, is_sensitive, is_regenerable, description, updated_at "
            "FROM app_settings ORDER BY category, key"
        )
        return [dict(r) for r in rows]


async def update_setting(pool: asyncpg.Pool, key: str, value: str) -> dict:
    """Update a single setting value."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE app_settings SET value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE key = $2 RETURNING key, value, category, is_sensitive, is_regenerable, description, updated_at
            """,
            value, key,
        )
        if not row:
            raise ValueError(f"Setting '{key}' not found")
    await refresh_cache(pool)
    return dict(row)


async def regenerate_secret(pool: asyncpg.Pool, key: str) -> dict:
    """Regenerate a secret value for a regenerable setting."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT is_regenerable FROM app_settings WHERE key = $1", key
        )
        if not row:
            raise ValueError(f"Setting '{key}' not found")
        if not row["is_regenerable"]:
            raise ValueError(f"Setting '{key}' is not regenerable")

        new_value = secrets.token_urlsafe(32)
        updated = await conn.fetchrow(
            """
            UPDATE app_settings SET value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE key = $2 RETURNING key, value, category, is_sensitive, is_regenerable, description, updated_at
            """,
            new_value, key,
        )
    await refresh_cache(pool)
    return dict(updated)
