"""Clinical Operations Package — Doctor Practice & Hospital Enterprise Module."""

from services.clinical_ops.domain import (
    AffiliatedDoctor,
    DoctorDashboardStats,
    HospitalDashboardData,
    HospitalProfile,
    PatientEHRSummary,
)
from services.clinical_ops.repository import (
    ClinicalOpsRepository,
    default_clinical_ops_repo,
)
from services.clinical_ops.hospital_service import (
    HospitalEnterpriseService,
    default_hospital_service,
)
from services.clinical_ops.doctor_service import (
    DoctorPracticeService,
    default_doctor_service,
)

__all__ = [
    "HospitalProfile",
    "AffiliatedDoctor",
    "PatientEHRSummary",
    "DoctorDashboardStats",
    "HospitalDashboardData",
    "ClinicalOpsRepository",
    "default_clinical_ops_repo",
    "HospitalEnterpriseService",
    "default_hospital_service",
    "DoctorPracticeService",
    "default_doctor_service",
]

