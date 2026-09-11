"""Patient-related Pydantic schemas.

Used by routers/patient.py for doctor connection requests and patient-facing actions.
"""

from datetime import date
from typing import Optional, Union

from pydantic import BaseModel, Field


class RequestDoctorAssignment(BaseModel):
    """Request body for a patient sending a connection request to a doctor."""
    doctor_id: Union[int, str]


# =============================================================================
# Appointment schemas
# =============================================================================

class PatientBookAppointmentRequest(BaseModel):
    """Patient books or requests an appointment.

    The patient can either:
    - Provide a specific slot_id (exact booking), OR
    - Provide preferred_date + preferred_time_period for smart matching.

    Time periods:
        morning   → 06:00–12:00
        afternoon → 12:00–17:00
        evening   → 17:00–21:00
        any       → no preference, closest date wins
    """
    doctor_id: int = Field(..., description="Doctor to book with")
    slot_id: Optional[int] = Field(
        None,
        description="Specific slot to book. If omitted, smart matching is used.",
    )
    preferred_date: Optional[date] = Field(
        None,
        description="Preferred date (YYYY-MM-DD). Used when slot_id is not supplied.",
    )
    preferred_time_period: Optional[str] = Field(
        "any",
        description="morning | afternoon | evening | any",
    )
    reason_for_visit: Optional[str] = Field(None, description="Chief complaint or reason")

