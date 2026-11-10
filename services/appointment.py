"""Doctor appointment facade layer (Backwards-Compatible Interface).

Delegates all doctor appointment and slot management queries to the OOP
AppointmentBookingService under services.appointments.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.appointments import default_appointment_service


def get_doctor_appointments(
    doctor_id: int,
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    return default_appointment_service.get_doctor_appointments(
        doctor_id=doctor_id, status_filter=status_filter, limit=limit, offset=offset
    )


def get_appointment_counts(doctor_id: int) -> Dict[str, int]:
    return default_appointment_service.get_appointment_counts(doctor_id)


def update_appointment_status(
    doctor_id: int,
    appointment_id: int,
    new_status: str,
) -> bool:
    return default_appointment_service.update_appointment_status(doctor_id, appointment_id, new_status)


def get_doctor_clinics(doctor_id: int) -> List[Dict[str, Any]]:
    return default_appointment_service.get_doctor_clinics(doctor_id)


def create_slot(
    doctor_id: int,
    clinic_id: int,
    slot_date: Any,
    start_time: Any,
    end_time: Any,
    max_patients: int = 1,
) -> Dict[str, Any]:
    return default_appointment_service.create_slot(
        doctor_id=doctor_id,
        clinic_id=clinic_id,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        max_patients=max_patients,
    )


def update_doctor_slot(
    doctor_id: int,
    slot_id: int,
    slot_date: Any = None,
    start_time: Any = None,
    end_time: Any = None,
    max_patients: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    return default_appointment_service.update_doctor_slot(
        doctor_id=doctor_id,
        slot_id=slot_id,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        max_patients=max_patients,
    )


def delete_doctor_slot(doctor_id: int, slot_id: int) -> bool:
    return default_appointment_service.delete_doctor_slot(doctor_id, slot_id)
