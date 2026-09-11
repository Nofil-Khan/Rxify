"""Hospital-related Pydantic schemas.

Used by routers/hospital.py for hospital registration, login,
profile responses, patient data responses, and appointment management.
"""

from datetime import date, time
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# =============================================================================
# Request schemas — Auth
# =============================================================================

class HospitalRegister(BaseModel):
    """Registration request body for a new hospital."""
    name: str = Field(..., min_length=2, max_length=200, description="Hospital display name")
    email: EmailStr = Field(..., description="Login email — must be unique")
    password: str = Field(..., min_length=6, description="Will be bcrypt-hashed before storage")
    phone: Optional[str] = Field(None, description="Contact phone number")
    address: Optional[str] = Field(None, description="Full street address")
    city: Optional[str] = Field(None, description="City")
    state: Optional[str] = Field(None, description="State or province")
    registration_number: Optional[str] = Field(None, description="Government registration ID — must be unique if provided")


class HospitalLogin(BaseModel):
    """Login request body — email and password."""
    email: EmailStr
    password: str


# =============================================================================
# Request schemas — Doctor Affiliation
# =============================================================================

from typing import Optional, Union


class AffiliateDoctorRequest(BaseModel):
    """Affiliate a doctor to this hospital (direct add, no doctor approval required)."""
    doctor_id: Union[int, str] = Field(..., description="The doctor's numeric doctor_id or RXF-D-X code")
    department: Optional[str] = Field(None, description="Department/wing, e.g. 'Cardiology'")


# =============================================================================
# Request schemas — Appointment Slot (hospital creates on behalf of doctor)
# =============================================================================

class HospitalCreateSlotRequest(BaseModel):
    """Hospital creates an appointment slot for one of its affiliated doctors."""
    slot_date: date = Field(..., description="Date of the slot (YYYY-MM-DD)")
    start_time: time = Field(..., description="Slot start time (HH:MM)")
    end_time: time = Field(..., description="Slot end time (HH:MM)")
    clinic_id: int = Field(..., description="Clinic/location where the appointment is held")
    max_patients: int = Field(1, ge=1, le=50, description="Max concurrent bookings for this slot")


class HospitalUpdateSlotRequest(BaseModel):
    """Partial update for an existing appointment slot."""
    slot_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    max_patients: Optional[int] = Field(None, ge=1, le=50)


# =============================================================================
# Request schemas — Appointment Booking (hospital books for a patient)
# =============================================================================

class HospitalBookAppointmentRequest(BaseModel):
    """Hospital books an appointment for a patient with one of its doctors."""
    patient_code: str = Field(..., description="Patient's public RXF-P-XXXXX code")
    doctor_id: int = Field(..., description="Doctor to book with")
    slot_id: int = Field(..., description="The specific appointment slot to book")
    reason_for_visit: Optional[str] = Field(None, description="Optional reason / chief complaint")

