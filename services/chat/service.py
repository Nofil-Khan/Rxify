"""Chat domain service for clinical messaging."""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from database.db import get_conn
from services.chat.models import ConversationSummary
from services.chat.repository import ChatRepository, default_chat_repo


class ChatService:
    """Domain service managing clinical chat conversations between patients and doctors."""

    def __init__(self, repo: Optional[ChatRepository] = None) -> None:
        self.repo = repo or default_chat_repo

    def resolve_patient_doctor_ids(self, user_id: int) -> Dict[str, Any]:
        """Given a users.user_id, return dict with patient_id, doctor_id, and role."""
        ctx = self.repo.resolve_user_context(user_id)
        return {
            "patient_id": ctx.patient_id,
            "doctor_id": ctx.doctor_id,
            "role": ctx.role,
        }

    def get_or_create_conversation(self, conn: Any, patient_id: int, doctor_id: int) -> int:
        """Return existing conversation_id or create a new one."""
        return self.repo.get_or_create_conversation(conn, patient_id, doctor_id)

    def get_conversations(self, user_id: int) -> List[Dict[str, Any]]:
        """Return all active chat conversations for the logged-in user."""
        ctx = self.repo.resolve_user_context(user_id)

        if ctx.role == "PATIENT" and ctx.patient_id:
            conv_rows = self.repo.list_patient_conversations(ctx.patient_id)
        elif ctx.role == "DOCTOR" and ctx.doctor_id:
            conv_rows = self.repo.list_doctor_conversations(ctx.doctor_id)
        else:
            return []

        conversations: List[Dict[str, Any]] = []

        for conv in conv_rows:
            cid = conv["conversation_id"]
            last_msg = self.repo.get_last_message(cid)
            unread_count = self.repo.count_unread(cid, user_id)

            summary = ConversationSummary(
                peer_id=conv["peer_user_id"],
                username=conv["username"],
                display_name=conv["display_name"],
                role=conv["role"],
                specialty=conv.get("specialty"),
                unread_count=unread_count,
                last_message=last_msg,
            )
            conversations.append(summary.to_dict())

        conversations.sort(
            key=lambda c: (
                c["last_message"]["created_at"].isoformat()
                if c["last_message"] and c["last_message"].get("created_at")
                else ""
            ),
            reverse=True,
        )
        return conversations

    def get_chat_history(self, user_id: int, other_user_id: int) -> List[Dict[str, Any]]:
        """Return chronological message history between two users and mark messages read."""
        cid = self.repo.find_conversation_id(user_a_id=user_id, user_b_id=other_user_id)
        if cid is None:
            return []

        self.repo.mark_read(conversation_id=cid, sender_id=other_user_id)
        return self.repo.get_messages(cid)

    def send_chat_message(
        self, sender_id: int, receiver_id: int, message_text: str
    ) -> Dict[str, Any]:
        """Send a message between two users. Auto-creates conversation if needed."""
        clean_text = message_text.strip()
        if not clean_text:
            raise ValueError("Message text cannot be empty.")

        sender_info = self.resolve_patient_doctor_ids(sender_id)
        receiver_info = self.resolve_patient_doctor_ids(receiver_id)

        if sender_info["role"] == "PATIENT":
            patient_id = sender_info["patient_id"]
            doctor_id = receiver_info["doctor_id"]
            sender_type = "PATIENT"
        else:
            patient_id = receiver_info["patient_id"]
            doctor_id = sender_info["doctor_id"]
            sender_type = "DOCTOR"

        if patient_id is None or doctor_id is None:
            raise ValueError("Cannot establish conversation: could not resolve patient/doctor IDs.")

        with get_conn() as conn:
            cid = self.get_or_create_conversation(conn, patient_id, doctor_id)
            return self.repo.insert_message(
                conversation_id=cid,
                sender_id=sender_id,
                sender_type=sender_type,
                message_text=clean_text,
            )


default_chat_service = ChatService()

