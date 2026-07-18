import os
import pathlib
from dotenv import load_dotenv
from pgvector.asyncpg import register_vector

load_dotenv()

def get_config(key: str, default: str = "") -> str:
    """Get config from DB cache (via settings_service) -> env -> default."""
    from backend.services.settings_service import get_config as _get_config
    return _get_config(key, default)

SOURCE_PATH = pathlib.Path(
    os.getenv("COCOINDEX_SOURCE_PATH", str(pathlib.Path(__file__).parent.parent.parent))
)
PROJECT_NAME = os.getenv("COCOINDEX_PROJECT_NAME", "default")
BRANCH_NAME = os.getenv("COCOINDEX_BRANCH_NAME", "main")
TABLE_NAME = "code_embeddings"
TOP_K = 10

# Database
DATABASE_URL = os.getenv(
    "POSTGRES_URL", "postgres://cocoindex:cocoindex@localhost/cocoindex"
)

# LLM setup for Vertex AI Embedding
# https://docs.litellm.ai/docs/embedding/supported_embedding
os.environ["LITELLM_LOG"] = "INFO" 

EMBEDDING_PROVIDER = os.getenv("COCOINDEX_EMBEDDING_PROVIDER", "vertex") # 'vertex' or 'local'
EMBED_MODEL = "vertex_ai/text-embedding-004"
LOCAL_EMBED_MODEL = os.getenv("COCOINDEX_LOCAL_EMBED_MODEL", "sentence-transformers/all-mpnet-base-v2")

# Gitlab PAT
GITLAB_PAT = os.getenv("GITLAB_PAT", "")
GITLAB_WEBHOOK_SECRET = os.getenv("GITLAB_WEBHOOK_SECRET", "")

AGENT_API_KEY = os.getenv("AGENT_API_KEY", "default_agent_secret_key")

COCOINDEX_CMD = os.getenv("COCOINDEX_CMD", ".venv/bin/cocoindex")

# Auth Configs
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key-for-local-dev-only")
OAUTH_PROVIDER = os.getenv("OAUTH_PROVIDER")
OAUTH_CLIENT_ID = os.getenv("OAUTH_CLIENT_ID")
OAUTH_CLIENT_SECRET = os.getenv("OAUTH_CLIENT_SECRET")
OAUTH_WELL_KNOWN_URL = os.getenv("OAUTH_WELL_KNOWN_URL")
OAUTH_DOMAIN = os.getenv("OAUTH_DOMAIN")
OAUTH_REALM = os.getenv("OAUTH_REALM")
REDIRECT_URL = os.getenv("REDIRECT_URL", "http://localhost:5173/login")
BACKEND_URL = os.getenv("BACKEND_URL")
