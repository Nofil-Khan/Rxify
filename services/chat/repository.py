"""Chat repository interface and PostgreSQL implementation."""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import psycopg2.extras

from database.db import get_conn
from services.chat.models import ChatUserContext


class ChatRepository(ABC):
    """Abstract interface for chat persistence."""

    @abstractmethod
    def resolve_user_context(self, user_id: int) -> ChatUserContext:
        """Resolve role and domain ID (patient_id or doctor_id) for a user."""
        ...

    @abstractmethod
    def get_or_create_conversation(self, conn: Any, patient_id: int, doctor_id: int) -> int:
        """Retrieve existing conversation ID or insert a new one."""
        ...

    @abstractmethod
    def list_patient_conversations(self, patient_id: int) -> List[Dict[str, Any]]:
        """List active conversation threads for a patient."""
        ...

    @abstractmethod
    def list_doctor_conversations(self, doctor_id: int) -> List[Dict[str, Any]]:
        """List active conversation threads for a doctor."""
        ...

    @abstractmethod
    def get_last_message(self, conversation_id: int) -> Optional[Dict[str, Any]]:
        """Fetch the most recent message in a conversation."""
        ...

    @abstractmethod
    def count_unread(self, conversation_id: int, exclude_sender_id: int) -> int:
        """Count unread messages in a conversation where sender != exclude_sender_id."""
        ...

    @abstractmethod
    def find_conversation_id(self, user_a_id: int, user_b_id: int) -> Optional[int]:
        """Find conversation ID between two users, or None."""
        ...

    @abstractmethod
    def mark_read(self, conversation_id: int, sender_id: int) -> None:
        """Mark incoming messages from sender as read."""
        ...

    @abstractmethod
    def get_messages(self, conversation_id: int) -> List[Dict[str, Any]]:
        """Fetch chronological message history."""
        ...

    @abstractmethod
    def insert_message(
        self,
        conversation_id: int,
        sender_id: int,
        sender_type: str,
        message_text: str,
    ) -> Dict[str, Any]:
        """Persist a message and touch conversation updated_at."""
        ...


class PostgresChatRepository(ChatRepository):
    """PostgreSQL production implementation of ChatRepository."""

    def resolve_user_context(self, user_id: int) -> ChatUserContext:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
                urow = cur.fetchone()
                if not urow:
                    return ChatUserContext(user_id=user_id, role="UNKNOWN")
                role = urow["role"]

                if role == "PATIENT":
                    cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (user_id,))
                    prow = cur.fetchone()
                    return ChatUserContext(
                        user_id=user_id,
                        role=role,
                        patient_id=prow["patient_id"] if prow else None,
                    )
                elif role == "DOCTOR":
                    cur.execute("SELECT doctor_id FROM doctor WHERE user_id = %s", (user_id,))
                    drow = cur.fetchone()
                    return ChatUserContext(
                        user_id=user_id,
                        role=role,
                        doctor_id=drow["doctor_id"] if drow else None,
                    )
                return ChatUserContext(user_id=user_id, role=role)

    def get_or_create_conversation(self, conn: Any, patient_id: int, doctor_id: int) -> int:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT conversation_id FROM chat_conversation WHERE patient_id = %s AND doctor_id = %s",
                (patient_id, doctor_id),
            )
            row = cur.fetchone()
            if row:
                return row["conversation_id"]

            cur.execute(
                """
                INSERT INTO chat_conversation (patient_id, doctor_id)
                VALUES (%s, %s)
                RETURNING conversation_id
                """,
                (patient_id, doctor_id),
            )
            return cur.fetchone()["conversation_id"]

    def list_patient_conversations(self, patient_id: int) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT cc.conversation_id,
                           cc.doctor_id,
                           u.user_id   AS peer_user_id,
                           u.email     AS username,
                           u.full_name AS display_name,
                           d.specialization AS specialty,
                           'DOCTOR'    AS role
                    FROM chat_conversation cc
                    JOIN doctor d ON d.doctor_id  = cc.doctor_id
                    JOIN users  u ON u.user_id    = d.user_id
                    WHERE cc.patient_id = %s
                    """,
                    (patient_id,),
                )
                return [dict(r) for r in cur.fetchall()]

    def list_doctor_conversations(self, doctor_id: int) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT cc.conversation_id,
                           cc.patient_id,
                           u.user_id   AS peer_user_id,
                           u.email     AS username,
                           u.full_name AS display_name,
                           NULL        AS specialty,
                           'PATIENT'   AS role
                    FROM chat_conversation cc
                    JOIN patient pt ON pt.patient_id = cc.patient_id
                    JOIN users   u  ON u.user_id     = pt.user_id
                    WHERE cc.doctor_id = %s
                    """,
                    (doctor_id,),
                )
                return [dict(r) for r in cur.fetchall()]

    def get_last_message(self, conversation_id: int) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT message_id, sender_id, message_text, is_read, sent_at AS created_at
                    FROM chat_message
                    WHERE conversation_id = %s
                    ORDER BY sent_at DESC LIMIT 1
                    """,
                    (conversation_id,),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    def count_unread(self, conversation_id: int, exclude_sender_id: int) -> int:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) AS c FROM chat_message
                    WHERE conversation_id = %s
                      AND sender_id != %s
                      AND is_read = FALSE
                    """,
                    (conversation_id, exclude_sender_id),
                )
                return cur.fetchone()["c"]

    def find_conversation_id(self, user_a_id: int, user_b_id: int) -> Optional[int]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT cc.conversation_id
                    FROM chat_conversation cc
                    JOIN patient pt ON pt.patient_id = cc.patient_id
                    JOIN doctor  d  ON d.doctor_id   = cc.doctor_id
                    WHERE (pt.user_id = %s AND d.user_id = %s)
                       OR (pt.user_id = %s AND d.user_id = %s)
                    LIMIT 1
                    """,
                    (user_a_id, user_b_id, user_b_id, user_a_id),
                )
                row = cur.fetchone()
                return row["conversation_id"] if row else None

    def mark_read(self, conversation_id: int, sender_id: int) -> None:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE chat_message
                    SET is_read = TRUE
                    WHERE conversation_id = %s AND sender_id = %s AND is_read = FALSE
                    """,
                    (conversation_id, sender_id),
                )
                conn.commit()

    def get_messages(self, conversation_id: int) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT message_id AS id,
                           sender_id,
                           message_text,
                           is_read,
                           sent_at AS created_at
                    FROM chat_message
                    WHERE conversation_id = %s
                    ORDER BY sent_at ASC
                    """,
                    (conversation_id,),
                )
                return [dict(r) for r in cur.fetchall()]

    def insert_message(
        self,
        conversation_id: int,
        sender_id: int,
        sender_type: str,
        message_text: str,
    ) -> Dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO chat_message (conversation_id, sender_id, sender_type, message_text)
                    VALUES (%s, %s, %s, %s)
                    RETURNING message_id AS id, sender_id, message_text, is_read, sent_at AS created_at
                    """,
                    (conversation_id, sender_id, sender_type, message_text),
                )
                row = cur.fetchone()
                cur.execute(
                    "UPDATE chat_conversation SET updated_at = NOW() WHERE conversation_id = %s",
                    (conversation_id,),
                )
                conn.commit()
                return dict(row)


default_chat_repo = PostgresChatRepository()

