"""Hospital Module API endpoints — /api/hospital/...

Handles hospital registration, login, dashboard data, patient lookup,
doctor affiliation management, slot management, and appointment booking.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm

from core.security import create_access_token, require_hospital
from models.hospital import (
    AffiliateDoctorRequest,
    HospitalBookAppointmentRequest,
    HospitalCreateSlotRequest,
    HospitalLogin,
    HospitalRegister,
    HospitalUpdateSlotRequest,
)
from services import hospital as hospital_service

router = APIRouter(prefix="/api/hospital", tags=["hospital"])


# =============================================================================
# Auth & Registration
# =============================================================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_hospital(body: HospitalRegister):
    """Register a new hospital organization."""
    try:
        hospital = hospital_service.create_hospital(
            name=body.name,
            email=body.email,
            password=body.password,
            phone=body.phone,
            address=body.address,
            city=body.city,
            state=body.state,
            registration_number=body.registration_number,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if hospital is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered.",
        )

    return {"message": "Hospital registered successfully.", "hospital_id": hospital["hospital_id"]}


@router.post("/login")
def login_hospital(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate a hospital and return a JWT.
    
    This is entirely separate from the patient/doctor login.
    """
    hospital = hospital_service.authenticate_hospital(form_data.username, form_data.password)
    
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if hospital["status"] != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hospital account is suspended or inactive.",
        )

    # Note the specific sub and role for hospitals
    access_token = create_access_token(
        data={
            "sub": f"hospital:{hospital['hospital_id']}",
            "role": "HOSPITAL",
            "hospital_id": hospital["hospital_id"],
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": "HOSPITAL",
        "hospital_id": hospital["hospital_id"],
        "hospital_code": f"RXF-H-{hospital['hospital_id']}",
        "name": hospital["name"],
    }


# =============================================================================
# Hospital Profile & Dashboard
# =============================================================================

@router.get("/me")
def get_hospital_profile(
    current_hospital: dict = Depends(require_hospital()),
):
    """Return the authenticated hospital's profile."""
    # We strip out the password_hash and internal timestamps just in case
    return {
        "hospital_id": current_hospital["hospital_id"],
        "hospital_code": f"RXF-H-{current_hospital['hospital_id']}",
        "name": current_hospital["name"],
        "email": current_hospital["email"],
        "phone": current_hospital["phone"],
        "address": current_hospital["address"],
        "city": current_hospital["city"],
        "state": current_hospital["state"],
        "registration_number": current_hospital["registration_number"],
        "status": current_hospital["status"],
    }


@router.get("/dashboard")
def get_hospital_dashboard(
    current_hospital: dict = Depends(require_hospital()),
):
    """Return aggregated dashboard statistics for the hospital."""
    return hospital_service.get_dashboard_data(current_hospital["hospital_id"])


# =============================================================================
# Patient Lookup & Medical Data
# =============================================================================

@router.get("/patients/{patient_code}")
def lookup_patient(
    patient_code: str,
    current_hospital: dict = Depends(require_hospital()),
):
    """Look up a patient by their public patient_code (e.g. from a QR scan)."""
    patient = hospital_service.lookup_patient_by_code(patient_code)
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with code {patient_code} not found.",
        )
        
    # Log the access
    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="LOOKUP",
        entity_type="PATIENT",
        entity_id=patient["patient_id"],
        details=f"Looked up patient {patient_code}"
    )
    
    # Do not return the internal patient_id
    return {
        "patient_code": patient["patient_code"],
        "full_name": patient["full_name"],
        "date_of_birth": patient["date_of_birth"],
        "blood_group": patient["blood_group"],
    }


@router.get("/patients/{patient_code}/prescriptions")
def get_patient_prescriptions(
    patient_code: str,
    current_hospital: dict = Depends(require_hospital()),
):
    """Return all prescriptions for the identified patient."""
    patient = hospital_service.lookup_patient_by_code(patient_code)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    prescriptions = hospital_service.get_patient_prescriptions(patient["patient_id"])
    
    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="READ_PRESCRIPTIONS",
        entity_type="PATIENT",
        entity_id=patient["patient_id"],
        details=f"Viewed prescriptions list for {patient_code}"
    )
    
    return {"total": len(prescriptions), "prescriptions": prescriptions}


@router.get("/patients/{patient_code}/prescriptions/{prescription_id}")
def get_patient_prescription_detail(
    patient_code: str,
    prescription_id: int,
    current_hospital: dict = Depends(require_hospital()),
):
    """Return full detail (with medications) for a specific prescription."""
    patient = hospital_service.lookup_patient_by_code(patient_code)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    detail = hospital_service.get_patient_prescription_detail(
        patient_id=patient["patient_id"], 
        prescription_id=prescription_id
    )
    
    if not detail:
        raise HTTPException(status_code=404, detail="Prescription not found or access denied.")
        
    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="READ_PRESCRIPTION_DETAIL",
        entity_type="PRESCRIPTION",
        entity_id=prescription_id,
        details=f"Viewed prescription {prescription_id} for {patient_code}"
    )
    
    return detail


@router.get("/patients/{patient_code}/medications")
def get_patient_medications(
    patient_code: str,
    current_hospital: dict = Depends(require_hospital()),
):
    """Return current medications for the identified patient."""
    patient = hospital_service.lookup_patient_by_code(patient_code)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    medications = hospital_service.get_patient_current_medications(patient["patient_id"])
    
    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="READ_MEDICATIONS",
        entity_type="PATIENT",
        entity_id=patient["patient_id"],
        details=f"Viewed current medications for {patient_code}"
    )
    
    return {"total": len(medications), "medications": medications}


# =============================================================================
# Doctor Affiliation Management
# =============================================================================

@router.get("/doctors")
def list_affiliated_doctors(
    current_hospital: dict = Depends(require_hospital()),
):
    """List all active doctors affiliated with this hospital.

    Returns doctor name, specialization, department, and active patient count.

    **Access:** Hospital only.
    """
    doctors = hospital_service.get_hospital_doctors(current_hospital["hospital_id"])
    return {"total": len(doctors), "doctors": doctors}


def _parse_doc_identifier(val: str | int) -> int:
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


@router.post("/doctors", status_code=status.HTTP_201_CREATED)
def affiliate_doctor(
    body: AffiliateDoctorRequest,
    current_hospital: dict = Depends(require_hospital()),
):
    """Affiliate a doctor to this hospital (direct add — no doctor approval needed).
    If the doctor was previously removed, this reactivates the affiliation.
    Accepts numeric doctor_id or RXF-D-X code.
    **Access:** Hospital only.
    """
    doc_id = _parse_doc_identifier(body.doctor_id)
    try:
        affiliation = hospital_service.affiliate_doctor(
            hospital_id=current_hospital["hospital_id"],
            doctor_id=doc_id,
            department=body.department,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="AFFILIATE_DOCTOR",
        entity_type="DOCTOR",
        entity_id=doc_id,
        details=f"Affiliated doctor_id={doc_id} to hospital",
    )
    return {"message": "Doctor affiliated successfully.", "affiliation": affiliation}


@router.get("/dispensaries")
def list_hospital_dispensaries(
    current_hospital: dict = Depends(require_hospital()),
):
    """List all dispensaries affiliated with this hospital."""
    from database.db import get_conn
    import psycopg2.extras
    hid = current_hospital["hospital_id"]
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT d.dispensary_id,
                       CONCAT('RXF-DISP-', d.dispensary_id) AS dispensary_code,
                       d.name,
                       d.email,
                       d.phone,
                       d.location,
                       d.operating_hours,
                       d.avg_prep_minutes,
                       d.status,
                       d.created_at,
                       (SELECT COUNT(*) FROM inventory_dispensary_stock WHERE dispensary_id = d.dispensary_id) AS total_inventory_items,
                       (SELECT COUNT(*) FROM dispensary_request WHERE dispensary_id = d.dispensary_id AND status IN ('PENDING', 'PROCESSING')) AS active_queue_count
                FROM dispensary d
                WHERE d.hospital_id = %s
                ORDER BY d.dispensary_id ASC
                """,
                (hid,),
            )
            rows = [dict(r) for r in cur.fetchall()]
            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = str(r["created_at"])
            return {"total": len(rows), "dispensaries": rows}


@router.delete("/doctors/{doctor_id}", status_code=status.HTTP_200_OK)
def remove_doctor_affiliation(
    doctor_id: int,
    current_hospital: dict = Depends(require_hospital()),
):
    """Remove a doctor's affiliation from this hospital (soft-delete).

    The doctor's existing data is preserved; they just no longer appear in the roster.

    **Access:** Hospital only.
    """
    removed = hospital_service.remove_doctor_affiliation(
        hospital_id=current_hospital["hospital_id"],
        doctor_id=doctor_id,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active affiliation found for doctor_id={doctor_id}.",
        )
    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="REMOVE_DOCTOR_AFFILIATION",
        entity_type="DOCTOR",
        entity_id=doctor_id,
        details=f"Removed doctor_id={doctor_id} from hospital roster",
    )
    return {"message": "Doctor affiliation removed."}


@router.get("/doctors/{doctor_id}/patients")
def get_doctor_patients(
    doctor_id: int,
    current_hospital: dict = Depends(require_hospital()),
):
    """Return the list of patients a specific doctor has worked with.

    Only returns data if the doctor is currently affiliated with this hospital.
    Includes relationship type, status, and prescription history summary.

    **Access:** Hospital only.
    """
    try:
        patients = hospital_service.get_doctor_patients_for_hospital(
            hospital_id=current_hospital["hospital_id"],
            doctor_id=doctor_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="VIEW_DOCTOR_PATIENTS",
        entity_type="DOCTOR",
        entity_id=doctor_id,
        details=f"Viewed patient list for doctor_id={doctor_id}",
    )
    return {"doctor_id": doctor_id, "total": len(patients), "patients": patients}


# =============================================================================
# Appointment Slot Management (hospital manages on behalf of doctors)
# =============================================================================

@router.get("/appointments/doctors/{doctor_id}/slots")
def get_doctor_slots(
    doctor_id: int,
    from_date: Optional[date] = Query(default=None, description="Start of date range (YYYY-MM-DD). Defaults to today."),
    to_date: Optional[date] = Query(default=None, description="End of date range (YYYY-MM-DD). Optional."),
    current_hospital: dict = Depends(require_hospital()),
):
    """Return available appointment slots for a specific doctor.

    Only shows future slots with remaining capacity.

    **Access:** Hospital only.
    """
    slots = hospital_service.get_available_slots_for_doctor(
        doctor_id=doctor_id,
        from_date=from_date,
        to_date=to_date,
    )
    return {"doctor_id": doctor_id, "total": len(slots), "slots": slots}


@router.post("/appointments/doctors/{doctor_id}/slots", status_code=status.HTTP_201_CREATED)
def create_slot_for_doctor(
    doctor_id: int,
    body: HospitalCreateSlotRequest,
    current_hospital: dict = Depends(require_hospital()),
):
    """Create an appointment slot on behalf of an affiliated doctor.

    The doctor must be affiliated with this hospital.
    Both hospitals and doctors can create slots; doctors can also edit/delete them.

    **Access:** Hospital only.
    """
    try:
        slot = hospital_service.create_slot_for_doctor(
            hospital_id=current_hospital["hospital_id"],
            doctor_id=doctor_id,
            clinic_id=body.clinic_id,
            slot_date=body.slot_date,
            start_time=body.start_time,
            end_time=body.end_time,
            max_patients=body.max_patients,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    hospital_service.log_hospital_access(
        hospital_id=current_hospital["hospital_id"],
        action="CREATE_SLOT",
        entity_type="DOCTOR",
        entity_id=doctor_id,
        details=f"Created slot for doctor_id={doctor_id} on {body.slot_date}",
    )
    return {"message": "Slot created successfully.", "slot": slot}


@router.put("/appointments/slots/{slot_id}")
def update_slot(
    slot_id: int,
    body: HospitalUpdateSlotRequest,
    current_hospital: dict = Depends(require_hospital()),
):
    """Update an appointment slot owned by one of this hospital's affiliated doctors.

    **Access:** Hospital only.
    """
    updated = hospital_service.update_slot(
        hospital_id=current_hospital["hospital_id"],
        slot_id=slot_id,
        slot_date=body.slot_date,
        start_time=body.start_time,
        end_time=body.end_time,
        max_patients=body.max_patients,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slot not found or not owned by any of your affiliated doctors.",
        )
    return {"message": "Slot updated.", "slot": updated}


@router.delete("/appointments/slots/{slot_id}", status_code=status.HTTP_200_OK)
def delete_slot(
    slot_id: int,
    current_hospital: dict = Depends(require_hospital()),
):
    """Delete an appointment slot for one of this hospital's affiliated doctors.

    **Access:** Hospital only.
    """
    deleted = hospital_service.delete_slot(
        hospital_id=current_hospital["hospital_id"],
        slot_id=slot_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slot not found or not owned by any of your affiliated doctors.",
        )
    return {"message": "Slot deleted."}


# =============================================================================
# Hospital Books Appointment for a Patient
# =============================================================================

@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def book_appointment(
    body: HospitalBookAppointmentRequest,
    current_hospital: dict = Depends(require_hospital()),
):
    """Hospital books an appointment for a patient with one of its affiliated doctors.

    Requires:
    - `patient_code` — the patient's public RXF-P-XXXXX code
    - `doctor_id`    — must be affiliated with this hospital
    - `slot_id`      — must belong to that doctor and have remaining capacity

    **Access:** Hospital only.
    """
    try:
        appointment = hospital_service.book_appointment_for_patient(
            hospital_id=current_hospital["hospital_id"],
            patient_code=body.patient_code,
            doctor_id=body.doctor_id,
            slot_id=body.slot_id,
            reason_for_visit=body.reason_for_visit,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {
        "message": "Appointment booked successfully.",
        "appointment": appointment,
    }

