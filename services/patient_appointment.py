"""Patient appointment service — PostgreSQL.

Provides:
  - Doctor search by specialty (for appointment browsing)
  - Available slot listing with smart time-period matching
  - Appointment booking (exact slot or best-match)
  - Patient appointment history
  - Appointment cancellation

Smart Slot Matching:
  Given preferred_date + preferred_time_period, the system scores all
  available slots and returns the closest match. If no slot falls within
  the preferred window, the nearest available slot is returned with
  `suggested: True` to signal a fallback.

  time_period definitions:
    "morning"   → start_time in [06:00, 12:00)
    "afternoon" → start_time in [12:00, 17:00)
    "evening"   → start_time in [17:00, 21:00)
    "any"       → no time window filter, sort by date + time
"""

from __future__ import annotations

from datetime import date, time as dtime
from typing import Any, Dict, List, Optional, Tuple

import psycopg2.extras

from database.db import get_conn


# ---------------------------------------------------------------------------
# Time period definitions
# ---------------------------------------------------------------------------

_TIME_PERIODS: Dict[str, Tuple[dtime, dtime]] = {
    "morning":   (dtime(6, 0),  dtime(12, 0)),
    "afternoon": (dtime(12, 0), dtime(17, 0)),
    "evening":   (dtime(17, 0), dtime(21, 0)),
}


def _parse_time(value) -> Optional[dtime]:
    """Convert DB time string or timedelta to a dtime object."""
    if value is None:
        return None
    if isinstance(value, dtime):
        return value
    # psycopg2 can return timedelta for TIME columns in some versions
    try:
        from datetime import timedelta
        if isinstance(value, timedelta):
            total = int(value.total_seconds())
            return dtime(total // 3600, (total % 3600) // 60, total % 60)
    except Exception:
        pass
    # string "HH:MM:SS"
    try:
        parts = str(value).split(":")
        return dtime(int(parts[0]), int(parts[1]), int(parts[2].split(".")[0]))
    except Exception:
        return None


def _in_period(start_time_raw, period: str) -> bool:
    """Return True if start_time falls within the given time_period window."""
    if period not in _TIME_PERIODS:
        return True  # "any" — always match
    t = _parse_time(start_time_raw)
    if t is None:
        return False
    lo, hi = _TIME_PERIODS[period]
    return lo <= t < hi


# ---------------------------------------------------------------------------
# Doctor search
# ---------------------------------------------------------------------------

def search_doctors_by_specialty(
    specialty: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Return doctors filtered by specialization (case-insensitive partial match).

    If specialty is None or empty, returns all doctors.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if specialty:
                cur.execute(
                    """
                    SELECT
                        d.doctor_id,
                        u.full_name         AS doctor_name,
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
                        u.full_name         AS doctor_name,
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


# ---------------------------------------------------------------------------
# Available slot listing + smart matching
# ---------------------------------------------------------------------------

def get_available_slots_smart(
    doctor_id: int,
    preferred_date: Optional[date] = None,
    time_period: str = "any",
) -> List[Dict[str, Any]]:
    """Return available slots for a doctor, sorted by best match to preferences.

    Each slot has a `suggested` field:
      - False  → slot is within the preferred time period
      - True   → slot is the closest fallback (time period preference not met)

    Returns empty list if no slots exist at all.
    """
    today = date.today()
    from_date = preferred_date or today

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
            raw_rows = cur.fetchall()

    if not raw_rows:
        return []

    preferred = []
    fallback = []

    for r in raw_rows:
        item = dict(r)
        for k in ("slot_date", "start_time", "end_time"):
            if item.get(k):
                item[k] = str(item[k])

        if _in_period(r["start_time"], time_period):
            item["suggested"] = False
            preferred.append(item)
        else:
            item["suggested"] = True
            fallback.append(item)

    if preferred:
        # Return preferred slots + up to 3 fallbacks for visibility
        return preferred + fallback[:3]

    # No exact match — return all as suggested (closest date first)
    return fallback


# ---------------------------------------------------------------------------
# Booking (patient-side)
# ---------------------------------------------------------------------------

def book_appointment(
    patient_user_id: int,
    doctor_id: int,
    slot_id: Optional[int] = None,
    preferred_date: Optional[date] = None,
    time_period: str = "any",
    reason_for_visit: Optional[str] = None,
) -> Dict[str, Any]:
    """Book an appointment for a patient.

    If slot_id is provided, books that exact slot.
    Otherwise, performs smart matching and books the best available slot.

    Returns the created appointment dict (with `slot_matched: bool` flag).
    Raises ValueError on validation failure.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Resolve patient_id
            cur.execute(
                "SELECT patient_id FROM patient WHERE user_id = %s",
                (patient_user_id,),
            )
            patient_row = cur.fetchone()
            if not patient_row:
                raise ValueError("No patient profile found for this account.")
            patient_id = patient_row["patient_id"]

            # Resolve the slot to book
            if slot_id is not None:
                # Exact slot — validate directly
                target_slot_id = slot_id
                slot_matched = True
            else:
                # Smart match
                slots = get_available_slots_smart(doctor_id, preferred_date, time_period)
                if not slots:
                    raise ValueError(
                        "No available slots found for this doctor. "
                        "Please try a different date or time period."
                    )
                target_slot_id = slots[0]["slot_id"]
                slot_matched = not slots[0]["suggested"]

            # Capacity check
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
                (target_slot_id, doctor_id),
            )
            slot = cur.fetchone()
            if not slot:
                raise ValueError("Selected slot not found or does not belong to this doctor.")
            if slot["booked_count"] >= slot["max_patients"]:
                raise ValueError(
                    "The selected slot is now fully booked. Please refresh and try another slot."
                )

            # Check patient doesn't already have an active booking in this slot
            cur.execute(
                """
                SELECT 1 FROM appointment
                WHERE patient_id = %s AND slot_id = %s
                  AND status NOT IN ('CANCELLED', 'NO_SHOW')
                """,
                (patient_id, target_slot_id),
            )
            if cur.fetchone():
                raise ValueError("You already have a booking for this slot.")

            # Create appointment
            cur.execute(
                """
                INSERT INTO appointment
                    (patient_id, doctor_id, clinic_id, slot_id, status, reason_for_visit)
                VALUES (%s, %s, %s, %s, 'BOOKED', %s)
                RETURNING appointment_id, patient_id, doctor_id, clinic_id, slot_id,
                          status, reason_for_visit, created_at
                """,
                (patient_id, doctor_id, slot["clinic_id"], target_slot_id, reason_for_visit),
            )
            appt = dict(cur.fetchone())
            if appt.get("created_at"):
                appt["created_at"] = str(appt["created_at"])
            appt["slot_matched_preference"] = slot_matched

            return appt


# ---------------------------------------------------------------------------
# Patient appointment history
# ---------------------------------------------------------------------------

def get_patient_appointments(
    patient_user_id: int,
    status_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return all appointments for a patient, newest first."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT patient_id FROM patient WHERE user_id = %s",
                (patient_user_id,),
            )
            row = cur.fetchone()
            if not row:
                return []
            patient_id = row["patient_id"]

        params: list = [patient_id]
        where_extra = ""
        if status_filter and status_filter.lower() != "all":
            where_extra = "AND a.status = %s"
            params.append(status_filter.upper())

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


# ---------------------------------------------------------------------------
# Cancellation
# ---------------------------------------------------------------------------

def cancel_appointment(patient_user_id: int, appointment_id: int) -> bool:
    """Cancel a patient's own appointment.

    Only BOOKED or CONFIRMED appointments can be cancelled.
    Returns True on success, False if not found or not cancellable.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT patient_id FROM patient WHERE user_id = %s",
                (patient_user_id,),
            )
            row = cur.fetchone()
            if not row:
                return False
            patient_id = row["patient_id"]

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
            return cur.rowcount > 0
