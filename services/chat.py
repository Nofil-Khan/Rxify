"""Chat service layer — doctor ↔ patient messaging.

All operations are strictly scoped to active doctor_patient_assignments.
Neither party can send or read messages unless they share an active assignment.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from database.user_database import db_connection


# ── Internal helper ──────────────────────────────────────────────────────────

def _are_assigned(user_a: int, user_b: int) -> bool:
    """Return True if an active assignment exists between the two users (either direction)."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 1 FROM doctor_patient_assignments
            WHERE status = 'active'
              AND (
                    (doctor_id = ? AND patient_id = ?)
                 OR (doctor_id = ? AND patient_id = ?)
              )
            LIMIT 1
            """,
            (user_a, user_b, user_b, user_a),
        )
        return cursor.fetchone() is not None


# ── Public API ───────────────────────────────────────────────────────────────

def send_message(
    sender_id: int, receiver_id: int, body: str
) -> Optional[Dict[str, Any]]:
    """Insert a message if the two users share an active assignment.

    Returns the new message dict on success, or None if not assigned.
    """
    if not _are_assigned(sender_id, receiver_id):
        return None

    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO messages (sender_id, receiver_id, body)
            VALUES (?, ?, ?)
            """,
            (sender_id, receiver_id, body),
        )
        new_id = cursor.lastrowid

    # Fetch the just-inserted row to return a clean dict
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, sender_id, receiver_id, body, sent_at, is_read, message_type, scheduled_at FROM messages WHERE id = ?",
            (new_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_conversation(
    user_a: int, user_b: int, limit: int = 15
) -> List[Dict[str, Any]]:
    """Return the last N messages between two users, oldest-first.

    Also marks all messages sent TO user_a FROM user_b as read.
    Returns an empty list if no active assignment exists.
    """
    if not _are_assigned(user_a, user_b):
        return []

    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # ── Mark incoming messages as read ───────────────────────────────────
        cursor.execute(
            """
            UPDATE messages
            SET is_read = 1
            WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
            """,
            (user_a, user_b),
        )

        # ── Fetch last N messages in the conversation (both directions) ───────
        cursor.execute(
            """
            SELECT id, sender_id, receiver_id, body, sent_at, is_read, message_type, scheduled_at
            FROM messages
            WHERE (sender_id = ? AND receiver_id = ?)
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_a, user_b, user_b, user_a, limit),
        )
        rows = cursor.fetchall()

    # Reverse so the result is oldest → newest for the frontend
    return [dict(r) for r in reversed(rows)]


def has_unread(user_id: int, other_id: int) -> bool:
    """Return True if other_id has sent any unread messages to user_id.

    Returns False if no active assignment exists (can't have messages anyway).
    """
    if not _are_assigned(user_id, other_id):
        return False

    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 1 FROM messages
            WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
            LIMIT 1
            """,
            (user_id, other_id),
        )
        return cursor.fetchone() is not None
