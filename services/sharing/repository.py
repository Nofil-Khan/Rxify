"""Prescription share token repository interface and PostgreSQL implementation."""

from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import psycopg2.extras

from database.db import get_conn


class SharingRepository(ABC):
    """Abstract interface for prescription sharing persistence."""

    @abstractmethod
    def resolve_patient_id(self, user_id: int) -> Optional[int]:
        """Return patient_id for a given users.user_id, or None."""
        ...

    @abstractmethod
    def create_token(
        self,
        patient_id: int,
        token_value: str,
        label: Optional[str],
        expires_at: Optional[datetime],
    ) -> Dict[str, Any]:
        """Insert and return a new share token record."""
        ...

    @abstractmethod
    def list_patient_tokens(self, patient_id: int) -> List[Dict[str, Any]]:
        """Fetch all tokens for a patient."""
        ...

    @abstractmethod
    def deactivate_token(self, patient_id: int, token_id: int) -> bool:
        """Set is_active = FALSE for a specific token."""
        ...

    @abstractmethod
    def get_token_record(self, token: str) -> Optional[Dict[str, Any]]:
        """Fetch token metadata by token string."""
        ...

    @abstractmethod
    def get_patient_public_name(self, patient_id: int) -> Optional[str]:
        """Fetch display name or email for a patient."""
        ...

    @abstractmethod
    def get_shared_prescriptions(self, patient_id: int) -> List[Dict[str, Any]]:
        """Fetch prescriptions and their medications for a patient."""
        ...


class PostgresSharingRepository(SharingRepository):
    """PostgreSQL production implementation of SharingRepository."""

    def resolve_patient_id(self, user_id: int) -> Optional[int]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
                return row["patient_id"] if row else None

    def create_token(
        self,
        patient_id: int,
        token_value: str,
        label: Optional[str],
        expires_at: Optional[datetime],
    ) -> Dict[str, Any]:
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
                row = dict(cur.fetchone())
                conn.commit()
                return row

    def list_patient_tokens(self, patient_id: int) -> List[Dict[str, Any]]:
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
                return [dict(r) for r in cur.fetchall()]

    def deactivate_token(self, patient_id: int, token_id: int) -> bool:
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
                conn.commit()
                return cur.rowcount > 0

    def get_token_record(self, token: str) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT patient_id, label, expires_at, is_active
                    FROM patient_share_tokens
                    WHERE token = %s
                    """,
                    (token,),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    def get_patient_public_name(self, patient_id: int) -> Optional[str]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT u.full_name, u.email
                    FROM users u
                    JOIN patient pt ON pt.user_id = u.user_id
                    WHERE pt.patient_id = %s
                    """,
                    (patient_id,),
                )
                user_row = cur.fetchone()
                if not user_row:
                    return None
                return user_row.get("full_name") or user_row["email"]

    def get_shared_prescriptions(self, patient_id: int) -> List[Dict[str, Any]]:
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


default_sharing_repo = PostgresSharingRepository()

