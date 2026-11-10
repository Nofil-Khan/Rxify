"""Data access repository for prescriptions, prescribed medicines, and active schedules."""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import psycopg2.extras
from database.db import get_conn


class PrescriptionRepository:
    """Encapsulates SQL persistence for prescriptions, line items, and current medication records."""

    def get_or_create_patient_id(self, user_id: int) -> int:
        """Resolve the patient profile ID for a user, automatically creating one if missing."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
                if row:
                    return row["patient_id"]
                cur.execute("INSERT INTO patient (user_id) VALUES (%s) RETURNING patient_id", (user_id,))
                new_p = cur.fetchone()
                conn.commit()
                return new_p["patient_id"]

    def create_prescription(
        self,
        patient_id: int,
        issue_date: Optional[str],
        follow_up_date: Optional[str],
        diagnosis: Optional[str],
        notes: Optional[str],
    ) -> int:
        """Insert a prescription header record."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO prescription (patient_id, issue_date, follow_up_date, diagnosis, notes)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING prescription_id
                    """,
                    (patient_id, issue_date, follow_up_date, diagnosis, notes),
                )
                rx_id = cur.fetchone()["prescription_id"]
                conn.commit()
                return rx_id

    def insert_prescription_item(
        self,
        prescription_id: int,
        name: str,
        dosage: Optional[str],
        frequency: Optional[str],
        duration: Optional[str],
        instructions: Optional[str],
    ) -> int:
        """Insert a line item in prescription_medicine."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO prescription_medicine
                        (prescription_id, name, dosage, frequency, duration, instructions)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING prescription_medicine_id
                    """,
                    (prescription_id, name, dosage, frequency, duration, instructions),
                )
                pm_id = cur.fetchone()["prescription_medicine_id"]
                conn.commit()
                return pm_id

    def update_item_resolution(
        self,
        prescription_medicine_id: int,
        medicine_id: Optional[int],
        match_status: str,
    ) -> None:
        """Update match status and canonical foreign key for a prescribed line item."""
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE prescription_medicine
                    SET medicine_id  = %s,
                        match_status = %s
                    WHERE prescription_medicine_id = %s
                    """,
                    (medicine_id, match_status, prescription_medicine_id),
                )
                conn.commit()

    def get_medicine_info(self, prescription_id: int, user_id: int) -> List[Dict[str, Any]]:
        """Fetch all prescribed medicines for a given prescription belonging to a user."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT pm.prescription_medicine_id,
                           pm.name,
                           pm.dosage,
                           pm.frequency,
                           pm.duration,
                           pm.instructions,
                           pm.medicine_id,
                           COALESCE(m.generic_name, pm.name) AS generic_name,
                           m.brand_name,
                           m.strength,
                           m.form
                    FROM prescription_medicine pm
                    JOIN prescription p ON p.prescription_id = pm.prescription_id
                    JOIN patient pt ON pt.patient_id = p.patient_id
                    LEFT JOIN medicine m ON m.medicine_id = pm.medicine_id
                    WHERE pm.prescription_id = %s
                      AND pt.user_id = %s
                    ORDER BY pm.prescription_medicine_id ASC
                    """,
                    (prescription_id, user_id),
                )
                return [dict(r) for r in cur.fetchall()]

