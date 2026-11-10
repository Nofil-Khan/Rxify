"""Chat and Messaging Service Facade (Backwards-Compatible Interface).

Delegates clinical messaging and conversation management to ChatService
under services.chat.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.chat import (
    ChatService,
    default_chat_service,
)

__all__ = [
    "ChatService",
    "default_chat_service",
    "get_conversations",
    "get_chat_history",
    "send_chat_message",
]


def get_conversations(user_id: int) -> List[Dict[str, Any]]:
    """Return all active chat conversations for the logged-in user."""
    return default_chat_service.get_conversations(user_id)


def get_chat_history(user_id: int, other_user_id: int) -> List[Dict[str, Any]]:
    """Return chronological message history between two users."""
    return default_chat_service.get_chat_history(user_id, other_user_id)


def send_chat_message(
    sender_id: int, receiver_id: int, message_text: str
) -> Dict[str, Any]:
    """Send a message between two users. Auto-creates conversation if needed."""
    return default_chat_service.send_chat_message(sender_id, receiver_id, message_text)
