"""Doctor Practice Service — Clinician Caseload & Care Workflow.

Encapsulates business operations for doctor clinical practice: patient roster,
scoped medical records access, consultation request triage, and doctor profile management.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from services.clinical_ops.repository import ClinicalOpsRepository, default_clinical_ops_repo


class DoctorPracticeService:
    """Domain service orchestrating clinical workflows for healthcare practitioners."""

    def __init__(self, repo: Optional[ClinicalOpsRepository] = None):
        self.repo = repo or default_clinical_ops_repo

    # ── Prescription Management (Doctor-Scoped) ──────────────────────────────

    def get_prescriptions(
        self,
        doctor_id: int,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Return paginated prescriptions for patients assigned to this doctor."""
        return self.repo.get_doctor_prescriptions(
            doctor_id=doctor_id, search=search, limit=limit, offset=offset
        )

    def get_prescription_detail(
        self, doctor_id: int, prescription_id: int
    ) -> Optional[Dict[str, Any]]:
        """Return prescription details only if the doctor is assigned to that patient."""
        return self.repo.get_doctor_prescription_detail(doctor_id, prescription_id)

    # ── Patient Directory & Rosters ──────────────────────────────────────────

    def get_patients(self, doctor_id: int) -> List[Dict[str, Any]]:
        """Return summary of all patients assigned to this doctor."""
        return self.repo.get_doctor_patients(doctor_id)

    def get_patient_prescriptions_scoped(
        self, doctor_id: int, patient_user_id: int
    ) -> List[Dict[str, Any]]:
        """Return all prescriptions for an assigned patient with complete details."""
        return self.repo.get_patient_prescriptions_scoped(doctor_id, patient_user_id)

    def get_stats(self, doctor_id: int) -> Dict[str, Any]:
        """Aggregate practice statistics for the clinician dashboard."""
        return self.repo.get_doctor_stats(doctor_id)

    # ── Patient Connection & Triage ──────────────────────────────────────────

    def get_pending_requests(self, doctor_id: int) -> List[Dict[str, Any]]:
        """Return pending patient connection requests awaiting clinician review."""
        return self.repo.get_pending_requests(doctor_id)

    def respond_to_request(self, doctor_id: int, request_id: int, accept: bool) -> bool:
        """Accept or reject a patient connection request."""
        return self.repo.respond_to_request(doctor_id, request_id, accept)

    def lookup_patient_by_code(
        self, doctor_id: int, patient_code: str
    ) -> Optional[Dict[str, Any]]:
        """Lookup patient by code and determine relationship with this clinician."""
        return self.repo.lookup_patient_by_code_for_doctor(doctor_id, patient_code)

    def connect_patient(self, doctor_id: int, patient_code: str) -> Dict[str, Any]:
        """Directly connect doctor with patient via patient code."""
        return self.repo.doctor_connect_patient(doctor_id, patient_code)

    # ── Clinician Profile ────────────────────────────────────────────────────

    def update_profile(
        self,
        doctor_id: int,
        display_name: Optional[str] = None,
        specialty: Optional[str] = None,
    ) -> bool:
        """Update doctor's display name and clinical specialization."""
        return self.repo.update_doctor_profile(doctor_id, display_name, specialty)


default_doctor_service = DoctorPracticeService()

