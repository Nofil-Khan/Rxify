"""Doctor appointment service — PostgreSQL.

Provides queries for:
  - Listing a doctor's appointments (upcoming + past)
  - Updating appointment status (confirm / complete / cancel)
  - Creating appointment slots (availability windows)
  - Listing a doctor's created slots
"""

from __future__ import annotations

from datetime import date, time as dtime
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn


# ---------------------------------------------------------------------------
# Appointment queries
# ---------------------------------------------------------------------------

def get_doctor_appointments(
    doctor_id: int,
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Return a list of appointments for this doctor, newest first.

    Each row includes: appointment_id, patient_name, patient_email,
    slot_date, start_time, end_time, clinic_name, status, reason_for_visit, notes.
    """
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
            # Convert time/date objects to string for JSON serialization
            results = []
            for r in rows:
                item = dict(r)
                if item.get("slot_date"):
                    item["slot_date"] = str(item["slot_date"])
                if item.get("start_time"):
                    item["start_time"] = str(item["start_time"])
                if item.get("end_time"):
                    item["end_time"] = str(item["end_time"])
                if item.get("created_at"):
                    item["created_at"] = str(item["created_at"])
                results.append(item)
            return results


def get_appointment_counts(doctor_id: int) -> Dict[str, int]:
    """Return counts of appointments by status for the dashboard stat card."""
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
    doctor_id: int,
    appointment_id: int,
    new_status: str,
) -> bool:
    """Update the status of an appointment that belongs to this doctor.

    Allowed transitions: BOOKED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW.
    Returns True on success, False if not found or not owned by this doctor.
    """
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
            return cur.rowcount > 0


def get_doctor_clinics(doctor_id: int) -> List[Dict[str, Any]]:
    """Return clinics this doctor is associated with (or all clinics if none explicitly assigned)."""
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
            # Fallback to all clinics if doctor is not mapped to any clinic yet
            cur.execute("SELECT clinic_id, name, address, type FROM clinic_hospital ORDER BY name ASC")
            return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Doctor-owned slot CRUD
# ---------------------------------------------------------------------------

def create_slot(
    doctor_id: int,
    clinic_id: int,
    slot_date,
    start_time,
    end_time,
    max_patients: int = 1,
) -> Dict[str, Any]:
    """Doctor creates their own appointment slot.

    Returns the created slot dict.
    """
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
    doctor_id: int,
    slot_id: int,
    slot_date=None,
    start_time=None,
    end_time=None,
    max_patients: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Doctor partially updates one of their own slots.

    Returns the updated slot dict, or None if not found / not owned.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Ownership check
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


def delete_doctor_slot(doctor_id: int, slot_id: int) -> bool:
    """Doctor deletes one of their own slots.

    Blocked if there are active (non-cancelled, non-no-show) bookings.
    Returns True if deleted, False otherwise.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Ownership check
            cur.execute(
                "SELECT slot_id FROM appointment_slot WHERE slot_id = %s AND doctor_id = %s",
                (slot_id, doctor_id),
            )
            if not cur.fetchone():
                return False

            # Active bookings guard
            cur.execute(
                """
                SELECT COUNT(*) FROM appointment
                WHERE slot_id = %s AND status NOT IN ('CANCELLED', 'NO_SHOW')
                """,
                (slot_id,),
            )
            if cur.fetchone()[0] > 0:
                return False  # Has active bookings, cannot delete

            cur.execute("DELETE FROM appointment_slot WHERE slot_id = %s AND doctor_id = %s", (slot_id, doctor_id))
            return cur.rowcount > 0


