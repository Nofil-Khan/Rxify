"""Patient care domain entities, adherence models, and timeline value objects."""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class MedicationCourseStatus(str, Enum):
    """Lifecycle status of a patient's active medication course."""
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    DISCONTINUED = "DISCONTINUED"
    ON_HOLD = "ON_HOLD"


class MedicationTransitionType(str, Enum):
    """Transition state of a medication between clinical milestones."""
    STARTED = "STARTED"
    CONTINUED = "CONTINUED"
    DISCONTINUED = "DISCONTINUED"
    COMPLETED = "COMPLETED"


@dataclass(frozen=True)
class PatientStats:
    """Dashboard metrics and counts for the patient portal."""
    patient_id: Optional[int]
    patient_code: Optional[str]
    full_name: str
    email: str
    rx_count: int = 0
    pending_requests: int = 0
    active_shares: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_id": self.patient_id,
            "patient_code": self.patient_code,
            "full_name": self.full_name,
            "email": self.email,
            "rx_count": self.rx_count,
            "pending_requests": self.pending_requests,
            "active_shares": self.active_shares,
        }


@dataclass(frozen=True)
class DoctorProfile:
    """Doctor public information visible to patients."""
    doctor_id: int
    doctor_code: str
    user_id: int
    username: str
    display_name: str
    specialty: Optional[str] = None
    license_number: Optional[str] = None
    experience_years: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.doctor_id,
            "doctor_code": self.doctor_code,
            "user_id": self.user_id,
            "username": self.username,
            "display_name": self.display_name,
            "specialty": self.specialty,
            "license_number": self.license_number,
            "experience_years": self.experience_years,
        }


@dataclass
class TimelineMedication:
    """Medication entry inside a clinical milestone."""
    current_medication_id: int
    prescription_medicine_id: int
    medicine_id: Optional[int]
    name: str
    generic_name: Optional[str]
    brand_name: Optional[str]
    strength: Optional[str]
    form: Optional[str]
    category: Optional[str]
    dosage: Optional[str]
    frequency: Optional[str]
    duration: Optional[str]
    instructions: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    status: str
    effective_status: str
    notes: Optional[str]
    prescription_id: Optional[int]
    doctor_name: Optional[str]
    diagnosis: Optional[str]
    node_item_id: Optional[str] = None
    transition: Optional[str] = None
    connected_from: Optional[str] = None


@dataclass
class TimelineMilestone:
    """Chronological milestone date node containing active and changed medications."""
    index: int
    date: str
    display_date: str
    title: str
    prescription_ids: List[int]
    doctors: List[str]
    diagnoses: List[str]
    total_active_meds: int
    medications: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class FlowchartLink:
    """Directional edge connecting medication states between timeline milestones."""
    id: str
    source: str
    target: str
    source_milestone: int
    target_milestone: int
    medicine_name: str
    type: str

