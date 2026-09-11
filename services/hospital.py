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


# =============================================================================
# Hospital ↔ Doctor affiliation
# =============================================================================

def affiliate_doctor(
    hospital_id: int,
    doctor_id: int,
    department: Optional[str] = None,
) -> Dict[str, Any]:
    """Link a doctor to a hospital.

    Returns the created/reactivated affiliation row.
    Raises ValueError if the doctor does not exist.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Verify doctor exists
            cur.execute("SELECT doctor_id FROM doctor WHERE doctor_id = %s", (doctor_id,))
            if not cur.fetchone():
                raise ValueError(f"Doctor with ID {doctor_id} does not exist.")

            # Upsert: if previously removed (is_active=False), reactivate
            cur.execute(
                """
                INSERT INTO hospital_doctor (hospital_id, doctor_id, department, is_active)
                VALUES (%s, %s, %s, TRUE)
                ON CONFLICT (hospital_id, doctor_id)
                DO UPDATE SET is_active = TRUE,
                              department = COALESCE(EXCLUDED.department, hospital_doctor.department),
                              joined_at = NOW()
                RETURNING hospital_doctor_id, hospital_id, doctor_id, department, is_active, joined_at
                """,
                (hospital_id, doctor_id, department),
            )
            return dict(cur.fetchone())


def remove_doctor_affiliation(hospital_id: int, doctor_id: int) -> bool:
    """Soft-delete: mark doctor affiliation as inactive.

    Returns True if the row existed and was updated, False otherwise.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE hospital_doctor
                SET is_active = FALSE
                WHERE hospital_id = %s AND doctor_id = %s AND is_active = TRUE
                """,
                (hospital_id, doctor_id),
            )
            return cur.rowcount > 0


def get_hospital_doctors(hospital_id: int) -> List[Dict[str, Any]]:
    """List all active doctors affiliated with this hospital.

    Returns doctor profile info + specialization + active patient count.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    d.doctor_id,
                    u.full_name                         AS doctor_name,
                    u.email                             AS doctor_email,
                    d.specialization,
                    d.qualification,
                    d.license_number,
                    d.experience_years,
                    hd.department,
                    hd.joined_at,
                    COUNT(pd.patient_doctor_id)
                        FILTER (WHERE pd.status = 'active') AS active_patient_count
                FROM hospital_doctor hd
                JOIN doctor  d ON d.doctor_id = hd.doctor_id
                JOIN users   u ON u.user_id   = d.user_id
                LEFT JOIN patient_doctor pd ON pd.doctor_id = d.doctor_id
                WHERE hd.hospital_id = %s AND hd.is_active = TRUE
                GROUP BY d.doctor_id, u.full_name, u.email, d.specialization,
                         d.qualification, d.license_number, d.experience_years,
                         hd.department, hd.joined_at
                ORDER BY u.full_name ASC
                """,
                (hospital_id,),
            )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if item.get("joined_at"):
                    item["joined_at"] = str(item["joined_at"])
                results.append(item)
            return results


def get_doctor_patients_for_hospital(
    hospital_id: int,
    doctor_id: int,
) -> List[Dict[str, Any]]:
    """Return patients that have a relationship with this doctor.
    Scoped to hospital ownership — the doctor must be affiliated with this hospital.
    Returns patient name, patient_code, relationship type, and last prescription date.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Confirm the doctor is affiliated
            cur.execute(
                "SELECT 1 FROM hospital_doctor WHERE hospital_id=%s AND doctor_id=%s AND is_active=TRUE",
                (hospital_id, doctor_id),
            )
            if not cur.fetchone():
                raise ValueError("Doctor is not affiliated with this hospital.")

            cur.execute(
                """
                SELECT
                    pt.patient_id,
                    pt.patient_code,
                    u.full_name                     AS patient_name,
                    u.email                         AS patient_email,
                    pt.blood_group,
                    pd.relationship_type,
                    pd.status                       AS relationship_status,
                    pd.created_at                   AS relationship_since,
                    MAX(rx.issue_date)              AS last_prescription_date,
                    COUNT(rx.prescription_id)       AS total_prescriptions
                FROM patient_doctor pd
                JOIN patient pt  ON pt.patient_id  = pd.patient_id
                JOIN users   u   ON u.user_id       = pt.user_id
                LEFT JOIN prescription rx ON rx.patient_id = pt.patient_id
                                         AND rx.doctor_id  = pd.doctor_id
                WHERE pd.doctor_id = %s
                GROUP BY pt.patient_id, pt.patient_code, u.full_name, u.email,
                         pt.blood_group, pd.relationship_type, pd.status, pd.created_at
                ORDER BY pd.created_at DESC
                """,
                (doctor_id,),
            )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                for k in ("relationship_since", "last_prescription_date"):
                    if item.get(k):
                        item[k] = str(item[k])
                results.append(item)
            return results


# =============================================================================
# Slot management (hospital creates/edits slots for affiliated doctors)
# =============================================================================

def create_slot_for_doctor(
    hospital_id: int,
    doctor_id: int,
    clinic_id: int,
    slot_date,
    start_time,
    end_time,
    max_patients: int = 1,
) -> Dict[str, Any]:
    """Hospital creates an appointment slot on behalf of an affiliated doctor.

    Raises ValueError if the doctor is not affiliated with this hospital.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT 1 FROM hospital_doctor WHERE hospital_id=%s AND doctor_id=%s AND is_active=TRUE",
                (hospital_id, doctor_id),
            )
            if not cur.fetchone():
                raise ValueError("Doctor is not affiliated with this hospital.")

            cur.execute(
                """
                INSERT INTO appointment_slot (doctor_id, clinic_id, slot_date, start_time, end_time, max_patients)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING slot_id, doctor_id, clinic_id, slot_date, start_time, end_time, max_patients, created_at
                """,
                (doctor_id, clinic_id, slot_date, start_time, end_time, max_patients),
            )
            row = dict(cur.fetchone())
            for k in ("slot_date", "start_time", "end_time", "created_at"):
                if row.get(k):
                    row[k] = str(row[k])
            return row


def update_slot(
    hospital_id: int,
    slot_id: int,
    slot_date=None,
    start_time=None,
    end_time=None,
    max_patients: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Hospital partially updates an appointment slot for one of its affiliated doctors.

    Returns the updated slot or None if not found / not owned by hospital's doctor.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Verify slot belongs to an affiliated doctor
            cur.execute(
                """
                SELECT sl.slot_id FROM appointment_slot sl
                JOIN hospital_doctor hd ON hd.doctor_id = sl.doctor_id
                WHERE sl.slot_id = %s AND hd.hospital_id = %s AND hd.is_active = TRUE
                """,
                (slot_id, hospital_id),
            )
            if not cur.fetchone():
                return None

            fields, params = [], []
            if slot_date is not None:
                fields.append("slot_date = %s")
                params.append(slot_date)
            if start_time is not None:
                fields.append("start_time = %s")
                params.append(start_time)
            if end_time is not None:
                fields.append("end_time = %s")
                params.append(end_time)
            if max_patients is not None:
                fields.append("max_patients = %s")
                params.append(max_patients)

            if not fields:
                # Nothing to update — return current row
                cur.execute(
                    "SELECT slot_id, doctor_id, clinic_id, slot_date, start_time, end_time, max_patients FROM appointment_slot WHERE slot_id = %s",
                    (slot_id,),
                )
                row = dict(cur.fetchone())
                for k in ("slot_date", "start_time", "end_time"):
                    if row.get(k):
                        row[k] = str(row[k])
                return row

            params.append(slot_id)
            cur.execute(
                f"UPDATE appointment_slot SET {', '.join(fields)} WHERE slot_id = %s "
                "RETURNING slot_id, doctor_id, clinic_id, slot_date, start_time, end_time, max_patients",
                params,
            )
            row = dict(cur.fetchone())
            for k in ("slot_date", "start_time", "end_time"):
                if row.get(k):
                    row[k] = str(row[k])
            return row


def delete_slot(hospital_id: int, slot_id: int) -> bool:
    """Hospital removes an appointment slot for one of its affiliated doctors.

    Returns True if deleted, False if not found or not owned.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM appointment_slot
                WHERE slot_id = %s
                  AND doctor_id IN (
                      SELECT doctor_id FROM hospital_doctor
                      WHERE hospital_id = %s AND is_active = TRUE
                  )
                """,
                (slot_id, hospital_id),
            )
            return cur.rowcount > 0


def get_available_slots_for_doctor(
    doctor_id: int,
    from_date=None,
    to_date=None,
) -> List[Dict[str, Any]]:
    """Return future available slots for a doctor with remaining capacity.

    A slot is 'available' when the count of non-cancelled appointments is
    less than max_patients.
    """
    from datetime import date as _date
    today = _date.today()
    from_date = from_date or today
    to_date = to_date or None

    params: list = [doctor_id, from_date]
    extra = ""
    if to_date:
        extra = "AND sl.slot_date <= %s"
        params.append(to_date)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT
                    sl.slot_id,
                    sl.slot_date,
                    sl.start_time,
                    sl.end_time,
                    sl.max_patients,
                    ch.clinic_id,
                    ch.name         AS clinic_name,
                    ch.address      AS clinic_address,
                    sl.max_patients - COALESCE(booked.cnt, 0) AS remaining_capacity
                FROM appointment_slot sl
                LEFT JOIN clinic_hospital ch ON ch.clinic_id = sl.clinic_id
                LEFT JOIN (
                    SELECT slot_id, COUNT(*) AS cnt
                    FROM appointment
                    WHERE status NOT IN ('CANCELLED', 'NO_SHOW')
                    GROUP BY slot_id
                ) booked ON booked.slot_id = sl.slot_id
                WHERE sl.doctor_id = %s
                  AND sl.slot_date >= %s
                  {extra}
                  AND (sl.max_patients - COALESCE(booked.cnt, 0)) > 0
                ORDER BY sl.slot_date ASC, sl.start_time ASC
                """,
                params,
            )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                for k in ("slot_date", "start_time", "end_time"):
                    if item.get(k):
                        item[k] = str(item[k])
                results.append(item)
            return results


# =============================================================================
# Hospital books appointment for a patient
# =============================================================================

def book_appointment_for_patient(
    hospital_id: int,
    patient_code: str,
    doctor_id: int,
    slot_id: int,
    reason_for_visit: Optional[str] = None,
) -> Dict[str, Any]:
    """Hospital books an appointment on behalf of a patient.

    Validates:
    - Patient exists (by patient_code)
    - Doctor is affiliated with this hospital
    - Slot belongs to this doctor and has remaining capacity

    Returns the created appointment dict.
    Raises ValueError with a descriptive message on any validation failure.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Resolve patient
            cur.execute(
                "SELECT patient_id FROM patient WHERE patient_code = %s",
                (patient_code.upper(),),
            )
            patient_row = cur.fetchone()
            if not patient_row:
                raise ValueError(f"Patient with code '{patient_code}' not found.")
            patient_id = patient_row["patient_id"]

            # 2. Confirm doctor affiliation
            cur.execute(
                "SELECT 1 FROM hospital_doctor WHERE hospital_id=%s AND doctor_id=%s AND is_active=TRUE",
                (hospital_id, doctor_id),
            )
            if not cur.fetchone():
                raise ValueError("Doctor is not affiliated with this hospital.")

            # 3. Validate slot + capacity
            cur.execute(
                """
                SELECT sl.slot_id, sl.clinic_id, sl.max_patients,
                       COALESCE(booked.cnt, 0) AS booked_count
                FROM appointment_slot sl
                LEFT JOIN (
                    SELECT slot_id, COUNT(*) AS cnt
                    FROM appointment
                    WHERE status NOT IN ('CANCELLED', 'NO_SHOW')
                    GROUP BY slot_id
                ) booked ON booked.slot_id = sl.slot_id
                WHERE sl.slot_id = %s AND sl.doctor_id = %s
                """,
                (slot_id, doctor_id),
            )
            slot = cur.fetchone()
            if not slot:
                raise ValueError("Slot not found or does not belong to this doctor.")
            if slot["booked_count"] >= slot["max_patients"]:
                raise ValueError("This slot is fully booked. Please choose another slot.")

            # 4. Create appointment
            cur.execute(
                """
                INSERT INTO appointment
                    (patient_id, doctor_id, clinic_id, slot_id, status, reason_for_visit)
                VALUES (%s, %s, %s, %s, 'BOOKED', %s)
                RETURNING appointment_id, patient_id, doctor_id, clinic_id, slot_id,
                          status, reason_for_visit, created_at
                """,
                (patient_id, doctor_id, slot["clinic_id"], slot_id, reason_for_visit),
            )
            appt = dict(cur.fetchone())
            if appt.get("created_at"):
                appt["created_at"] = str(appt["created_at"])

            # 5. Audit
            cur.execute(
                """
                INSERT INTO audit_log (hospital_id, action, entity_type, entity_id, details)
                VALUES (%s, 'BOOK_APPOINTMENT', 'APPOINTMENT', %s, %s)
                """,
                (hospital_id, appt["appointment_id"], f"Booked appointment for patient_id={patient_id} with doctor_id={doctor_id}"),
            )

            return appt

