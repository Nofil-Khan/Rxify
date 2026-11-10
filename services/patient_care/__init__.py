"""Patient Care Domain Package.

Exposes domain entities, repositories, timeline generators, and patient services.
"""

from __future__ import annotations

from services.patient_care.domain import (
    DoctorProfile,
    FlowchartLink,
    MedicationCourseStatus,
    MedicationTransitionType,
    PatientStats,
    TimelineMedication,
    TimelineMilestone,
)
from services.patient_care.repository import PatientRepository, default_patient_repo
from services.patient_care.timeline_service import MedicationTimelineService, default_timeline_service
from services.patient_care.care_service import PatientCareService, default_care_service
from services.patient_care.reconciliation_service import MedicationReconciliationService, default_reconciliation_service

__all__ = [
    # Domain Models
    "DoctorProfile",
    "FlowchartLink",
    "MedicationCourseStatus",
    "MedicationTransitionType",
    "PatientStats",
    "TimelineMedication",
    "TimelineMilestone",
    # OOP Services & Repositories
    "MedicationTimelineService",
    "PatientCareService",
    "PatientRepository",
    "MedicationReconciliationService",
    # Singletons
    "default_care_service",
    "default_patient_repo",
    "default_timeline_service",
    "default_reconciliation_service",
]

