"""Medication Timeline Facade Layer (Backwards-Compatible Interface).

Delegates patient adherence milestone and timeline queries to the OOP
MedicationTimelineService and PatientCareService under services.patient_care.
"""

from __future__ import annotations
from typing import Any, Dict, Optional

from services.patient_care import (
    default_care_service,
    default_timeline_service,
)

__all__ = [
    "get_patient_medication_timeline",
    "confirm_patient_medication",
    "update_patient_medication_status",
    "get_course_history",
]


def get_patient_medication_timeline(patient_user_id: int) -> Dict[str, Any]:
    return default_timeline_service.get_patient_medication_timeline(patient_user_id)


def confirm_patient_medication(
    patient_user_id: int,
    current_medication_id: int,
) -> Dict[str, Any]:
    return default_care_service.update_patient_medication_status(
        patient_user_id=patient_user_id,
        current_medication_id=current_medication_id,
        status="ACTIVE",
    )


def update_patient_medication_status(
    patient_user_id: int,
    current_medication_id: int,
    status: str,
    end_date: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    return default_care_service.update_patient_medication_status(
        patient_user_id=patient_user_id,
        current_medication_id=current_medication_id,
        status=status,
        end_date=end_date,
        notes=notes,
    )


def get_course_history(patient_user_id: int, course_id: int) -> Dict[str, Any]:
    return default_timeline_service.get_patient_medication_timeline(patient_user_id)
