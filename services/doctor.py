"""Doctor service layer facade (Backwards Compatibility Layer).

Delegates all clinician caseload and practice workflow operations to the OOP
DoctorPracticeService under services.clinical_ops.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.clinical_ops import (
    DoctorPracticeService,
    default_doctor_service,
)


def get_my_prescriptions(
    doctor_id: int,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    return default_doctor_service.get_prescriptions(
        doctor_id=doctor_id, search=search, limit=limit, offset=offset
    )


def get_my_prescription_detail(
    doctor_id: int, prescription_id: int
) -> Optional[Dict[str, Any]]:
    return default_doctor_service.get_prescription_detail(doctor_id, prescription_id)


def get_my_patients(doctor_id: int) -> List[Dict[str, Any]]:
    return default_doctor_service.get_patients(doctor_id)


def get_patient_prescriptions_scoped(
    doctor_id: int, patient_user_id: int
) -> List[Dict[str, Any]]:
    return default_doctor_service.get_patient_prescriptions_scoped(doctor_id, patient_user_id)


def get_doctor_stats(doctor_id: int) -> Dict[str, Any]:
    return default_doctor_service.get_stats(doctor_id)


def get_pending_requests(doctor_id: int) -> List[Dict[str, Any]]:
    return default_doctor_service.get_pending_requests(doctor_id)


def respond_to_request(doctor_id: int, request_id: int, accept: bool) -> bool:
    return default_doctor_service.respond_to_request(doctor_id, request_id, accept)


def update_doctor_profile(
    doctor_id: int,
    display_name: Optional[str],
    specialty: Optional[str],
) -> bool:
    return default_doctor_service.update_profile(doctor_id, display_name, specialty)


def lookup_patient_by_code_for_doctor(
    doctor_id: int, patient_code: str
) -> Optional[Dict[str, Any]]:
    return default_doctor_service.lookup_patient_by_code(doctor_id, patient_code)


def doctor_connect_patient(doctor_id: int, patient_code: str) -> Dict[str, Any]:
    return default_doctor_service.connect_patient(doctor_id, patient_code)
