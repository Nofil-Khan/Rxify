"""High-level Authentication Service implementing business use-cases."""

from __future__ import annotations
from typing import Optional
from services.auth.domain import AuthUser, AuthResult
from services.auth.password_service import PasswordService
from services.auth.token_service import TokenService
from services.auth.repository import UserRepository


class AuthService:
    """Facade service for user authentication, registration, and credentials verification."""

    def __init__(
        self,
        repository: Optional[UserRepository] = None,
        password_service: Optional[PasswordService] = None,
        token_service: Optional[TokenService] = None,
    ):
        self._repo = repository or UserRepository()
        self._passwords = password_service or PasswordService()
        self._tokens = token_service or TokenService()

    def authenticate_general(self, email: str, plain_password: str) -> Optional[AuthResult]:
        """Authenticate a general platform user (PATIENT or DOCTOR). Returns AuthResult or None."""
        user = self._repo.get_by_email(email)
        if not user or not self._passwords.verify_password(plain_password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return self._build_auth_result(user)

    def authenticate_dispensary(self, email: str, plain_password: str) -> Optional[AuthResult]:
        """Authenticate a dispensary organization account. Returns AuthResult or None."""
        user = self._repo.get_dispensary_by_email(email)
        if not user or not self._passwords.verify_password(plain_password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return self._build_auth_result(user)

    def authenticate_hospital(self, email: str, plain_password: str) -> Optional[AuthResult]:
        """Authenticate an institutional hospital account. Returns AuthResult or None."""
        user = self._repo.get_hospital_by_email(email)
        if not user or not self._passwords.verify_password(plain_password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return self._build_auth_result(user)

    def register_user(self, email: str, plain_password: str, role: str, full_name: Optional[str] = None) -> Optional[AuthUser]:
        """Register a new patient or doctor account."""
        password_hash = self._passwords.hash_password(plain_password)
        return self._repo.create_user(email=email, password_hash=password_hash, role=role, full_name=full_name)

    def get_user_from_token(self, token: str) -> Optional[AuthUser]:
        """Decode JWT and return the active AuthUser."""
        try:
            claims = self._tokens.decode_token(token)
            if not claims.user_id:
                return None
            user = self._repo.get_by_id(claims.user_id)
            return user if user and user.is_active else None
        except Exception:
            return None

    def _build_auth_result(self, user: AuthUser) -> AuthResult:
        token = self._tokens.create_token(user)
        return AuthResult(
            access_token=token,
            token_type="bearer",
            role=user.role,
            user_id=user.user_id,
            email=user.email,
            display_name=user.display_name,
            doctor_id=user.doctor_id,
            doctor_code=f"RXF-D-{user.doctor_id}" if user.doctor_id else None,
            patient_id=user.patient_id,
            patient_code=user.patient_code,
            dispensary_id=user.dispensary_id,
            dispensary_code=f"RXF-DISP-{user.dispensary_id}" if user.dispensary_id else None,
            hospital_id=user.hospital_id,
        )


# Default singleton instance for direct dependency injection
default_auth_service = AuthService()

