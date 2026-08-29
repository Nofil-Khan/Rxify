"""Doctor appointment router."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.security import require_role
from services import appointment as appointment_service

router = APIRouter(prefix="/api/doctor/appointments", tags=["doctor-appointments"])


def _doctor_id(current_user: dict) -> int:
    did = current_user.get("doctor_id")
    if not did:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No doctor profile found for this account.",
        )
    return did


class StatusUpdateSchema(BaseModel):
    status: str = Field(..., description="BOOKED | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW")


@router.get("")
def list_appointments(
    status: Optional[str] = Query(default=None, description="Status filter: all, booked, confirmed, completed, cancelled"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_role("doctor")),
):
    """Return appointments for the logged-in doctor."""
    did = _doctor_id(current_user)
    appointments = appointment_service.get_doctor_appointments(
        doctor_id=did,
        status_filter=status,
        limit=limit,
        offset=offset,
    )
    counts = appointment_service.get_appointment_counts(did)
    return {
        "total": len(appointments),
        "counts": counts,
        "appointments": appointments,
    }


@router.put("/{appointment_id}/status")
def update_status(
    appointment_id: int,
    body: StatusUpdateSchema,
    current_user: dict = Depends(require_role("doctor")),
):
    """Update appointment status."""
    did = _doctor_id(current_user)
    success = appointment_service.update_appointment_status(
        doctor_id=did,
        appointment_id=appointment_id,
        new_status=body.status,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found or update failed.",
        )
    return {"message": "Status updated successfully.", "status": body.status.upper()}


@router.get("/clinics")
def list_clinics(
    current_user: dict = Depends(require_role("doctor")),
):
    """List clinics available for this doctor."""
    did = _doctor_id(current_user)
    return {"clinics": appointment_service.get_doctor_clinics(did)}

