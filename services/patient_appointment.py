"""Patient appointment facade layer — Backwards-compatible interface delegating to services.appointments."""

from __future__ import annotations
from datetime import date, time as dtime
from typing import Any, Dict, List, Optional

from services.appointments import (
    default_appointment_service,
    default_slot_matcher,
)


def _parse_time(value: Any) -> Optional[dtime]:
    return default_slot_matcher.parse_time(value)


def _in_period(start_time_raw: Any, period: str) -> bool:
    return default_slot_matcher.is_in_period(start_time_raw, period)


def search_doctors_by_specialty(
    specialty: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    return default_appointment_service.search_doctors_by_specialty(specialty, limit)


def get_available_slots_smart(
    doctor_id: int,
    preferred_date: Optional[date] = None,
    time_period: str = "any",
) -> List[Dict[str, Any]]:
    return default_appointment_service.get_available_slots_smart(doctor_id, preferred_date, time_period)


def book_appointment(
    patient_user_id: int,
    doctor_id: int,
    slot_id: Optional[int] = None,
    preferred_date: Optional[date] = None,
    time_period: str = "any",
    reason_for_visit: Optional[str] = None,
) -> Dict[str, Any]:
    return default_appointment_service.book_appointment(
        patient_user_id=patient_user_id,
        doctor_id=doctor_id,
        slot_id=slot_id,
        preferred_date=preferred_date,
        time_period=time_period,
        reason_for_visit=reason_for_visit,
    )


def get_patient_appointments(
    patient_user_id: int,
    status_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    return default_appointment_service.get_patient_appointments(patient_user_id, status_filter)


def cancel_appointment(patient_user_id: int, appointment_id: int) -> bool:
    return default_appointment_service.cancel_appointment(patient_user_id, appointment_id)
