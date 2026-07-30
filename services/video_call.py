"""Video call service layer — LiveKit room management and token generation.

Only doctors can schedule calls. Both parties (doctor + patient) must share
an active assignment to obtain a join token for a room.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from livekit import api as livekit_api

from core.config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
from database.user_database import db_connection
from services.chat import _are_assigned


# ── Internal helpers ─────────────────────────────────────────────────────────

def _generate_room_name(doctor_id: int, patient_id: int) -> str:
    """Generate a collision-resistant unique room name for this pair."""
    short_id = uuid.uuid4().hex[:8]
    return f"rxify-d{doctor_id}-p{patient_id}-{short_id}"


def _get_session_by_room(room_name: str) -> Optional[Dict[str, Any]]:
    """Fetch a video_call_sessions row by room_name, or None if not found."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, room_name, doctor_id, patient_id, scheduled_at, status, created_at
            FROM video_call_sessions
            WHERE room_name = ?
            """,
            (room_name,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


# ── Public API ───────────────────────────────────────────────────────────────

def schedule_call(
    doctor_id: int,
    patient_id: int,
    scheduled_at: str,
    note: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Create a video call session and send an invite to the patient's chat.

    Returns a dict with { room_name, scheduled_at, message_id } on success.
    Returns None if the doctor is not actively assigned to the patient.
    """
    if not _are_assigned(doctor_id, patient_id):
        return None

    room_name = _generate_room_name(doctor_id, patient_id)

    # Build the invite body — embed the room name so the frontend can pick it up
    invite_body = room_name
    if note:
        invite_body = f"{room_name}||{note}"

    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # ── 1. Create video_call_sessions row ────────────────────────────────
        cursor.execute(
            """
            INSERT INTO video_call_sessions (room_name, doctor_id, patient_id, scheduled_at)
            VALUES (?, ?, ?, ?)
            """,
            (room_name, doctor_id, patient_id, scheduled_at),
        )

        # ── 2. Send a video_call message to the patient's inbox ─────────────
        cursor.execute(
            """
            INSERT INTO messages (sender_id, receiver_id, body, message_type, scheduled_at)
            VALUES (?, ?, ?, 'video_call', ?)
            """,
            (doctor_id, patient_id, invite_body, scheduled_at),
        )
        message_id = cursor.lastrowid

    return {
        "room_name": room_name,
        "scheduled_at": scheduled_at,
        "message_id": message_id,
    }


def generate_token(room_name: str, user_id: int, username: str) -> Optional[str]:
    """Generate a LiveKit JWT for the given user to join the room.

    Returns a signed JWT string on success.
    Returns None if:
      - The session does not exist
      - The user is neither the doctor nor the patient for this session
    """
    session = _get_session_by_room(room_name)
    if session is None:
        return None

    # Only the doctor or the assigned patient may join
    if user_id not in (session["doctor_id"], session["patient_id"]):
        return None

    grants = livekit_api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    )

    token = (
        livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(str(user_id))
        .with_name(username)
        .with_grants(grants)
        .with_ttl(7200)  # 2-hour window
    )

    return token.to_jwt()


def get_session(room_name: str, requesting_user_id: int) -> Optional[Dict[str, Any]]:
    """Return session details if the requesting user is a participant.

    Returns None if the session is not found or the user is not a participant.
    """
    session = _get_session_by_room(room_name)
    if session is None:
        return None
    if requesting_user_id not in (session["doctor_id"], session["patient_id"]):
        return None
    return session
