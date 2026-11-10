"""Domain entities and value objects for Clinical Appointments & Consultation Scheduling."""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional


class TimePeriod(str, Enum):
    """Clinical consultation appointment time windows."""
    MORNING = "morning"     # [06:00, 12:00)
    AFTERNOON = "afternoon" # [12:00, 17:00)
    EVENING = "evening"     # [17:00, 21:00)
    ANY = "any"             # All operational hours


class AppointmentStatus(str, Enum):
    """Lifecycle status of a consultation appointment."""
    BOOKED = "BOOKED"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


@dataclass(frozen=True)
class DoctorSearchResult:
    """Doctor profile match for patient browsing."""
    doctor_id: int
    doctor_name: str
    specialization: Optional[str]
    qualification: Optional[str]
    experience_years: Optional[int]
    about: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doctor_id": self.doctor_id,
            "doctor_name": self.doctor_name,
            "specialization": self.specialization,
            "qualification": self.qualification,
            "experience_years": self.experience_years,
            "about": self.about,
        }


@dataclass(frozen=True)
class AppointmentSlot:
    """Clinical appointment slot with real-time remaining capacity."""
    slot_id: int
    slot_date: str
    start_time: str
    end_time: str
    max_patients: int
    remaining_capacity: int
    clinic_id: Optional[int]
    clinic_name: Optional[str]
    clinic_address: Optional[str]
    suggested: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slot_id": self.slot_id,
            "slot_date": self.slot_date,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "max_patients": self.max_patients,
            "remaining_capacity": self.remaining_capacity,
            "clinic_id": self.clinic_id,
            "clinic_name": self.clinic_name,
            "clinic_address": self.clinic_address,
            "suggested": self.suggested,
        }


@dataclass
class AppointmentRecord:
    """Consultation booking record."""
    appointment_id: int
    patient_id: int
    doctor_id: int
    doctor_name: str
    doctor_specialty: Optional[str]
    slot_date: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    clinic_name: Optional[str]
    clinic_address: Optional[str]
    status: AppointmentStatus
    reason_for_visit: Optional[str]
    notes: Optional[str]
    created_at: Optional[str]

