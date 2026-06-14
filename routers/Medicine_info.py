from fastapi import APIRouter, Depends, HTTPException, status
from services.Medicine import get_medicine_info
from core.security import get_current_user


router = APIRouter(prefix="/api/medicine_info", tags=["medicine_info"])

@router.get("/p/{prescription_id}")
async def read_medicine_info(prescription_id: int, current_user: dict = Depends(get_current_user)):
    return get_medicine_info(prescription_id, current_user["id"])