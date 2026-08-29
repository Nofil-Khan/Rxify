"""Doctor-only API endpoints.

All routes are protected by `require_role("doctor")`.
All prescription queries are scoped to the doctor's assigned patients only —
a doctor cannot see any data for patients they are not connected to.

NOTE: current_user["doctor_id"] is the doctor.doctor_id (profile row),
      current_user["id"]        is the users.user_id.
All service functions use doctor_id.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.security import require_role
from models.doctor import DoctorProfileUpdate, RespondToRequest
from services import doctor as doctor_service

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


def _doctor_id(current_user: dict) -> int:
    """Extract doctor_id from the current user token dict."""
    did = current_user.get("doctor_id")
    if not did:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No doctor profile found for this account.",
        )
    return did


@router.get("/stats")
def get_stats(
    current_user: dict = Depends(require_role("doctor")),
):
    """Return dashboard statistics for the logged-in doctor.

    Includes: assigned patient count, total prescriptions, pending requests,
    and upcoming follow-up count (within 7 days).

    **Access:** Doctor only.
    """
    return doctor_service.get_doctor_stats(_doctor_id(current_user))


@router.get("/my-patients")
def list_my_patients(
    current_user: dict = Depends(require_role("doctor")),
):
    """Return the list of patients currently assigned to this doctor.

    Each entry includes the patient's username, display name, assignment date,
    and a count of their uploaded prescriptions.

    **Access:** Doctor only.
    """
    return {"patients": doctor_service.get_my_patients(_doctor_id(current_user))}


@router.get("/prescriptions")
def list_prescriptions(
    search: Optional[str] = Query(
        default=None,
        description="Optional filter. Case-insensitive partial match against patient_name, diagnosis, or clinic_name.",
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_role("doctor")),
):
    """Return paginated prescriptions for this doctor's assigned patients only.

    A doctor can NEVER see prescriptions of patients they are not assigned to.

    **Access:** Doctor only.
    """
    records = doctor_service.get_my_prescriptions(
        doctor_id=_doctor_id(current_user),
        search=search,
        limit=limit,
        offset=offset,
    )
    return {
        "total": len(records),
        "limit": limit,
        "offset": offset,
        "prescriptions": records,
    }


@router.get("/prescriptions/{prescription_id}")
def get_prescription(
    prescription_id: int,
    current_user: dict = Depends(require_role("doctor")),
):
    """Return full detail of a single prescription.

    Returns 404 if the prescription does not exist OR if this doctor is not
    assigned to the patient who uploaded it.

    **Access:** Doctor only.
    """
    detail = doctor_service.get_my_prescription_detail(
        doctor_id=_doctor_id(current_user),
        prescription_id=prescription_id,
    )
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription {prescription_id} not found or access denied.",
        )
    return detail


@router.get("/patients/{user_id}/prescriptions")
def get_patient_history(
    user_id: int,
    current_user: dict = Depends(require_role("doctor")),
):
    """Return all prescriptions for a specific assigned patient.

    Returns 404 if the patient is not assigned to this doctor.

    **Access:** Doctor only.
    """
    records = doctor_service.get_patient_prescriptions_scoped(
        doctor_id=_doctor_id(current_user),
        patient_user_id=user_id,
    )
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No prescriptions found for user_id={user_id} or patient not assigned to you.",
        )
    return {"user_id": user_id, "total": len(records), "prescriptions": records}


@router.get("/requests")
def list_pending_requests(
    current_user: dict = Depends(require_role("doctor")),
):
    """Return all pending patient connection requests for this doctor.

    **Access:** Doctor only.
    """
    return {"requests": doctor_service.get_pending_requests(_doctor_id(current_user))}


@router.post("/requests/{request_id}/respond", status_code=status.HTTP_200_OK)
def respond_to_request(
    request_id: int,
    body: RespondToRequest,
    current_user: dict = Depends(require_role("doctor")),
):
    """Accept or reject a patient's connection request.

    When accepted, the patient is added to this doctor's assigned patients list
    and their prescriptions become visible immediately.

    **Access:** Doctor only.
    """
    success = doctor_service.respond_to_request(
        doctor_id=_doctor_id(current_user),
        request_id=request_id,
        accept=body.accept,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or already responded to.",
        )
    action = "accepted" if body.accept else "rejected"
    return {"message": f"Request {action} successfully.", "accepted": body.accept}


@router.get("/profile")
def get_profile(
    current_user: dict = Depends(require_role("doctor")),
):
    """Return the doctor's profile (username, display name, specialty).

    **Access:** Doctor only.
    """
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "display_name": current_user.get("display_name"),
        "specialty": current_user.get("specialty"),
        "doctor_id": current_user.get("doctor_id"),
    }


@router.put("/profile")
def update_profile(
    body: DoctorProfileUpdate,
    current_user: dict = Depends(require_role("doctor")),
):
    """Update the doctor's display name and/or specialty.

    **Access:** Doctor only.
    """
    success = doctor_service.update_doctor_profile(
        doctor_id=_doctor_id(current_user),
        display_name=body.display_name,
        specialty=body.specialty,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile.",
        )
    return {"message": "Profile updated successfully."}
