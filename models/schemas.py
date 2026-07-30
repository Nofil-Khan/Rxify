from typing import Optional

from pydantic import BaseModel, Field, field_validator


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


class SendMessage(BaseModel):
    receiver_id: int
    body: str = Field(..., min_length=1, max_length=2000)


class ScheduleVideoCall(BaseModel):
    patient_id: int
    scheduled_at: str  # ISO 8601 datetime, e.g. "2026-07-25T15:00:00"
    note: Optional[str] = Field(default=None, max_length=500)