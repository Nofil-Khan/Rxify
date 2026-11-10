"""Real-time WebSocket and Notification Dispatcher for Dispensary Events."""

from __future__ import annotations
import logging
from typing import Any, Dict, Optional

from database.db import get_conn

logger = logging.getLogger(__name__)


class DispensaryNotificationDispatcher:
    """Dispatches asynchronous WebSocket events and persistent database notifications."""

    def broadcast_queue_update(
        self,
        dispensary_id: int,
        request_id: int,
        event: str = "STATUS_CHANGED",
        prescription_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> None:
        """Push queue changes over WebSocket to active dispensary workspaces."""
        try:
            from services.websocket_manager import dispensary_ws_manager
            payload: Dict[str, Any] = {
                "type": "QUEUE_UPDATED",
                "event": event,
                "request_id": request_id,
            }
            if prescription_id is not None:
                payload["prescription_id"] = prescription_id
            if status is not None:
                payload["status"] = status
            dispensary_ws_manager.notify_dispensary_sync(dispensary_id, payload)
        except Exception as exc:
            logger.warning("Could not emit dispensary WebSocket event: %s", exc)

    def notify_patient(
        self,
        user_id: int,
        title: str,
        message: str,
        notification_type: str = "MEDICINE",
    ) -> None:
        """Insert persistent in-app notification for patient."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO notification (user_id, title, message, type)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (user_id, title, message, notification_type),
                    )
                    conn.commit()
        except Exception as exc:
            logger.warning("Failed to dispatch patient notification: %s", exc)


default_dispatcher = DispensaryNotificationDispatcher()

