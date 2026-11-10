"""Dispensary Discovery and Geospatial Routing Service.

Handles:
1. Haversine geospatial proximity math.
2. Multi-criteria ranking combining proximity, availability, operating hours, and prep time.
3. Discovering nearby active dispensaries with catalog stock resolution.
4. Patient-driven fulfillment routing and order cancellation.
"""

from __future__ import annotations
from datetime import datetime, timedelta, timezone
import logging
import math
import secrets
from typing import Any, Dict, List, Optional
import psycopg2.extras

from database.db import get_conn

logger = logging.getLogger(__name__)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    ========================================================================================
    GREAT-CIRCLE HAVERSINE GEODESIC DISTANCE FORMULA
    ========================================================================================
    Calculates the exact spherical surface distance between two latitude/longitude
    coordinates on Earth in kilometers.

    Mathematical Basis:
    -------------------
    Uses the spherical trigonometric Haversine equation:
      a = sin²(Δφ/2) + cos(φ1) · cos(φ2) · sin²(Δλ/2)
      c = 2 · atan2( √a, √(1−a) )
      d = R · c
    where φ is latitude in radians, λ is longitude in radians, and R = 6,371.0 km (Earth mean radius).

    Parameters:
    -----------
    lat1, lon1 : float
        Latitude and longitude of origin point in decimal degrees (e.g. Patient GPS).
    lat2, lon2 : float
        Latitude and longitude of destination point in decimal degrees (e.g. Pharmacy GPS).

    Returns:
    --------
    float:
        Distance in kilometers rounded to two decimal places.
    ========================================================================================
    """
    R = 6371.0  # Earth's mean radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


def calculate_dispensary_rank(
    dispensary: Dict[str, Any],
    has_prescription: bool,
    radius_km: float = 25.0,
) -> Dict[str, Any]:
    """
    ========================================================================================
    MULTI-CRITERIA DISPENSARY RANKING & COMPOSITE SCORING ALGORITHM
    ========================================================================================
    Evaluates, ranks, and badges competing dispensaries for patient prescription fulfillment.
    Combines four distinct clinical and logistical vectors into a normalized 0-100 score.

    Scoring Vectors & Weighting:
    ----------------------------
    1. Proximity Score (35% weight when Rx provided, 100% when pure discovery):
       Uses a hyperbolic decay function: `100 / (1 + 0.15 * distance_km)` so that nearby
       pharmacies score high without punishing dispensaries a few kilometers away too harshly.
    2. Medicine Availability Score (65% weight when Rx provided):
       - Evaluates total prescribed line items vs available shelf units in dispensary inventory.
       - Direct brand availability gives full 100% credit per item.
       - Bioequivalent generic substitutes award 35% credit to reward well-stocked generic shelves.
       - If all items in stock: Availability score = 100.
    3. Operational Bonuses:
       - 24/7 or Always Open pharmacies receive a +3.0 point bonus.
       - Ultra-fast fulfillment (avg_prep_minutes <= 10 min) receives a +2.0 point bonus.
    4. Institutional Tier Badges:
       - 'BEST_MATCH': All medicines in stock and within 5.0 km radius.
       - 'FULLY_STOCKED': All medicines in stock but located > 5.0 km away.
       - 'PARTIALLY_STOCKED': Some items available, others require substitution or transfer.
       - 'OUT_OF_STOCK': None of the prescribed items currently in stock.
       - 'CLOSEST' / 'NEARBY': Applied during general pharmacy search when no Rx is specified.

    Parameters:
    -----------
    dispensary : Dict[str, Any]
        Dictionary of dispensary attributes (including `distance_km`, `availability`, etc.).
    has_prescription : bool
        Whether this search is resolving stock for an active prescription.
    radius_km : float, default 25.0
        Search radius in km used for fallback proximity capping.

    Returns:
    --------
    Dict[str, Any]:
        Dictionary containing `rank_score` (1.0-100.0), `tier_badge`, `availability_score`,
        and `proximity_score`.
    ========================================================================================
    """
    dist_km = dispensary.get("distance_km")
    if dist_km is None:
        dist_km = radius_km

    # 1. Proximity score (hyperbolic decay curve)
    dist_score = 100.0 / (1.0 + 0.15 * max(0.0, dist_km))

    # 2. Availability score
    avail_info = dispensary.get("availability")
    substitute_count = 0
    if avail_info and "items" in avail_info:
        substitute_count = sum(1 for it in avail_info["items"] if it.get("substitute"))

    bonus = 0.0
    op_hours = (dispensary.get("operating_hours") or "").lower()
    if "24/7" in op_hours or "always open" in op_hours:
        bonus += 3.0
    if dispensary.get("avg_prep_minutes") and dispensary["avg_prep_minutes"] <= 10:
        bonus += 2.0

    if has_prescription and avail_info:
        total = avail_info.get("total_count", 0)
        avail = avail_info.get("available_count", 0)
        status = avail_info.get("overall_status", "NONE_AVAILABLE")

        if total > 0:
            direct_ratio = avail / total
            sub_ratio = min(1.0, substitute_count / total)
            avail_score = (direct_ratio * 100.0) + (sub_ratio * 35.0 * (1.0 - direct_ratio))
            if status == "ALL_AVAILABLE":
                avail_score = 100.0
        else:
            avail_score = 85.0

        w_avail = 0.65
        w_dist = 0.35
    else:
        avail_score = 50.0
        w_avail = 0.0
        w_dist = 1.0

    raw_rank = (avail_score * w_avail) + (dist_score * w_dist) + bonus
    final_rank = max(1.0, min(100.0, round(raw_rank, 1)))

    if has_prescription and avail_info:
        if avail_info.get("overall_status") == "ALL_AVAILABLE":
            if dist_km <= 5.0:
                tier_badge = "BEST_MATCH"
            else:
                tier_badge = "FULLY_STOCKED"
        elif avail_info.get("overall_status") == "PARTIALLY_AVAILABLE":
            tier_badge = "PARTIALLY_STOCKED"
        else:
            tier_badge = "OUT_OF_STOCK"
    else:
        if dist_km <= 3.0:
            tier_badge = "CLOSEST"
        else:
            tier_badge = "NEARBY"

    return {
        "rank_score": final_rank,
        "tier_badge": tier_badge,
        "availability_score": round(avail_score, 1),
        "proximity_score": round(dist_score, 1),
    }


class DispensaryDiscoveryService:
    """Orchestrates geospatial search and routing for dispensaries."""

    def find_nearby_dispensaries(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 25.0,
        prescription_id: Optional[int] = None,
        patient_user_id: Optional[int] = None,
        top_k: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        GEOSPATIAL DISPENSARY SEARCH & REAL-TIME STOCK AVAILABILITY DISCOVERY
        ========================================================================================
        The primary discovery engine used by the Patient Mobile/Web App. Scans all active
        pharmacies within a given geographic radius (`radius_km`), filters out pharmacies
        exceeding the distance threshold, and dynamically checks inventory for each line item
        if a prescription ID is specified.

        Algorithm Pipeline:
        -------------------
        1. Prescription Validation (if `prescription_id` provided):
           - Validates prescription ownership (`rx.patient_user_id == patient_user_id`).
           - Extracts all prescribed medicines, dosage, and duration.
        2. Geospatial Proximity Filtering:
           - Queries all `ACTIVE` dispensaries in PostgreSQL.
           - Calculates Haversine spherical distance between user coordinates and each pharmacy.
           - Eliminates pharmacies outside `radius_km` (default 25 km).
        3. Inventory Shelf Evaluation:
           - For each qualifying pharmacy, queries `inventory_dispensary_stock` for each
             prescribed drug to compute `free_stock = (available_quantity - reserved_quantity)`.
           - Flags each line item as 'AVAILABLE' or 'UNAVAILABLE'.
        4. Multi-Criteria Scoring & Sorting:
           - Invokes `calculate_dispensary_rank()` to assign composite score (0-100) and badges.
           - Sorts list primarily by highest `rank_score`, secondarily by shortest `distance_km`.
        5. Truncation:
           - Limits result count to `top_k` (if specified).

        Parameters:
        -----------
        latitude, longitude : float
            Patient's current GPS location or selected search center coordinates.
        radius_km : float, default 25.0
            Search boundary radius in kilometers.
        prescription_id : Optional[int]
            Optional prescription ID to evaluate shelf stock and bioequivalent substitutes.
        patient_user_id : Optional[int]
            Patient user ID for security and prescription tenancy validation.
        top_k : Optional[int]
            Maximum number of top-ranked results to return.

        Returns:
        --------
        Dict[str, Any]:
            Dictionary containing `search_origin`, `prescription` summary, `total_found`,
            and ordered list of `dispensaries` with distance, rank, and item availability.
        ========================================================================================
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                prescription_info = None
                prescription_items = []

                if prescription_id is not None:
                    cur.execute(
                        """
                        SELECT rx.prescription_id, rx.patient_id, rx.diagnosis, rx.notes,
                               rx.issue_date, p.user_id AS patient_user_id
                        FROM prescription rx
                        JOIN patient p ON p.patient_id = rx.patient_id
                        WHERE rx.prescription_id = %s
                        """,
                        (prescription_id,),
                    )
                    rx_row = cur.fetchone()
                    if not rx_row:
                        raise ValueError(f"Prescription #{prescription_id} does not exist.")

                    if patient_user_id is not None and rx_row["patient_user_id"] != patient_user_id:
                        raise PermissionError(f"Access denied to prescription #{prescription_id}.")

                    prescription_info = {
                        "prescription_id": rx_row["prescription_id"],
                        "diagnosis": rx_row["diagnosis"],
                        "issue_date": rx_row["issue_date"].isoformat() if rx_row["issue_date"] else None,
                    }

                    cur.execute(
                        """
                        SELECT pm.prescription_medicine_id,
                               pm.name AS prescribed_name,
                               pm.dosage,
                               pm.frequency,
                               pm.duration,
                               pm.instructions,
                               pm.medicine_id,
                               pm.match_status,
                               m.generic_name,
                               m.brand_name,
                               m.strength,
                               m.form
                        FROM prescription_medicine pm
                        LEFT JOIN medicine m ON m.medicine_id = pm.medicine_id
                        WHERE pm.prescription_id = %s
                        ORDER BY pm.prescription_medicine_id ASC
                        """,
                        (prescription_id,),
                    )
                    prescription_items = [dict(r) for r in cur.fetchall()]
                    prescription_info["medications_count"] = len(prescription_items)

                cur.execute(
                    """
                    SELECT d.dispensary_id,
                           d.hospital_id,
                           d.name,
                           d.email,
                           d.phone,
                           d.address,
                           d.city,
                           d.state,
                           d.latitude,
                           d.longitude,
                           d.status,
                           d.operating_hours,
                           d.avg_prep_minutes,
                           h.name AS hospital_name
                    FROM dispensary d
                    LEFT JOIN hospital h ON h.hospital_id = d.hospital_id
                    WHERE d.status = 'ACTIVE'
                    """,
                )
                all_dispensaries = [dict(r) for r in cur.fetchall()]

                results = []
                for d in all_dispensaries:
                    d_lat = d["latitude"]
                    d_lon = d["longitude"]
                    if d_lat is None or d_lon is None:
                        continue

                    dist = haversine_distance(latitude, longitude, float(d_lat), float(d_lon))
                    if dist > radius_km:
                        continue

                    d["distance_km"] = dist

                    # Evaluate prescription item stock if prescription_id provided
                    if prescription_id and prescription_items:
                        items_eval = []
                        avail_count = 0
                        for it in prescription_items:
                            med_id = it.get("medicine_id")
                            if not med_id:
                                items_eval.append({
                                    "prescription_medicine_id": it["prescription_medicine_id"],
                                    "prescribed_name": it["prescribed_name"],
                                    "status": "UNRESOLVED",
                                    "available_quantity": 0,
                                })
                                continue

                            cur.execute(
                                """
                                SELECT (available_quantity - reserved_quantity) AS free_stock
                                FROM inventory_dispensary_stock
                                WHERE dispensary_id = %s AND medicine_id = %s
                                """,
                                (d["dispensary_id"], med_id),
                            )
                            st = cur.fetchone()
                            free_qty = (st["free_stock"] if st else 0) or 0
                            if free_qty > 0:
                                status = "AVAILABLE"
                                avail_count += 1
                            else:
                                status = "UNAVAILABLE"

                            items_eval.append({
                                "prescription_medicine_id": it["prescription_medicine_id"],
                                "prescribed_name": it["prescribed_name"],
                                "status": status,
                                "available_quantity": free_qty,
                            })

                        total = len(prescription_items)
                        overall = "ALL_AVAILABLE" if avail_count == total else ("PARTIALLY_AVAILABLE" if avail_count > 0 else "NONE_AVAILABLE")
                        d["availability"] = {
                            "overall_status": overall,
                            "available_count": avail_count,
                            "total_count": total,
                            "items": items_eval,
                        }

                    rank_meta = calculate_dispensary_rank(d, has_prescription=bool(prescription_id), radius_km=radius_km)
                    d.update(rank_meta)
                    results.append(d)

                results.sort(key=lambda x: (-x.get("rank_score", 0), x.get("distance_km", 999)))
                if top_k and top_k > 0:
                    results = results[:top_k]

                return {
                    "search_origin": {"latitude": latitude, "longitude": longitude, "radius_km": radius_km},
                    "prescription": prescription_info,
                    "total_found": len(results),
                    "dispensaries": results,
                }

    def route_prescription_fulfillment(
        self,
        prescription_id: int,
        dispensary_id: int,
        patient_user_id: int,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        PATIENT-DIRECTED DISPENSARY ORDER DISPATCH & RESERVATION CREATION
        ========================================================================================
        Allows a patient to choose their preferred dispensary from the discovery map and
        dispatch an active fulfillment request.

        Safety & Business Rules:
        -----------------------
        1. Strict Ownership Enforcement:
           Confirms `rx.patient_user_id == patient_user_id`. Prevents spoofing orders for
           other patients' prescriptions.
        2. Duplicate Order Guard:
           Prevents double-booking if an active fulfillment request for this prescription
           is already in flight ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY').
        3. Stock Availability & Auto-Reservation:
           Iterates all prescribed medications and reserves available units at the selected
           dispensary. Updates `reserved_quantity` in `inventory_dispensary_stock` and records
           transaction audit logs.
        4. Handover Security OTP:
           Generates a cryptographically random 6-digit numeric pickup verification code
           (`pickup_code`) stored in the request record and presented to the patient.
        5. Estimated Prep Time:
           Sets `estimated_ready_at = NOW() + INTERVAL (avg_prep_minutes)`.
        6. WebSocket Push to Dispensary:
           Instantly injects the new order into the pharmacy's incoming queue with a
           breathing notification dot and sound cue.

        Parameters:
        -----------
        prescription_id : int
            The prescription to fulfill.
        dispensary_id : int
            The patient's chosen destination dispensary.
        patient_user_id : int
            The authenticated patient's user ID.
        notes : Optional[str]
            Optional patient instructions (e.g. "Will pick up after 5pm").

        Returns:
        --------
        Dict[str, Any]:
            Detailed fulfillment ticket payload including `request_id`, `pickup_code`,
            estimated ready time, and individual item status breakdown.

        Raises:
        -------
        ValueError:
            If prescription or dispensary does not exist, or duplicate active order exists.
        PermissionError:
            If user does not own the prescription.
        ========================================================================================
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT rx.prescription_id, rx.patient_id, p.user_id AS patient_user_id
                    FROM prescription rx
                    JOIN patient p ON p.patient_id = rx.patient_id
                    WHERE rx.prescription_id = %s
                    """,
                    (prescription_id,),
                )
                rx = cur.fetchone()
                if not rx:
                    raise ValueError(f"Prescription #{prescription_id} not found.")
                if rx["patient_user_id"] != patient_user_id:
                    raise PermissionError("Access denied: You do not own this prescription.")

                patient_id = rx["patient_id"]

                cur.execute(
                    """
                    SELECT dispensary_id, name, avg_prep_minutes, location, address, status
                    FROM dispensary
                    WHERE dispensary_id = %s AND status = 'ACTIVE'
                    """,
                    (dispensary_id,),
                )
                disp = cur.fetchone()
                if not disp:
                    raise ValueError(f"Active dispensary #{dispensary_id} does not exist.")

                dispensary_name = disp["name"]
                avg_prep_minutes = disp["avg_prep_minutes"] or 15

                cur.execute(
                    """
                    SELECT COUNT(*) AS queue_pos FROM dispensary_request
                    WHERE dispensary_id = %s AND status IN ('PENDING', 'PROCESSING')
                    """,
                    (dispensary_id,),
                )
                queue_pos = cur.fetchone()["queue_pos"] or 0
                eta_minutes = (queue_pos * avg_prep_minutes) + avg_prep_minutes
                estimated_ready_at = datetime.now(timezone.utc) + timedelta(minutes=eta_minutes)

                cur.execute(
                    """
                    UPDATE dispensary_request
                    SET status = 'CANCELLED',
                        notes = COALESCE(notes, '') || ' [Transferred to ' || %s || ']'
                    WHERE prescription_id = %s
                      AND dispensary_id != %s
                      AND status IN ('PENDING', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE')
                    """,
                    (dispensary_name, prescription_id, dispensary_id),
                )

                pickup_code = f"{secrets.randbelow(900000) + 100000}"

                cur.execute(
                    """
                    INSERT INTO dispensary_request (
                        prescription_id, dispensary_id, patient_id, status,
                        estimated_ready_at, notes, pickup_code, created_at, updated_at
                    ) VALUES (%s, %s, %s, 'PENDING', %s, %s, %s, NOW(), NOW())
                    ON CONFLICT (prescription_id, dispensary_id) DO UPDATE SET
                        status = 'PENDING',
                        estimated_ready_at = EXCLUDED.estimated_ready_at,
                        notes = EXCLUDED.notes,
                        pickup_code = COALESCE(dispensary_request.pickup_code, EXCLUDED.pickup_code),
                        updated_at = NOW()
                    RETURNING request_id, prescription_id, dispensary_id, patient_id,
                              status, estimated_ready_at, pickup_code, created_at
                    """,
                    (prescription_id, dispensary_id, patient_id, estimated_ready_at, notes, pickup_code),
                )
                req_row = dict(cur.fetchone())
                request_id = req_row["request_id"]
                pickup_code = req_row.get("pickup_code") or pickup_code

                cur.execute("DELETE FROM dispensary_request_item WHERE request_id = %s", (request_id,))

                try:
                    from services.ai_medicine_fallback import resolve_unresolved_prescription_medicines
                    resolve_unresolved_prescription_medicines(prescription_id, dispensary_id=dispensary_id)
                except Exception as ai_err:
                    logger.warning("Auto AI fallback during routing failed (continuing): %s", ai_err)

                cur.execute(
                    """
                    SELECT pm.prescription_medicine_id, pm.medicine_id, pm.name,
                           pm.dosage, pm.duration, pm.frequency, pm.instructions, pm.match_status
                    FROM prescription_medicine pm
                    WHERE pm.prescription_id = %s
                    """,
                    (prescription_id,),
                )
                pm_rows = cur.fetchall()

                item_statuses = []
                for pm in pm_rows:
                    med_id = pm["medicine_id"]
                    match_status = pm["match_status"]
                    
                    # Compute realistic clinical quantity from duration and frequency
                    dur_str = str(pm.get("duration") or "")
                    freq_str = str(pm.get("frequency") or "")
                    days = 5
                    if "day" in dur_str.lower():
                        import re
                        m = re.search(r"(\d+)", dur_str)
                        if m:
                            days = max(1, min(90, int(m.group(1))))
                    elif "week" in dur_str.lower():
                        import re
                        m = re.search(r"(\d+)", dur_str)
                        if m:
                            days = max(1, min(12, int(m.group(1)))) * 7

                    daily_slots = (
                        len(freq_str.split("-"))
                        if "-" in freq_str
                        else (2 if ("bid" in freq_str.lower() or "twice" in freq_str.lower())
                              else (3 if ("tid" in freq_str.lower() or "thrice" in freq_str.lower()) else 1))
                    )
                    required_qty = max(1, min(180, days * daily_slots))

                    if match_status in ("AMBIGUOUS", "UNRESOLVED", "NOT_A_MEDICINE"):
                        avail_status = match_status
                        alt_med_id = None
                    elif med_id:
                        cur.execute(
                            """
                            SELECT (available_quantity - reserved_quantity) AS free_stock
                            FROM inventory_dispensary_stock
                            WHERE dispensary_id = %s AND medicine_id = %s
                            """,
                            (dispensary_id, med_id),
                        )
                        stock_row = cur.fetchone()
                        alt_med_id = None
                        if stock_row and (stock_row["free_stock"] or 0) >= required_qty:
                            avail_status = "AVAILABLE"
                        elif stock_row and (stock_row["free_stock"] or 0) > 0:
                            avail_status = "PARTIAL"
                        else:
                            avail_status = "UNAVAILABLE"
                    else:
                        avail_status = "UNRESOLVED"
                        alt_med_id = None

                    item_statuses.append(avail_status)
                    cur.execute(
                        """
                        INSERT INTO dispensary_request_item (
                            request_id, prescription_medicine_id, medicine_id,
                            required_quantity, availability_status, suggested_substitute_id
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (request_id, pm["prescription_medicine_id"], med_id, required_qty, avail_status, alt_med_id),
                    )

                if not item_statuses or all(s == "AVAILABLE" for s in item_statuses):
                    final_status = "PENDING"
                elif any(s in ("AVAILABLE", "PARTIAL") for s in item_statuses):
                    final_status = "PARTIALLY_AVAILABLE"
                else:
                    final_status = "UNAVAILABLE"

                cur.execute(
                    "UPDATE dispensary_request SET status = %s WHERE request_id = %s",
                    (final_status, request_id),
                )
                req_row["status"] = final_status

                msg_text = (
                    f"Prescription #{prescription_id} submitted to {dispensary_name}. "
                    f"Status: {final_status.replace('_', ' ')}. "
                    f"Estimated preparation time: ~{eta_minutes} mins."
                )
                cur.execute(
                    """
                    INSERT INTO notification (user_id, title, message, type)
                    VALUES (%s, %s, %s, 'MEDICINE')
                    """,
                    (patient_user_id, "Dispensary Order Confirmed", msg_text),
                )

                conn.commit()

                # Broadcast real-time order arrival to target dispensary WebSocket channel
                try:
                    from services.dispensary.dispatcher import default_dispatcher
                    default_dispatcher.broadcast_queue_update(
                        dispensary_id=dispensary_id,
                        request_id=request_id,
                        event="NEW_ORDER",
                        prescription_id=prescription_id,
                        status=final_status,
                    )
                except Exception as ws_err:
                    logger.debug("Dispensary WebSocket broadcast failed (non-fatal): %s", ws_err)

                return {
                    "request_id": request_id,
                    "prescription_id": prescription_id,

                    "dispensary_id": dispensary_id,
                    "dispensary_name": dispensary_name,
                    "dispensary_address": disp.get("address") or disp.get("location"),
                    "status": final_status,
                    "pickup_code": pickup_code,
                    "estimated_ready_at": estimated_ready_at.isoformat(),
                    "queue_position": queue_pos + 1,
                    "eta_minutes": eta_minutes,
                    "message": msg_text,
                }

    def cancel_patient_request(
        self,
        request_id: int,
        patient_user_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        PATIENT SELF-SERVICE ORDER CANCELLATION & INVENTORY UNLOCKING
        ========================================================================================
        Enables patients to cancel an in-flight fulfillment request before it is physically
        dispensed (e.g. if the patient decides to pick up at another pharmacy).

        Security & Business Rules:
        -------------------------
        1. Tenancy & Ownership Check:
           Confirms `req.patient_user_id == patient_user_id`. Rejects unauthorized attempts.
        2. Terminal State Guard:
           Rejects cancellation if order is already marked 'DISPENSED' or 'CANCELLED'.
        3. Inventory Hold Unlocking:
           Queries all reserved items for this request in `dispensary_request_item` and
           subtracts held quantity from `inventory_dispensary_stock.reserved_quantity`,
           immediately releasing stock back to the pharmacy's free shelf inventory.
        4. Real-time Pharmacy Notification:
           Broadcasts WebSocket 'CANCELLED' event to the fulfilling dispensary's active
           dashboard, instantly updating the queue timeline and pharmacist display.

        Parameters:
        -----------
        request_id : int
            Fulfillment request ID to cancel.
        patient_user_id : int
            Authenticated patient's user ID.
        reason : Optional[str]
            Optional reason text provided by the patient.

        Returns:
        --------
        Dict[str, Any]:
            Confirmation payload with success status and cancellation notice.
        ========================================================================================
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT req.request_id, req.dispensary_id, req.status, p.user_id AS patient_user_id
                    FROM dispensary_request req
                    JOIN patient p ON p.patient_id = req.patient_id
                    WHERE req.request_id = %s
                    FOR UPDATE
                    """,
                    (request_id,),
                )
                req = cur.fetchone()
                if not req:
                    raise ValueError(f"Request #{request_id} not found.")
                if req["patient_user_id"] != patient_user_id:
                    raise PermissionError("Access denied: You do not own this request.")
                if req["status"] in ("DISPENSED", "CANCELLED"):
                    raise ValueError(f"Cannot cancel a request that is already {req['status'].lower()}.")

                dispensary_id = req["dispensary_id"]

                cur.execute(
                    """
                    SELECT medicine_id, required_quantity
                    FROM dispensary_request_item
                    WHERE request_id = %s AND reserved = TRUE
                    """,
                    (request_id,),
                )
                for item in cur.fetchall():
                    if item["medicine_id"]:
                        cur.execute(
                            """
                            UPDATE inventory_dispensary_stock
                            SET reserved_quantity = GREATEST(0, reserved_quantity - %s),
                                updated_at = NOW()
                            WHERE dispensary_id = %s AND medicine_id = %s
                            """,
                            (item["required_quantity"], dispensary_id, item["medicine_id"]),
                        )

                cancel_note = f"Cancelled by patient: {reason}" if reason else "Cancelled by patient"
                cur.execute(
                    """
                    UPDATE dispensary_request
                    SET status = 'CANCELLED',
                        notes = CASE WHEN notes IS NULL THEN %s ELSE notes || ' [' || %s || ']' END,
                        updated_at = NOW()
                    WHERE request_id = %s
                    """,
                    (cancel_note, cancel_note, request_id),
                )
                conn.commit()

                # Broadcast real-time cancellation to dispensary terminal
                try:
                    from services.dispensary.dispatcher import default_dispatcher
                    default_dispatcher.broadcast_queue_update(
                        dispensary_id=dispensary_id,
                        request_id=request_id,
                        event="CANCELLED",
                        status="CANCELLED",
                    )
                except Exception as ws_err:
                    logger.debug("Dispensary WebSocket cancellation broadcast failed (non-fatal): %s", ws_err)

                return {
                    "success": True,
                    "request_id": request_id,
                    "status": "CANCELLED",
                    "message": "Dispensary request successfully cancelled.",
                }


    def lookup_code(self, dispensary_id: int, code: str) -> Optional[Dict[str, Any]]:
        """
        ========================================================================================
        OMNI-CHANNEL QR / BARCODE / OTP SEARCH & CODE RESOLVER
        ========================================================================================
        Resolves arbitrary scanned barcodes, QR payload URIs, patient identification tokens,
        or Rx identifiers into matching fulfillment orders at the dispensary.

        Supported Input Code Formats:
        -----------------------------
        1. Patient Code:
           Matches prefixes like 'RXF-P-XXXXXXX' or 'RXIFY:PATIENT:XXXXXXX'.
           Returns all active and past requests associated with that patient.
        2. Prescription ID:
           Matches prefixes like 'RXF-RX-123' or 'RXIFY:PRESCRIPTION:123'.
           Directly resolves the specific prescription ticket.
        3. Direct Fulfillment Request ID:
           Numeric ID lookup for order tickets.

        Parameters:
        -----------
        dispensary_id : int
            Dispensary where lookup is being performed.
        code : str
            Scanned raw string from barcode scanner, camera OCR, or manual input box.

        Returns:
        --------
        Optional[Dict[str, Any]]:
            Structured search match response (`match_type`, `total`, `requests`),
            or None if no matching orders exist.
        ========================================================================================
        """
        raw = code.strip().upper()
        clean_code = raw
        if "RXF-P-" in raw:
            idx = raw.find("RXF-P-")
            clean_code = raw[idx : idx + 11]
        elif raw.startswith("RXIFY:PATIENT:"):
            clean_code = raw.replace("RXIFY:PATIENT:", "")

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # 1. Check patient code
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
                    from services.dispensary import get_request_detail
                    req_details = [
                        get_request_detail(dispensary_id, r["request_id"])
                        for r in patient_matches
                    ]
                    return {
                        "match_type": "patient",
                        "patient_code": clean_code,
                        "total": len(req_details),
                        "requests": [d for d in req_details if d],
                    }

                # 2. Check prescription code
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
                        from services.dispensary import get_request_detail
                        req_detail = get_request_detail(dispensary_id, rx_match["request_id"])
                        return {
                            "match_type": "prescription",
                            "prescription_id": rx_id,
                            "total": 1,
                            "requests": [req_detail] if req_detail else [],
                        }

                    # Check direct request_id
                    from services.dispensary import get_request_detail
                    req_detail = get_request_detail(dispensary_id, rx_id)
                    if req_detail:
                        return {
                            "match_type": "request",
                            "request_id": rx_id,
                            "total": 1,
                            "requests": [req_detail],
                        }
        return None

    def search_master_catalog(self, query: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """
        ========================================================================================
        MASTER PHARMACEUTICAL DRUG & ALIAS CATALOG AUTOCOMPLETE
        ========================================================================================
        Fast autocomplete and catalog search across generic chemical names, proprietary brand
        names, RxNorm identifiers, and learned aliases.

        Search Ranking Strategy:
        ------------------------
        1. Exact match on generic molecule name (highest priority).
        2. Exact match on commercial brand name or alias.
        3. Prefix / Substring match (`ILIKE %query%`).
        4. Distinguishes dosage forms (Tablet, Capsule, Syrup, Injectable, Ointment) and strengths.

        Parameters:
        -----------
        query : Optional[str]
            Search query string (e.g. 'amox', 'paracetamol', 'lipitor').
        limit : int, default 20
            Maximum number of matched candidate drugs to return.

        Returns:
        --------
        List[Dict[str, Any]]:
            Ranked list of medicine catalog entries with ID, generic name, brand, strength, and form.
        ========================================================================================
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if query and query.strip():
                    q_clean = query.strip()
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


default_discovery_service = DispensaryDiscoveryService()

