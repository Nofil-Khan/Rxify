"""Hospital service layer — PostgreSQL.

Handles hospital CRUD, patient lookup by public code, and medical data
access through EXISTING prescription/medicine/current_medication tables.

Every access to patient medical data is logged in the audit_log table.

Relationship chain (no new junction tables):
    hospital → (patient_code lookup) → patient → prescription → prescription_medicine
                                                → current_medication → medicine
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn, get_password_hash, verify_password


# =============================================================================
# Hospital CRUD
# =============================================================================

def create_hospital(
    name: str,
    email: str,
    password: str,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    registration_number: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Register a new hospital organisation.

    Returns:
        Hospital dict on success, or None if the email is already taken.

    Raises:
        ValueError: If the registration_number is already in use.
    """
    password_hash = get_password_hash(password)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Check email uniqueness
            cur.execute("SELECT 1 FROM hospital WHERE email = %s", (email,))
            if cur.fetchone():
                return None

            # Check registration_number uniqueness (if provided)
            if registration_number:
                cur.execute(
                    "SELECT 1 FROM hospital WHERE registration_number = %s",
                    (registration_number,),
                )
                if cur.fetchone():
                    raise ValueError("Registration number already exists.")

            cur.execute(
                """
                INSERT INTO hospital (name, email, password_hash, phone, address, city, state, registration_number)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING hospital_id, name, email, status, created_at
                """,
                (name, email, password_hash, phone, address, city, state, registration_number),
            )
            return dict(cur.fetchone())


def authenticate_hospital(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Verify hospital credentials.

    Returns:
        Hospital dict (including password_hash for the caller to strip) on success.
        None if email not found or password mismatch.
    """
    hospital = get_hospital_by_email(email)
    if hospital is None:
        return None
    if not verify_password(password, hospital["password_hash"]):
        return None
    return hospital


def get_hospital_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch a hospital by email. Returns None if not found."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT hospital_id, name, email, password_hash, phone, address,
                       city, state, registration_number, status, created_at, updated_at
                FROM hospital
                WHERE email = %s
                """,
                (email,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_hospital_by_id(hospital_id: int) -> Optional[Dict[str, Any]]:
    """Fetch a hospital by internal ID.

    Used by `get_current_hospital()` to validate JWT tokens on every request.
    Does NOT return password_hash.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT hospital_id, name, email, phone, address,
                       city, state, registration_number, status, created_at, updated_at
                FROM hospital
                WHERE hospital_id = %s
                """,
                (hospital_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


# =============================================================================
# Patient lookup (by public patient_code)
# =============================================================================

def lookup_patient_by_code(patient_code: str) -> Optional[Dict[str, Any]]:
    """Look up a patient by their public patient_code.

    Returns basic info plus internal patient_id (for subsequent queries).
    The router is responsible for stripping patient_id before returning to the client.

    Returns None if no patient matches the code.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT pt.patient_id,
                       pt.patient_code,
                       u.full_name,
                       pt.date_of_birth,
                       pt.blood_group
                FROM patient pt
                JOIN users u ON u.user_id = pt.user_id
                WHERE pt.patient_code = %s
                """,
                (patient_code.upper(),),
            )
            row = cur.fetchone()
            return dict(row) if row else None


# =============================================================================
# Medical data access (reuses existing tables — NO new hospital-specific tables)
# =============================================================================

def get_patient_prescriptions(patient_id: int) -> List[Dict[str, Any]]:
    """Return all prescriptions for a patient, newest first.

    Follows: prescription → clinic_hospital, prescription → doctor → users
    """
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
                    ch.name             AS clinic_name,
                    d_user.full_name    AS doctor_name,
                    d.specialization    AS doctor_specialty
                FROM prescription rx
                LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                LEFT JOIN doctor d           ON d.doctor_id  = rx.doctor_id
                LEFT JOIN users  d_user      ON d_user.user_id = d.user_id
                WHERE rx.patient_id = %s
                ORDER BY rx.prescription_id DESC
                """,
                (patient_id,),
            )
            return [dict(row) for row in cur.fetchall()]

def get_patient_prescription_detail(
    patient_id: int, prescription_id: int
) -> Optional[Dict[str, Any]]:
    """Return full prescription detail including medications.

    Verifies that the prescription belongs to the specified patient.
    Returns None if not found or ownership mismatch.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Prescription header (with ownership check)
            cur.execute(
                """
                SELECT
                    rx.prescription_id  AS id,
                    rx.diagnosis,
                    rx.issue_date,
                    rx.follow_up_date,
                    rx.notes,
                    rx.extracted_text   AS raw_text,
                    ch.name             AS clinic_name,
                    ch.address          AS clinic_address,
                    ch.phone            AS clinic_phone,
                    d_user.full_name    AS doctor_name,
                    d.specialization    AS doctor_specialty
                FROM prescription rx
                LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                LEFT JOIN doctor d           ON d.doctor_id  = rx.doctor_id
                LEFT JOIN users  d_user      ON d_user.user_id = d.user_id
                WHERE rx.prescription_id = %s AND rx.patient_id = %s
                """,
                (prescription_id, patient_id),
            )
            row = cur.fetchone()
            if row is None:
                return None

            prescription = dict(row)

            # Medications
            cur.execute(
                """
                SELECT pm.prescription_medicine_id AS id,
                       COALESCE(m.brand_name, m.generic_name, 'Unknown Medicine') AS name, 
                       pm.dosage, pm.frequency, pm.duration, pm.instructions,
                       pm.created_at AS date
                FROM prescription_medicine pm
                LEFT JOIN medicine m ON m.medicine_id = pm.medicine_id
                WHERE pm.prescription_id = %s
                ORDER BY pm.prescription_medicine_id
                """,
                (prescription_id,),
            )
            prescription["medications"] = [dict(r) for r in cur.fetchall()]
            return prescription


def get_patient_current_medications(patient_id: int) -> List[Dict[str, Any]]:
    """Return current/active medications for a patient.

    Follows: current_medication → medicine
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    pm.prescription_medicine_id AS id,
                    COALESCE(m.brand_name, m.generic_name, 'Unknown Medicine') AS medicine_name,
                    pm.dosage,
                    pm.frequency,
                    pm.duration,
                    pm.instructions,
                    pm.created_at AS date
                FROM prescription_medicine pm
                JOIN prescription rx ON rx.prescription_id = pm.prescription_id
                LEFT JOIN medicine m ON m.medicine_id = pm.medicine_id
                WHERE rx.patient_id = %s
                ORDER BY pm.created_at DESC
                """,
                (patient_id,),
            )
            return [dict(row) for row in cur.fetchall()]


# =============================================================================
# Audit logging
# =============================================================================

def log_hospital_access(
    hospital_id: int,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    details: Optional[str] = None,
) -> None:
    """Record a hospital's access to patient data in the existing audit_log table.

    Uses the new nullable hospital_id column — user_id is left NULL for hospital actions.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_log (hospital_id, action, entity_type, entity_id, details)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (hospital_id, action, entity_type, entity_id, details),
            )


# =============================================================================
# Dashboard
# =============================================================================

def get_dashboard_data(hospital_id: int) -> Dict[str, Any]:
    """Return hospital dashboard summary.

    Aggregated from the audit_log — no new analytics tables needed.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Recent activity (last 20 actions)
            cur.execute(
                """
                SELECT action, entity_type, entity_id, details, created_at
                FROM audit_log
                WHERE hospital_id = %s
                ORDER BY created_at DESC
                LIMIT 20
                """,
                (hospital_id,),
            )
            recent_activity = [dict(row) for row in cur.fetchall()]

            # Aggregate counts
            cur.execute(
                """
                SELECT
                    COUNT(*)                                                              AS total_accesses,
                    COUNT(DISTINCT entity_id) FILTER (WHERE entity_type = 'PATIENT')      AS unique_patients,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')     AS accesses_today
                FROM audit_log
                WHERE hospital_id = %s
                """,
                (hospital_id,),
            )
            stats = dict(cur.fetchone())

            return {
                "total_accesses":          stats.get("total_accesses", 0),
                "unique_patients_accessed": stats.get("unique_patients", 0),
                "accesses_today":          stats.get("accesses_today", 0),
                "recent_activity":         recent_activity,
            }
