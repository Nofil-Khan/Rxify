"""Hospital service layer facade (Backwards Compatibility Layer).

Delegates all institutional hospital enterprise operations to the OOP
HospitalEnterpriseService under services.clinical_ops.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.clinical_ops import (
    HospitalEnterpriseService,
    default_hospital_service,
)


def create_hospital(
    name: str,
    email: str,
    password: str,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    registration_number: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    return default_hospital_service.register_hospital(
        name=name,
        email=email,
        password=password,
        phone=phone,
        address=address,
        city=city,
        state=state,
        registration_number=registration_number,
    )


def authenticate_hospital(email: str, password: str) -> Optional[Dict[str, Any]]:
    return default_hospital_service.authenticate(email, password)


def get_hospital_by_email(email: str) -> Optional[Dict[str, Any]]:
    return default_hospital_service.get_hospital_by_email(email)


def get_hospital_by_id(hospital_id: int) -> Optional[Dict[str, Any]]:
    return default_hospital_service.get_hospital_by_id(hospital_id)


def lookup_patient_by_code(patient_code: str) -> Optional[Dict[str, Any]]:
    return default_hospital_service.lookup_patient_by_code(patient_code)


def get_patient_prescriptions(patient_id: int) -> List[Dict[str, Any]]:
    return default_hospital_service.get_patient_prescriptions(patient_id)


def get_patient_prescription_detail(
    patient_id: int, prescription_id: int
) -> Optional[Dict[str, Any]]:
    return default_hospital_service.get_patient_prescription_detail(patient_id, prescription_id)


def get_patient_current_medications(patient_id: int) -> List[Dict[str, Any]]:
    return default_hospital_service.get_patient_current_medications(patient_id)


def log_hospital_access(
    hospital_id: int,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    details: Optional[str] = None,
) -> None:
    default_hospital_service.log_access(hospital_id, action, entity_type, entity_id, details)


def get_dashboard_data(hospital_id: int) -> Dict[str, Any]:
    return default_hospital_service.get_dashboard_data(hospital_id)


def affiliate_doctor(
    hospital_id: int,
    doctor_id: int,
    department: Optional[str] = None,
) -> Dict[str, Any]:
    return default_hospital_service.affiliate_doctor(hospital_id, doctor_id, department)


def remove_doctor_affiliation(hospital_id: int, doctor_id: int) -> bool:
    return default_hospital_service.remove_doctor_affiliation(hospital_id, doctor_id)


def get_hospital_doctors(hospital_id: int) -> List[Dict[str, Any]]:
    return default_hospital_service.get_hospital_doctors(hospital_id)


def get_doctor_patients_for_hospital(
    hospital_id: int,
    doctor_id: int,
) -> List[Dict[str, Any]]:
    return default_hospital_service.get_doctor_patients_for_hospital(hospital_id, doctor_id)


def create_slot_for_doctor(
    hospital_id: int,
    doctor_id: int,
    clinic_id: int,
    slot_date: Any,
    start_time: Any,
    end_time: Any,
    max_patients: int = 1,
) -> Dict[str, Any]:
    return default_hospital_service.create_slot_for_doctor(
        hospital_id, doctor_id, clinic_id, slot_date, start_time, end_time, max_patients
    )


def update_slot(
    hospital_id: int,
    slot_id: int,
    slot_date: Any = None,
    start_time: Any = None,
    end_time: Any = None,
    max_patients: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    return default_hospital_service.update_slot(
        hospital_id, slot_id, slot_date, start_time, end_time, max_patients
    )


def delete_slot(hospital_id: int, slot_id: int) -> bool:
    return default_hospital_service.delete_slot(hospital_id, slot_id)


def get_available_slots_for_doctor(
    doctor_id: int,
    from_date: Any = None,
    to_date: Any = None,
) -> List[Dict[str, Any]]:
    return default_hospital_service.get_available_slots_for_doctor(doctor_id, from_date, to_date)


def book_appointment_for_patient(
    hospital_id: int,
    patient_code: str,
    doctor_id: int,
    slot_id: int,
    reason_for_visit: Optional[str] = None,
) -> Dict[str, Any]:
    return default_hospital_service.book_appointment_for_patient(
        hospital_id, patient_code, doctor_id, slot_id, reason_for_visit
    )
