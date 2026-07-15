"""Service layer for patient prescription sharing tokens.

Patients can generate UUID tokens and share them with anyone (family, specialists, etc.).
Token holders can read prescription history via a public endpoint — no login required.
Tokens are revocable and can have an optional expiry date.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from database.user_database import db_connection


# ── Token Generation ──────────────────────────────────────────────────────────

def generate_token(
    patient_id: int,
    label: Optional[str] = None,
    expires_in_days: Optional[int] = 7,
) -> Dict[str, Any]:
    """Create a new share token for a patient and persist it.

    Args:
        patient_id:      The patient's user ID.
        label:           Optional human-readable note (e.g. "For Dr. Smith").
        expires_in_days: Days until expiry. None means the token never expires.

    Returns:
        A dict with the new token record (id, token, label, expires_at, created_at).
    """
    token_value = str(uuid.uuid4())

    expires_at: Optional[str] = None
    if expires_in_days is not None:
        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        ).isoformat()

    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO patient_share_tokens (patient_id, token, label, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (patient_id, token_value, label, expires_at),
        )
        token_id = cursor.lastrowid

    return {
        "id": token_id,
        "token": token_value,
        "label": label,
        "expires_at": expires_at,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Token Management (patient-facing) ────────────────────────────────────────

def list_tokens(patient_id: int) -> List[Dict[str, Any]]:
    """Return all share tokens belonging to a patient (active and revoked)."""
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, token, label, expires_at, is_active, created_at
            FROM patient_share_tokens
            WHERE patient_id = ?
            ORDER BY created_at DESC
            """,
            (patient_id,),
        )
        rows = cursor.fetchall()

    tokens = []
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        record = dict(row)
        # Compute a convenience 'status' field
        if not record["is_active"]:
            record["status"] = "revoked"
        elif record["expires_at"] and record["expires_at"] < now:
            record["status"] = "expired"
        else:
            record["status"] = "active"
        tokens.append(record)

    return tokens


def revoke_token(patient_id: int, token_id: int) -> bool:
    """Deactivate a token. Returns True on success, False if not found / not owned.

    A revoked token immediately stops working for anyone who tries to use it.
    """
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE patient_share_tokens
            SET is_active = 0
            WHERE id = ? AND patient_id = ?
            """,
            (token_id, patient_id),
        )
        return cursor.rowcount > 0


# ── Token Resolution (public-facing) ─────────────────────────────────────────

def resolve_token(token: str) -> Optional[int]:
    """Validate a share token and return the associated patient_id, or None.

    Returns None if the token:
    - Does not exist
    - Has been revoked (is_active = 0)
    - Has expired (expires_at < now)
    """
    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT patient_id, expires_at, is_active
            FROM patient_share_tokens
            WHERE token = ?
            """,
            (token,),
        )
        row = cursor.fetchone()

    if row is None:
        return None
    if not row["is_active"]:
        return None
    if row["expires_at"]:
        now = datetime.now(timezone.utc).isoformat()
        if row["expires_at"] < now:
            return None

    return row["patient_id"]


def get_token_info(token: str) -> Optional[Dict[str, Any]]:
    """Return basic public info about a token (patient display name, expiry).

    Useful so a recipient can verify the token before viewing full records.
    Returns None if the token is invalid / revoked / expired.
    """
    patient_id = resolve_token(token)
    if patient_id is None:
        return None

    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # Fetch the token row for label/expiry
        cursor.execute(
            "SELECT label, expires_at FROM patient_share_tokens WHERE token = ?",
            (token,),
        )
        token_row = dict(cursor.fetchone())

        # Fetch safe patient details (no PII beyond display name)
        cursor.execute(
            "SELECT display_name, username FROM users WHERE id = ?",
            (patient_id,),
        )
        user_row = dict(cursor.fetchone())

    return {
        "patient_display_name": user_row.get("display_name") or user_row["username"],
        "label": token_row["label"],
        "expires_at": token_row["expires_at"],
        "valid": True,
    }


def get_prescriptions_by_token(token: str) -> Optional[List[Dict[str, Any]]]:
    """Return full prescription list for the patient associated with a valid token.

    Returns None if the token is invalid/revoked/expired.
    Returns an empty list if the patient simply has no prescriptions.
    """
    patient_id = resolve_token(token)
    if patient_id is None:
        return None

    with db_connection(row_factory=True) as conn:
        cursor = conn.cursor()

        # Fetch prescription headers
        cursor.execute(
            """
            SELECT
                p.id,
                p.patient_name,
                p.patient_age,
                p.patient_gender,
                p.doctor_name,
                p.clinic_name,
                p.clinic_address,
                p.clinic_phone,
                p.diagnosis,
                p.issue_date,
                p.follow_up_date,
                p.notes,
                p.raw_text
            FROM prescriptions p
            WHERE p.user_id = ?
            ORDER BY p.id DESC
            """,
            (patient_id,),
        )
        prescriptions = [dict(row) for row in cursor.fetchall()]

        # Attach medications to each prescription
        for rx in prescriptions:
            cursor.execute(
                """
                SELECT id, name, dosage, frequency, duration, instructions, date
                FROM prescription_medications
                WHERE prescription_id = ?
                ORDER BY id
                """,
                (rx["id"],),
            )
            rx["medications"] = [dict(r) for r in cursor.fetchall()]

    return prescriptions
