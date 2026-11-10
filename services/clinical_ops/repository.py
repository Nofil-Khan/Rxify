"""Clinical Operations Repository — SQL Data Access for Doctors & Hospitals."""

from __future__ import annotations
from datetime import date as _date, datetime, timedelta
import logging
from typing import Any, Dict, List, Optional

import psycopg2.extras
from database.db import get_conn, get_password_hash

logger = logging.getLogger(__name__)


class ClinicalOpsRepository:
    """Encapsulates transactional PostgreSQL queries for hospital enterprise and doctor practice."""

    # ── Hospital Profile & Authentication ────────────────────────────────────

    def create_hospital(
        self,
        name: str,
        email: str,
        password: str,
        phone: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        registration_number: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        password_hash = get_password_hash(password)
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT 1 FROM hospital WHERE email = %s", (email,))
                if cur.fetchone():
                    return None

                if registration_number:
                    cur.execute("SELECT 1 FROM hospital WHERE registration_number = %s", (registration_number,))
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
                row = dict(cur.fetchone())
                if row.get("created_at"):
                    row["created_at"] = str(row["created_at"])
                return row

    def get_hospital_by_id(self, hospital_id: int) -> Optional[Dict[str, Any]]:
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
                if not row:
                    return None
                res = dict(row)
                for k in ("created_at", "updated_at"):
                    if res.get(k):
                        res[k] = str(res[k])
                return res

    def get_hospital_by_email(self, email: str) -> Optional[Dict[str, Any]]:
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
                if not row:
                    return None
                res = dict(row)
                for k in ("created_at", "updated_at"):
                    if res.get(k):
                        res[k] = str(res[k])
                return res

    # ── Hospital Audit & Dashboard ───────────────────────────────────────────

    def log_hospital_access(
        self,
        hospital_id: int,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        details: Optional[str] = None,
    ) -> None:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_log (hospital_id, action, entity_type, entity_id, details)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (hospital_id, action, entity_type, entity_id, details),
                )
                conn.commit()

    def get_hospital_dashboard_data(self, hospital_id: int) -> Dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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
                for it in recent_activity:
                    if it.get("created_at"):
                        it["created_at"] = str(it["created_at"])

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
                    "total_accesses": stats.get("total_accesses", 0),
                    "unique_patients_accessed": stats.get("unique_patients", 0),
                    "accesses_today": stats.get("accesses_today", 0),
                    "recent_activity": recent_activity,
                }

    # ── Doctor Affiliations ──────────────────────────────────────────────────

    def affiliate_doctor(
        self,
        hospital_id: int,
        doctor_id: int,
        department: Optional[str] = None,
    ) -> Dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT doctor_id FROM doctor WHERE doctor_id = %s", (doctor_id,))
                if not cur.fetchone():
                    raise ValueError(f"Doctor with ID {doctor_id} does not exist.")

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
                row = dict(cur.fetchone())
                if row.get("joined_at"):
                    row["joined_at"] = str(row["joined_at"])
                return row

    def remove_doctor_affiliation(self, hospital_id: int, doctor_id: int) -> bool:
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
                conn.commit()
                return cur.rowcount > 0

    def get_hospital_doctors(self, hospital_id: int) -> List[Dict[str, Any]]:
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

    def get_doctor_patients_for_hospital(self, hospital_id: int, doctor_id: int) -> List[Dict[str, Any]]:
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
                    LEFT JOIN prescription rx ON rx.patient_id = pt.patient_id AND rx.doctor_id = pd.doctor_id
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

    # ── Doctor Practice Methods ──────────────────────────────────────────────

    def get_doctor_prescriptions(
        self,
        doctor_id: int,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        params: list = [doctor_id]
        where_extra = ""
        if search:
            where_extra = """
                AND (
                    u.full_name     ILIKE %s OR
                    rx.diagnosis    ILIKE %s OR
                    ch.name         ILIKE %s
                )
            """
            pattern = f"%{search}%"
            params.extend([pattern, pattern, pattern])

        params.extend([limit, offset])
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    f"""
                    SELECT
                        rx.prescription_id          AS id,
                        u.full_name                 AS patient_name,
                        u.user_id                   AS patient_user_id,
                        u.email                     AS uploaded_by,
                        ch.name                     AS clinic_name,
                        rx.diagnosis,
                        rx.issue_date,
                        rx.follow_up_date,
                        rx.notes
                    FROM prescription rx
                    JOIN patient        pt  ON pt.patient_id  = rx.patient_id
                    JOIN users          u   ON u.user_id       = pt.user_id
                    JOIN patient_doctor pd  ON pd.patient_id   = pt.patient_id
                                            AND pd.doctor_id    = %s
                                            AND pd.status       = 'active'
                    LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                    {where_extra}
                    ORDER BY rx.prescription_id DESC
                    LIMIT %s OFFSET %s
                    """,
                    params,
                )
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    for k in ("issue_date", "follow_up_date"):
                        if item.get(k):
                            item[k] = str(item[k])
                    results.append(item)
                return results

    def get_doctor_stats(self, doctor_id: int) -> Dict[str, Any]:
        today = datetime.now().date()
        week_ahead = today + timedelta(days=7)
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        (SELECT COUNT(*) FROM patient_doctor WHERE doctor_id = %s AND status = 'active') AS patient_count,
                        (SELECT COUNT(*) FROM prescription rx
                         JOIN patient pt ON pt.patient_id = rx.patient_id
                         JOIN patient_doctor pd ON pd.patient_id = pt.patient_id AND pd.doctor_id = %s AND pd.status = 'active') AS rx_count,
                        (SELECT COUNT(*) FROM patient_doctor WHERE doctor_id = %s AND status = 'pending') AS pending_requests,
                        (SELECT COUNT(*) FROM prescription rx
                         JOIN patient pt ON pt.patient_id = rx.patient_id
                         JOIN patient_doctor pd ON pd.patient_id = pt.patient_id AND pd.doctor_id = %s AND pd.status = 'active'
                         WHERE rx.follow_up_date >= %s AND rx.follow_up_date <= %s) AS upcoming_followups
                    """,
                    (doctor_id, doctor_id, doctor_id, doctor_id, today, week_ahead),
                )
                row = cur.fetchone()
                if row is None:
                    return {"patient_count": 0, "rx_count": 0, "pending_requests": 0, "upcoming_followups": 0}
                return {
                    "patient_count": row["patient_count"] or 0,
                    "rx_count": row["rx_count"] or 0,
                    "pending_requests": row["pending_requests"] or 0,
                    "upcoming_followups": row["upcoming_followups"] or 0,
                }

    # ── Patient EHR & Medical Records Ingress ────────────────────────────────

    def lookup_patient_by_code(self, patient_code: str) -> Optional[Dict[str, Any]]:
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

    def get_patient_prescriptions(self, patient_id: int) -> List[Dict[str, Any]]:
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
        self, patient_id: int, prescription_id: int
    ) -> Optional[Dict[str, Any]]:
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

    def get_patient_current_medications(self, patient_id: int) -> List[Dict[str, Any]]:
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

    # ── Hospital Slot Scheduling & Bookings ───────────────────────────────────

    def create_slot_for_doctor(
        self,
        hospital_id: int,
        doctor_id: int,
        clinic_id: int,
        slot_date: Any,
        start_time: Any,
        end_time: Any,
        max_patients: int = 1,
    ) -> Dict[str, Any]:
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
        self,
        hospital_id: int,
        slot_id: int,
        slot_date: Any = None,
        start_time: Any = None,
        end_time: Any = None,
        max_patients: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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

    def delete_slot(self, hospital_id: int, slot_id: int) -> bool:
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
        self,
        doctor_id: int,
        from_date: Any = None,
        to_date: Any = None,
    ) -> List[Dict[str, Any]]:
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

    def book_appointment_for_patient(
        self,
        hospital_id: int,
        patient_code: str,
        doctor_id: int,
        slot_id: int,
        reason_for_visit: Optional[str] = None,
    ) -> Dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT patient_id FROM patient WHERE patient_code = %s",
                    (patient_code.upper(),),
                )
                patient_row = cur.fetchone()
                if not patient_row:
                    raise ValueError(f"Patient with code '{patient_code}' not found.")
                patient_id = patient_row["patient_id"]

                cur.execute(
                    "SELECT 1 FROM hospital_doctor WHERE hospital_id=%s AND doctor_id=%s AND is_active=TRUE",
                    (hospital_id, doctor_id),
                )
                if not cur.fetchone():
                    raise ValueError("Doctor is not affiliated with this hospital.")

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

                cur.execute(
                    """
                    INSERT INTO audit_log (hospital_id, action, entity_type, entity_id, details)
                    VALUES (%s, 'BOOK_APPOINTMENT', 'APPOINTMENT', %s, %s)
                    """,
                    (hospital_id, appt["appointment_id"], f"Booked appointment for patient_id={patient_id} with doctor_id={doctor_id}"),
                )
                return appt

    # ── Doctor Clinical Practice Data Access ─────────────────────────────────

    def get_doctor_prescription_detail(
        self, doctor_id: int, prescription_id: int
    ) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT rx.prescription_id
                    FROM prescription rx
                    JOIN patient        pt  ON pt.patient_id = rx.patient_id
                    JOIN patient_doctor pd  ON pd.patient_id = pt.patient_id
                                           AND pd.doctor_id  = %s
                                           AND pd.status     = 'active'
                    WHERE rx.prescription_id = %s
                    """,
                    (doctor_id, prescription_id),
                )
                if cur.fetchone() is None:
                    return None

                cur.execute(
                    """
                    SELECT
                        rx.prescription_id  AS id,
                        u.full_name         AS patient_name,
                        u.user_id,
                        u.email             AS uploaded_by,
                        ch.name             AS clinic_name,
                        ch.address          AS clinic_address,
                        ch.phone            AS clinic_phone,
                        rx.diagnosis,
                        rx.issue_date,
                        rx.follow_up_date,
                        rx.notes,
                        rx.raw_text
                    FROM prescription rx
                    JOIN patient      pt ON pt.patient_id = rx.patient_id
                    JOIN users        u  ON u.user_id     = pt.user_id
                    LEFT JOIN clinic_hospital ch ON ch.clinic_id = rx.clinic_id
                    WHERE rx.prescription_id = %s
                    """,
                    (prescription_id,),
                )
                row = cur.fetchone()
                if row is None:
                    return None
                prescription = dict(row)
                cur.execute(
                    """
                    SELECT prescription_medicine_id AS id,
                           name, dosage, frequency, duration, instructions, created_at AS date
                    FROM prescription_medicine
                    WHERE prescription_id = %s
                    ORDER BY prescription_medicine_id
                    """,
                    (prescription_id,),
                )
                prescription["medications"] = [dict(r) for r in cur.fetchall()]
                return prescription

    def get_doctor_patients(self, doctor_id: int) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        u.user_id               AS id,
                        u.email                 AS username,
                        u.full_name             AS display_name,
                        pd.created_at           AS assigned_at,
                        COUNT(rx.prescription_id) AS prescription_count
                    FROM patient_doctor pd
                    JOIN patient  pt ON pt.patient_id = pd.patient_id
                    JOIN users    u  ON u.user_id      = pt.user_id
                    LEFT JOIN prescription rx ON rx.patient_id = pt.patient_id
                    WHERE pd.doctor_id = %s AND pd.status = 'active'
                    GROUP BY u.user_id, u.email, u.full_name, pd.created_at
                    ORDER BY pd.created_at DESC
                    """,
                    (doctor_id,),
                )
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    if item.get("assigned_at"):
                        item["assigned_at"] = str(item["assigned_at"])
                    results.append(item)
                return results

    def get_patient_prescriptions_scoped(
        self, doctor_id: int, patient_user_id: int
    ) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT pd.patient_doctor_id
                    FROM patient_doctor pd
                    JOIN patient pt ON pt.patient_id = pd.patient_id
                    WHERE pd.doctor_id = %s AND pt.user_id = %s AND pd.status = 'active'
                    """,
                    (doctor_id, patient_user_id),
                )
                if cur.fetchone() is None:
                    return []

                cur.execute(
                    """
                    SELECT rx.prescription_id
                    FROM prescription rx
                    JOIN patient pt ON pt.patient_id = rx.patient_id
                    WHERE pt.user_id = %s
                    ORDER BY rx.prescription_id DESC
                    """,
                    (patient_user_id,),
                )
                ids = [row["prescription_id"] for row in cur.fetchall()]

        return [
            detail
            for pid in ids
            if (detail := self.get_doctor_prescription_detail(doctor_id, pid)) is not None
        ]

    def get_pending_requests(self, doctor_id: int) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        pd.patient_doctor_id        AS id,
                        pt.patient_id,
                        pd.created_at               AS requested_at,
                        pd.status,
                        u.email                     AS patient_username,
                        u.full_name                 AS patient_display_name,
                        COUNT(rx.prescription_id)   AS prescription_count
                    FROM patient_doctor pd
                    JOIN patient  pt ON pt.patient_id  = pd.patient_id
                    JOIN users    u  ON u.user_id       = pt.user_id
                    LEFT JOIN prescription rx ON rx.patient_id = pt.patient_id
                    WHERE pd.doctor_id = %s AND pd.status = 'pending'
                    GROUP BY pd.patient_doctor_id, pt.patient_id, pd.created_at, pd.status,
                             u.email, u.full_name
                    ORDER BY pd.created_at DESC
                    """,
                    (doctor_id,),
                )
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    if item.get("requested_at"):
                        item["requested_at"] = str(item["requested_at"])
                    results.append(item)
                return results

    def respond_to_request(self, doctor_id: int, request_id: int, accept: bool) -> bool:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT patient_id FROM patient_doctor
                    WHERE patient_doctor_id = %s AND doctor_id = %s AND status = 'pending'
                    """,
                    (request_id, doctor_id),
                )
                row = cur.fetchone()
                if row is None:
                    return False

                new_status = "active" if accept else "rejected"
                cur.execute(
                    "UPDATE patient_doctor SET status = %s WHERE patient_doctor_id = %s",
                    (new_status, request_id),
                )
                conn.commit()
                return True

    def update_doctor_profile(
        self,
        doctor_id: int,
        display_name: Optional[str],
        specialty: Optional[str],
    ) -> bool:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id FROM doctor WHERE doctor_id = %s", (doctor_id,)
                )
                row = cur.fetchone()
                if row is None:
                    return False
                user_id = row[0]

                if display_name is not None:
                    cur.execute(
                        "UPDATE users SET full_name = %s WHERE user_id = %s",
                        (display_name, user_id),
                    )
                if specialty is not None:
                    cur.execute(
                        "UPDATE doctor SET specialization = %s WHERE doctor_id = %s",
                        (specialty, doctor_id),
                    )
                conn.commit()
                return True

    def lookup_patient_by_code_for_doctor(self, doctor_id: int, patient_code: str) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT pt.patient_id,
                           pt.patient_code,
                           pt.date_of_birth,
                           pt.blood_group,
                           u.user_id,
                           u.full_name,
                           u.email,
                           pd.status AS connection_status,
                           pd.patient_doctor_id,
                           pd.created_at AS connected_at
                    FROM patient pt
                    JOIN users u ON u.user_id = pt.user_id
                    LEFT JOIN patient_doctor pd ON pd.patient_id = pt.patient_id AND pd.doctor_id = %s
                    WHERE UPPER(pt.patient_code) = %s
                    """,
                    (doctor_id, patient_code.strip().upper()),
                )
                row = cur.fetchone()
                if not row:
                    return None
                res = dict(row)
                cur.execute("SELECT COUNT(*) AS total_rx FROM prescription WHERE patient_id = %s", (res["patient_id"],))
                rx_row = cur.fetchone()
                res["total_prescriptions"] = rx_row["total_rx"] if rx_row else 0
                if res.get("date_of_birth"):
                    res["date_of_birth"] = str(res["date_of_birth"])
                if res.get("connected_at"):
                    res["connected_at"] = str(res["connected_at"])
                return res

    def doctor_connect_patient(self, doctor_id: int, patient_code: str) -> Dict[str, Any]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT patient_id, patient_code FROM patient WHERE UPPER(patient_code) = %s",
                    (patient_code.strip().upper(),),
                )
                pt = cur.fetchone()
                if not pt:
                    return {"success": False, "message": f"Patient with code {patient_code} not found."}
                patient_id = pt["patient_id"]

                cur.execute(
                    "SELECT patient_doctor_id, status FROM patient_doctor WHERE patient_id = %s AND doctor_id = %s",
                    (patient_id, doctor_id),
                )
                existing = cur.fetchone()
                if existing:
                    if existing["status"] == "active":
                        return {"success": True, "message": "Already connected to this patient.", "status": "active"}
                    cur.execute(
                        "UPDATE patient_doctor SET status = 'active', created_at = NOW() WHERE patient_doctor_id = %s",
                        (existing["patient_doctor_id"],),
                    )
                    conn.commit()
                    return {"success": True, "message": "Patient connected successfully!", "status": "active"}

                cur.execute(
                    """
                    INSERT INTO patient_doctor (patient_id, doctor_id, relationship_type, status)
                    VALUES (%s, %s, 'CONSULTING', 'active')
                    """,
                    (patient_id, doctor_id),
                )
                conn.commit()
                return {"success": True, "message": "Patient connected to your care directory!", "status": "active"}


default_clinical_ops_repo = ClinicalOpsRepository()
