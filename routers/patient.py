"""Patient-facing API endpoints — /api/patient/...

Patients can:
  - Look up a doctor before sending a request
  - Send / view connection requests to doctors
  - See their assigned doctor
  - View their own prescriptions (list and detail)
  - View their dashboard stats
  - Search doctors by specialty and browse available slots
  - Book appointments (with smart time-period matching)
  - View and cancel their own appointments

All routes require a valid JWT with role = PATIENT.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.security import require_role
from models.patient import PatientBookAppointmentRequest, RequestDoctorAssignment
from services import patient as patient_service
from services import patient_appointment as appt_service

router = APIRouter(prefix="/api/patient", tags=["patient"])


def _parse_doctor_identifier(val: str | int) -> int:
    s = str(val).strip().upper()
    if s.startswith("RXF-D-"):
        s = s[6:]
    elif s.startswith("DOC-"):
        s = s[4:]
    elif s.startswith("RXIFY:DOCTOR:"):
        s = s[13:]
    try:
        return int(s)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid doctor identifier: '{val}'. Expected numeric ID or RXF-D-X.",
        )


# =============================================================================
# Doctor connection requests
# =============================================================================

@router.get("/doctor/lookup/{doctor_id}")
def lookup_doctor(
    doctor_id: str,
    current_user: dict = Depends(require_role("patient")),
):
    """Look up a doctor by their ID or RXF-D-X code before sending a connection request.

    Returns the doctor's username, display name, and specialty so the patient
    can confirm they have the right person.

    **Access:** Patient only.
    """
    did = _parse_doctor_identifier(doctor_id)
    doctor = patient_service.lookup_doctor(did)
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No doctor found with ID or code '{doctor_id}'.",
        )
    return doctor


@router.post("/request-doctor", status_code=status.HTTP_200_OK)
def request_doctor(
    body: RequestDoctorAssignment,
    current_user: dict = Depends(require_role("patient")),
):
    """Send a connection request to a doctor using their ID or RXF-D-X code.

    The doctor will see this in their Requests tab and can accept or reject.
    Once accepted, the doctor can view this patient's prescription history.

    **Access:** Patient only.
    """
    did = _parse_doctor_identifier(body.doctor_id)
    result = patient_service.send_doctor_request(
        patient_user_id=current_user["id"],
        doctor_id=did,
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


# =============================================================================
# Appointment — Doctor Discovery
# =============================================================================

@router.get("/appointments/doctors")
def search_doctors(
    specialty: Optional[str] = Query(
        default=None,
        description="Filter by specialization (case-insensitive partial match). "
                    "Leave empty to list all doctors.",
    ),
    current_user: dict = Depends(require_role("patient")),
):
    """Search for doctors by specialty to find one to book with.

    **Access:** Patient only.
    """
    doctors = appt_service.search_doctors_by_specialty(specialty=specialty)
    return {"total": len(doctors), "doctors": doctors}


@router.get("/appointments/doctors/{doctor_id}/slots")
def get_doctor_slots(
    doctor_id: int,
    preferred_date: Optional[str] = Query(
        default=None,
        description="Preferred date (YYYY-MM-DD). Defaults to today.",
    ),
    time_period: str = Query(
        default="any",
        description="Preferred time window: morning (6–12), afternoon (12–17), evening (17–21), or any.",
    ),
    current_user: dict = Depends(require_role("patient")),
):
    """Browse available appointment slots for a specific doctor.

    Slots matching the preferred time period appear first with `suggested: false`.
    Fallback slots (outside the window) appear with `suggested: true`.

    **Access:** Patient only.
    """
    from datetime import date
    parsed_date = None
    if preferred_date:
        try:
            parsed_date = date.fromisoformat(preferred_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid preferred_date format. Use YYYY-MM-DD.",
            )

    slots = appt_service.get_available_slots_smart(
        doctor_id=doctor_id,
        preferred_date=parsed_date,
        time_period=time_period.lower(),
    )
    return {
        "doctor_id": doctor_id,
        "preferred_date": preferred_date,
        "time_period": time_period,
        "total": len(slots),
        "slots": slots,
    }


# =============================================================================
# Appointment — Booking
# =============================================================================

@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def book_appointment(
    body: PatientBookAppointmentRequest,
    current_user: dict = Depends(require_role("patient")),
):
    """Book an appointment with a doctor.

    **Two modes:**

    1. **Exact booking** — provide `slot_id`. Books that specific slot directly.
    2. **Smart booking** — provide `preferred_date` + `preferred_time_period`.
       The system picks the best available slot and books it automatically.
       The response includes `slot_matched_preference: true/false` to indicate
       whether the preferred window was met or a fallback slot was used.

    **Access:** Patient only.
    """
    try:
        appointment = appt_service.book_appointment(
            patient_user_id=current_user["id"],
            doctor_id=body.doctor_id,
            slot_id=body.slot_id,
            preferred_date=body.preferred_date,
            time_period=body.preferred_time_period or "any",
            reason_for_visit=body.reason_for_visit,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"message": "Appointment booked successfully.", "appointment": appointment}


# =============================================================================
# Appointment — View & Cancel
# =============================================================================

@router.get("/appointments")
def my_appointments(
    status: Optional[str] = Query(
        default=None,
        description="Filter by status: booked, confirmed, completed, cancelled, no_show, all.",
    ),
    current_user: dict = Depends(require_role("patient")),
):
    """Return all appointments for this patient, newest first.

    Each entry includes doctor name, specialty, slot date/time, clinic, and status.

    **Access:** Patient only.
    """
    appointments = appt_service.get_patient_appointments(
        patient_user_id=current_user["id"],
        status_filter=status,
    )
    return {"total": len(appointments), "appointments": appointments}


@router.delete("/appointments/{appointment_id}", status_code=status.HTTP_200_OK)
def cancel_appointment(
    appointment_id: int,
    current_user: dict = Depends(require_role("patient")),
):
    """Cancel one of this patient's own appointments.

    Only appointments in BOOKED or CONFIRMED status can be cancelled.

    **Access:** Patient only.
    """
    cancelled = appt_service.cancel_appointment(
        patient_user_id=current_user["id"],
        appointment_id=appointment_id,
    )
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found, not yours, or cannot be cancelled (already completed/cancelled).",
        )
    return {"message": "Appointment cancelled successfully.", "appointment_id": appointment_id}


# =============================================================================
# Dispensary Requests (Patient View)
# =============================================================================

@router.get("/dispensary-requests")
def my_dispensary_requests(
    current_user: dict = Depends(require_role("patient")),
):
    """Return all dispensary requests, medicine statuses, and collection ETAs for this patient."""
    from services import dispensary as dispensary_service
    patient_id = current_user.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="No patient profile found for this account.")
    return {"requests": dispensary_service.get_patient_dispensary_requests(patient_id)}

