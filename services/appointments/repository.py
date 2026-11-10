"""Appointment Repository — SQL Data Access & Concurrency Locks."""

from __future__ import annotations
from datetime import date
import logging
from typing import Any, Dict, List, Optional

import psycopg2.extras
from database.db import get_conn

logger = logging.getLogger(__name__)


class AppointmentRepository:
    """Encapsulates transactional PostgreSQL queries for clinical appointment bookings."""

    def search_doctors(self, specialty: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if specialty:
                    cur.execute(
                        """
                        SELECT
                            d.doctor_id,
                            u.full_name AS doctor_name,
                            d.specialization,
                            d.qualification,
                            d.experience_years,
                            d.about
                        FROM doctor d
                        JOIN users u ON u.user_id = d.user_id
                        WHERE u.status = 'ACTIVE'
                          AND d.specialization ILIKE %s
                        ORDER BY u.full_name ASC
                        LIMIT %s
                        """,
                        (f"%{specialty}%", limit),
                    )
                else:
                    cur.execute(
                        """
                        SELECT
                            d.doctor_id,
                            u.full_name AS doctor_name,
                            d.specialization,
                            d.qualification,
                            d.experience_years,
                            d.about
                        FROM doctor d
                        JOIN users u ON u.user_id = d.user_id
                        WHERE u.status = 'ACTIVE'
                        ORDER BY u.full_name ASC
                        LIMIT %s
                        """,
                        (limit,),
                    )
                return [dict(r) for r in cur.fetchall()]

    def get_available_slots(self, doctor_id: int, from_date: date) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
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
                      AND (sl.max_patients - COALESCE(booked.cnt, 0)) > 0
                    ORDER BY sl.slot_date ASC, sl.start_time ASC
                    """,
                    (doctor_id, from_date),
                )
                return [dict(r) for r in cur.fetchall()]

    def get_patient_appointments(
        self,
        patient_id: int,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        params: list = [patient_id]
        where_extra = ""
        if status_filter and status_filter.lower() != "all":
            where_extra = "AND a.status = %s"
            params.append(status_filter.upper())

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    f"""
                    SELECT
                        a.appointment_id        AS id,
                        u.full_name             AS doctor_name,
                        d.specialization        AS doctor_specialty,
                        sl.slot_date,
                        sl.start_time,
                        sl.end_time,
                        ch.name                 AS clinic_name,
                        ch.address              AS clinic_address,
                        a.status,
                        a.reason_for_visit,
                        a.notes,
                        a.created_at
                    FROM appointment a
                    JOIN doctor d               ON d.doctor_id  = a.doctor_id
                    JOIN users  u               ON u.user_id    = d.user_id
                    LEFT JOIN appointment_slot sl ON sl.slot_id = a.slot_id
                    LEFT JOIN clinic_hospital  ch ON ch.clinic_id = a.clinic_id
                    WHERE a.patient_id = %s
                    {where_extra}
                    ORDER BY sl.slot_date DESC NULLS LAST, a.created_at DESC
                    """,
                    params,
                )
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    for k in ("slot_date", "start_time", "end_time", "created_at"):
                        if item.get(k):
                            item[k] = str(item[k])
                    results.append(item)
                return results

    def cancel_appointment(self, patient_id: int, appointment_id: int) -> bool:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE appointment
                    SET status = 'CANCELLED', updated_at = NOW()
                    WHERE appointment_id = %s
                      AND patient_id = %s
                      AND status IN ('BOOKED', 'CONFIRMED')
                    """,
                    (appointment_id, patient_id),
                )
                conn.commit()
                return cur.rowcount > 0

    # ── Doctor Appointment & Slot Management ─────────────────────────────────

    def get_doctor_appointments(
        self,
        doctor_id: int,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        params: list = [doctor_id]
        where_extra = ""
        if status_filter and status_filter.lower() != "all":
            where_extra = "AND a.status = %s"
            params.append(status_filter.upper())

        query = f"""
            SELECT
                a.appointment_id            AS id,
                u.full_name                 AS patient_name,
                u.email                     AS patient_email,
                pt.patient_id,
                sl.slot_date,
                sl.start_time,
                sl.end_time,
                ch.name                     AS clinic_name,
                a.status,
                a.reason_for_visit,
                a.notes,
                a.created_at
            FROM appointment a
            JOIN patient            pt  ON pt.patient_id  = a.patient_id
            JOIN users              u   ON u.user_id       = pt.user_id
            LEFT JOIN appointment_slot sl ON sl.slot_id   = a.slot_id
            LEFT JOIN clinic_hospital  ch ON ch.clinic_id  = a.clinic_id
            WHERE a.doctor_id = %s
            {where_extra}
            ORDER BY sl.slot_date DESC NULLS LAST, a.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, params)
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    for k in ("slot_date", "start_time", "end_time", "created_at"):
                        if item.get(k):
                            item[k] = str(item[k])
                    results.append(item)
                return results

    def get_appointment_counts(self, doctor_id: int) -> Dict[str, int]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'BOOKED')     AS booked,
                        COUNT(*) FILTER (WHERE status = 'CONFIRMED')   AS confirmed,
                        COUNT(*) FILTER (WHERE status = 'COMPLETED')   AS completed,
                        COUNT(*) FILTER (WHERE status = 'CANCELLED')   AS cancelled,
                        COUNT(*) FILTER (WHERE status = 'NO_SHOW')     AS no_show,
                        COUNT(*) FILTER (WHERE slot_id IN (
                            SELECT slot_id FROM appointment_slot
                            WHERE slot_date >= CURRENT_DATE AND doctor_id = %s
                        ) AND status IN ('BOOKED', 'CONFIRMED'))       AS upcoming
                    FROM appointment
                    WHERE doctor_id = %s
                    """,
                    (doctor_id, doctor_id),
                )
                row = cur.fetchone()
                if row is None:
                    return {"booked": 0, "confirmed": 0, "completed": 0, "upcoming": 0, "cancelled": 0, "no_show": 0}
                return {
                    "booked": row["booked"] or 0,
                    "confirmed": row["confirmed"] or 0,
                    "completed": row["completed"] or 0,
                    "cancelled": row["cancelled"] or 0,
                    "no_show": row["no_show"] or 0,
                    "upcoming": row["upcoming"] or 0,
                }

    def update_appointment_status(
        self,
        doctor_id: int,
        appointment_id: int,
        new_status: str,
    ) -> bool:
        valid_statuses = {"BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"}
        if new_status.upper() not in valid_statuses:
            return False

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE appointment
                    SET status = %s, updated_at = NOW()
                    WHERE appointment_id = %s AND doctor_id = %s
                    """,
                    (new_status.upper(), appointment_id, doctor_id),
                )
                conn.commit()
                return cur.rowcount > 0

    def get_doctor_clinics(self, doctor_id: int) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT ch.clinic_id, ch.name, ch.address, ch.type
                    FROM doctor_clinic dc
                    JOIN clinic_hospital ch ON ch.clinic_id = dc.clinic_id
                    WHERE dc.doctor_id = %s
                    ORDER BY dc.is_primary DESC, ch.name ASC
                    """,
                    (doctor_id,),
                )
                rows = cur.fetchall()
                if rows:
                    return [dict(r) for r in rows]
                cur.execute("SELECT clinic_id, name, address, type FROM clinic_hospital ORDER BY name ASC")
                return [dict(r) for r in cur.fetchall()]

    def create_doctor_slot(
        self,
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

    def update_doctor_slot(
        self,
        doctor_id: int,
        slot_id: int,
        slot_date: Any = None,
        start_time: Any = None,
        end_time: Any = None,
        max_patients: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT slot_id FROM appointment_slot WHERE slot_id = %s AND doctor_id = %s",
                    (slot_id, doctor_id),
                )
                if not cur.fetchone():
                    return None

                fields, params = [], []
                if slot_date is not None:
                    fields.append("slot_date = %s"); params.append(slot_date)
                if start_time is not None:
                    fields.append("start_time = %s"); params.append(start_time)
                if end_time is not None:
                    fields.append("end_time = %s"); params.append(end_time)
                if max_patients is not None:
                    fields.append("max_patients = %s"); params.append(max_patients)

                if not fields:
                    cur.execute(
                        "SELECT slot_id, doctor_id, clinic_id, slot_date, start_time, end_time, max_patients FROM appointment_slot WHERE slot_id = %s",
                        (slot_id,),
                    )
                    row = dict(cur.fetchone())
                    for k in ("slot_date", "start_time", "end_time"):
                        if row.get(k): row[k] = str(row[k])
                    return row

                params.append(slot_id)
                cur.execute(
                    f"UPDATE appointment_slot SET {', '.join(fields)} WHERE slot_id = %s "
                    "RETURNING slot_id, doctor_id, clinic_id, slot_date, start_time, end_time, max_patients",
                    params,
                )
                row = dict(cur.fetchone())
                for k in ("slot_date", "start_time", "end_time"):
                    if row.get(k): row[k] = str(row[k])
                return row

    def delete_doctor_slot(self, doctor_id: int, slot_id: int) -> bool:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT slot_id FROM appointment_slot WHERE slot_id = %s AND doctor_id = %s",
                    (slot_id, doctor_id),
                )
                if not cur.fetchone():
                    return False

                cur.execute(
                    """
                    SELECT COUNT(*) FROM appointment
                    WHERE slot_id = %s AND status NOT IN ('CANCELLED', 'NO_SHOW')
                    """,
                    (slot_id,),
                )
                if cur.fetchone()[0] > 0:
                    return False

                cur.execute("DELETE FROM appointment_slot WHERE slot_id = %s AND doctor_id = %s", (slot_id, doctor_id))
                conn.commit()
                return cur.rowcount > 0


default_appointment_repo = AppointmentRepository()

