"""Authentication domain entities and value objects."""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class AuthUser:
    """Represents an authenticated user across any role in Rxify."""
    user_id: int
    email: str
    role: str
    password_hash: str
    status: str = "ACTIVE"
    display_name: Optional[str] = None
    patient_id: Optional[int] = None
    patient_code: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_specialty: Optional[str] = None
    dispensary_id: Optional[int] = None
    hospital_id: Optional[int] = None

    @property
    def is_active(self) -> bool:
        return (self.status or "").upper() == "ACTIVE"


@dataclass(frozen=True)
class TokenPayload:
    """Decoded JWT claims payload."""
    sub: str
    role: str
    user_id: Optional[int] = None
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    dispensary_id: Optional[int] = None
    hospital_id: Optional[int] = None


@dataclass(frozen=True)
class AuthResult:
    """Outcome of a successful authentication attempt."""
    access_token: str
    token_type: str
    role: str
    user_id: int
    email: str
    display_name: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_code: Optional[str] = None
    patient_id: Optional[int] = None
    patient_code: Optional[str] = None
    dispensary_id: Optional[int] = None
    dispensary_code: Optional[str] = None
    hospital_id: Optional[int] = None

