"""Prescription service layer — PostgreSQL.

Consolidates all prescription-related database operations into one module:
  - Inserting prescriptions and their medications (from OCR output)
  - Retrieving medication info with frequency parsing

Uses the ER-diagram schema:
  prescription / prescription_medicine / patient
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn


# =============================================================================
# Helper Utilities (Date Parsing & Data Sanitization)
# =============================================================================

def parse_date_string(val: Any) -> Optional[str]:
    """Safely parse various date string formats into ISO 'YYYY-MM-DD' format or None.

    Prevents PostgreSQL InvalidDatetimeFormat errors when inserting OCR results.
    """
    if not val or not isinstance(val, str):
        return None
    val = val.strip()
    if not val or val.lower() in ("null", "none", "n/a", "na", "unknown", "undefined", "-", "not specified", "nil"):
        return None

    # Try ISO YYYY-MM-DD format first
    try:
        dt = datetime.date.fromisoformat(val)
        return dt.isoformat()
    except ValueError:
        pass

    # Try common explicit date formats
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d",
        "%d-%m-%Y", "%m-%d-%Y", "%d.%m.%Y", "%Y.%m.%d",
        "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y",
        "%d-%b-%Y", "%d-%B-%Y"
    ]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(val, fmt).date().isoformat()
        except ValueError:
            continue

    # Fallback to dateutil if available
    try:
        from dateutil import parser
        dt = parser.parse(val, fuzzy=True)
        return dt.date().isoformat()
    except Exception:
        return None


# =============================================================================
# Frequency parsing
# =============================================================================

def parse_frequency(freq: str) -> List[str]:
    """Parse a medical abbreviation frequency into descriptive time-of-day slots.

    Args:
        freq: Frequency string from prescription (e.g. "1-0-1", "BD", "TDS").

    Returns:
        A list of times of day (e.g. ["Morning", "Night"]) or a fallback message.
    """
    if not freq:
        return []

    freq = freq.strip().upper()

    # Handle dash-separated patterns (e.g. 1-0-1)
    if "-" in freq:
        parts = freq.split("-")
        times = ["Morning", "Afternoon", "Night"]
        return [times[i] for i, v in enumerate(parts) if v.strip() in ("1", "2")]

    # Common abbreviations
    mapping = {
        "OD":         ["Morning"],
        "1 OD":       ["Morning"],
        "BD":         ["Morning", "Night"],
        "1/2 BD":     ["Morning", "Night"],
        "TWICE DAILY":["Morning", "Night"],
        "TDS":        ["Morning", "Afternoon", "Night"],
        "QID":        ["Morning", "Afternoon", "Evening", "Night"],
        "HS":         ["Night"],
        "1 HS":       ["Night"],
        "SOS":        ["As needed"],
    }

    return mapping.get(freq, ["Check with doctor"])


# =============================================================================
# Prescription insertion (called by the OCR upload pipeline)
# =============================================================================

def insert_prescription(extracted: Dict[str, Any], user_id: int) -> int:
    """Insert a prescription and its medicines into the database.

    Maps the Gemini-extracted flat dict onto the normalized schema.
    The patient_id is resolved from user_id via the patient table. Auto-creates
    a patient profile if one does not exist for the user.

    Args:
        extracted: Dict from Gemini OCR with keys like diagnosis, medications, etc.
        user_id:   users.user_id of the currently logged-in patient.

    Returns:
        The newly created prescription_id.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Resolve or auto-create patient_id from user_id
            cur.execute(
                "SELECT patient_id FROM patient WHERE user_id = %s",
                (user_id,),
            )
            patient_row = cur.fetchone()
            if patient_row is None:
                cur.execute(
                    "INSERT INTO patient (user_id) VALUES (%s) RETURNING patient_id",
                    (user_id,),
                )
                patient_row = cur.fetchone()

            patient_id = patient_row["patient_id"]

            # Parse and sanitize date fields to avoid PostgreSQL type errors
            issue_date = parse_date_string(extracted.get("issue_date"))
            follow_up_date = parse_date_string(extracted.get("follow_up_date"))

            # Combine OCR doctor/clinic metadata into notes if available
            doc_name = extracted.get("doctor_name")
            clinic_name = extracted.get("clinic_name")
            meta_header = []
            if doc_name and str(doc_name).strip():
                meta_header.append(f"Doctor: {str(doc_name).strip()}")
            if clinic_name and str(clinic_name).strip():
                meta_header.append(f"Clinic: {str(clinic_name).strip()}")

            user_notes = extracted.get("notes") or ""
            if meta_header:
                prefix = " | ".join(meta_header)
                final_notes = f"{prefix}\n{user_notes}".strip() if user_notes else prefix
            else:
                final_notes = user_notes if user_notes.strip() else None

            # Insert prescription header
            cur.execute(
                """
                INSERT INTO prescription (
                    patient_id, issue_date, follow_up_date,
                    diagnosis, notes, raw_text
                ) VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING prescription_id
                """,
                (
                    patient_id,
                    issue_date,
                    follow_up_date,
                    extracted.get("diagnosis"),
                    final_notes,
                    extracted.get("raw_text"),
                ),
            )
            prescription_id = cur.fetchone()["prescription_id"]

            # Insert each medication with sanitized name field (NOT NULL requirement)
            for med in extracted.get("medications", []):
                med_name = med.get("name")
                if not med_name or not str(med_name).strip():
                    med_name = "Unspecified Medicine"
                else:
                    med_name = str(med_name).strip()

                cur.execute(
                    """
                    INSERT INTO prescription_medicine (
                        prescription_id, name, dosage, frequency, duration, instructions
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING prescription_medicine_id
                    """,
                    (
                        prescription_id,
                        med_name,
                        med.get("dosage"),
                        med.get("frequency"),
                        med.get("duration"),
                        med.get("instructions"),
                    ),
                )
                pm_id = cur.fetchone()["prescription_medicine_id"]

                # Fuzzy match against the medicine catalog so the dispensary
                # system can do stock lookups by medicine_id rather than
                # unreliable free-text matching.
                cur.execute(
                    """
                    SELECT medicine_id FROM medicine
                    WHERE generic_name ILIKE %s OR brand_name ILIKE %s
                    ORDER BY
                        CASE WHEN generic_name ILIKE %s THEN 0 ELSE 1 END
                    LIMIT 1
                    """,
                    (med_name, med_name, med_name),
                )
                catalog_row = cur.fetchone()
                if catalog_row:
                    cur.execute(
                        "UPDATE prescription_medicine SET medicine_id = %s"
                        " WHERE prescription_medicine_id = %s",
                        (catalog_row["medicine_id"], pm_id),
                    )

            # Automatically create a dispensary request for this prescription
            try:
                from services import dispensary as dispensary_service
                dispensary_service.create_dispensary_request_for_prescription(prescription_id)
            except Exception as exc:
                print(f"[DISPENSARY AUTO-CREATE WARNING] Failed to create request for rx #{prescription_id}: {exc}")

            return prescription_id


# =============================================================================
# Medication info retrieval (with schedule enrichment)
# =============================================================================

def get_medicine_info(prescription_id: int, user_id: int) -> List[Dict[str, Any]]:
    """Retrieve and format medications for a specific prescription.

    Enforces access control — only the patient who owns the prescription
    or a doctor currently assigned to that patient may access it.

    Args:
        prescription_id: The prescription to look up.
        user_id:         users.user_id of the requester.

    Returns:
        List of medication dicts enriched with a parsed ``schedule`` field.
        Returns an empty list if access is denied or no records exist.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT DISTINCT pm.name, pm.dosage, pm.frequency, pm.duration, pm.created_at AS date
                FROM prescription_medicine pm
                JOIN prescription rx ON pm.prescription_id = rx.prescription_id
                JOIN patient      pt ON pt.patient_id      = rx.patient_id
                LEFT JOIN patient_doctor pd ON pd.patient_id = pt.patient_id AND pd.status = 'active'
                LEFT JOIN doctor  d  ON d.doctor_id = pd.doctor_id
                WHERE pm.prescription_id = %s AND (pt.user_id = %s OR d.user_id = %s)
                """,
                (prescription_id, user_id, user_id),
            )
            rows = cur.fetchall()

    if not rows:
        return []

    return [
        {
            "name":      row["name"],
            "dosage":    row["dosage"],
            "frequency": row["frequency"],
            "schedule":  parse_frequency(row["frequency"] or ""),
            "duration":  row["duration"],
            "date":      row["date"],
        }
        for row in rows
    ]
