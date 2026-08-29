"""Chat and Messaging database service layer — PostgreSQL version.

Uses the new ER-diagram schema:
  - chat_conversation  (one per patient-doctor pair)
  - chat_message       (each message tied to a conversation)

The old flat chat_messages table is replaced by this two-table design.
Public API response shape is preserved so the frontend does not break.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_conversation(
    conn, patient_id: int, doctor_id: int
) -> int:
    """Return existing conversation_id or create a new one."""
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


def _resolve_patient_doctor_ids(user_id: int) -> Dict[str, Any]:
    """
    Given a users.user_id, return which patient_id and doctor_id it corresponds to.
    Returns {"patient_id": int|None, "doctor_id": int|None, "role": str}
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
            urow = cur.fetchone()
            if not urow:
                return {"patient_id": None, "doctor_id": None, "role": "UNKNOWN"}
            role = urow["role"]

            if role == "PATIENT":
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (user_id,))
                prow = cur.fetchone()
                return {"patient_id": prow["patient_id"] if prow else None, "doctor_id": None, "role": role}
            elif role == "DOCTOR":
                cur.execute("SELECT doctor_id FROM doctor WHERE user_id = %s", (user_id,))
                drow = cur.fetchone()
                return {"patient_id": None, "doctor_id": drow["doctor_id"] if drow else None, "role": role}
            return {"patient_id": None, "doctor_id": None, "role": role}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_conversations(user_id: int) -> List[Dict[str, Any]]:
    """Return all active chat conversations for the logged-in user."""
    ids = _resolve_patient_doctor_ids(user_id)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            if ids["role"] == "PATIENT" and ids["patient_id"]:
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
                    (ids["patient_id"],),
                )
            elif ids["role"] == "DOCTOR" and ids["doctor_id"]:
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
                    (ids["doctor_id"],),
                )
            else:
                return []

            conv_rows = cur.fetchall()
            conversations = []

            for conv in conv_rows:
                conv_dict = dict(conv)
                cid = conv_dict["conversation_id"]

                # Latest message
                cur.execute(
                    """
                    SELECT message_id, sender_id, message_text, is_read, sent_at AS created_at
                    FROM chat_message
                    WHERE conversation_id = %s
                    ORDER BY sent_at DESC LIMIT 1
                    """,
                    (cid,),
                )
                last_msg = cur.fetchone()

                # Unread count (messages TO this user)
                cur.execute(
                    """
                    SELECT COUNT(*) AS c FROM chat_message
                    WHERE conversation_id = %s
                      AND sender_id != %s
                      AND is_read = FALSE
                    """,
                    (cid, user_id),
                )
                unread_count = cur.fetchone()["c"]

                conversations.append({
                    "peer_id": conv_dict["peer_user_id"],
                    "username": conv_dict["username"],
                    "display_name": conv_dict["display_name"],
                    "role": conv_dict["role"],
                    "specialty": conv_dict.get("specialty"),
                    "unread_count": unread_count,
                    "last_message": dict(last_msg) if last_msg else None,
                })

            conversations.sort(
                key=lambda c: c["last_message"]["created_at"].isoformat()
                if c["last_message"]
                else "",
                reverse=True,
            )
            return conversations


def get_chat_history(user_id: int, other_user_id: int) -> List[Dict[str, Any]]:
    """Return chronological message history between two users."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Find conversation_id that involves both users
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
                (user_id, other_user_id, other_user_id, user_id),
            )
            row = cur.fetchone()
            if row is None:
                return []

            cid = row["conversation_id"]

            # Mark unread as read
            cur.execute(
                """
                UPDATE chat_message
                SET is_read = TRUE
                WHERE conversation_id = %s AND sender_id = %s AND is_read = FALSE
                """,
                (cid, other_user_id),
            )

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
                (cid,),
            )
            return [dict(r) for r in cur.fetchall()]


def send_chat_message(
    sender_id: int, receiver_id: int, message_text: str
) -> Dict[str, Any]:
    """Send a message between two users. Auto-creates conversation if needed."""
    clean_text = message_text.strip()
    if not clean_text:
        raise ValueError("Message text cannot be empty.")

    # Determine patient/doctor roles
    sender_info   = _resolve_patient_doctor_ids(sender_id)
    receiver_info = _resolve_patient_doctor_ids(receiver_id)

    # Determine patient_id and doctor_id for conversation
    if sender_info["role"] == "PATIENT":
        patient_id = sender_info["patient_id"]
        doctor_id  = receiver_info["doctor_id"]
        sender_type = "PATIENT"
    else:
        patient_id = receiver_info["patient_id"]
        doctor_id  = sender_info["doctor_id"]
        sender_type = "DOCTOR"

    if patient_id is None or doctor_id is None:
        raise ValueError("Cannot establish conversation: could not resolve patient/doctor IDs.")

    with get_conn() as conn:
        cid = _get_or_create_conversation(conn, patient_id, doctor_id)

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO chat_message (conversation_id, sender_id, sender_type, message_text)
                VALUES (%s, %s, %s, %s)
                RETURNING message_id AS id, sender_id, message_text, is_read, sent_at AS created_at
                """,
                (cid, sender_id, sender_type, clean_text),
            )
            row = cur.fetchone()

            # Update conversation timestamp
            cur.execute(
                "UPDATE chat_conversation SET updated_at = NOW() WHERE conversation_id = %s",
                (cid,),
            )

            return dict(row)
