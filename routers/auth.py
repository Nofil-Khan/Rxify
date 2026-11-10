from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from models.auth import UserRegister
from services.auth import default_auth_service

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRegister):
    """Register a new user with a patient or doctor role."""
    created = default_auth_service.register_user(
        email=user.username,
        plain_password=user.password,
        role=user.role,
    )
    if not created:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )
    return {"message": "User created successfully.", "role": created.role}


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate and return a JWT token along with the user's role."""
    result = default_auth_service.authenticate_general(
        email=form_data.username,
        plain_password=form_data.password,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "access_token": result.access_token,
        "token_type": result.token_type,
        "role": result.role,
        "user_id": result.user_id,
        "display_name": result.display_name,
        "doctor_id": result.doctor_id,
        "doctor_code": result.doctor_code,
        "patient_id": result.patient_id,
        "patient_code": result.patient_code,
        "dispensary_id": result.dispensary_id,
    }


