"""JWT token issuance and verification service."""

from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt

from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from services.auth.domain import AuthUser, TokenPayload


class TokenService:
    """Encapsulates JSON Web Token creation, claims embedding, and verification."""

    def __init__(self, secret_key: str = SECRET_KEY, algorithm: str = ALGORITHM, expire_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES):
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._expire_minutes = expire_minutes

    def create_token(self, user: AuthUser, custom_expires_minutes: Optional[int] = None) -> str:
        """Issue a signed JWT for the given AuthUser with all necessary role claims."""
        mins = custom_expires_minutes or self._expire_minutes
        expire = datetime.now(timezone.utc) + timedelta(minutes=mins)

        claims = {
            "sub": user.email,
            "role": user.role,
            "uid": user.user_id,
            "exp": expire,
            "patient_id": user.patient_id,
            "doctor_id": user.doctor_id,
            "dispensary_id": user.dispensary_id,
            "hospital_id": user.hospital_id,
        }
        return jwt.encode(claims, self._secret_key, algorithm=self._algorithm)

    def decode_token(self, token: str) -> TokenPayload:
        """Decode and validate claims from an incoming JWT. Raises jwt.PyJWTError on failure."""
        payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
        return TokenPayload(
            sub=payload.get("sub", ""),
            role=payload.get("role", ""),
            user_id=payload.get("uid"),
            patient_id=payload.get("patient_id"),
            doctor_id=payload.get("doctor_id"),
            dispensary_id=payload.get("dispensary_id"),
            hospital_id=payload.get("hospital_id"),
        )

