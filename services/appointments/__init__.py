"""Clinical Appointments & Consultation Scheduling Package.

Exposes domain entities, repositories, slot matchers, and booking services.
"""

from __future__ import annotations

from services.appointments.domain import (
    AppointmentRecord,
    AppointmentSlot,
    AppointmentStatus,
    DoctorSearchResult,
    TimePeriod,
)
from services.appointments.slot_matcher import SmartSlotMatcher, default_slot_matcher
from services.appointments.repository import AppointmentRepository, default_appointment_repo
from services.appointments.appointment_service import AppointmentBookingService, default_appointment_service

__all__ = [
    # Domain Models & Enums
    "AppointmentRecord",
    "AppointmentSlot",
    "AppointmentStatus",
    "DoctorSearchResult",
    "TimePeriod",
    # Service Classes
    "AppointmentBookingService",
    "AppointmentRepository",
    "SmartSlotMatcher",
    # Singletons
    "default_appointment_repo",
    "default_appointment_service",
    "default_slot_matcher",
]

