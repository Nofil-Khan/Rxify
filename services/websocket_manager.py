"""Dispensary Live WebSocket Connection Manager.

=============================================================================
WHY WE USE WEBSOCKETS INSTEAD OF HTTP POLLING:
=============================================================================
1. Zero Wasted Database Queries:
   With HTTP polling, client browsers execute 'GET /queue' every 5–30 seconds.
   If 1,000 pharmacies keep their dashboard open, that creates 100 to 200 SQL queries
   per second just asking "anything new?", even when 99% of responses are identical.
   With WebSockets, the connection sits completely idle (0 DB queries) until an
   actual event occurs.

2. Sub-50 Millisecond Latency:
   The exact millisecond a patient places an order or a doctor issues a prescription,
   the backend broadcasts a lightweight event:
     {"type": "QUEUE_UPDATED", "request_id": 1042, "status": "PENDING"}
   The pharmacy screen updates instantly without waiting for a 30-second timer.

3. Multi-Tab Synchronisation:
   If a pharmacist has two tabs open or multiple dispensing stations active, any
   status update (e.g., "Mark Ready") is broadcast to all tabs of that dispensary.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, Dict, Optional, Set

import jwt
from fastapi import WebSocket, WebSocketDisconnect

from core.config import ALGORITHM, SECRET_KEY

logger = logging.getLogger("dispensary.websocket")


class DispensaryConnectionManager:
    """Manages active WebSocket connections grouped by dispensary_id with cross-worker sync."""

    def __init__(self) -> None:
        # Maps dispensary_id -> Set of active WebSocket instances
        self._active_connections: Dict[int, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._pg_listener_started = False

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Store reference to running event loop and spawn background multi-worker listener."""
        self._loop = loop
        if not self._pg_listener_started:
            self._pg_listener_started = True
            self._start_pg_listener()

    def _start_pg_listener(self) -> None:
        """Spawn background listener thread for cross-worker events via PostgreSQL LISTEN/NOTIFY."""
        import threading
        t = threading.Thread(target=self._pg_listener_worker, daemon=True, name="rxify-pg-ws-listener")
        t.start()

    def _pg_listener_worker(self) -> None:
        """Worker thread listening on rxify_dispensary_events channel."""
        import select
        try:
            from database.db import get_pool
            pool = get_pool()
            conn = pool.getconn()
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("LISTEN rxify_dispensary_events;")
            while True:
                if select.select([conn], [], [], 5) == ([], [], []):
                    pass
                else:
                    conn.poll()
                    while conn.notifies:
                        notify = conn.notifies.pop(0)
                        try:
                            data = json.loads(notify.payload)
                            disp_id = data.get("dispensary_id")
                            body = data.get("payload")
                            if disp_id and body and self._loop and self._loop.is_running():
                                asyncio.run_coroutine_threadsafe(
                                    self.broadcast_to_dispensary(disp_id, body),
                                    self._loop,
                                )
                        except Exception as e:
                            logger.debug(f"[WS] Failed parsing notify payload: {e}")
        except Exception as exc:
            logger.debug(f"[WS] PG listener inactive (standalone/mock mode): {exc}")

    async def connect(self, websocket: WebSocket, dispensary_id: int) -> None:
        """Accept incoming WebSocket and register it under the dispensary tenant."""
        await websocket.accept()
        async with self._lock:
            self._active_connections[dispensary_id].add(websocket)
            logger.info(
                f"[WS] Dispensary #{dispensary_id} connected. "
                f"Active connections for tenant: {len(self._active_connections[dispensary_id])}"
            )

    async def disconnect(self, websocket: WebSocket, dispensary_id: int) -> None:
        """Remove a closed or dropped WebSocket connection."""
        async with self._lock:
            self._active_connections[dispensary_id].discard(websocket)
            if not self._active_connections[dispensary_id]:
                self._active_connections.pop(dispensary_id, None)
            logger.info(f"[WS] Dispensary #{dispensary_id} client disconnected.")

    async def broadcast_to_dispensary(self, dispensary_id: int, payload: Dict[str, Any]) -> None:
        """Asynchronously send a JSON message to all connected screens for a dispensary."""
        connections = self._active_connections.get(dispensary_id, set()).copy()
        if not connections:
            return

        dead_connections: Set[WebSocket] = set()
        message_text = json.dumps(payload)

        for ws in connections:
            try:
                await ws.send_text(message_text)
            except Exception as exc:
                logger.warning(f"[WS] Failed to send message to dispensary #{dispensary_id}: {exc}")
                dead_connections.add(ws)

        if dead_connections:
            async with self._lock:
                for dead_ws in dead_connections:
                    self._active_connections[dispensary_id].discard(dead_ws)

    def notify_dispensary_sync(self, dispensary_id: int, payload: Dict[str, Any]) -> None:
        """Thread-safe synchronous bridge with cross-worker PostgreSQL pub/sub broadcast."""
        # 1. Local broadcast
        try:
            loop = self._loop or asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    self.broadcast_to_dispensary(dispensary_id, payload),
                    loop,
                )
            else:
                loop.run_until_complete(self.broadcast_to_dispensary(dispensary_id, payload))
        except Exception as exc:
            logger.debug(f"[WS] Local broadcast dispatch: {exc}")

        # 2. Cross-worker broadcast via PostgreSQL NOTIFY
        try:
            from database.db import get_conn
            with get_conn() as conn:
                with conn.cursor() as cur:
                    message_text = json.dumps({"dispensary_id": dispensary_id, "payload": payload})
                    cur.execute("SELECT pg_notify('rxify_dispensary_events', %s);", (message_text,))
        except Exception as exc:
            logger.debug(f"[WS] Cross-process PG notify notice: {exc}")


# Global Singleton Manager
dispensary_ws_manager = DispensaryConnectionManager()
manager = dispensary_ws_manager



def verify_ws_token(token: Optional[str], expected_dispensary_id: int) -> bool:
    """Validate JWT token passed in WebSocket handshake query parameters.

    Browser WebSocket API (new WebSocket(url)) does not support custom headers
    like 'Authorization: Bearer <token>', so authentication must be performed
    via the query string (?token=...) or initial handshake message.
    """
    if not token:
        return False
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role = payload.get("role")
        token_disp_id = payload.get("dispensary_id")
        # Validate that the token belongs to a DISPENSARY and matches the target dispensary_id
        if role == "DISPENSARY" and token_disp_id == expected_dispensary_id:
            return True
        return False
    except jwt.InvalidTokenError:
        return False

