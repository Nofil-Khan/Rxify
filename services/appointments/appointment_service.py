"""Appointment Booking & Schedule Orchestration Service."""

from __future__ import annotations
from datetime import date
import logging
from typing import Any, Dict, List, Optional

import psycopg2.extras
from database.db import get_conn
from services.appointments.repository import AppointmentRepository, default_appointment_repo
from services.appointments.slot_matcher import SmartSlotMatcher, default_slot_matcher

logger = logging.getLogger(__name__)


class AppointmentBookingService:
    """Manages clinical doctor consultation discovery, slot matching, and race-free booking."""

    def __init__(
        self,
        repository: Optional[AppointmentRepository] = None,
        matcher: Optional[SmartSlotMatcher] = None,
    ):
        self._repo = repository or default_appointment_repo
        self._matcher = matcher or default_slot_matcher

    def search_doctors_by_specialty(
        self,
        specialty: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Return active doctors filtered by clinical specialization."""
        return self._repo.search_doctors(specialty, limit)

    def get_available_slots_smart(
        self,
        doctor_id: int,
        preferred_date: Optional[date] = None,
        time_period: str = "any",
    ) -> List[Dict[str, Any]]:
        """Return available slots for a doctor ranked by preference match with fallbacks."""
        from_date = preferred_date or date.today()
        raw_slots = self._repo.get_available_slots(doctor_id, from_date)
        return self._matcher.match_slots(raw_slots, time_period)

    def book_appointment(
        self,
        patient_user_id: int,
        doctor_id: int,
        slot_id: Optional[int] = None,
        preferred_date: Optional[date] = None,
        time_period: str = "any",
        reason_for_visit: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Book an appointment with row-level slot locking to eliminate race conditions."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # 1. Resolve patient_id
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (patient_user_id,))
                patient_row = cur.fetchone()
                if not patient_row:
                    raise ValueError("No patient profile found for this account.")
                patient_id = patient_row["patient_id"]

                # 2. Determine slot to book
                if slot_id is not None:
                    target_slot_id = slot_id
                    slot_matched = True
                else:
                    slots = self.get_available_slots_smart(doctor_id, preferred_date, time_period)
                    if not slots:
                        raise ValueError("No available slots found for this doctor. Please try a different date or time period.")
                    target_slot_id = slots[0]["slot_id"]
                    slot_matched = not slots[0]["suggested"]

                # 3. Lock the appointment slot row (FOR UPDATE)
                cur.execute(
                    """
                    SELECT slot_id, clinic_id, max_patients
                    FROM appointment_slot
                    WHERE slot_id = %s AND doctor_id = %s
                    FOR UPDATE
                    """,
                    (target_slot_id, doctor_id),
                )
                slot = cur.fetchone()
                if not slot:
                    raise ValueError("Selected slot not found or does not belong to this doctor.")

                # 4. Check real-time capacity under row lock
                cur.execute(
                    """
                    SELECT COUNT(*) AS booked_count
                    FROM appointment
                    WHERE slot_id = %s AND status NOT IN ('CANCELLED', 'NO_SHOW')
                    """,
                    (target_slot_id,),
                )
                count_row = cur.fetchone()
                booked_count = count_row["booked_count"] if count_row else 0
                if booked_count >= slot["max_patients"]:
                    raise ValueError("The selected slot is now fully booked. Please refresh and try another slot.")

                # 5. Check duplicate active booking for patient
                cur.execute(
                    """
                    SELECT 1 FROM appointment
                    WHERE patient_id = %s AND slot_id = %s
                      AND status NOT IN ('CANCELLED', 'NO_SHOW')
                    """,
                    (patient_id, target_slot_id),
                )
                if cur.fetchone():
                    raise ValueError("You already have an active booking for this slot.")

                # 6. Commit booking
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
                conn.commit()

                return appt

    def get_patient_appointments(
        self,
        patient_user_id: int,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return all appointments for a patient, ordered chronologically."""
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (patient_user_id,))
                row = cur.fetchone()
                if not row:
                    return []
                patient_id = row[0]

        return self._repo.get_patient_appointments(patient_id, status_filter)

    def cancel_appointment(self, patient_user_id: int, appointment_id: int) -> bool:
        """Cancel a patient's booked appointment."""
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT patient_id FROM patient WHERE user_id = %s", (patient_user_id,))
                row = cur.fetchone()
                if not row:
                    return False
                patient_id = row[0]

        return self._repo.cancel_appointment(patient_id, appointment_id)

    # ── Doctor Appointment & Slot Orchestration ──────────────────────────────

    def get_doctor_appointments(
        self,
        doctor_id: int,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Return a list of appointments for this doctor, newest first."""
        return self._repo.get_doctor_appointments(doctor_id, status_filter, limit, offset)

    def get_appointment_counts(self, doctor_id: int) -> Dict[str, int]:
        """Return counts of appointments by status for doctor dashboard KPIs."""
        return self._repo.get_appointment_counts(doctor_id)

    def update_appointment_status(
        self,
        doctor_id: int,
        appointment_id: int,
        new_status: str,
    ) -> bool:
        """Update appointment status (BOOKED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW)."""
        return self._repo.update_appointment_status(doctor_id, appointment_id, new_status)

    def get_doctor_clinics(self, doctor_id: int) -> List[Dict[str, Any]]:
        """Return clinics this doctor is associated with."""
        return self._repo.get_doctor_clinics(doctor_id)

    def create_slot(
        self,
        doctor_id: int,
        clinic_id: int,
        slot_date: Any,
        start_time: Any,
        end_time: Any,
        max_patients: int = 1,
    ) -> Dict[str, Any]:
        """Doctor creates their own appointment slot."""
        return self._repo.create_doctor_slot(
            doctor_id, clinic_id, slot_date, start_time, end_time, max_patients
        )

    def update_doctor_slot(
        self,
        doctor_id: int,
        slot_id: int,
        slot_date: Any = None,
        start_time: Any = None,
        end_time: Any = None,
        max_patients: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """Doctor updates one of their own slots."""
        return self._repo.update_doctor_slot(
            doctor_id, slot_id, slot_date, start_time, end_time, max_patients
        )

    def delete_doctor_slot(self, doctor_id: int, slot_id: int) -> bool:
        """Doctor deletes one of their own slots if no active bookings exist."""
        return self._repo.delete_doctor_slot(doctor_id, slot_id)


default_appointment_service = AppointmentBookingService()

