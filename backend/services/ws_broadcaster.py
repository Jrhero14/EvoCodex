"""WebSocket manager for broadcasting job status updates to connected clients."""

import asyncio
import json
from typing import Set

from fastapi import WebSocket


class JobBroadcaster:
    """Manages WebSocket connections and broadcasts job status events."""

    def __init__(self):
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._connections.discard(ws)

    async def broadcast(self, event: dict):
        """Send an event to all connected WebSocket clients."""
        message = json.dumps(event)
        async with self._lock:
            stale = set()
            for ws in self._connections:
                try:
                    await ws.send_text(message)
                except Exception:
                    stale.add(ws)
            self._connections -= stale


# Singleton instance used across the application
job_broadcaster = JobBroadcaster()
