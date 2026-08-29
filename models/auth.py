"""Authentication-related Pydantic schemas.

Used by routers/auth.py for user registration and login.
"""

from pydantic import BaseModel, EmailStr, field_validator

_VALID_ROLES = {"PATIENT", "DOCTOR", "DISPENSARY"}


class UserRegister(BaseModel):
    username: EmailStr  # treated as email — kept as 'username' for OAuth2PasswordRequestForm compat
    password: str
    role: str = "PATIENT"

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in _VALID_ROLES:
            raise ValueError(f"role must be one of: {', '.join(sorted(_VALID_ROLES))}")
        return v_upper
