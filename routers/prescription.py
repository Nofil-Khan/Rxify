"""Prescription domain endpoints — medicine info and share tokens.

Groups two previously separate routers into one prescription-scoped module:

  /api/medicine_info/p/{id}            — medication detail for a prescription
  /api/patient/share-tokens            — patient token management (auth required)
  /api/share/{token}/info              — public token preview
  /api/share/{token}/prescriptions     — public prescription read via token
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.security import get_current_user, require_role
from models.prescription import CreateShareToken
from services import prescription as prescription_service
from services import sharing as sharing_service
from services import patient as patient_service

router = APIRouter(tags=["prescription"])


# ---------------------------------------------------------------------------
# Request body schema for the patient-resolve endpoint
# ---------------------------------------------------------------------------
from pydantic import BaseModel as _BaseModel, Field as _Field  # noqa: E402


class _ResolveMedicineBody(_BaseModel):
    medicine_id: int = _Field(
        ..., gt=0, description="Catalog medicine_id chosen by the patient."
    )


# =============================================================================
# Medication info (auth required — patient or assigned doctor)
# =============================================================================

@router.get("/api/medicine_info/p/{prescription_id}")
async def get_medicine_info(
    prescription_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Return medication schedule details for a given prescription.

    Access is granted to:
    - The patient who owns the prescription
    - A doctor currently assigned to that patient

    **Access:** Patient or assigned Doctor.
    """
    meds = prescription_service.get_medicine_info(prescription_id, current_user["id"])
    if not meds:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription #{prescription_id} not found or access denied.",
        )
    return meds


# =============================================================================
# Share token management (auth required — patient only)
# =============================================================================

@router.post(
    "/api/patient/share-tokens",
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new share token",
)
def create_share_token(
    body: CreateShareToken,
    current_user: dict = Depends(require_role("patient")),
):
    """Generate a new prescription share token.

    The returned token string can be shared via any channel (WhatsApp, email, etc.).
    Whoever has it can view this patient's prescription history — no account needed.

    - **label**: Optional note so you remember who you shared it with.
    - **expires_in_days**: Default 7 days. Pass ``null`` for a never-expiring token.

    **Access:** Patient only.
    """
    record = sharing_service.generate_token(
        patient_user_id=current_user["id"],
        label=body.label,
        expires_in_days=body.expires_in_days,
    )
    return {"message": "Share token created successfully.", "token": record}


@router.get(
    "/api/patient/share-tokens",
    summary="List my share tokens",
)
def list_share_tokens(
    current_user: dict = Depends(require_role("patient")),
):
    """Return all share tokens created by this patient.

    Each token includes its current status: ``active``, ``expired``, or ``revoked``.

    **Access:** Patient only.
    """
    return {"tokens": sharing_service.list_tokens(current_user["id"])}


@router.delete(
    "/api/patient/share-tokens/{token_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke a share token",
)
def revoke_share_token(
    token_id: int,
    current_user: dict = Depends(require_role("patient")),
):
    """Immediately revoke a share token.

    Anyone currently using that token will instantly lose access.
    This action cannot be undone — create a new token if needed.

    **Access:** Patient only.
    """
    success = sharing_service.revoke_token(
        patient_user_id=current_user["id"],
        token_id=token_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Token {token_id} not found or does not belong to you.",
        )
    return {"message": f"Token {token_id} has been revoked successfully."}


# =============================================================================
# Public share endpoints (no auth required)
# =============================================================================

@router.get(
    "/api/share/{token}/info",
    summary="Preview token info (no login required)",
)
def get_token_info(token: str):
    """Return basic, non-sensitive info about a share token.

    Use this to confirm a token is valid and see whose records it unlocks
    before fetching the full prescription list.

    Returns the patient's display name, token label, and expiry date.

    **Access:** Public — no authentication required.
    """
    info = sharing_service.get_token_info(token)
    if info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This token is invalid, expired, or has been revoked.",
        )
    return info


@router.get(
    "/api/share/{token}/prescriptions",
    summary="View prescriptions via share token (no login required)",
)
def get_shared_prescriptions(token: str):
    """Return full prescription history for the patient who owns this token.

    No login or account is required — the token itself is the credential.
    Returns 404 if the token is invalid, expired, or has been revoked.

    **Access:** Public — no authentication required.
    """
    prescriptions = sharing_service.get_prescriptions_by_token(token)
    if prescriptions is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This token is invalid, expired, or has been revoked.",
        )
    return {"total": len(prescriptions), "prescriptions": prescriptions}


# =============================================================================
# Medicine clarification (auth required — patient only)
# =============================================================================

@router.get(
    "/api/patient/prescriptions/{prescription_id}/medicines/{pm_id}/candidates",
    summary="Get clarification candidates for an unresolved medicine",
)
def get_medicine_candidates(
    prescription_id: int,
    pm_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Return ranked catalog candidates for an AMBIGUOUS or UNRESOLVED medicine.

    Re-runs the medicine matcher pipeline on demand.  For AMBIGUOUS entries the
    same candidates the auto-matcher found are returned, enriched with catalog
    details (strength, form, category).  For UNRESOLVED entries a lower-threshold
    trigram search is used so the patient still gets useful suggestions.

    The ``prescription_id`` parameter is used only for URL clarity — the service
    layer re-validates ownership through the ``pm_id`` directly.

    **Access:** Authenticated patient who owns the prescription.
    """
    result = patient_service.get_medicine_candidates(
        pm_id=pm_id,
        patient_user_id=current_user["id"],
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription medicine #{pm_id} not found or access denied.",
        )
    return result


@router.patch(
    "/api/patient/prescriptions/{prescription_id}/medicines/{pm_id}/resolve",
    summary="Patient resolves an ambiguous/unresolved medicine",
)
def resolve_medicine(
    prescription_id: int,
    pm_id: int,
    body: _ResolveMedicineBody,
    current_user: dict = Depends(get_current_user),
):
    """Commit a patient-selected catalog medicine_id for an unresolved entry.

    Sets ``match_status = 'MATCHED'`` and ``patient_resolved = TRUE`` on the
    prescription medicine row, then triggers a dispensary re-evaluation so that
    stock availability is refreshed for the now-identified medicine.

    Returns the updated catalog details (generic_name, brand_name, strength, form,
    category) so the frontend can update the card immediately without a reload.

    **Access:** Authenticated patient who owns the prescription.
    """
    try:
        result = patient_service.resolve_prescription_medicine(
            pm_id=pm_id,
            medicine_id=body.medicine_id,
            patient_user_id=current_user["id"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription medicine #{pm_id} not found or access denied.",
        )
    return {"message": "Medicine resolved successfully.", "medicine": result}
