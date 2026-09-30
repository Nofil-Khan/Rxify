"""Medicine matching API endpoints.

Provides:
  POST /api/medicine/resolve          -- resolve a single medicine name
  POST /api/medicine/resolve-batch    -- resolve a list of medications
  GET  /api/medicine/search           -- lightweight catalog search
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import psycopg2.extras
from database.db import get_conn
from core.security import get_current_user
from services.medicine_matcher import resolve_medicine, resolve_prescription_medications

router = APIRouter(prefix="/api/medicine", tags=["medicine"])


# =============================================================================
# Request / Response schemas
# =============================================================================

class ResolveMedicineRequest(BaseModel):
    raw_name: str = Field(..., description="Medicine name as extracted from the prescription.")
    dosage: Optional[str] = Field(None, description="Dosage string, e.g. '500 mg' or '50/500mg'.")
    form: Optional[str] = Field(None, description="Dosage form, e.g. 'tablet', 'capsule'.")


class MedicationInput(BaseModel):
    raw_name: str
    dosage: Optional[str] = None
    form: Optional[str] = None


class ResolveBatchRequest(BaseModel):
    medications: List[MedicationInput] = Field(..., description="List of medications to resolve.")


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/resolve")
def resolve_single(
    body: ResolveMedicineRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Resolve a single extracted medicine name to a catalog entry.

    Returns one of: MATCHED, AMBIGUOUS, UNRESOLVED, NOT_A_MEDICINE.
    """
    return resolve_medicine(
        raw_name=body.raw_name,
        extracted_dosage=body.dosage,
        extracted_form=body.form,
    )


@router.post("/resolve-batch")
def resolve_batch(
    body: ResolveBatchRequest,
    current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Resolve a list of extracted medications (e.g. from a full prescription).

    Returns the same list with a ``match`` key added to each item.
    """
    meds = [m.model_dump() for m in body.medications]
    return resolve_prescription_medications(meds)


@router.get("/search")
def search_catalog(
    q: str = Query(..., min_length=2, description="Search term (medicine name or brand)"),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Lightweight catalog search — returns medicines whose generic or brand name
    contains the query string (ILIKE).  Useful for UI autocomplete.
    """
    pattern = f"%{q}%"
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, strength, form
                    FROM medicine
                    WHERE generic_name ILIKE %s OR brand_name ILIKE %s
                    ORDER BY
                        CASE WHEN LOWER(generic_name) = LOWER(%s) THEN 0
                             WHEN LOWER(brand_name)   = LOWER(%s) THEN 1
                             ELSE 2 END,
                        generic_name
                    LIMIT %s
                    """,
                    (pattern, pattern, q, q, limit),
                )
                rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")
