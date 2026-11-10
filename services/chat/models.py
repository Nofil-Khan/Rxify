"""Domain data models for clinical patient-doctor messaging."""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class ChatUserContext:
    """Resolved tenant IDs for a user account."""
    user_id: int
    role: str
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None


@dataclass(frozen=True)
class ChatMessageRecord:
    """Individual timestamped chat message."""
    id: int
    sender_id: int
    message_text: str
    is_read: bool
    created_at: Any

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "message_text": self.message_text,
            "is_read": self.is_read,
            "created_at": self.created_at,
        }


@dataclass(frozen=True)
class ConversationSummary:
    """Summary of a chat thread including unread counts and peer identity."""
    peer_id: int
    username: str
    display_name: str
    role: str
    specialty: Optional[str]
    unread_count: int
    last_message: Optional[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "peer_id": self.peer_id,
            "username": self.username,
            "display_name": self.display_name,
            "role": self.role,
            "specialty": self.specialty,
            "unread_count": self.unread_count,
            "last_message": self.last_message,
        }

