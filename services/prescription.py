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
from services.medicine_matcher import resolve_medicine


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
# Duration parsing (text → days)
# =============================================================================

import re as _re

def parse_duration_to_days(duration: str) -> Optional[int]:
    """Convert a free-text duration string into a number of days.

    Handles patterns like: '7 days', '2 weeks', '1 month', '10 d', '3 wks', etc.
    Returns None when the duration is ambiguous, indefinite, or unparseable.

    Args:
        duration: Raw duration text from OCR (e.g. '14 days', '2 weeks', 'ongoing').

    Returns:
        Integer number of days, or None if unparseable / indefinite.
    """
    if not duration or not isinstance(duration, str):
        return None

    dur = duration.strip().lower()

    # Explicitly indefinite / ongoing patterns → no end date
    indefinite = (
        "ongoing", "indefinitely", "indefinite", "long term", "long-term",
        "chronic", "lifelong", "as needed", "sos", "prn", "till review",
        "until review", "continue", "continued", "as directed",
    )
    if dur in indefinite or any(dur.startswith(k) for k in indefinite):
        return None

    # Match patterns like: 14 days, 2 weeks, 1 month, 3d, 2wks, 1 mo
    pattern = _re.compile(
        r"(\d+(?:\.\d+)?)\s*"
        r"(day|days|d|week|weeks|wk|wks|w|month|months|mo|mos|year|years|yr|yrs)",
        _re.IGNORECASE,
    )
    match = pattern.search(dur)
    if not match:
        return None

    amount = float(match.group(1))
    unit   = match.group(2).lower()

    multiplier = {
        "d": 1, "day": 1, "days": 1,
        "w": 7, "wk": 7, "wks": 7, "week": 7, "weeks": 7,
        "mo": 30, "mos": 30, "month": 30, "months": 30,
        "yr": 365, "yrs": 365, "year": 365, "years": 365,
    }.get(unit)

    if multiplier is None:
        return None

    return int(amount * multiplier)


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

            # Combine all rich OCR clinical metadata into notes if available
            meta_header = []
            doc_name = extracted.get("doctor_name")
            doc_deg = extracted.get("doctor_degree")
            doc_reg = extracted.get("doctor_reg_number")
            if doc_name and str(doc_name).strip():
                doc_str = f"Doctor: {str(doc_name).strip()}"
                if doc_deg and str(doc_deg).strip():
                    doc_str += f" ({str(doc_deg).strip()})"
                if doc_reg and str(doc_reg).strip():
                    doc_str += f" [Reg: {str(doc_reg).strip()}]"
                meta_header.append(doc_str)

            clinic_name = extracted.get("clinic_name")
            clinic_addr = extracted.get("clinic_address")
            if clinic_name and str(clinic_name).strip():
                c_str = f"Clinic: {str(clinic_name).strip()}"
                if clinic_addr and str(clinic_addr).strip():
                    c_str += f", {str(clinic_addr).strip()}"
                meta_header.append(c_str)

            vitals = extracted.get("vitals")
            if vitals and str(vitals).strip():
                meta_header.append(f"Vitals: {str(vitals).strip()}")

            complaints = extracted.get("chief_complaints")
            if complaints and str(complaints).strip():
                meta_header.append(f"Symptoms: {str(complaints).strip()}")

            tests = extracted.get("investigations_advised")
            if tests and isinstance(tests, list) and len(tests) > 0:
                meta_header.append(f"Lab Tests: {', '.join(tests)}")

            advice = extracted.get("dietary_lifestyle_advice")
            if advice and str(advice).strip():
                meta_header.append(f"Advice: {str(advice).strip()}")

            user_notes = extracted.get("notes") or ""
            if meta_header:
                prefix = "\n".join(meta_header)
                final_notes = f"{prefix}\n---\n{user_notes}".strip() if user_notes else prefix
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
                # Gemini output uses `raw_name`; fall back to `normalised_name`
                # then `name` for legacy compatibility.
                med_name = (
                    med.get("raw_name")
                    or med.get("normalised_name")
                    or med.get("name")
                )
                if not med_name or not str(med_name).strip():
                    med_name = "Unspecified Medicine"
                else:
                    med_name = str(med_name).strip()

                instructions = med.get("instructions") or ""
                extra_parts = []
                if med.get("quantity"):
                    extra_parts.append(f"Qty: {med['quantity']}")
                if med.get("frequency_raw"):
                    extra_parts.append(f"[{med['frequency_raw']}]")
                if extra_parts:
                    extra_str = " · ".join(extra_parts)
                    instructions = f"{instructions} ({extra_str})".strip() if instructions else extra_str

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
                        instructions or None,
                    ),
                )
                pm_id = cur.fetchone()["prescription_medicine_id"]

                # -- Medicine matching -----------------------------------------------
                # Use the full resolution pipeline (alias → exact → strength → trgm)
                # rather than a raw ILIKE, so we get reliable medicine_ids.
                #
                # Rules:
                #   MATCHED        → write medicine_id; status = 'MATCHED'
                #   AMBIGUOUS      → leave medicine_id NULL; status = 'AMBIGUOUS'
                #   UNRESOLVED     → leave medicine_id NULL; status = 'UNRESOLVED'
                #   NOT_A_MEDICINE → leave medicine_id NULL; status = 'NOT_A_MEDICINE'
                #
                # We never silently coerce an ambiguous or unresolved result into
                # a catalog ID — that would create phantom dispensary stock lookups.
                try:
                    match_result = resolve_medicine(
                        raw_name=med_name,
                        extracted_dosage=med.get("dosage"),
                        extracted_form=med.get("form"),
                    )
                    match_status = match_result.get("status", "UNRESOLVED")
                    resolved_medicine_id = (
                        match_result.get("medicine_id")
                        if match_status == "MATCHED"
                        else None
                    )
                except Exception as exc:
                    # Matcher failure must never break prescription insertion.
                    print(f"[MATCHER WARNING] resolve_medicine({med_name!r}) failed: {exc}")
                    match_status = "UNRESOLVED"
                    resolved_medicine_id = None

                cur.execute(
                    """
                    UPDATE prescription_medicine
                    SET medicine_id   = %s,
                        match_status  = %s
                    WHERE prescription_medicine_id = %s
                    """,
                    (resolved_medicine_id, match_status, pm_id),
                )

    # -----------------------------------------------------------------------
    # Populate current_medication for every medicine in this prescription.
    # This is the live tracking table used by the Medicine Timeline feature.
    # We do this AFTER the transaction commits so prescription_medicine rows
    # are visible to the FK constraint on current_medication.
    # -----------------------------------------------------------------------
    try:
        _populate_current_medications(prescription_id, patient_id, issue_date)
    except Exception as exc:
        print(f"[CURRENT_MED WARNING] Failed to populate current_medication for rx #{prescription_id}: {exc}")

    # Automatically create a dispensary request for this prescription AFTER the
    # prescription and its medicines have been committed to the database.
    try:
        from services import dispensary as dispensary_service
        dispensary_service.create_dispensary_request_for_prescription(prescription_id)
    except Exception as exc:
        print(f"[DISPENSARY AUTO-CREATE WARNING] Failed to create request for rx #{prescription_id}: {exc}")

    return prescription_id


def _populate_current_medications(
    prescription_id: int,
    patient_id: int,
    issue_date: Optional[str],
) -> None:
    """Upsert rows in current_medication for every medicine in a prescription.

    Logic:
      - For each prescription_medicine row, compute start_date (= issue_date)
        and end_date (= issue_date + parsed duration days, if parseable).
      - If a current_medication row already exists for the same
        (patient_id, prescription_medicine_id) pair it is updated in-place
        (idempotent re-upload safety).
      - Status defaults to 'ACTIVE'.  The patient can later change it to
        'COMPLETED' or 'DISCONTINUED' through the patient API.

    Args:
        prescription_id: The prescription whose medicines to track.
        patient_id:      patient.patient_id (NOT user_id) of the owner.
        issue_date:      ISO date string (YYYY-MM-DD) or None.
    """
    import datetime as _dt

    start = None
    if issue_date:
        if isinstance(issue_date, _dt.datetime):
            start = issue_date.date()
        elif isinstance(issue_date, _dt.date):
            start = issue_date
        elif isinstance(issue_date, str):
            try:
                start = _dt.date.fromisoformat(issue_date.strip().split("T")[0])
            except ValueError:
                start = None

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Fetch all medicines for this prescription
            cur.execute(
                """
                SELECT prescription_medicine_id, medicine_id, dosage, frequency, duration
                FROM prescription_medicine
                WHERE prescription_id = %s
                """,
                (prescription_id,),
            )
            medicines = cur.fetchall()

            for med in medicines:
                pm_id     = med["prescription_medicine_id"]
                med_id    = med["medicine_id"]
                dosage    = med["dosage"]
                frequency = med["frequency"]
                duration  = med["duration"]

                # Compute end_date from duration string if possible
                end = None
                if start and duration:
                    days = parse_duration_to_days(duration)
                    if days is not None:
                        end = start + _dt.timedelta(days=days)

                # Upsert: update if already exists, insert otherwise.
                # The UNIQUE constraint on (patient_id, prescription_medicine_id)
                # must exist in schema.sql — see migration note in db.py.
                cur.execute(
                    """
                    INSERT INTO current_medication (
                        patient_id, prescription_medicine_id, medicine_id,
                        dosage, frequency, start_date, end_date, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
                    ON CONFLICT (patient_id, prescription_medicine_id)
                    DO UPDATE SET
                        medicine_id = EXCLUDED.medicine_id,
                        dosage      = EXCLUDED.dosage,
                        frequency   = EXCLUDED.frequency,
                        start_date  = EXCLUDED.start_date,
                        end_date    = COALESCE(current_medication.end_date, EXCLUDED.end_date)
                    """,
                    (patient_id, pm_id, med_id, dosage, frequency,
                     start.isoformat() if start else None,
                     end.isoformat() if end else None),
                )


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
