"""Patient service facade layer — Backwards-compatible interface delegating to services.patient_care."""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.patient_care import (
    default_care_service,
    default_patient_repo,
    default_timeline_service,
)


def get_my_prescriptions(patient_user_id: int) -> List[Dict[str, Any]]:
    return default_care_service.get_my_prescriptions(patient_user_id)


def get_my_prescription_detail(patient_user_id: int, prescription_id: int) -> Optional[Dict[str, Any]]:
    return default_care_service.get_my_prescription_detail(patient_user_id, prescription_id)


def get_patient_stats(patient_user_id: int) -> Dict[str, Any]:
    return default_care_service.get_patient_stats(patient_user_id)


def lookup_doctor(doctor_id: int) -> Optional[Dict[str, Any]]:
    return default_care_service.lookup_doctor(doctor_id)


def send_doctor_request(patient_user_id: int, doctor_id: int) -> Dict[str, Any]:
    return default_care_service.send_doctor_request(patient_user_id, doctor_id)


def get_my_requests(patient_user_id: int) -> List[Dict[str, Any]]:
    return default_care_service.get_my_requests(patient_user_id)


def get_assigned_doctor(patient_user_id: int) -> Optional[Dict[str, Any]]:
    return default_care_service.get_assigned_doctor(patient_user_id)


def get_medicine_candidates(pm_id: int, patient_user_id: int) -> Optional[Dict[str, Any]]:
    return default_care_service.get_medicine_candidates(pm_id, patient_user_id)


def resolve_prescription_medicine(
    pm_id: int,
    medicine_id: int,
    patient_user_id: int,
) -> Optional[Dict[str, Any]]:
    return default_care_service.resolve_prescription_medicine(pm_id, medicine_id, patient_user_id)


def _backfill_patient_current_medications(patient_id: int) -> None:
    default_timeline_service.backfill_patient_current_medications(patient_id)


def get_patient_medication_timeline(patient_user_id: int) -> Dict[str, Any]:
    return default_timeline_service.get_patient_medication_timeline(patient_user_id)


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


def get_patient_timeline_prescriptions(patient_user_id: int) -> List[Dict[str, Any]]:
    return default_timeline_service.get_patient_timeline_prescriptions(patient_user_id)
