"""Dispensary API endpoints — /api/dispensary/...

Full implementation of the Dispensary feature according to specification:
  - Auth: Register, Login, Me (role: DISPENSARY)
  - Inventory: Stock listing, Add/Update stock, Search central medicine catalog
  - Queue & Requests: FIFO Queue, Request Detail, Patient Verification
  - Status Workflow: Process (Reserve Stock), Ready, Dispense (Deduct Stock), Cancel
  - Dashboard & Alerts: Stats counters, Low Stock & Out of Stock alerts
  - Patient View: /api/patient/dispensary/requests
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile

from core.security import create_access_token, require_dispensary, require_role
from database.db import get_conn
import psycopg2.extras
from models.dispensary import (
    DispenseRequestBody,
    DispensaryLogin,
    DispensaryRegister,
    StockAddOrUpdateRequest,
    StockPartialUpdate,
)
from services import dispensary as dispensary_service

router = APIRouter(prefix="/api/dispensary", tags=["dispensary"])


# =============================================================================
# 1. Authentication & Registration
# =============================================================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_dispensary(body: DispensaryRegister):
    """Register a new dispensary organization under a hospital."""
    try:
        dispensary = dispensary_service.create_dispensary(
            hospital_id=body.hospital_id,
            name=body.name,
            email=body.email,
            password=body.password,
            phone=body.phone,
            location=body.location,
            operating_hours=body.operating_hours,
            avg_prep_minutes=body.avg_prep_minutes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if dispensary is None:
        raise HTTPException(status_code=409, detail="A dispensary with this email already exists.")

    return {
        "message": "Dispensary account created successfully.",
        "dispensary": dispensary,
    }


@router.post("/login")
def login_dispensary(body: DispensaryLogin):
    """Authenticate dispensary organization and return JWT access token."""
    dispensary = dispensary_service.authenticate_dispensary(body.email, body.password)
    if dispensary is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        data={
            "sub": dispensary["email"],
            "role": "DISPENSARY",
            "dispensary_id": dispensary["dispensary_id"],
            "hospital_id": dispensary["hospital_id"],
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": "DISPENSARY",
        "dispensary_id": dispensary["dispensary_id"],
        "dispensary_code": f"RXF-DISP-{dispensary['dispensary_id']}",
        "hospital_id": dispensary["hospital_id"],
        "name": dispensary["name"],
    }


@router.get("/me")
def get_dispensary_profile(current_dispensary: dict = Depends(require_dispensary())):
    """Return profile info of the currently logged-in dispensary."""
    profile = dict(current_dispensary)
    profile["dispensary_code"] = f"RXF-DISP-{current_dispensary['dispensary_id']}"
    return profile


@router.get("/lookup/{code}")
def lookup_code(
    code: str,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Look up a scanned patient_code, prescription_id, or request_id to find associated dispensary requests."""
    dispensary_id = current_dispensary["dispensary_id"]
    raw = code.strip().upper()

    # 1. Check patient code format
    clean_code = raw
    if "RXF-P-" in raw:
        idx = raw.find("RXF-P-")
        clean_code = raw[idx : idx + 11]
    elif raw.startswith("RXIFY:PATIENT:"):
        clean_code = raw.replace("RXIFY:PATIENT:", "")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Check patient match
            cur.execute(
                """
                SELECT req.request_id
                FROM dispensary_request req
                JOIN patient pt ON pt.patient_id = req.patient_id
                WHERE req.dispensary_id = %s AND UPPER(pt.patient_code) = %s
                ORDER BY req.created_at DESC
                LIMIT 5
                """,
                (dispensary_id, clean_code),
            )
            patient_matches = cur.fetchall()
            if patient_matches:
                req_details = [
                    dispensary_service.get_request_detail(dispensary_id, r["request_id"])
                    for r in patient_matches
                ]
                return {
                    "match_type": "patient",
                    "patient_code": clean_code,
                    "total": len(req_details),
                    "requests": [d for d in req_details if d],
                }

            # Check prescription match (e.g. RXF-RX-5 or 5)
            rx_clean = raw
            if "RXF-RX-" in rx_clean:
                rx_clean = rx_clean.replace("RXF-RX-", "")
            elif rx_clean.startswith("RXIFY:PRESCRIPTION:"):
                rx_clean = rx_clean.replace("RXIFY:PRESCRIPTION:", "")

            if rx_clean.isdigit():
                rx_id = int(rx_clean)
                cur.execute(
                    "SELECT request_id FROM dispensary_request WHERE dispensary_id = %s AND prescription_id = %s",
                    (dispensary_id, rx_id),
                )
                rx_match = cur.fetchone()
                if rx_match:
                    req_detail = dispensary_service.get_request_detail(dispensary_id, rx_match["request_id"])
                    return {
                        "match_type": "prescription",
                        "prescription_id": rx_id,
                        "total": 1,
                        "requests": [req_detail] if req_detail else [],
                    }

                # Check direct request_id
                req_detail = dispensary_service.get_request_detail(dispensary_id, rx_id)
                if req_detail:
                    return {
                        "match_type": "request",
                        "request_id": rx_id,
                        "total": 1,
                        "requests": [req_detail],
                    }

    raise HTTPException(status_code=404, detail=f"No matching dispensary requests found for code '{code}'.")



# =============================================================================
# 2. Master Medicine Catalog Search
# =============================================================================

@router.get("/catalog/medicines")
def search_medicine_catalog(
    q: Optional[str] = Query(None, description="Search query for brand or generic name"),
    limit: int = Query(20, ge=1, le=100),
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Search master medicine catalog to select medicines when adding stock."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if q:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, category, strength, form
                    FROM medicine
                    WHERE generic_name ILIKE %s OR brand_name ILIKE %s OR category ILIKE %s
                    ORDER BY generic_name ASC
                    LIMIT %s
                    """,
                    (f"%{q}%", f"%{q}%", f"%{q}%", limit),
                )
            else:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, category, strength, form
                    FROM medicine
                    ORDER BY generic_name ASC
                    LIMIT %s
                    """,
                    (limit,),
                )
            return [dict(r) for r in cur.fetchall()]


# =============================================================================
# 3. Inventory Stock Control
# =============================================================================

@router.get("/inventory")
def list_inventory(current_dispensary: dict = Depends(require_dispensary())):
    """List all medicine stock entries for the logged-in dispensary."""
    dispensary_id = current_dispensary["dispensary_id"]
    return dispensary_service.get_inventory_stock(dispensary_id)


@router.post("/inventory")
def add_or_update_stock(
    body: StockAddOrUpdateRequest,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Add or replace medicine stock in inventory."""
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        inv = dispensary_service.add_or_update_stock(
            dispensary_id=dispensary_id,
            medicine_id=body.medicine_id,
            available_quantity=body.available_quantity,
            reorder_level=body.reorder_level,
            unit=body.unit,
        )
        return {
            "message": "Inventory updated successfully.",
            "inventory": inv,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/inventory/bulk")
def bulk_add_stock(
    items: list[dict],
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Bulk import or update multiple medicine stock items in one request."""
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        return dispensary_service.bulk_add_or_update_stock(dispensary_id, items)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/inventory/csv")
async def import_csv_stock(
    file: UploadFile = File(...),
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Import inventory stock directly from a CSV file upload."""
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        content_bytes = await file.read()
        csv_text = content_bytes.decode("utf-8-sig")
        return dispensary_service.import_stock_from_csv(dispensary_id, csv_text)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"CSV import failed: {exc}")


@router.patch("/inventory/{inventory_id}")
def update_stock_partial(
    inventory_id: int,
    body: StockPartialUpdate,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Partially update stock fields (available_quantity, reorder_level, unit)."""
    dispensary_id = current_dispensary["dispensary_id"]
    inv = dispensary_service.update_stock_partial(
        dispensary_id=dispensary_id,
        inventory_id=inventory_id,
        available_quantity=body.available_quantity,
        reorder_level=body.reorder_level,
        unit=body.unit,
    )
    if inv is None:
        raise HTTPException(status_code=404, detail="Stock item not found.")

    return {
        "message": "Stock updated successfully.",
        "inventory": inv,
    }


# =============================================================================
# 4. Queue & Requests Management
# =============================================================================

@router.get("/queue")
def get_dispensary_queue(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_dispensary: dict = Depends(require_dispensary()),
):
    """View active queue for dispensary in FIFO order."""
    dispensary_id = current_dispensary["dispensary_id"]
    return dispensary_service.get_dispensary_queue(dispensary_id, status_filter)


@router.get("/requests/{request_id}")
def get_request_detail(
    request_id: int,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Get complete request detail with patient verification info and item statuses."""
    dispensary_id = current_dispensary["dispensary_id"]
    detail = dispensary_service.get_request_detail(dispensary_id, request_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Request not found.")
    return detail


# =============================================================================
# 5. Status Workflow Actions (Process, Ready, Dispense, Cancel)
# =============================================================================

@router.post("/requests/{request_id}/process")
def process_request(
    request_id: int,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Transition request status to PROCESSING and reserve available stock."""
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        updated = dispensary_service.process_request(dispensary_id, request_id)
        return {
            "message": "Request is now being processed. Stock reserved.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/requests/{request_id}/ready")
def mark_request_ready(
    request_id: int,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Mark request as READY for collection and notify patient."""
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        updated = dispensary_service.mark_request_ready(dispensary_id, request_id)
        return {
            "message": "Request marked READY for collection.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/requests/{request_id}/dispense")
def dispense_request(
    request_id: int,
    body: Optional[DispenseRequestBody] = None,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Finalize dispensing: deduct physical stock, clear reservation, set DISPENSED status."""
    dispensary_id = current_dispensary["dispensary_id"]
    items_input = [i.model_dump() for i in body.items] if body and body.items else None
    notes = body.notes if body else None

    try:
        updated = dispensary_service.dispense_request(
            dispensary_id=dispensary_id,
            request_id=request_id,
            items_input=items_input,
            notes=notes,
        )
        return {
            "message": "Medicines successfully dispensed. Stock updated.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/requests/{request_id}/cancel")
def cancel_request(
    request_id: int,
    notes: Optional[str] = Query(None, description="Reason for cancellation"),
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Cancel request and release any reserved stock."""
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        updated = dispensary_service.cancel_request(dispensary_id, request_id, notes)
        return {
            "message": "Request cancelled. Reserved stock released.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# =============================================================================
# 6. Dashboard & Alerts
# =============================================================================

@router.get("/dashboard")
def get_dashboard_stats(current_dispensary: dict = Depends(require_dispensary())):
    """Get status counters and inventory statistics for dashboard."""
    dispensary_id = current_dispensary["dispensary_id"]
    return dispensary_service.get_dashboard_stats(dispensary_id)


@router.get("/alerts")
def get_inventory_alerts(current_dispensary: dict = Depends(require_dispensary())):
    """Get low-stock and out-of-stock items for alerts screen."""
    dispensary_id = current_dispensary["dispensary_id"]
    return dispensary_service.get_inventory_alerts(dispensary_id)


# =============================================================================
# 7. Patient View Endpoints
# =============================================================================

@router.get("/patient/requests", tags=["patient"])
def get_patient_dispensary_requests(current_user: dict = Depends(require_role("PATIENT"))):
    """Get all dispensary requests and live status/ETA for the logged-in patient."""
    patient_id = current_user.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="No patient profile found for this account.")

    return dispensary_service.get_patient_dispensary_requests(patient_id)
