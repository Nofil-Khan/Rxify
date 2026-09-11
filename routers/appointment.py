"""Doctor appointment router — /api/doctor/appointments/...

Handles:
  - Viewing the doctor's own appointments (with filtering)
  - Updating appointment status
  - Listing associated clinics
  - Full slot CRUD (doctor manages their own availability)
    Hospital can ALSO manage slots via /api/hospital/appointments/...
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.security import require_role
from models.doctor import DoctorCreateSlotRequest, DoctorUpdateSlotRequest
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


# =============================================================================
# Appointment listing + status updates
# =============================================================================

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


# =============================================================================
# Slot management — doctor manages their own availability
# Hospital can ALSO manage slots for affiliated doctors via /api/hospital/...
# =============================================================================

@router.get("/slots")
def list_my_slots(
    current_user: dict = Depends(require_role("doctor")),
):
    """List all future available slots created by or for this doctor.

    **Access:** Doctor only.
    """
    did = _doctor_id(current_user)
    from services import hospital as hospital_service
    slots = hospital_service.get_available_slots_for_doctor(doctor_id=did)
    return {"total": len(slots), "slots": slots}


@router.post("/slots", status_code=status.HTTP_201_CREATED)
def create_slot(
    body: DoctorCreateSlotRequest,
    current_user: dict = Depends(require_role("doctor")),
):
    """Doctor creates their own appointment slot.

    **Access:** Doctor only.
    """
    did = _doctor_id(current_user)
    slot = appointment_service.create_slot(
        doctor_id=did,
        clinic_id=body.clinic_id,
        slot_date=body.slot_date,
        start_time=body.start_time,
        end_time=body.end_time,
        max_patients=body.max_patients,
    )
    return {"message": "Slot created successfully.", "slot": slot}


@router.put("/slots/{slot_id}")
def update_slot(
    slot_id: int,
    body: DoctorUpdateSlotRequest,
    current_user: dict = Depends(require_role("doctor")),
):
    """Doctor updates one of their own appointment slots.

    **Access:** Doctor only.
    """
    did = _doctor_id(current_user)
    updated = appointment_service.update_doctor_slot(
        doctor_id=did,
        slot_id=slot_id,
        slot_date=body.slot_date,
        start_time=body.start_time,
        end_time=body.end_time,
        max_patients=body.max_patients,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slot not found or does not belong to you.",
        )
    return {"message": "Slot updated.", "slot": updated}


@router.delete("/slots/{slot_id}", status_code=status.HTTP_200_OK)
def delete_slot(
    slot_id: int,
    current_user: dict = Depends(require_role("doctor")),
):
    """Doctor removes one of their own appointment slots.

    Only future slots with no active bookings can be deleted.

    **Access:** Doctor only.
    """
    did = _doctor_id(current_user)
    deleted = appointment_service.delete_doctor_slot(doctor_id=did, slot_id=slot_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slot not found, not owned by you, or has active bookings.",
        )
    return {"message": "Slot deleted successfully."}
