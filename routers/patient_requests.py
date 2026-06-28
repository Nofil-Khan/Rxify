"""Patient-facing endpoints for doctor connection requests.

Patients can look up a doctor by their user ID, send a connection request,
and view the status of all their sent requests.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.security import require_role
from models.schemas import RequestDoctorAssignment
from services import patient_requests as req_service

router = APIRouter(prefix="/api/patient", tags=["patient"])


@router.get("/doctor/lookup/{doctor_id}")
def lookup_doctor(
    doctor_id: int,
    current_user: dict = Depends(require_role("patient")),
):
    """Look up a doctor by their numeric User ID before sending a request.

    Returns the doctor's username, display name, and specialty so the patient
    can confirm they have the right person.

    **Access:** Patient only.
    """
    doctor = req_service.lookup_doctor(doctor_id)
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No doctor found with User ID {doctor_id}.",
        )
    return doctor


@router.post("/request-doctor", status_code=status.HTTP_200_OK)
def request_doctor(
    body: RequestDoctorAssignment,
    current_user: dict = Depends(require_role("patient")),
):
    """Send a connection request to a doctor using their User ID.

    The doctor will see this in their Requests tab and can accept or reject.
    Once accepted, the doctor can view your prescription history.

    **Access:** Patient only.
    """
    result = req_service.send_request(
        patient_id=current_user["id"],
        doctor_id=body.doctor_id,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"],
        )
    return result


@router.get("/my-requests")
def my_requests(
    current_user: dict = Depends(require_role("patient")),
):
    """Return all connection requests this patient has sent, with their status.

    Status values: 'pending', 'accepted', 'rejected'.

    **Access:** Patient only.
    """
    return {
        "requests": req_service.get_my_requests(current_user["id"])
    }


@router.get("/my-doctor")
def my_assigned_doctor(
    current_user: dict = Depends(require_role("patient")),
):
    """Return the active doctor assigned to this patient.

    Returns null if no doctor is currently assigned.

    **Access:** Patient only.
    """
    doctor = req_service.get_my_assigned_doctor(current_user["id"])
    return {"doctor": doctor}
