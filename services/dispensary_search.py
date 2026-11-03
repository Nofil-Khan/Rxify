"""Dispensary Discovery and Geospatial Availability Service — Rxify.

Handles:
1. Geospatial discovery of nearby active dispensaries (Haversine formula).
2. Prescription-scoped medicine availability evaluation across dispensaries:
   - AVAILABLE: item is in stock with available_quantity > 0.
   - PARTIALLY_AVAILABLE: some items available, some out of stock.
   - UNAVAILABLE: item is out of stock (available_quantity == 0 or unstocked).
   - AVAILABILITY_UNKNOWN: prescription medicine unresolved/unmapped to catalog.
3. Patient-driven fulfillment routing: allows patients to select a nearby dispensary
   and submit their prescription for pickup.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn


# ---------------------------------------------------------------------------
# Geospatial Distance Helper (Haversine)
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth in kilometers."""
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


# ---------------------------------------------------------------------------
# Nearby Dispensaries Discovery & Availability Check
# ---------------------------------------------------------------------------

def calculate_dispensary_rank(
    dispensary: Dict[str, Any],
    has_prescription: bool,
    radius_km: float = 25.0,
) -> Dict[str, Any]:
    """Calculate multi-criteria rank score (0 - 100) combining medicine availability,
    geographic proximity, operating hours, and fulfillment speed.
    """
    dist_km = dispensary.get("distance_km")
    if dist_km is None:
        dist_km = radius_km

    # 1. Proximity score (hyperbolic decay curve: 0km->100, 2km->77, 5km->57, 10km->40)
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
            # Full direct stock = 100; partial stock + generic substitute credit
            avail_score = (direct_ratio * 100.0) + (sub_ratio * 35.0 * (1.0 - direct_ratio))
            if status == "ALL_AVAILABLE":
                avail_score = 100.0
        else:
            avail_score = 85.0

        # Weights when prescription is selected: Stock is #1 priority (65%), Proximity is #2 (35%)
        w_avail = 0.65
        w_dist = 0.35
    else:
        # General discovery: Proximity is #1 (70%), Base availability is #2 (30%)
        avail_score = 85.0
        w_avail = 0.30
        w_dist = 0.70

    composite = (w_avail * avail_score) + (w_dist * dist_score) + bonus
    composite = max(0.0, min(100.0, round(composite, 1)))

    if composite >= 85.0:
        tier = "EXCELLENT_MATCH"
    elif composite >= 70.0:
        tier = "GOOD_MATCH"
    elif composite >= 50.0:
        tier = "MODERATE_MATCH"
    else:
        tier = "LOW_MATCH"

    return {
        "rank_score": composite,
        "match_tier": tier,
        "score_breakdown": {
            "availability_score": round(avail_score, 1),
            "distance_score": round(dist_score, 1),
            "availability_weight": w_avail,
            "distance_weight": w_dist,
            "bonus_points": round(bonus, 1),
        },
    }


def find_nearby_dispensaries(
    latitude: float,
    longitude: float,
    radius_km: float = 25.0,
    prescription_id: Optional[int] = None,
    patient_user_id: Optional[int] = None,
    top_k: Optional[int] = None,
) -> Dict[str, Any]:
    """Discover nearby dispensaries with optional prescription medicine availability and smart multi-criteria ranking."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. If prescription_id is provided, load and validate it
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

                # If patient_user_id is provided, enforce authorization
                if patient_user_id is not None and rx_row["patient_user_id"] != patient_user_id:
                    raise PermissionError(f"Access denied to prescription #{prescription_id}.")

                prescription_info = {
                    "prescription_id": rx_row["prescription_id"],
                    "diagnosis": rx_row["diagnosis"],
                    "issue_date": rx_row["issue_date"].isoformat() if rx_row["issue_date"] else None,
                }

                # Load prescription line items with canonical medicine details
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

            # 2. Fetch all active dispensaries
            cur.execute(
                """
                SELECT d.dispensary_id,
                       d.hospital_id,
                       d.name,
                       d.email,
                       d.phone,
                       d.location,
                       d.latitude,
                       d.longitude,
                       d.address,
                       d.operating_hours,
                       d.avg_prep_minutes,
                       d.status,
                       h.name AS hospital_name
                FROM dispensary d
                LEFT JOIN hospital h ON h.hospital_id = d.hospital_id
                WHERE d.status = 'ACTIVE'
                """
            )
            dispensaries_raw = cur.fetchall()

            # Preload stock rows for this prescription across all dispensaries if applicable
            stock_lookup: Dict[tuple[int, int], Dict[str, Any]] = {}
            if prescription_items:
                valid_med_ids = [pm["medicine_id"] for pm in prescription_items if pm["medicine_id"]]
                if valid_med_ids:
                    cur.execute(
                        """
                        SELECT dispensary_id, medicine_id, available_quantity, reserved_quantity, unit
                        FROM inventory_dispensary_stock
                        WHERE medicine_id = ANY(%s)
                        """,
                        (valid_med_ids,),
                    )
                    for s in cur.fetchall():
                        stock_lookup[(s["dispensary_id"], s["medicine_id"])] = dict(s)

            # 3. Process each dispensary: distance + medicine availability
            nearby_list: List[Dict[str, Any]] = []

            for d in dispensaries_raw:
                d_lat = d["latitude"]
                d_lng = d["longitude"]

                dist_km: Optional[float] = None
                if d_lat is not None and d_lng is not None:
                    dist_km = haversine_distance(latitude, longitude, float(d_lat), float(d_lng))
                    # Apply radius filter if specified
                    if radius_km is not None and radius_km > 0 and dist_km > radius_km:
                        continue

                # Build dispensary object
                disp_obj: Dict[str, Any] = {
                    "dispensary_id": d["dispensary_id"],
                    "name": d["name"],
                    "email": d["email"],
                    "phone": d["phone"],
                    "location": d["location"],
                    "address": d["address"] or d["location"] or "Address not specified",
                    "latitude": d_lat,
                    "longitude": d_lng,
                    "distance_km": dist_km,
                    "operating_hours": d["operating_hours"] or "Operating hours not listed",
                    "avg_prep_minutes": d["avg_prep_minutes"],
                    "is_hospital_affiliated": d["hospital_id"] is not None,
                    "hospital_name": d["hospital_name"],
                    "status": d["status"],
                }

                # Evaluate medicine availability if prescription is present
                if prescription_items:
                    items_status: List[Dict[str, Any]] = []
                    avail_count = 0
                    unknown_count = 0

                    for pm in prescription_items:
                        med_id = pm["medicine_id"]
                        prescribed_name = pm["prescribed_name"]
                        dosage = pm["dosage"]
                        strength = pm["strength"]
                        form = pm["form"]

                        if not med_id:
                            # Medicine was not resolved to the catalog
                            items_status.append({
                                "prescription_medicine_id": pm["prescription_medicine_id"],
                                "medicine_id": None,
                                "prescribed_name": prescribed_name,
                                "dosage": dosage,
                                "strength": None,
                                "form": None,
                                "status": "UNKNOWN",
                                "available_quantity": 0,
                                "unit": None,
                                "message": "Medicine not yet mapped to catalog (clarification needed)",
                            })
                            unknown_count += 1
                        else:
                            st = stock_lookup.get((d["dispensary_id"], med_id))
                            if st and st["available_quantity"] > 0:
                                items_status.append({
                                    "prescription_medicine_id": pm["prescription_medicine_id"],
                                    "medicine_id": med_id,
                                    "prescribed_name": prescribed_name,
                                    "generic_name": pm["generic_name"],
                                    "brand_name": pm["brand_name"],
                                    "dosage": dosage,
                                    "strength": strength,
                                    "form": form,
                                    "status": "AVAILABLE",
                                    "available_quantity": st["available_quantity"],
                                    "unit": st.get("unit") or "units",
                                    "message": f"In stock ({st['available_quantity']} {st.get('unit') or 'units'} available)",
                                })
                                avail_count += 1
                            else:
                                # Check for generic bioequivalent in stock at this dispensary
                                substitute = None
                                gen_name = pm.get("generic_name")
                                if gen_name:
                                    cur.execute(
                                        """
                                        SELECT m.medicine_id, m.generic_name, m.brand_name, m.strength, m.form,
                                               s.available_quantity, s.unit
                                        FROM inventory_dispensary_stock s
                                        JOIN medicine m ON m.medicine_id = s.medicine_id
                                        WHERE s.dispensary_id = %s
                                          AND LOWER(m.generic_name) = LOWER(%s)
                                          AND s.medicine_id != %s
                                          AND s.available_quantity > 0
                                        LIMIT 1
                                        """,
                                        (d["dispensary_id"], gen_name, med_id),
                                    )
                                    sub_row = cur.fetchone()
                                    if sub_row:
                                        sub_disp_name = sub_row["brand_name"] or sub_row["generic_name"]
                                        sub_strength = f" {sub_row['strength']}" if sub_row["strength"] else ""
                                        substitute = {
                                            "medicine_id": sub_row["medicine_id"],
                                            "generic_name": sub_row["generic_name"],
                                            "brand_name": sub_row["brand_name"],
                                            "strength": sub_row["strength"],
                                            "form": sub_row["form"],
                                            "available_quantity": sub_row["available_quantity"],
                                            "unit": sub_row["unit"],
                                            "name": f"{sub_disp_name}{sub_strength}",
                                        }

                                items_status.append({
                                    "prescription_medicine_id": pm["prescription_medicine_id"],
                                    "medicine_id": med_id,
                                    "prescribed_name": prescribed_name,
                                    "generic_name": pm["generic_name"],
                                    "brand_name": pm["brand_name"],
                                    "dosage": dosage,
                                    "strength": strength,
                                    "form": form,
                                    "status": "UNAVAILABLE",
                                    "available_quantity": 0,
                                    "unit": None,
                                    "message": "Out of stock at this dispensary",
                                    "substitute": substitute,
                                })

                    total_items = len(prescription_items)
                    if avail_count == total_items:
                        overall_status = "ALL_AVAILABLE"
                    elif avail_count > 0:
                        overall_status = "PARTIALLY_AVAILABLE"
                    elif unknown_count == total_items:
                        overall_status = "AVAILABILITY_UNKNOWN"
                    else:
                        overall_status = "NONE_AVAILABLE"

                    disp_obj["availability"] = {
                        "overall_status": overall_status,
                        "available_count": avail_count,
                        "total_count": total_items,
                        "unknown_count": unknown_count,
                        "items": items_status,
                    }

                nearby_list.append(disp_obj)

            # 4. Multi-Criteria Ranking (Availability + Proximity + Operational Speed)
            for disp in nearby_list:
                rank_meta = calculate_dispensary_rank(
                    dispensary=disp,
                    has_prescription=(prescription_id is not None),
                    radius_km=radius_km,
                )
                disp["ranking"] = rank_meta

            # Sort descending by rank_score (highest match first), ties broken by shortest distance
            nearby_list.sort(
                key=lambda d: (
                    -d["ranking"]["rank_score"],
                    d["distance_km"] if d["distance_km"] is not None else 999999.0,
                )
            )

            # Assign 1-indexed ranks and badges
            for idx, disp in enumerate(nearby_list):
                rank_num = idx + 1
                disp["ranking"]["rank"] = rank_num
                if rank_num == 1:
                    disp["ranking"]["rank_badge"] = "Top Recommendation"
                    disp["ranking"]["is_top_pick"] = True
                elif rank_num == 2:
                    disp["ranking"]["rank_badge"] = "Runner-Up Match"
                    disp["ranking"]["is_top_pick"] = False
                elif rank_num == 3:
                    disp["ranking"]["rank_badge"] = "Top Alternative"
                    disp["ranking"]["is_top_pick"] = False
                else:
                    disp["ranking"]["rank_badge"] = None
                    disp["ranking"]["is_top_pick"] = False

            total_evaluated = len(nearby_list)
            # Apply top_k limitation if requested
            filtered_dispensaries = nearby_list
            if top_k is not None and top_k > 0:
                filtered_dispensaries = nearby_list[:top_k]

            return {
                "search_center": {"latitude": latitude, "longitude": longitude},
                "radius_km": radius_km,
                "total_found": total_evaluated,
                "top_k_applied": top_k if (top_k is not None and top_k > 0) else None,
                "prescription": prescription_info,
                "dispensaries": filtered_dispensaries,
            }


# ---------------------------------------------------------------------------
# Patient-Driven Prescription Fulfillment Routing
# ---------------------------------------------------------------------------

def route_prescription_fulfillment(
    prescription_id: int,
    dispensary_id: int,
    patient_user_id: int,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Submit or reroute a prescription to a chosen dispensary for pickup."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Validate prescription and patient ownership
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

            # 2. Validate dispensary
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

            # 3. Calculate queue position and estimated ready time
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

            # 4. Cancel or cleanup any previous pending requests for this prescription
            #    at other dispensaries so the order is cleanly transferred.
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

            # 5. Generate secure 6-digit handover verification code & insert request
            import secrets
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

            # 6. Delete old request items for this request_id if any (from re-routing)
            cur.execute("DELETE FROM dispensary_request_item WHERE request_id = %s", (request_id,))

            # 7. Evaluate and insert line items
            cur.execute(
                """
                SELECT pm.prescription_medicine_id, pm.medicine_id, pm.name,
                       pm.dosage, pm.match_status
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
                required_qty = 1

                if match_status in ("AMBIGUOUS", "UNRESOLVED", "NOT_A_MEDICINE"):
                    avail_status = match_status
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
                    if stock_row and (stock_row["free_stock"] or 0) >= required_qty:
                        avail_status = "AVAILABLE"
                    elif stock_row and (stock_row["free_stock"] or 0) > 0:
                        avail_status = "PARTIAL"
                    else:
                        avail_status = "UNAVAILABLE"
                else:
                    avail_status = "UNRESOLVED"

                item_statuses.append(avail_status)

                cur.execute(
                    """
                    INSERT INTO dispensary_request_item (
                        request_id, prescription_medicine_id, medicine_id,
                        required_quantity, availability_status
                    ) VALUES (%s, %s, %s, %s, %s)
                    """,
                    (request_id, pm["prescription_medicine_id"], med_id, required_qty, avail_status),
                )

            # 8. Determine final request status
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

            # 9. Send patient confirmation notification
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

            return {
                "request_id": request_id,
                "prescription_id": prescription_id,
                "dispensary_id": dispensary_id,
                "dispensary_name": dispensary_name,
                "dispensary_address": disp["address"] or disp["location"],
                "status": final_status,
                "pickup_code": pickup_code,
                "estimated_ready_at": estimated_ready_at.isoformat(),
                "queue_position": queue_pos + 1,
                "eta_minutes": eta_minutes,
                "message": msg_text,
            }


# ---------------------------------------------------------------------------
# Patient Request Cancellation
# ---------------------------------------------------------------------------

def cancel_patient_request(
    request_id: int,
    patient_user_id: int,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Cancel a pending or in-progress dispensary request and release reserved stock."""
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

            # Release any stock reservations
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

            # Mark request as CANCELLED
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
            return {
                "success": True,
                "request_id": request_id,
                "status": "CANCELLED",
                "message": "Dispensary request successfully cancelled.",
            }


