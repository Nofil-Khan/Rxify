"""Doctor-related Pydantic schemas.

Used by routers/doctor.py for profile management and request responses.
"""

from typing import Optional

from pydantic import BaseModel


class DoctorProfileUpdate(BaseModel):
    """Request body for updating a doctor's profile fields."""
    display_name: Optional[str] = None
    specialty: Optional[str] = None


class RespondToRequest(BaseModel):
    """Request body for a doctor accepting or rejecting a patient connection request."""
    accept: bool
