"""Domain entities for Doctor Practice & Hospital Enterprise Operations."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class HospitalProfile:
    """Hospital healthcare organization registry entity."""
    hospital_id: int
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    registration_number: Optional[str] = None
    status: str = "ACTIVE"
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hospital_id": self.hospital_id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "registration_number": self.registration_number,
            "status": self.status,
            "created_at": self.created_at,
        }


@dataclass(frozen=True)
class AffiliatedDoctor:
    """Doctor affiliated with a hospital enterprise."""
    doctor_id: int
    doctor_name: str
    doctor_email: str
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    license_number: Optional[str] = None
    experience_years: Optional[int] = None
    department: Optional[str] = None
    joined_at: Optional[str] = None
    active_patient_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doctor_id": self.doctor_id,
            "doctor_name": self.doctor_name,
            "doctor_email": self.doctor_email,
            "specialization": self.specialization,
            "qualification": self.qualification,
            "license_number": self.license_number,
            "experience_years": self.experience_years,
            "department": self.department,
            "joined_at": self.joined_at,
            "active_patient_count": self.active_patient_count,
        }


@dataclass(frozen=True)
class PatientEHRSummary:
    """Public patient EHR header accessed via patient_code."""
    patient_id: int
    patient_code: str
    full_name: str
    date_of_birth: Optional[str] = None
    blood_group: Optional[str] = None
    total_prescriptions: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_id": self.patient_id,
            "patient_code": self.patient_code,
            "full_name": self.full_name,
            "date_of_birth": self.date_of_birth,
            "blood_group": self.blood_group,
            "total_prescriptions": self.total_prescriptions,
        }


@dataclass(frozen=True)
class DoctorDashboardStats:
    """Operational KPI summary for doctor practice dashboard."""
    patient_count: int = 0
    rx_count: int = 0
    pending_requests: int = 0
    upcoming_followups: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_count": self.patient_count,
            "rx_count": self.rx_count,
            "pending_requests": self.pending_requests,
            "upcoming_followups": self.upcoming_followups,
        }


@dataclass(frozen=True)
class HospitalDashboardData:
    """Compliance audit statistics and recent access logs for hospital portals."""
    total_accesses: int = 0
    unique_patients_accessed: int = 0
    accesses_today: int = 0
    recent_activity: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_accesses": self.total_accesses,
            "unique_patients_accessed": self.unique_patients_accessed,
            "accesses_today": self.accesses_today,
            "recent_activity": self.recent_activity,
        }

