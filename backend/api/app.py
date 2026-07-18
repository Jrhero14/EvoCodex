"""
FastAPI application entry point.

Initializes the app, database pool, middleware, and includes all controller routers.
"""

from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pgvector.asyncpg import register_vector
from cocoindex.ops.litellm import LiteLLMEmbedder

from backend.api import dependencies as deps
from backend.api.dependencies import check_role_access
from backend.core.config import DATABASE_URL, EMBED_MODEL, JWT_SECRET_KEY
from backend.database.migrations import run_migrations

import jwt as pyjwt

from backend.api.controllers import (
    auth_controller,
    project_controller,
    index_controller,
    search_controller,
    database_controller,
    monitoring_controller,
    template_controller,
    user_controller,
    role_controller,
)


# ── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Initialize DB pool & embedder on startup, close on shutdown."""
    deps.embedder = LiteLLMEmbedder(EMBED_MODEL)
    # Run database migrations FIRST using a temporary connection.
    # This ensures the 'vector' extension exists BEFORE register_vector tries to load it on every pool connection.
    temp_conn = await asyncpg.connect(DATABASE_URL)
    await run_migrations(temp_conn)
    await temp_conn.close()

    deps.db_pool = await asyncpg.create_pool(
        DATABASE_URL,
        init=register_vector,
        min_size=1,
        max_size=5,
        command_timeout=60,
        statement_cache_size=0,  # Required for Supabase transaction pooler
    )

    yield

    await deps.db_pool.close()


# ── App & Middleware ────────────────────────────────────────────────────────

app = FastAPI(
    title="CocoIndex Webhook Service", 
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── RBAC Middleware ────────────────────────────────────────────────────────

# Paths that don't require authentication at all
PUBLIC_PATHS = {"/api/login", "/api/oauth/login", "/api/oauth/callback", "/api/oauth/logout", "/api/docs", "/api/openapi.json"}

@app.middleware("http")
async def rbac_middleware(request: Request, call_next):
    """Enforce role-based access on every API request."""
    path = request.url.path
    method = request.method

    # Skip RBAC for public paths, non-API paths, and WebSocket paths
    if path in PUBLIC_PATHS or not path.startswith("/api") or path.startswith("/api/ws/"):
        return await call_next(request)

    # Extract and verify JWT
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return await call_next(request)  # Let endpoint-level auth handle it

    token = auth_header.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"], options={"verify_aud": False})
    except pyjwt.InvalidTokenError:
        return await call_next(request)  # Let endpoint-level auth handle invalid tokens

    # Check role-based access
    if not check_role_access(payload, method, path):
        return JSONResponse(
            status_code=403,
            content={"detail": f"Access denied for role '{payload.get('role', 'guest')}' on {method} {path}"},
        )

    return await call_next(request)


# ── Router Registration ────────────────────────────────────────────────────

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_controller.router)
api_router.include_router(project_controller.router)
api_router.include_router(template_controller.router)
api_router.include_router(index_controller.router)
api_router.include_router(search_controller.router)
api_router.include_router(database_controller.router)
api_router.include_router(monitoring_controller.router)
api_router.include_router(user_controller.router)
api_router.include_router(role_controller.router)

app.include_router(api_router)


# ── WebSocket Endpoint ─────────────────────────────────────────────────────

from backend.services.ws_broadcaster import job_broadcaster

@app.websocket("/api/ws/jobs")
async def ws_jobs(websocket: WebSocket):
    """WebSocket endpoint for real-time job status updates."""
    await job_broadcaster.connect(websocket)
    try:
        # Keep connection alive; listen for pings/messages
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await job_broadcaster.disconnect(websocket)
    except Exception:
        await job_broadcaster.disconnect(websocket)


# ── Frontend Static Serving ──────────────────────────────────────────────────
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
            
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return JSONResponse(status_code=404, content={"detail": "Frontend not found"})

# ── Dev Server ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.api.app:app", host="0.0.0.0", port=8000, reload=True)
