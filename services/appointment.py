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

