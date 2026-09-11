"""Doctor-related Pydantic schemas.

Used by routers/doctor.py for profile management and request responses.
"""

from datetime import date, time
from typing import Optional

from pydantic import BaseModel, Field


class DoctorProfileUpdate(BaseModel):
    """Request body for updating a doctor's profile fields."""
    display_name: Optional[str] = None
    specialty: Optional[str] = None


class RespondToRequest(BaseModel):
    """Request body for a doctor accepting or rejecting a patient connection request."""
    accept: bool


# =============================================================================
# Slot management (doctor creates / edits own availability slots)
# =============================================================================

class DoctorCreateSlotRequest(BaseModel):
    """Doctor creates their own appointment slot.

    The slot is tied to a clinic/location. Hospital managers can also
    create slots on behalf of doctors via the hospital API.
    """
    slot_date: date = Field(..., description="Date of the slot (YYYY-MM-DD)")
    start_time: time = Field(..., description="Slot start time (HH:MM:SS)")
    end_time: time = Field(..., description="Slot end time (HH:MM:SS)")
    clinic_id: int = Field(..., description="Clinic / location ID")
    max_patients: int = Field(1, ge=1, le=50, description="Max bookings for this slot")


class DoctorUpdateSlotRequest(BaseModel):
    """Partial update for a doctor's own appointment slot."""
    slot_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    max_patients: Optional[int] = Field(None, ge=1, le=50)

