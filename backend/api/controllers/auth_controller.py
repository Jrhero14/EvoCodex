"""Auth controller — login endpoint."""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from backend.api import dependencies as deps
from backend.core.config import REDIRECT_URL, BACKEND_URL
from backend.dtos.auth_dto import LoginRequest
from pydantic import BaseModel
from backend.services import auth_service

class RefreshRequest(BaseModel):
    refresh_token: str

router = APIRouter(tags=["Auth"])


@router.post("/login")
async def login(req: LoginRequest):
    try:
        access_token, refresh_token = await auth_service.authenticate(
            req.username, req.password, deps.db_pool
        )
        return {"token": access_token, "refresh_token": refresh_token}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/refresh")
async def refresh(req: RefreshRequest):
    try:
        access_token, refresh_token = await auth_service.refresh_access_token(
            req.refresh_token, deps.db_pool
        )
        return {"token": access_token, "refresh_token": refresh_token}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


import base64

def get_base_url(request: Request, origin: str = None) -> str:
    """Determine the base URL for redirects based on origin or request headers."""
    if origin:
        return origin.rstrip("/")
    # Fallback to headers (useful when proxied by Nginx/DevTunnels)
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{forwarded_proto}://{host}"

@router.get("/oauth/login")
async def oauth_login(request: Request, origin: str = None):
    base_url = get_base_url(request, origin)
    redirect_uri = f"{base_url}/api/oauth/callback"
    
    # Encode origin into state parameter to persist across OAuth flow
    state_payload = ""
    if origin:
        state_payload = base64.urlsafe_b64encode(origin.encode("utf-8")).decode("utf-8")

    try:
        login_url = auth_service.get_oauth_login_url(redirect_uri, state_payload)
        return RedirectResponse(url=login_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/oauth/callback", name="oauth_callback")
async def oauth_callback(request: Request, code: str, state: str = None):
    origin = None
    if state:
        try:
            origin = base64.urlsafe_b64decode(state.encode("utf-8")).decode("utf-8")
        except Exception:
            pass

    base_url = get_base_url(request, origin)
    redirect_uri = f"{base_url}/api/oauth/callback"
    
    try:
        access_token, refresh_token = await auth_service.handle_oauth_callback(code, redirect_uri, deps.db_pool)
        frontend_redirect_url = f"{base_url}/login?token={access_token}&refreshToken={refresh_token}"
        return RedirectResponse(url=frontend_redirect_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/oauth/logout")
async def oauth_logout(request: Request, origin: str = None):
    base_url = get_base_url(request, origin)
    logout_redirect = f"{base_url}/login"
    
    try:
        logout_url = auth_service.get_oauth_logout_url(logout_redirect)
        return RedirectResponse(url=logout_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
