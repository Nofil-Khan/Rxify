from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from core.security import create_access_token
from database import user_database
from models.schemas import UserRegister

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register")
def register(user: UserRegister):
    created_user = user_database.create_user(user.username, user.password)
    if not created_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return {"message": "User created successfully"}


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = user_database.get_user(form_data.username)
    if not user or not user_database.verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}
