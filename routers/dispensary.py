"""Dispensary API endpoints — /api/dispensary/...

Full implementation of the Dispensary feature according to specification:
  - Auth: Register, Login, Me (role: DISPENSARY)
  - Inventory: Stock listing, Add/Update stock, Search central medicine catalog
  - Queue & Requests: FIFO Queue, Request Detail, Patient Verification
  - Status Workflow: Process (Reserve Stock), Ready, Dispense (Deduct Stock), Cancel
  - Dashboard & Alerts: Stats counters, Low Stock & Out of Stock alerts
  - Patient View: /api/patient/dispensary/requests
  - Availability Layer (read-only):
      GET  /api/dispensary/{dispensary_id}/medicines/{medicine_id}/availability
      POST /api/dispensary/{dispensary_id}/availability
"""

from __future__ import annotations

from typing import Optional
import json
from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile, WebSocket, WebSocketDisconnect

from core.security import create_access_token, require_dispensary, require_role
from database.db import get_conn
import psycopg2.extras
from models.dispensary import (
    ApproveRequestBody,
    AvailabilityMedicineInput,
    DispenseRequestBody,
    DispensaryLogin,
    DispensaryLocationUpdate,
    DispensaryRegister,
    PrescriptionAvailabilityRequest,
    ReconsultRequestBody,
    StockAddOrUpdateRequest,
    StockPartialUpdate,
    UpdateRequestItemDecision,
    VerifyPrescriptionBody,
)
from services import inventory_availability as availability_service
from services import dispensary as dispensary_service
from services.websocket_manager import dispensary_ws_manager, verify_ws_token

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


@router.patch("/location")
@router.put("/location")
def update_dispensary_location(
    body: DispensaryLocationUpdate,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Save or update the GPS location (lat, lng, address) of the authenticated dispensary.

    The dispensary_id is taken from the JWT — the client cannot choose which
    dispensary to update. Coordinates are validated on the Pydantic model and
    again inside the service layer.
    """
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        updated = dispensary_service.update_dispensary_location(
            dispensary_id=dispensary_id,
            latitude=body.latitude,
            longitude=body.longitude,
            address=body.address,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if updated is None:
        raise HTTPException(status_code=404, detail="Dispensary not found.")

    updated["dispensary_code"] = f"RXF-DISP-{updated['dispensary_id']}"
    return {
        "message": "Location saved successfully.",
        "dispensary": updated,
    }


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
    """Search master medicine catalog to select medicines when adding stock.
    
    Returns distinguishable candidates preserving legitimate strength, form,
    and formulation alternatives without silently collapsing them.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if q and q.strip():
                q_clean = q.strip()
                cur.execute(
                    """
                    SELECT
                        m.medicine_id,
                        m.generic_name,
                        COALESCE(m.brand_name, ma.alias_name) AS brand_name,
                        m.category,
                        m.strength,
                        m.form,
                        m.rxcui
                    FROM medicine m
                    LEFT JOIN (
                        SELECT DISTINCT ON (medicine_id) medicine_id, alias_name
                        FROM medicine_alias
                        WHERE alias_name ILIKE %s
                        ORDER BY medicine_id, LENGTH(alias_name) ASC
                    ) ma ON ma.medicine_id = m.medicine_id
                    WHERE m.generic_name ILIKE %s
                       OR m.brand_name ILIKE %s
                       OR m.rxnorm_name ILIKE %s
                       OR ma.alias_name IS NOT NULL
                    ORDER BY
                        CASE
                            WHEN LOWER(m.generic_name) = LOWER(%s) THEN 0
                            WHEN LOWER(COALESCE(m.brand_name, ma.alias_name, '')) = LOWER(%s) THEN 1
                            WHEN m.generic_name ILIKE %s THEN 2
                            ELSE 3
                        END,
                        m.generic_name ASC,
                        m.strength ASC NULLS LAST,
                        m.form ASC NULLS LAST,
                        m.medicine_id ASC
                    LIMIT %s
                    """,
                    (
                        f"%{q_clean}%",
                        f"%{q_clean}%",
                        f"%{q_clean}%",
                        f"%{q_clean}%",
                        q_clean,
                        q_clean,
                        f"{q_clean}%",
                        limit,
                    ),
                )
            else:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, category, strength, form, rxcui
                    FROM medicine
                    ORDER BY generic_name ASC, strength ASC NULLS LAST, form ASC NULLS LAST, medicine_id ASC
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
# 4.1 Real-Time WebSocket Channel (Replaces 30s Polling)
# =============================================================================

@router.websocket("/ws/{dispensary_id}")
async def dispensary_websocket_channel(
    websocket: WebSocket,
    dispensary_id: int,
    token: Optional[str] = Query(None),
):
    """Real-time bi-directional WebSocket connection for dispensary workspaces.

    ARCHITECTURE OVERVIEW:
    - Eliminates redundant client polling loops.
    - Authenticates the JWT token supplied in the query string (?token=...).
    - Registers the WebSocket with DispensaryConnectionManager.
    - Instantly receives server pushes when new tickets arrive or stock changes.
    - Supports heartbeat ping/pong to prevent proxy connection timeouts.
    """
    # 1. Validate JWT credential
    if not verify_ws_token(token, dispensary_id):
        # 1008 = Policy Violation (Unauthorized)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Register active connection
    await dispensary_ws_manager.connect(websocket, dispensary_id)

    # 3. Send initial connected confirmation
    await websocket.send_text(
        json.dumps({
            "type": "CONNECTION_ESTABLISHED",
            "dispensary_id": dispensary_id,
            "message": "Connected to Rxify Live Dispensary WebSocket stream.",
        })
    )

    # 4. Listen for client pings and keep connection open
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await dispensary_ws_manager.disconnect(websocket, dispensary_id)
    except Exception:
        await dispensary_ws_manager.disconnect(websocket, dispensary_id)


# =============================================================================
# 5. Status Workflow Actions (Process, Ready, Dispense, Cancel)
# =============================================================================

@router.post("/requests/{request_id}/approve")
def approve_request(
    request_id: int,
    body: Optional[ApproveRequestBody] = None,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Approve and confirm prescription fulfillment ticket.

    Sets status to CONFIRMED, records preparation time and confirmation notes, and reserves stock.
    """
    dispensary_id = current_dispensary["dispensary_id"]
    prep_mins = body.estimated_prep_minutes if body else 15
    notes = body.pharmacist_notes if body else None

    try:
        updated = dispensary_service.confirm_or_approve_request(
            dispensary_id=dispensary_id,
            request_id=request_id,
            estimated_prep_minutes=prep_mins,
            pharmacist_notes=notes,
        )
        return {
            "message": "Prescription fulfillment ticket approved & confirmed.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/requests/{request_id}/reconsult")
def reconsult_request(
    request_id: int,
    body: ReconsultRequestBody,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Flag prescription ticket or specific medicines for doctor/patient reconsultation.

    Releases any reserved inventory, records clinical advisory notes, sets status to RECONSULTATION_NEEDED,
    and alerts the patient.
    """
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        updated = dispensary_service.request_reconsultation(
            dispensary_id=dispensary_id,
            request_id=request_id,
            reason=body.reason,
            pharmacist_notes=body.pharmacist_notes,
            target=body.target or "DOCTOR",
            item_ids=body.item_ids,
        )
        return {
            "success": True,
            "message": "Reconsultation advisory recorded and patient notified.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/requests/{request_id}/items/{item_id}")
def update_item_decision(
    request_id: int,
    item_id: int,
    body: UpdateRequestItemDecision,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Execute per-medicine fulfillment decision (FULFILL, PARTIAL, SUBSTITUTE, UNAVAILABLE, RECONSULT)."""
    dispensary_id = current_dispensary["dispensary_id"]
    try:
        updated = dispensary_service.update_request_item_decision(
            dispensary_id=dispensary_id,
            request_id=request_id,
            item_id=item_id,
            decision=body.decision,
            quantity=body.quantity,
            substitute_medicine_id=body.substitute_medicine_id,
            notes=body.notes,
        )
        return {
            "success": True,
            "message": f"Medicine decision '{body.decision}' applied successfully.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/requests/{request_id}/verify")
def verify_prescription_route(
    request_id: int,
    body: Optional[VerifyPrescriptionBody] = None,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Sign-off on clinical prescription verification record by the dispensing pharmacist."""
    dispensary_id = current_dispensary["dispensary_id"]
    user_id = current_dispensary["id"]
    p_chk = body.patient_identity_checked if body else True
    d_chk = body.dosage_validity_checked if body else True
    i_chk = body.interactions_cleared if body else True
    notes = body.notes if body else None

    try:
        updated = dispensary_service.verify_prescription(
            dispensary_id=dispensary_id,
            request_id=request_id,
            user_id=user_id,
            patient_checked=p_chk,
            dosage_checked=d_chk,
            interactions_checked=i_chk,
            notes=notes,
        )
        return {
            "success": True,
            "message": "Prescription clinically verified & signed off.",
            "request": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/transactions")
def get_transactions_route(
    medicine_id: Optional[int] = Query(None, description="Filter by medicine ID"),
    txn_type: Optional[str] = Query(None, description="Filter by transaction type"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Retrieve audit ledger of inventory movements (dispensed, reserved, added, cancelled)."""
    dispensary_id = current_dispensary["dispensary_id"]
    return dispensary_service.get_inventory_transactions(
        dispensary_id=dispensary_id,
        medicine_id=medicine_id,
        txn_type=txn_type,
        limit=limit,
        offset=offset,
    )


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
            "success": True,
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
            "success": True,
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
    pickup_code = body.pickup_code if body else None

    try:
        updated = dispensary_service.dispense_request(
            dispensary_id=dispensary_id,
            request_id=request_id,
            items_input=items_input,
            notes=notes,
            pickup_code=pickup_code,
        )
        return {
            "success": True,
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
            "success": True,
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


@router.get("/analytics")
def get_dispensary_analytics(
    days: int = Query(30, ge=1, le=365),
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Get dispensary operational analytics including top-ordered medicines, category split, and order velocity."""
    dispensary_id = current_dispensary["dispensary_id"]
    return dispensary_service.get_dispensary_analytics(dispensary_id, days=days)


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


# =============================================================================
# 8. Inventory Availability Layer (read-only, no reservation)
# =============================================================================

@router.get(
    "/{dispensary_id}/medicines/{medicine_id}/availability",
    summary="Single-medicine availability at a dispensary",
    tags=["availability"],
)
def get_medicine_availability(
    dispensary_id: int,
    medicine_id: int,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Check whether a single resolved medicine is available at the given dispensary.

    - **AVAILABLE**     — stock row exists and available_quantity > 0
    - **NOT_AVAILABLE** — no stock row, or available_quantity == 0
    - **UNRESOLVED**    — medicine_id does not exist in the catalog

    The caller must ensure dispensary_id matches their own dispensary or have
    appropriate access; currently restricted to authenticated dispensary accounts.
    """
    # Enforce dispensary ownership: an authenticated dispensary can only inspect its own inventory
    if current_dispensary.get("dispensary_id") != dispensary_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot access availability data for another dispensary.",
        )

    try:
        return availability_service.get_medicine_availability(
            dispensary_id=dispensary_id,
            medicine_id=medicine_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post(
    "/{dispensary_id}/availability",
    summary="Prescription-level availability check (multiple medicines)",
    tags=["availability"],
)
def get_prescription_availability(
    dispensary_id: int,
    body: PrescriptionAvailabilityRequest,
    current_dispensary: dict = Depends(require_dispensary()),
):
    """Check availability for a list of resolved medicines at a dispensary.

    Accepts a list of ``{medicine_id, requested_quantity}`` objects and returns
    per-medicine AVAILABLE / NOT_AVAILABLE / UNRESOLVED statuses plus an
    ``overall_status`` of ALL_AVAILABLE / PARTIALLY_AVAILABLE / NONE_AVAILABLE.

    Stock is **not** reserved or decremented by this endpoint.
    """
    # Enforce dispensary ownership: an authenticated dispensary can only inspect its own inventory
    if current_dispensary.get("dispensary_id") != dispensary_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot access availability data for another dispensary.",
        )

    medicines = [m.model_dump() for m in body.medicines]
    try:
        return availability_service.get_prescription_availability(
            dispensary_id=dispensary_id,
            medicines=medicines,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

@router.post(
    "/requests/{request_id}/ai-resolve",
    summary="Fast AI fallback: auto-resolve and generalize ambiguous/unresolved medicines in order",
    tags=["requests"],
)
def ai_resolve_request_items_route(
    request_id: int,
    current_dispensary: dict = Depends(require_dispensary()),
):
    disp_id = current_dispensary["dispensary_id"]
    req = dispensary_service.get_request_detail(disp_id, request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispensary request #{request_id} not found."
        )

    from services.ai_medicine_fallback import resolve_unresolved_prescription_medicines
    report = resolve_unresolved_prescription_medicines(req["prescription_id"], dispensary_id=disp_id)
    updated_req = dispensary_service.get_request_detail(disp_id, request_id)

    return {
        "message": f"AI fallback resolved {report['resolved_count']} medicine(s).",
        "report": report,
        "request": updated_req,
    }
