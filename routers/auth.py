from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from core.security import create_access_token
from database import db as user_database
from models.auth import UserRegister

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRegister):
    """Register a new user with a `patient` or `doctor` or `dispensary` role."""
    created = user_database.create_user(user.username, user.password, user.role)
    if not created:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )
    return {"message": "User created successfully.", "role": created["role"]}


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate and return a JWT token along with the user's role."""
    user = user_database.get_user_by_email(form_data.username)
    if not user or not user_database.verify_password(
        form_data.password, user["password_hash"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "uid": user["id"],
            "patient_id": user.get("patient_id"),
            "doctor_id": user.get("doctor_id"),
        }
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "user_id": user["id"],
        "doctor_id": user.get("doctor_id"),
        "patient_id": user.get("patient_id"),
    }

