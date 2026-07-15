from typing import Optional

from pydantic import BaseModel, field_validator


class UserRegister(BaseModel):
    username: str
    password: str
    role: str = "patient"

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in {"patient", "doctor"}:
            raise ValueError("role must be 'patient' or 'doctor'")
        return v


class DoctorProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    specialty: Optional[str] = None


class RequestDoctorAssignment(BaseModel):
    doctor_id: int


class RespondToRequest(BaseModel):
    accept: bool


class CreateShareToken(BaseModel):
    label: Optional[str] = None
    expires_in_days: Optional[int] = 7  # None = never expires