"""Authentication service — login and JWT token management."""

import datetime

import asyncpg
import bcrypt
import httpx
import jwt
import secrets

from backend.core.config import (
    JWT_SECRET_KEY,
    OAUTH_PROVIDER,
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_DOMAIN,
    OAUTH_REALM
)


async def _get_user_role(conn: asyncpg.Connection, username: str) -> str:
    """Fetch the role name for a given username."""
    role_name = await conn.fetchval(
        """
        SELECT r.name FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.username = $1
        """,
        username,
    )
    return role_name or "guest"


async def authenticate(username: str, password: str, db_pool: asyncpg.Pool) -> str:
    """
    Verify credentials and return a signed JWT token.

    Raises ValueError if credentials are invalid.
    """
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(
            "SELECT id, password_hash FROM users WHERE username = $1", username
        )

        if not record or not bcrypt.checkpw(
            password.encode("utf-8"), record["password_hash"].encode("utf-8")
        ):
            raise ValueError("Invalid username or password")

        role = await _get_user_role(conn, username)

    access_token_payload = {
        "sub": username,
        "role": role,
        "type": "access",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    }
    refresh_token_payload = {
        "sub": username,
        "type": "refresh",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    access_token = jwt.encode(access_token_payload, JWT_SECRET_KEY, algorithm="HS256")
    refresh_token = jwt.encode(refresh_token_payload, JWT_SECRET_KEY, algorithm="HS256")
    return access_token, refresh_token

def get_oauth_login_url(redirect_uri: str, state_payload: str = None) -> str:
    """Return the OAuth login URL for the configured provider."""
    if OAUTH_PROVIDER == "keycloak":
        url = f"{OAUTH_DOMAIN}/realms/{OAUTH_REALM}/protocol/openid-connect/auth?client_id={OAUTH_CLIENT_ID}&redirect_uri={redirect_uri}&response_type=code&scope=openid profile email"
        if state_payload:
            url += f"&state={state_payload}"
        return url
    raise ValueError(f"Unsupported OAuth provider: {OAUTH_PROVIDER}")

def get_oauth_logout_url(post_logout_redirect_uri: str) -> str:
    """Return the OAuth logout URL for the configured provider."""
    if OAUTH_PROVIDER == "keycloak":
        return f"{OAUTH_DOMAIN}/realms/{OAUTH_REALM}/protocol/openid-connect/logout?client_id={OAUTH_CLIENT_ID}&post_logout_redirect_uri={post_logout_redirect_uri}"
    raise ValueError(f"Unsupported OAuth provider: {OAUTH_PROVIDER}")

async def handle_oauth_callback(code: str, redirect_uri: str, db_pool: asyncpg.Pool) -> str:
    """Exchange code for token, fetch user info, and return local JWT."""
    if OAUTH_PROVIDER != "keycloak":
        raise ValueError(f"Unsupported OAuth provider: {OAUTH_PROVIDER}")

    token_url = f"{OAUTH_DOMAIN}/realms/{OAUTH_REALM}/protocol/openid-connect/token"

    async with httpx.AsyncClient() as client:
        token_res = await client.post(token_url, data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": OAUTH_CLIENT_ID,
            "client_secret": OAUTH_CLIENT_SECRET,
            "redirect_uri": redirect_uri
        })
        if token_res.status_code != 200:
            raise ValueError(f"Failed to fetch token from provider: {token_res.text}")

        access_token = token_res.json()["access_token"]

        userinfo_url = f"{OAUTH_DOMAIN}/realms/{OAUTH_REALM}/protocol/openid-connect/userinfo"
        userinfo_res = await client.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
        if userinfo_res.status_code != 200:
            raise ValueError("Failed to fetch user info from provider")

        userinfo = userinfo_res.json()
        username = userinfo.get("preferred_username") or userinfo.get("email") or userinfo.get("sub")

    # Check if user exists, else create with guest role
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow("SELECT id FROM users WHERE username = $1", username)
        if not record:
            # Create user with guest role
            guest_role_id = await conn.fetchval("SELECT id FROM roles WHERE name = 'guest'")
            random_password = secrets.token_urlsafe(32)
            hashed_pw = bcrypt.hashpw(random_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            await conn.execute(
                "INSERT INTO users (username, password_hash, role_id, is_sso) VALUES ($1, $2, $3, $4)",
                username, hashed_pw, guest_role_id, True
            )

        role = await _get_user_role(conn, username)

    # Generate local JWT token
    access_token_payload = {
        "sub": username,
        "role": role,
        "type": "access",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    }
    refresh_token_payload = {
        "sub": username,
        "type": "refresh",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    access_token = jwt.encode(access_token_payload, JWT_SECRET_KEY, algorithm="HS256")
    refresh_token = jwt.encode(refresh_token_payload, JWT_SECRET_KEY, algorithm="HS256")
    return access_token, refresh_token

async def refresh_access_token(refresh_token: str, db_pool: asyncpg.Pool) -> tuple[str, str]:
    """Verify refresh token and issue a new pair of access and refresh tokens."""
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("Refresh token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise ValueError("Token is not a refresh token")

    username = payload.get("sub")
    if not username:
        raise ValueError("Invalid token payload")

    async with db_pool.acquire() as conn:
        role = await _get_user_role(conn, username)

    access_token_payload = {
        "sub": username,
        "role": role,
        "type": "access",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    }
    refresh_token_payload = {
        "sub": username,
        "type": "refresh",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    new_access_token = jwt.encode(access_token_payload, JWT_SECRET_KEY, algorithm="HS256")
    new_refresh_token = jwt.encode(refresh_token_payload, JWT_SECRET_KEY, algorithm="HS256")
    
    return new_access_token, new_refresh_token
