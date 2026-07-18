import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

from backend.api.app import app

if __name__ == "__main__":
    host = os.getenv("SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("SERVER_PORT", "8000"))
    print(f"Starting Webhook Service on {host}:{port}...")
    uvicorn.run("backend.api.app:app", host=host, port=port, reload=True)
