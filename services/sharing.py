"""Prescription sharing service layer — PostgreSQL.

Patients can generate UUID-based share tokens and share them with anyone
(family members, specialists, pharmacies, etc.).  Token holders can read
prescription history via a public endpoint — no login required.

Tokens are:
  - Revocable at any time
  - Optionally time-limited (default 7 days, or None for permanent)
  - Stored in patient_share_tokens (app-specific table)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn


# =============================================================================
# Internal helpers
# =============================================================================

def _resolve_patient_id(user_id: int) -> Optional[int]:
    """Return patient_id for a given users.user_id, or None if not found."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT patient_id FROM patient WHERE user_id = %s", (user_id,)
            )
            row = cur.fetchone()
            return row["patient_id"] if row else None


# =============================================================================
# Token management (patient-facing, auth required)
# =============================================================================

def generate_token(
    patient_user_id: int,
    label: Optional[str] = None,
    expires_in_days: Optional[int] = 7,
) -> Dict[str, Any]:
    """Create a new share token for a patient and persist it.

    Args:
        patient_user_id: users.user_id of the patient.
        label:           Optional human-readable note (e.g. "Shared with Dr. Smith").
        expires_in_days: Days until expiry. None = never expires.

    Returns:
        The newly created token record dict.

    Raises:
        ValueError: If no patient profile exists for the given user_id.
    """
    patient_id = _resolve_patient_id(patient_user_id)
    if patient_id is None:
        raise ValueError(f"No patient profile found for user_id={patient_user_id}")

    token_value = str(uuid.uuid4())
    expires_at: Optional[datetime] = None
    if expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO patient_share_tokens (patient_id, token, label, expires_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id, token, label, expires_at, is_active, created_at
                """,
                (patient_id, token_value, label, expires_at),
            )
            return dict(cur.fetchone())


def list_tokens(patient_user_id: int) -> List[Dict[str, Any]]:
    """Return all share tokens belonging to a patient (active, expired, and revoked)."""
    patient_id = _resolve_patient_id(patient_user_id)
    if patient_id is None:
        return []

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, token, label, expires_at, is_active, created_at
                FROM patient_share_tokens
                WHERE patient_id = %s
                ORDER BY created_at DESC
                """,
                (patient_id,),
            )
            rows = cur.fetchall()

    now = datetime.now(timezone.utc)
    tokens = []
    for row in rows:
        record = dict(row)
        if not record["is_active"]:
            record["status"] = "revoked"
        elif record["expires_at"] and record["expires_at"] < now:
            record["status"] = "expired"
        else:
            record["status"] = "active"
        tokens.append(record)

    return tokens


def revoke_token(patient_user_id: int, token_id: int) -> bool:
    """Deactivate a share token.

    Returns:
        True on success, False if the token was not found or not owned by this patient.
    """
    patient_id = _resolve_patient_id(patient_user_id)
    if patient_id is None:
        return False

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE patient_share_tokens
                SET is_active = FALSE
                WHERE id = %s AND patient_id = %s
                """,
                (token_id, patient_id),
            )
            return cur.rowcount > 0


# =============================================================================
# Token resolution (public-facing, no auth required)
# =============================================================================

def _resolve_token(token: str) -> Optional[int]:
    """Validate a share token and return its patient_id, or None if invalid/expired."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT patient_id, expires_at, is_active
                FROM patient_share_tokens
                WHERE token = %s
                """,
                (token,),
            )
            row = cur.fetchone()

    if row is None or not row["is_active"]:
        return None
    if row["expires_at"] and row["expires_at"] < datetime.now(timezone.utc):
        return None

    return row["patient_id"]


def get_token_info(token: str) -> Optional[Dict[str, Any]]:
    """Return basic, non-sensitive public info about a token.

    Returns None if the token is invalid, expired, or revoked.
    """
    patient_id = _resolve_token(token)
    if patient_id is None:
        return None

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT label, expires_at FROM patient_share_tokens WHERE token = %s",
                (token,),
            )
            token_row = dict(cur.fetchone())

            cur.execute(
                """
                SELECT u.full_name, u.email
                FROM users u
                JOIN patient pt ON pt.user_id = u.user_id
                WHERE pt.patient_id = %s
                """,
                (patient_id,),
            )
            user_row = dict(cur.fetchone())

    return {
        "patient_display_name": user_row.get("full_name") or user_row["email"],
        "label":      token_row["label"],
        "expires_at": token_row["expires_at"],
        "valid":      True,
    }


def get_prescriptions_by_token(token: str) -> Optional[List[Dict[str, Any]]]:
    """Return full prescription list for the patient linked to this token.

    Returns None if the token is invalid, expired, or revoked.
    """
    patient_id = _resolve_token(token)
    if patient_id is None:
        return None

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    rx.prescription_id  AS id,
                    rx.diagnosis,
                    rx.issue_date,
                    rx.follow_up_date,
                    rx.notes,
                    rx.raw_text,
                    ch.name             AS clinic_name,
                    ch.address          AS clinic_address,
                    ch.phone            AS clinic_phone
                FROM prescription rx
                LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                WHERE rx.patient_id = %s
                ORDER BY rx.prescription_id DESC
                """,
                (patient_id,),
            )
            prescriptions = [dict(row) for row in cur.fetchall()]

            for rx in prescriptions:
                cur.execute(
                    """
                    SELECT prescription_medicine_id AS id,
                           name, dosage, frequency, duration, instructions,
                           created_at AS date
                    FROM prescription_medicine
                    WHERE prescription_id = %s
                    ORDER BY prescription_medicine_id
                    """,
                    (rx["id"],),
                )
                rx["medications"] = [dict(r) for r in cur.fetchall()]

    return prescriptions
