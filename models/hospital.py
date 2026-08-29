"""Hospital-related Pydantic schemas.

Used by routers/hospital.py for hospital registration, login,
profile responses, and patient data responses.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# =============================================================================
# Request schemas
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
