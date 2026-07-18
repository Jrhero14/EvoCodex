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
    OAUTH_WELL_KNOWN_URL,
    OAUTH_DOMAIN,
    OAUTH_REALM,
    get_config,
)

_oidc_config = None

async def _get_oidc_endpoints():
    global _oidc_config
    if _oidc_config:
        return _oidc_config

    well_known_url = get_config("OAUTH_WELL_KNOWN_URL", OAUTH_WELL_KNOWN_URL or "")
    if well_known_url:
        async with httpx.AsyncClient() as client:
            res = await client.get(well_known_url)
            if res.status_code == 200:
                _oidc_config = res.json()
                return _oidc_config
            raise ValueError(f"Failed to fetch OIDC configuration from {well_known_url}")

    # Fallback to Keycloak logic if domain/realm are provided
    domain = get_config("OAUTH_DOMAIN", OAUTH_DOMAIN or "")
    realm = get_config("OAUTH_REALM", OAUTH_REALM or "")
    if domain and realm:
        base = f"{domain}/realms/{realm}/protocol/openid-connect"
        _oidc_config = {
            "authorization_endpoint": f"{base}/auth",
            "token_endpoint": f"{base}/token",
            "userinfo_endpoint": f"{base}/userinfo",
            "end_session_endpoint": f"{base}/logout",
        }
        return _oidc_config

    raise ValueError("OAuth is not properly configured. Provide OAUTH_WELL_KNOWN_URL or OAUTH_DOMAIN and OAUTH_REALM.")


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
    access_token = jwt.encode(access_token_payload, get_config("JWT_SECRET_KEY", JWT_SECRET_KEY), algorithm="HS256")
    refresh_token = jwt.encode(refresh_token_payload, get_config("JWT_SECRET_KEY", JWT_SECRET_KEY), algorithm="HS256")
    return access_token, refresh_token

async def get_oauth_login_url(redirect_uri: str, state_payload: str = None) -> str:
    """Return the OAuth login URL for the configured provider."""
    endpoints = await _get_oidc_endpoints()
    client_id = get_config("OAUTH_CLIENT_ID", OAUTH_CLIENT_ID or "")
    auth_endpoint = endpoints.get("authorization_endpoint")
    if not auth_endpoint:
        raise ValueError("Missing authorization_endpoint in OIDC config")
        
    url = f"{auth_endpoint}?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=openid profile email"
    if state_payload:
        url += f"&state={state_payload}"
    return url

async def get_oauth_logout_url(post_logout_redirect_uri: str) -> str:
    """Return the OAuth logout URL for the configured provider."""
    endpoints = await _get_oidc_endpoints()
    client_id = get_config("OAUTH_CLIENT_ID", OAUTH_CLIENT_ID or "")
    logout_endpoint = endpoints.get("end_session_endpoint")
    if not logout_endpoint:
        # Fallback if provider doesn't support end_session_endpoint
        return post_logout_redirect_uri
    return f"{logout_endpoint}?client_id={client_id}&post_logout_redirect_uri={post_logout_redirect_uri}"

async def handle_oauth_callback(code: str, redirect_uri: str, db_pool: asyncpg.Pool) -> str:
    """Exchange code for token, fetch user info, and return local JWT."""
    endpoints = await _get_oidc_endpoints()
    
    client_id = get_config("OAUTH_CLIENT_ID", OAUTH_CLIENT_ID or "")
    client_secret = get_config("OAUTH_CLIENT_SECRET", OAUTH_CLIENT_SECRET or "")
    
    token_url = endpoints.get("token_endpoint")
    if not token_url:
        raise ValueError("Missing token_endpoint in OIDC config")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(token_url, data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri
        })
        if token_res.status_code != 200:
            raise ValueError(f"Failed to fetch token from provider: {token_res.text}")

        access_token = token_res.json()["access_token"]

        userinfo_url = endpoints.get("userinfo_endpoint")
        if not userinfo_url:
            raise ValueError("Missing userinfo_endpoint in OIDC config")
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
    access_token = jwt.encode(access_token_payload, get_config("JWT_SECRET_KEY", JWT_SECRET_KEY), algorithm="HS256")
    refresh_token = jwt.encode(refresh_token_payload, get_config("JWT_SECRET_KEY", JWT_SECRET_KEY), algorithm="HS256")
    return access_token, refresh_token

async def refresh_access_token(refresh_token: str, db_pool: asyncpg.Pool) -> tuple[str, str]:
    """Verify refresh token and issue a new pair of access and refresh tokens."""
    try:
        payload = jwt.decode(refresh_token, get_config("JWT_SECRET_KEY", JWT_SECRET_KEY), algorithms=["HS256"])
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
    new_access_token = jwt.encode(access_token_payload, get_config("JWT_SECRET_KEY", JWT_SECRET_KEY), algorithm="HS256")
    new_refresh_token = jwt.encode(refresh_token_payload, get_config("JWT_SECRET_KEY", JWT_SECRET_KEY), algorithm="HS256")
    
    return new_access_token, new_refresh_token
