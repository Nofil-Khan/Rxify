"""Database services for prescription records and their associated medications.
"""

from __future__ import annotations

from typing import Any, Dict
from database.user_database import db_connection


def insert_prescription(extracted: Dict[str, Any], user_id: int) -> int:
    """Insert a prescription and its medications into the database.

    Args:
        extracted: A dictionary containing extracted prescription data.
        user_id: The ID of the patient uploading the prescription.

    Returns:
        The newly created prescription_id.
    """
    with db_connection() as conn:
        cursor = conn.cursor()

        # ── Insert prescription header ────────────────────────────────────────
        cursor.execute(
            """
            INSERT INTO prescriptions (
                user_id, doctor_name, clinic_name, clinic_address, clinic_phone,
                patient_name, patient_age, patient_gender, issue_date,
                follow_up_date, diagnosis, notes, raw_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                extracted.get("doctor_name"),
                extracted.get("clinic_name"),
                extracted.get("clinic_address"),
                extracted.get("clinic_phone"),
                extracted.get("patient_name"),
                extracted.get("patient_age"),
                extracted.get("patient_gender"),
                extracted.get("issue_date"),
                extracted.get("follow_up_date"),
                extracted.get("diagnosis"),
                extracted.get("notes"),
                extracted.get("raw_text"),
            ),
        )
        prescription_id = cursor.lastrowid

        # ── Insert medications ────────────────────────────────────────────────
        for med in extracted.get("medications", []):
            cursor.execute(
                """
                INSERT INTO prescription_medications (
                    prescription_id, date, name, dosage, frequency, duration, instructions
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    prescription_id,
                    extracted.get("issue_date"),
                    med.get("name"),
                    med.get("dosage"),
                    med.get("frequency"),
                    med.get("duration"),
                    med.get("instructions"),
                ),
            )

        return prescription_id
