"""Hospital Enterprise Service — Business Logic Orchestration.

Manages hospital profiles, doctor roster affiliations, patient federated EHR lookups,
HIPAA-compliant audit logging, and clinic slot allocation.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from database.db import verify_password
from services.clinical_ops.repository import ClinicalOpsRepository, default_clinical_ops_repo


class HospitalEnterpriseService:
    """Domain service orchestrating enterprise operations for hospital healthcare systems."""

    def __init__(self, repo: Optional[ClinicalOpsRepository] = None):
        self.repo = repo or default_clinical_ops_repo

    # ── Authentication & Registration ────────────────────────────────────────

    def register_hospital(
        self,
        name: str,
        email: str,
        password: str,
        phone: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        registration_number: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Register a new healthcare hospital institution."""
        return self.repo.create_hospital(
            name=name,
            email=email,
            password=password,
            phone=phone,
            address=address,
            city=city,
            state=state,
            registration_number=registration_number,
        )

    def authenticate(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify institutional hospital login credentials."""
        hospital = self.repo.get_hospital_by_email(email)
        if hospital is None:
            return None
        if not verify_password(password, hospital.get("password_hash", "")):
            return None
        return hospital

    def get_hospital_by_id(self, hospital_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve hospital profile metadata by ID."""
        return self.repo.get_hospital_by_id(hospital_id)

    def get_hospital_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Retrieve hospital profile by registered institutional email."""
        return self.repo.get_hospital_by_email(email)

    # ── Audit & Dashboard ────────────────────────────────────────────────────

    def log_access(
        self,
        hospital_id: int,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        details: Optional[str] = None,
    ) -> None:
        """Record an immutable hospital audit trail event."""
        self.repo.log_hospital_access(hospital_id, action, entity_type, entity_id, details)

    def get_dashboard_data(self, hospital_id: int) -> Dict[str, Any]:
        """Aggregate enterprise activity KPI metrics from the audit logs."""
        return self.repo.get_hospital_dashboard_data(hospital_id)

    # ── Doctor Affiliations ──────────────────────────────────────────────────

    def affiliate_doctor(
        self, hospital_id: int, doctor_id: int, department: Optional[str] = None
    ) -> Dict[str, Any]:
        """Affiliate or reactivate a clinician under the hospital's network."""
        return self.repo.affiliate_doctor(hospital_id, doctor_id, department)

    def remove_doctor_affiliation(self, hospital_id: int, doctor_id: int) -> bool:
        """Deactivate clinician affiliation from the hospital's roster."""
        return self.repo.remove_doctor_affiliation(hospital_id, doctor_id)

    def get_hospital_doctors(self, hospital_id: int) -> List[Dict[str, Any]]:
        """List active affiliated clinicians with their specialty and active caseload."""
        return self.repo.get_hospital_doctors(hospital_id)

    def get_doctor_patients_for_hospital(
        self, hospital_id: int, doctor_id: int
    ) -> List[Dict[str, Any]]:
        """Fetch patient caseload for an affiliated clinician."""
        return self.repo.get_doctor_patients_for_hospital(hospital_id, doctor_id)

    # ── Patient EHR & Clinical Records Ingress ────────────────────────────────

    def lookup_patient_by_code(self, patient_code: str) -> Optional[Dict[str, Any]]:
        """Resolve patient profile by alphanumeric patient code."""
        return self.repo.lookup_patient_by_code(patient_code)

    def get_patient_prescriptions(self, patient_id: int) -> List[Dict[str, Any]]:
        """Retrieve historical prescription records for a patient."""
        return self.repo.get_patient_prescriptions(patient_id)

    def get_patient_prescription_detail(
        self, patient_id: int, prescription_id: int
    ) -> Optional[Dict[str, Any]]:
        """Retrieve detailed prescription including associated medication lines."""
        return self.repo.get_patient_prescription_detail(patient_id, prescription_id)

    def get_patient_current_medications(self, patient_id: int) -> List[Dict[str, Any]]:
        """Retrieve active medications currently taken by the patient."""
        return self.repo.get_patient_current_medications(patient_id)

    # ── Slot Management & Patient Scheduling ─────────────────────────────────

    def create_slot_for_doctor(
        self,
        hospital_id: int,
        doctor_id: int,
        clinic_id: int,
        slot_date: Any,
        start_time: Any,
        end_time: Any,
        max_patients: int = 1,
    ) -> Dict[str, Any]:
        """Create an appointment slot on behalf of an affiliated clinician."""
        return self.repo.create_slot_for_doctor(
            hospital_id, doctor_id, clinic_id, slot_date, start_time, end_time, max_patients
        )

    def update_slot(
        self,
        hospital_id: int,
        slot_id: int,
        slot_date: Any = None,
        start_time: Any = None,
        end_time: Any = None,
        max_patients: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update appointment slot scheduling or capacity constraints."""
        return self.repo.update_slot(
            hospital_id, slot_id, slot_date, start_time, end_time, max_patients
        )

    def delete_slot(self, hospital_id: int, slot_id: int) -> bool:
        """Remove an appointment slot owned by an affiliated clinician."""
        return self.repo.delete_slot(hospital_id, slot_id)

    def get_available_slots_for_doctor(
        self,
        doctor_id: int,
        from_date: Any = None,
        to_date: Any = None,
    ) -> List[Dict[str, Any]]:
        """Query future available consultation slots with remaining capacity."""
        return self.repo.get_available_slots_for_doctor(doctor_id, from_date, to_date)

    def book_appointment_for_patient(
        self,
        hospital_id: int,
        patient_code: str,
        doctor_id: int,
        slot_id: int,
        reason_for_visit: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Book a consultation appointment on behalf of an affiliated patient."""
        return self.repo.book_appointment_for_patient(
            hospital_id, patient_code, doctor_id, slot_id, reason_for_visit
        )


default_hospital_service = HospitalEnterpriseService()

