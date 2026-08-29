"""Patient-facing API endpoints — /api/patient/...

Patients can:
  - Look up a doctor before sending a request
  - Send / view connection requests to doctors
  - See their assigned doctor
  - View their own prescriptions (list and detail)
  - View their dashboard stats

All routes require a valid JWT with role = PATIENT.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.security import require_role
from models.patient import RequestDoctorAssignment
from services import patient as patient_service

router = APIRouter(prefix="/api/patient", tags=["patient"])


# =============================================================================
# Doctor connection requests
# =============================================================================

@router.get("/doctor/lookup/{doctor_id}")
def lookup_doctor(
    doctor_id: int,
    current_user: dict = Depends(require_role("patient")),
):
    """Look up a doctor by their numeric ID before sending a connection request.

    Returns the doctor's username, display name, and specialty so the patient
    can confirm they have the right person.

    **Access:** Patient only.
    """
    doctor = patient_service.lookup_doctor(doctor_id)
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No doctor found with ID {doctor_id}.",
        )
    return doctor


@router.post("/request-doctor", status_code=status.HTTP_200_OK)
def request_doctor(
    body: RequestDoctorAssignment,
    current_user: dict = Depends(require_role("patient")),
):
    """Send a connection request to a doctor using their ID.

    The doctor will see this in their Requests tab and can accept or reject.
    Once accepted, the doctor can view this patient's prescription history.

    **Access:** Patient only.
    """
    result = patient_service.send_doctor_request(
        patient_user_id=current_user["id"],
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

    Status values: ``pending``, ``accepted``, ``rejected``.

    **Access:** Patient only.
    """
    return {"requests": patient_service.get_my_requests(current_user["id"])}


@router.get("/my-doctor")
def my_assigned_doctor(
    current_user: dict = Depends(require_role("patient")),
):
    """Return the active doctor currently assigned to this patient.

    Returns ``null`` if no doctor is currently assigned.

    **Access:** Patient only.
    """
    return {"doctor": patient_service.get_assigned_doctor(current_user["id"])}


# =============================================================================
# Patient prescriptions & stats
# =============================================================================

@router.get("/stats")
def my_stats(
    current_user: dict = Depends(require_role("patient")),
):
    """Return overview statistics for the patient dashboard.

    Includes: total prescription count, pending doctor requests, active share tokens.

    **Access:** Patient only.
    """
    return patient_service.get_patient_stats(current_user["id"])


@router.get("/prescriptions")
def my_prescriptions(
    current_user: dict = Depends(require_role("patient")),
):
    """Return all prescriptions uploaded by this patient, newest first.

    A patient can only see their own records.

    **Access:** Patient only.
    """
    records = patient_service.get_my_prescriptions(current_user["id"])
    return {"total": len(records), "prescriptions": records}


@router.get("/prescriptions/{prescription_id}")
def my_prescription_detail(
    prescription_id: int,
    current_user: dict = Depends(require_role("patient")),
):
    """Return full detail (including medications) for one of this patient's prescriptions.

    Returns 404 if the prescription does not exist or belongs to someone else.

    **Access:** Patient only.
    """
    detail = patient_service.get_my_prescription_detail(
        patient_user_id=current_user["id"],
        prescription_id=prescription_id,
    )
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription {prescription_id} not found or access denied.",
        )
    return detail
