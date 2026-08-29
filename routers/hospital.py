"""Hospital Module API endpoints — /api/hospital/...

Handles hospital registration, login, dashboard data, and patient lookup.
Provides access to patient prescriptions and medications via the public patient_code.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from core.security import create_access_token, require_hospital
from models.hospital import HospitalLogin, HospitalRegister
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
