from datetime import datetime, timedelta, timezone
from typing import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from database import db as user_database

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Validate JWT and return the current user dict directly from the token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception

        uid = payload.get("uid")
        role = payload.get("role")
        patient_id = payload.get("patient_id")
        doctor_id = payload.get("doctor_id")

        if uid is None or role is None:
            user = user_database.get_user_by_email(username)
            if user is None:
                raise credentials_exception
            return user

        return {
            "id": uid,
            "username": username,
            "role": role,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
        }
    except jwt.InvalidTokenError:
        raise credentials_exception


def require_role(*roles: str) -> Callable:
    """
    Dependency factory that restricts an endpoint to users with one of the
    specified roles. Comparison is case-insensitive.

    Usage:
        @router.get("/doctor-only")
        def some_endpoint(current_user: dict = Depends(require_role("doctor"))):
            ...
    """
    roles_upper = {r.upper() for r in roles}

    def _checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"].upper() not in roles_upper:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): {', '.join(roles)}. "
                    f"Your role: {current_user['role']}."
                ),
            )
        return current_user

    return _checker


def get_current_hospital(token: str = Depends(oauth2_scheme)) -> dict:
    """Validate JWT and return the hospital dictionary.

    This ensures that ONLY tokens explicitly issued to a hospital
    (via the separate hospital login) are accepted. Patient/Doctor
    tokens will be rejected here.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate hospital credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # We must import hospital service here to avoid circular dependencies
    from services import hospital as hospital_service

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # A hospital token uses "sub": "hospital:{id}" and "role": "HOSPITAL"
        role = payload.get("role")
        hospital_id = payload.get("hospital_id")
        
        if role != "HOSPITAL" or hospital_id is None:
            # Not a hospital token
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. This endpoint requires a hospital account.",
            )

        hospital = hospital_service.get_hospital_by_id(hospital_id)
        if hospital is None:
            raise credentials_exception
            
        if hospital["status"] != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hospital account is suspended or inactive.",
            )

        return hospital
    except jwt.InvalidTokenError:
        raise credentials_exception


def require_hospital() -> Callable:
    """Dependency that restricts an endpoint to active hospitals only."""
    return get_current_hospital
