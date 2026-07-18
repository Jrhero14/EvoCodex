"""Shared application state and FastAPI dependencies."""

import asyncpg
from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from backend.core.config import JWT_SECRET_KEY, AGENT_API_KEY
from cocoindex.ops.litellm import LiteLLMEmbedder

# ── Shared State (set during app lifespan) ──────────────────────────────────

db_pool: asyncpg.Pool = None
embedder: LiteLLMEmbedder = None

# ── Security ────────────────────────────────────────────────────────────────

security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Decode and verify JWT token from Authorization header."""
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def verify_agent_api_key(x_api_key: str = Header(..., description="Secret API Key for Agent")):
    """Verify static API key for M2M agent access."""
    if not x_api_key or x_api_key != AGENT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return True


# ── Role-based access guards ───────────────────────────────────────────────

# Permission map: role -> set of allowed operations
# Operations are defined as "method:prefix" patterns
ROLE_PERMISSIONS = {
    "admin": "*",  # full access
    "maintener": {
        # Can do everything EXCEPT access /users and /roles endpoints
        "deny": {"/users", "/roles"},
    },
    "guest": {
        # Can only GET (view) on specific endpoints
        "allow_read": {"/search", "/database", "/projects", "/monitoring", "/login", "/oauth"},
    },
}


def require_role(*allowed_roles: str):
    """
    FastAPI dependency that checks if the authenticated user has one of the allowed roles.
    Usage: Depends(require_role("admin", "maintener"))
    """
    def _guard(payload: dict = Depends(verify_token)):
        role = payload.get("role", "guest")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}. Your role: {role}",
            )
        return payload
    return _guard


def check_role_access(payload: dict, method: str, path: str) -> bool:
    """Check if a user's role grants access to a specific method+path."""
    role = payload.get("role", "guest")
    perms = ROLE_PERMISSIONS.get(role)

    if perms is None:
        return False

    # Admin has full access
    if perms == "*":
        return True

    # Maintener: deny specific endpoint prefixes
    if "deny" in perms:
        for denied_prefix in perms["deny"]:
            if path.startswith(f"/api{denied_prefix}"):
                return False
        return True

    # Guest: allow only GET on specific endpoints
    if "allow_read" in perms:
        if method.upper() != "GET":
            return False
        for allowed_prefix in perms["allow_read"]:
            if path.startswith(f"/api{allowed_prefix}"):
                return True
        return False

    return False
