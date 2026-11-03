"""Dispensary service layer — PostgreSQL.

Handles dispensary org entity registration/auth, inventory management with atomic
stock reservations, automatic prescription-to-dispensary-request creation,
queue processing, dispensing, and notification dispatch.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn, get_password_hash, verify_password


# =============================================================================
# 1. Dispensary Entity CRUD & Authentication
# =============================================================================

def create_dispensary(
    hospital_id: Optional[int] = None,
    name: str = "",
    email: str = "",
    password: str = "",
    phone: Optional[str] = None,
    location: Optional[str] = None,
    operating_hours: Optional[str] = None,
    avg_prep_minutes: int = 15,
) -> Optional[Dict[str, Any]]:
    """Register a new dispensary organization (independent or affiliated with a hospital).

    Returns dispensary dict on success, or None if email is taken.
    """
    password_hash = get_password_hash(password)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Check hospital exists only if hospital_id is provided
            if hospital_id is not None:
                cur.execute("SELECT 1 FROM hospital WHERE hospital_id = %s", (hospital_id,))
                if not cur.fetchone():
                    raise ValueError(f"Hospital with ID {hospital_id} does not exist.")

            # Check email uniqueness
            cur.execute("SELECT 1 FROM dispensary WHERE email = %s", (email,))
            if cur.fetchone():
                return None

            cur.execute(
                """
                INSERT INTO dispensary (
                    hospital_id, name, email, password_hash, phone, location,
                    operating_hours, avg_prep_minutes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING dispensary_id, hospital_id, name, email, phone, location,
                          operating_hours, avg_prep_minutes, status, created_at
                """,
                (
                    hospital_id,
                    name,
                    email,
                    password_hash,
                    phone,
                    location,
                    operating_hours,
                    avg_prep_minutes,
                ),
            )
            row = dict(cur.fetchone())
            if row.get("created_at"):
                row["created_at"] = str(row["created_at"])
            return row


def authenticate_dispensary(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Verify dispensary credentials. Returns dispensary dict on success, None on failure."""
    dispensary = get_dispensary_by_email(email)
    if dispensary is None:
        return None
    if not verify_password(password, dispensary["password_hash"]):
        return None
    return dispensary


def get_dispensary_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch dispensary by email."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT dispensary_id, hospital_id, name, email, password_hash, phone,
                       location, address, latitude, longitude,
                       operating_hours, avg_prep_minutes, status, created_at
                FROM dispensary
                WHERE email = %s
                """,
                (email,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_dispensary_by_id(dispensary_id: int) -> Optional[Dict[str, Any]]:
    """Fetch dispensary by internal ID."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT dispensary_id, hospital_id, name, email, phone, location,
                       address, latitude, longitude,
                       operating_hours, avg_prep_minutes, status, created_at
                FROM dispensary
                WHERE dispensary_id = %s
                """,
                (dispensary_id,),
            )
            row = cur.fetchone()
            if row:
                res = dict(row)
                if res.get("created_at"):
                    res["created_at"] = str(res["created_at"])
                return res
            return None


def list_dispensaries_by_hospital(hospital_id: int) -> List[Dict[str, Any]]:
    """List all dispensaries owned by a hospital."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT dispensary_id, hospital_id, name, email, phone, location,
                       address, latitude, longitude,
                       operating_hours, avg_prep_minutes, status, created_at
                FROM dispensary
                WHERE hospital_id = %s
                ORDER BY dispensary_id ASC
                """,
                (hospital_id,),
            )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if item.get("created_at"):
                    item["created_at"] = str(item["created_at"])
                results.append(item)
            return results


def update_dispensary_location(
    dispensary_id: int,
    latitude: float,
    longitude: float,
    address: Optional[str],
) -> Optional[Dict[str, Any]]:
    """Save or update the GPS location of a dispensary.

    Validates coordinate ranges and returns the updated dispensary record.
    Returns None if no matching dispensary row is found.
    Raises ValueError on out-of-range coordinates or obviously invalid address.
    """
    # Validate ranges
    if not (-90.0 <= latitude <= 90.0):
        raise ValueError(f"latitude must be between -90 and 90, got {latitude}")
    if not (-180.0 <= longitude <= 180.0):
        raise ValueError(f"longitude must be between -180 and 180, got {longitude}")

    # Normalize address: strip, collapse internal whitespace, limit length
    clean_address: Optional[str] = None
    if address is not None:
        stripped = " ".join(address.split()).strip()
        if stripped:
            clean_address = stripped[:500]  # hard cap at 500 chars

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE dispensary
                SET latitude    = %s,
                    longitude   = %s,
                    address     = %s,
                    updated_at  = NOW()
                WHERE dispensary_id = %s
                RETURNING dispensary_id, hospital_id, name, email, phone, location,
                          address, latitude, longitude,
                          operating_hours, avg_prep_minutes, status, created_at, updated_at
                """,
                (latitude, longitude, clean_address, dispensary_id),
            )
            row = cur.fetchone()
            if row is None:
                return None
            res = dict(row)
            for k in ("created_at", "updated_at"):
                if res.get(k):
                    res[k] = str(res[k])
            return res


# =============================================================================
# 2. Inventory Stock Control
# =============================================================================

def get_inventory_stock(dispensary_id: int) -> List[Dict[str, Any]]:
    """List all medicine stock entries for a dispensary with free stock calculations."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    inv.inventory_id,
                    inv.dispensary_id,
                    inv.medicine_id,
                    m.generic_name,
                    m.brand_name,
                    m.category,
                    m.strength,
                    m.form,
                    inv.available_quantity,
                    inv.reserved_quantity,
                    (inv.available_quantity - inv.reserved_quantity) AS free_stock,
                    inv.reorder_level,
                    inv.unit,
                    inv.created_at,
                    inv.updated_at,
                    CASE
                        WHEN (inv.available_quantity - inv.reserved_quantity) <= 0 THEN 'OUT_OF_STOCK'
                        WHEN (inv.available_quantity - inv.reserved_quantity) <= inv.reorder_level THEN 'LOW_STOCK'
                        ELSE 'NORMAL'
                    END AS stock_status
                FROM inventory_dispensary_stock inv
                JOIN medicine m ON m.medicine_id = inv.medicine_id
                WHERE inv.dispensary_id = %s
                ORDER BY m.generic_name ASC
                """,
                (dispensary_id,),
            )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                for k in ("created_at", "updated_at"):
                    if item.get(k):
                        item[k] = str(item[k])
                results.append(item)
            return results


def add_or_update_stock(
    dispensary_id: int,
    medicine_id: int,
    available_quantity: int,
    reorder_level: int = 10,
    unit: Optional[str] = "units",
) -> Dict[str, Any]:
    """Add new medicine stock or replace total quantity for a dispensary.
    
    Logs an inventory transaction.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Verify medicine exists
            cur.execute("SELECT 1 FROM medicine WHERE medicine_id = %s", (medicine_id,))
            if not cur.fetchone():
                raise ValueError(f"Medicine ID {medicine_id} does not exist in central catalog.")

            cur.execute(
                """
                INSERT INTO inventory_dispensary_stock (
                    dispensary_id, medicine_id, available_quantity, reorder_level, unit
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (dispensary_id, medicine_id)
                DO UPDATE SET
                    available_quantity = EXCLUDED.available_quantity,
                    reorder_level = EXCLUDED.reorder_level,
                    unit = COALESCE(EXCLUDED.unit, inventory_dispensary_stock.unit),
                    updated_at = NOW()
                RETURNING inventory_id, dispensary_id, medicine_id, available_quantity,
                          reserved_quantity, reorder_level, unit, updated_at
                """,
                (dispensary_id, medicine_id, available_quantity, reorder_level, unit),
            )
            inv = dict(cur.fetchone())

            # Log transaction
            cur.execute(
                """
                INSERT INTO inventory_transaction (
                    inventory_id, dispensary_id, medicine_id, txn_type, quantity, notes
                ) VALUES (%s, %s, %s, 'STOCK_ADDED', %s, 'Stock added or updated via inventory management')
                """,
                (inv["inventory_id"], dispensary_id, medicine_id, available_quantity or 1),
            )

            if inv.get("updated_at"):
                inv["updated_at"] = str(inv["updated_at"])
            return inv


def bulk_add_or_update_stock(
    dispensary_id: int,
    items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Bulk add/update multiple inventory items in a single database transaction.

    Accepts items with either `medicine_id` OR `generic_name` (+ optional `brand_name`).
    If a medicine is not in the central catalog, it is automatically added.
    """
    updated_count = 0
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for item in items:
                med_id = item.get("medicine_id")
                gen_name = item.get("generic_name") or item.get("name")
                brand_name = item.get("brand_name")
                qty = item.get("available_quantity", 0)
                reorder = item.get("reorder_level", 10)
                unit = item.get("unit", "units")

                if not med_id and gen_name:
                    # Look up or create medicine in central catalog
                    cur.execute(
                        """
                        SELECT medicine_id FROM medicine
                        WHERE generic_name ILIKE %s OR brand_name ILIKE %s
                        LIMIT 1
                        """,
                        (gen_name.strip(), gen_name.strip()),
                    )
                    row = cur.fetchone()
                    if row:
                        med_id = row["medicine_id"]
                    else:
                        cur.execute(
                            """
                            INSERT INTO medicine (generic_name, brand_name, form)
                            VALUES (%s, %s, 'TABLET')
                            RETURNING medicine_id
                            """,
                            (gen_name.strip(), brand_name.strip() if brand_name else None),
                        )
                        med_id = cur.fetchone()["medicine_id"]

                if not med_id:
                    continue

                cur.execute(
                    """
                    INSERT INTO inventory_dispensary_stock (
                        dispensary_id, medicine_id, available_quantity, reorder_level, unit
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (dispensary_id, medicine_id)
                    DO UPDATE SET
                        available_quantity = EXCLUDED.available_quantity,
                        reorder_level = EXCLUDED.reorder_level,
                        unit = COALESCE(EXCLUDED.unit, inventory_dispensary_stock.unit),
                        updated_at = NOW()
                    RETURNING inventory_id
                    """,
                    (dispensary_id, med_id, qty, reorder, unit),
                )
                inv_id = cur.fetchone()["inventory_id"]

                cur.execute(
                    """
                    INSERT INTO inventory_transaction (
                        inventory_id, dispensary_id, medicine_id, txn_type, quantity, notes
                    ) VALUES (%s, %s, %s, 'STOCK_ADDED', %s, 'Bulk inventory import')
                    """,
                    (inv_id, dispensary_id, med_id, qty or 1),
                )
                updated_count += 1

    return {
        "message": f"Successfully updated {updated_count} medicine stock items.",
        "updated_count": updated_count,
    }


def import_stock_from_csv(dispensary_id: int, csv_content: str) -> Dict[str, Any]:
    """Parse CSV content and bulk import inventory stock.
    
    Supported columns: generic_name (or medicine), brand_name, quantity (or available_quantity), reorder_level, unit
    """
    import csv
    import io

    reader = csv.DictReader(io.StringIO(csv_content))
    items_to_import = []
    for row in reader:
        # Normalize key names
        keys = {k.lower().strip(): v for k, v in row.items() if k}
        gen_name = keys.get("generic_name") or keys.get("medicine") or keys.get("name")
        brand_name = keys.get("brand_name") or keys.get("brand")
        qty_str = keys.get("quantity") or keys.get("available_quantity") or keys.get("qty") or "0"
        reorder_str = keys.get("reorder_level") or keys.get("reorder") or "10"
        unit = keys.get("unit") or "units"

        if gen_name and gen_name.strip():
            try:
                qty = int(qty_str.strip())
            except ValueError:
                qty = 0
            try:
                reorder = int(reorder_str.strip())
            except ValueError:
                reorder = 10

            items_to_import.append({
                "generic_name": gen_name.strip(),
                "brand_name": brand_name.strip() if brand_name else None,
                "available_quantity": qty,
                "reorder_level": reorder,
                "unit": unit.strip(),
            })

    if not items_to_import:
        raise ValueError("CSV contains no valid medicine stock rows or header missing.")

    return bulk_add_or_update_stock(dispensary_id, items_to_import)


def update_stock_partial(
    dispensary_id: int,
    inventory_id: int,
    available_quantity: Optional[int] = None,
    reorder_level: Optional[int] = None,
    unit: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Partially update stock fields."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM inventory_dispensary_stock WHERE inventory_id = %s AND dispensary_id = %s",
                (inventory_id, dispensary_id),
            )
            existing = cur.fetchone()
            if not existing:
                return None

            fields, params = [], []
            if available_quantity is not None:
                fields.append("available_quantity = %s")
                params.append(available_quantity)
            if reorder_level is not None:
                fields.append("reorder_level = %s")
                params.append(reorder_level)
            if unit is not None:
                fields.append("unit = %s")
                params.append(unit)

            if not fields:
                res = dict(existing)
                for k in ("created_at", "updated_at"):
                    if res.get(k):
                        res[k] = str(res[k])
                return res

            fields.append("updated_at = NOW()")
            params.extend([inventory_id, dispensary_id])

            cur.execute(
                f"UPDATE inventory_dispensary_stock SET {', '.join(fields)} "
                "WHERE inventory_id = %s AND dispensary_id = %s "
                "RETURNING inventory_id, dispensary_id, medicine_id, available_quantity, reserved_quantity, reorder_level, unit, updated_at",
                params,
            )
            res = dict(cur.fetchone())

            # Log stock adjustment transaction if quantity changed
            if available_quantity is not None and available_quantity != existing["available_quantity"]:
                diff = abs(available_quantity - existing["available_quantity"])
                txn_type = "STOCK_ADDED" if available_quantity > existing["available_quantity"] else "STOCK_REMOVED"
                cur.execute(
                    """
                    INSERT INTO inventory_transaction (
                        inventory_id, dispensary_id, medicine_id, txn_type, quantity, notes
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (inventory_id, dispensary_id, res["medicine_id"], txn_type, diff or 1, "Partial stock update"),
                )

            for k in ("updated_at",):
                if res.get(k):
                    res[k] = str(res[k])
            return res


# =============================================================================
# 3. Automatic Request Creation (Prescription → Dispensary Request)
# =============================================================================

def create_dispensary_request_for_prescription(prescription_id: int) -> Optional[Dict[str, Any]]:
    """Automatically create a dispensary request when a prescription is created.

    Checks stock availability, calculates request status, computes ETA,
    and dispatches a patient notification.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Load prescription + patient info
            cur.execute(
                """
                SELECT rx.prescription_id, rx.patient_id, rx.clinic_id, rx.doctor_id,
                       p.user_id AS patient_user_id
                FROM prescription rx
                JOIN patient p ON p.patient_id = rx.patient_id
                WHERE rx.prescription_id = %s
                """,
                (prescription_id,),
            )
            rx = cur.fetchone()
            if not rx:
                return None

            patient_id = rx["patient_id"]
            patient_user_id = rx["patient_user_id"]

            # 2. Select target dispensary
            # Check clinic_id → clinic's hospital dispensaries
            dispensary_id = None
            if rx["clinic_id"]:
                cur.execute(
                    """
                    SELECT d.dispensary_id, d.avg_prep_minutes, d.name AS dispensary_name
                    FROM dispensary d
                    JOIN clinic_hospital ch ON ch.clinic_id = %s
                    WHERE d.status = 'ACTIVE'
                    ORDER BY d.dispensary_id ASC
                    LIMIT 1
                    """,
                    (rx["clinic_id"],),
                )
                disp = cur.fetchone()
                if disp:
                    dispensary_id = disp["dispensary_id"]
                    avg_prep_minutes = disp["avg_prep_minutes"]
                    dispensary_name = disp["dispensary_name"]

            # If no clinic match, try doctor's affiliated hospital dispensaries
            if not dispensary_id and rx["doctor_id"]:
                cur.execute(
                    """
                    SELECT d.dispensary_id, d.avg_prep_minutes, d.name AS dispensary_name
                    FROM dispensary d
                    JOIN hospital_doctor hd ON hd.hospital_id = d.hospital_id
                    WHERE hd.doctor_id = %s AND hd.is_active = TRUE AND d.status = 'ACTIVE'
                    ORDER BY d.dispensary_id ASC
                    LIMIT 1
                    """,
                    (rx["doctor_id"],),
                )
                disp = cur.fetchone()
                if disp:
                    dispensary_id = disp["dispensary_id"]
                    avg_prep_minutes = disp["avg_prep_minutes"]
                    dispensary_name = disp["dispensary_name"]

            # Fallback: select first active dispensary in the database
            if not dispensary_id:
                cur.execute(
                    """
                    SELECT dispensary_id, avg_prep_minutes, name AS dispensary_name
                    FROM dispensary
                    WHERE status = 'ACTIVE'
                    ORDER BY dispensary_id ASC
                    LIMIT 1
                    """
                )
                disp = cur.fetchone()
                if not disp:
                    # No active dispensary configured in the system yet
                    return None
                dispensary_id = disp["dispensary_id"]
                avg_prep_minutes = disp["avg_prep_minutes"]
                dispensary_name = disp["dispensary_name"]

            # 3. Check existing request for this prescription + dispensary
            cur.execute(
                """
                SELECT request_id FROM dispensary_request
                WHERE prescription_id = %s AND dispensary_id = %s
                """,
                (prescription_id, dispensary_id),
            )
            existing_req = cur.fetchone()
            if existing_req:
                return get_request_detail(dispensary_id, existing_req["request_id"])

            # 4. Compute Queue Position & Estimated Ready Time
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

            # 5. Insert header request (initially PENDING)
            cur.execute(
                """
                INSERT INTO dispensary_request (
                    prescription_id, dispensary_id, patient_id, status, estimated_ready_at
                ) VALUES (%s, %s, %s, 'PENDING', %s)
                RETURNING request_id, prescription_id, dispensary_id, patient_id,
                          status, estimated_ready_at, created_at
                """,
                (prescription_id, dispensary_id, patient_id, estimated_ready_at),
            )
            req_row = dict(cur.fetchone())
            request_id = req_row["request_id"]

            # 6. Fetch prescription medicines and create request items
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
                match_status = pm["match_status"]  # MATCHED|AMBIGUOUS|UNRESOLVED|NOT_A_MEDICINE|NULL
                required_qty = 1  # Standard default per prescribed item

                if match_status in ("AMBIGUOUS", "UNRESOLVED", "NOT_A_MEDICINE"):
                    # Surface the exact matcher verdict rather than a generic UNAVAILABLE.
                    # The dispensary UI can then prompt the pharmacist to resolve manually.
                    avail_status = match_status
                elif med_id:
                    # MATCHED — check actual stock at this dispensary.
                    cur.execute(
                        """
                        SELECT (available_quantity - reserved_quantity) AS free_stock
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (dispensary_id, med_id),
                    )
                    stock_row = cur.fetchone()
                    if stock_row:
                        free_stock = stock_row["free_stock"] or 0
                        if free_stock >= required_qty:
                            avail_status = "AVAILABLE"
                        elif free_stock > 0:
                            avail_status = "PARTIAL"
                        else:
                            avail_status = "UNAVAILABLE"
                    else:
                        # medicine_id exists in catalog but no stock row at this dispensary
                        avail_status = "UNAVAILABLE"
                else:
                    # medicine_id is NULL and match_status is NULL — legacy or unknown
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

            # 7. Update overall request status based on item availability
            if not item_statuses or all(s == "AVAILABLE" for s in item_statuses):
                overall_status = "PENDING"
            elif any(s in ("AVAILABLE", "PARTIAL") for s in item_statuses):
                overall_status = "PARTIALLY_AVAILABLE"
            else:
                overall_status = "UNAVAILABLE"

            cur.execute(
                "UPDATE dispensary_request SET status = %s WHERE request_id = %s",
                (overall_status, request_id),
            )
            req_row["status"] = overall_status

            # 8. Notify Patient via Notification System
            msg_text = (
                f"Your prescription #{prescription_id} has been received by {dispensary_name}. "
                f"Status: {overall_status.replace('_', ' ')}. "
                f"Est. ready in ~{eta_minutes} mins."
            )
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, %s, %s, 'MEDICINE')
                """,
                (patient_user_id, "Dispensary Prescription Received", msg_text),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def confirm_or_approve_request(
    dispensary_id: int,
    request_id: int,
    estimated_prep_minutes: Optional[int] = 15,
    pharmacist_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Approve and confirm prescription fulfillment ticket.

    Reserves stock, records preparation time and confirmation notes, sets status to CONFIRMED.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot approve request in status '{req['status']}'.")

            # 2. Reserve available items
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved, availability_status
                FROM dispensary_request_item
                WHERE request_id = %s
                """,
                (request_id,),
            )
            items = cur.fetchall()

            for item in items:
                med_id = item["medicine_id"]
                req_qty = item["required_quantity"]

                if med_id and not item["reserved"]:
                    cur.execute(
                        """
                        SELECT inventory_id, available_quantity, reserved_quantity,
                               (available_quantity - reserved_quantity) AS free_stock
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        FOR UPDATE
                        """,
                        (dispensary_id, med_id),
                    )
                    inv = cur.fetchone()
                    if inv and (inv["free_stock"] or 0) >= req_qty:
                        cur.execute(
                            """
                            UPDATE inventory_dispensary_stock
                            SET reserved_quantity = reserved_quantity + %s,
                                updated_at = NOW()
                            WHERE inventory_id = %s
                            """,
                            (req_qty, inv["inventory_id"]),
                        )
                        cur.execute(
                            """
                            UPDATE dispensary_request_item
                            SET reserved = TRUE, availability_status = 'AVAILABLE'
                            WHERE item_id = %s
                            """,
                            (item["item_id"],),
                        )
                        cur.execute(
                            """
                            INSERT INTO inventory_transaction (
                                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                            ) VALUES (%s, %s, %s, 'MEDICINE_RESERVED', %s, %s, 'Reserved upon ticket confirmation')
                            """,
                            (inv["inventory_id"], dispensary_id, med_id, req_qty, request_id),
                        )

            prep_mins = estimated_prep_minutes if (estimated_prep_minutes and estimated_prep_minutes > 0) else 15
            est_time_expr = f"NOW() + INTERVAL '{prep_mins} minutes'"

            # 3. Update request status to CONFIRMED
            cur.execute(
                f"""
                UPDATE dispensary_request
                SET status = 'CONFIRMED',
                    estimated_ready_at = {est_time_expr},
                    pharmacist_notes = COALESCE(%s, pharmacist_notes),
                    reconsultation_reason = NULL,
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (pharmacist_notes, request_id),
            )

            # 4. Notify patient
            notes_addon = f' Note from pharmacist: "{pharmacist_notes}"' if pharmacist_notes else ""
            msg = (
                f"Your prescription order #{req['prescription_id']} has been APPROVED & CONFIRMED by {req['disp_name']}! "
                f"Estimated ready in ~{prep_mins} mins.{notes_addon}"
            )
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Dispensary Order Confirmed', %s, 'MEDICINE')
                """,
                (req["patient_user_id"], msg),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def request_reconsultation(
    dispensary_id: int,
    request_id: int,
    reason: str,
    pharmacist_notes: str,
    target: str = "DOCTOR",
    item_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Flag prescription ticket or specific medicines for doctor/patient reconsultation.

    Releases any reserved inventory so stock is not tied up, transitions status to RECONSULTATION_NEEDED,
    records the clinical advisory notes, and notifies the patient.
    """
    if not pharmacist_notes or not pharmacist_notes.strip():
        raise ValueError("Clinical notes describing the reconsultation reasoning are required.")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot reconsult request in status '{req['status']}'.")

            # 2. Release any reserved items for this request
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved
                FROM dispensary_request_item
                WHERE request_id = %s AND reserved = TRUE
                """,
                (request_id,),
            )
            reserved_items = cur.fetchall()
            for r_item in reserved_items:
                med_id = r_item["medicine_id"]
                req_qty = r_item["required_quantity"]
                if med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s),
                            updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (req_qty, dispensary_id, med_id),
                    )
                    cur.execute(
                        """
                        INSERT INTO inventory_transaction (
                            inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                        )
                        SELECT inventory_id, %s, %s, 'RESERVATION_CANCELLED', %s, %s, 'Released due to reconsultation'
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (dispensary_id, med_id, req_qty, request_id, dispensary_id, med_id),
                    )
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reserved = FALSE
                    WHERE item_id = %s
                    """,
                    (r_item["item_id"],),
                )

            # 3. If item_ids specified, flag those items
            if item_ids:
                for it_id in item_ids:
                    cur.execute(
                        """
                        UPDATE dispensary_request_item
                        SET reconsultation_needed = TRUE,
                            reconsultation_notes = %s,
                            availability_status = 'RECONSULTATION_NEEDED'
                        WHERE item_id = %s AND request_id = %s
                        """,
                        (pharmacist_notes.strip(), it_id, request_id),
                    )
            else:
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reconsultation_needed = TRUE,
                        reconsultation_notes = %s
                    WHERE request_id = %s
                    """,
                    (pharmacist_notes.strip(), request_id),
                )

            # 4. Update request status to RECONSULTATION_NEEDED
            clean_reason = reason.strip() if reason else "CLINICAL_RECONSULTATION"
            clean_target = (target or "DOCTOR").strip().upper()
            cur.execute(
                """
                UPDATE dispensary_request
                SET status = 'RECONSULTATION_NEEDED',
                    reconsultation_reason = %s,
                    pharmacist_notes = %s,
                    reconsultation_target = %s,
                    reconsultation_at = NOW(),
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (clean_reason, pharmacist_notes.strip(), clean_target, request_id),
            )

            # 5. Notify patient
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Doctor Reconsultation Advised by Pharmacist', %s, 'MEDICINE')
                """,
                (
                    req["patient_user_id"],
                    f"Pharmacist at {req['disp_name']} advises doctor reconsultation for prescription #{req['prescription_id']}: {pharmacist_notes.strip()}",
                ),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def mark_request_ready(dispensary_id: int, request_id: int) -> Dict[str, Any]:
    """Mark request as READY for collection and notify patient."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT req.request_id, req.patient_id, p.user_id AS patient_user_id, d.name AS disp_name, d.location
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError("Request not found.")

            cur.execute(
                """
                UPDATE dispensary_request
                SET status = 'READY', ready_at = NOW(), updated_at = NOW()
                WHERE request_id = %s
                """,
                (request_id,),
            )

            loc_str = f" from {req['location']}" if req.get("location") else ""
            msg = f"Your medicines are READY for collection{loc_str} at {req['disp_name']}!"
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Medicines Ready for Pickup', %s, 'MEDICINE')
                """,
                (req["patient_user_id"], msg),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def confirm_or_approve_request(
    dispensary_id: int,
    request_id: int,
    estimated_prep_minutes: Optional[int] = 15,
    pharmacist_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Approve and confirm prescription fulfillment ticket.

    Reserves stock, records preparation time and confirmation notes, sets status to CONFIRMED.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot approve request in status '{req['status']}'.")

            # 2. Reserve available items
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved, availability_status
                FROM dispensary_request_item
                WHERE request_id = %s
                """,
                (request_id,),
            )
            items = cur.fetchall()

            for item in items:
                med_id = item["medicine_id"]
                req_qty = item["required_quantity"]

                if med_id and not item["reserved"]:
                    cur.execute(
                        """
                        SELECT inventory_id, available_quantity, reserved_quantity,
                               (available_quantity - reserved_quantity) AS free_stock
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        FOR UPDATE
                        """,
                        (dispensary_id, med_id),
                    )
                    inv = cur.fetchone()
                    if inv and (inv["free_stock"] or 0) >= req_qty:
                        cur.execute(
                            """
                            UPDATE inventory_dispensary_stock
                            SET reserved_quantity = reserved_quantity + %s,
                                updated_at = NOW()
                            WHERE inventory_id = %s
                            """,
                            (req_qty, inv["inventory_id"]),
                        )
                        cur.execute(
                            """
                            UPDATE dispensary_request_item
                            SET reserved = TRUE, availability_status = 'AVAILABLE'
                            WHERE item_id = %s
                            """,
                            (item["item_id"],),
                        )
                        cur.execute(
                            """
                            INSERT INTO inventory_transaction (
                                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                            ) VALUES (%s, %s, %s, 'MEDICINE_RESERVED', %s, %s, 'Reserved upon ticket confirmation')
                            """,
                            (inv["inventory_id"], dispensary_id, med_id, req_qty, request_id),
                        )

            prep_mins = estimated_prep_minutes if (estimated_prep_minutes and estimated_prep_minutes > 0) else 15
            est_time_expr = f"NOW() + INTERVAL '{prep_mins} minutes'"

            # 3. Update request status to CONFIRMED
            cur.execute(
                f"""
                UPDATE dispensary_request
                SET status = 'CONFIRMED',
                    estimated_ready_at = {est_time_expr},
                    pharmacist_notes = COALESCE(%s, pharmacist_notes),
                    reconsultation_reason = NULL,
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (pharmacist_notes, request_id),
            )

            # 4. Notify patient
            notes_addon = f' Note from pharmacist: "{pharmacist_notes}"' if pharmacist_notes else ""
            msg = (
                f"Your prescription order #{req['prescription_id']} has been APPROVED & CONFIRMED by {req['disp_name']}! "
                f"Estimated ready in ~{prep_mins} mins.{notes_addon}"
            )
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Dispensary Order Confirmed', %s, 'MEDICINE')
                """,
                (req["patient_user_id"], msg),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def request_reconsultation(
    dispensary_id: int,
    request_id: int,
    reason: str,
    pharmacist_notes: str,
    target: str = "DOCTOR",
    item_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Flag prescription ticket or specific medicines for doctor/patient reconsultation.

    Releases any reserved inventory so stock is not tied up, transitions status to RECONSULTATION_NEEDED,
    records the clinical advisory notes, and notifies the patient.
    """
    if not pharmacist_notes or not pharmacist_notes.strip():
        raise ValueError("Clinical notes describing the reconsultation reasoning are required.")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot reconsult request in status '{req['status']}'.")

            # 2. Release any reserved items for this request
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved
                FROM dispensary_request_item
                WHERE request_id = %s AND reserved = TRUE
                """,
                (request_id,),
            )
            reserved_items = cur.fetchall()
            for r_item in reserved_items:
                med_id = r_item["medicine_id"]
                req_qty = r_item["required_quantity"]
                if med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s),
                            updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (req_qty, dispensary_id, med_id),
                    )
                    cur.execute(
                        """
                        INSERT INTO inventory_transaction (
                            inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                        )
                        SELECT inventory_id, %s, %s, 'RESERVATION_CANCELLED', %s, %s, 'Released due to reconsultation'
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (dispensary_id, med_id, req_qty, request_id, dispensary_id, med_id),
                    )
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reserved = FALSE
                    WHERE item_id = %s
                    """,
                    (r_item["item_id"],),
                )

            # 3. If item_ids specified, flag those items
            if item_ids:
                for it_id in item_ids:
                    cur.execute(
                        """
                        UPDATE dispensary_request_item
                        SET reconsultation_needed = TRUE,
                            reconsultation_notes = %s,
                            availability_status = 'RECONSULTATION_NEEDED'
                        WHERE item_id = %s AND request_id = %s
                        """,
                        (pharmacist_notes.strip(), it_id, request_id),
                    )
            else:
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reconsultation_needed = TRUE,
                        reconsultation_notes = %s
                    WHERE request_id = %s
                    """,
                    (pharmacist_notes.strip(), request_id),
                )

            # 4. Update request status to RECONSULTATION_NEEDED
            clean_reason = reason.strip() if reason else "CLINICAL_RECONSULTATION"
            clean_target = (target or "DOCTOR").strip().upper()
            cur.execute(
                """
                UPDATE dispensary_request
                SET status = 'RECONSULTATION_NEEDED',
                    reconsultation_reason = %s,
                    pharmacist_notes = %s,
                    reconsultation_target = %s,
                    reconsultation_at = NOW(),
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (clean_reason, pharmacist_notes.strip(), clean_target, request_id),
            )

            # 5. Notify patient
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Doctor Reconsultation Advised by Pharmacist', %s, 'MEDICINE')
                """,
                (
                    req["patient_user_id"],
                    f"Pharmacist at {req['disp_name']} advises doctor reconsultation for prescription #{req['prescription_id']}: {pharmacist_notes.strip()}",
                ),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)



def dispense_request(
    dispensary_id: int,
    request_id: int,
    items_input: Optional[List[Dict[str, Any]]] = None,
    notes: Optional[str] = None,
    pickup_code: Optional[str] = None,
) -> Dict[str, Any]:
    """Finalize dispensing: deduct physical stock, clear reservations, set DISPENSED status.

    Executed in a strict PostgreSQL transaction. Writes inventory_transaction and audit_log.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Lock request row
            cur.execute(
                """
                SELECT req.request_id, req.patient_id, req.status, req.pickup_code, p.user_id AS patient_user_id
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found.")

            if req["status"] == "DISPENSED":
                raise ValueError("Request is already marked DISPENSED.")
            if req["status"] == "CANCELLED":
                raise ValueError("Cannot dispense a cancelled request.")

            # Validate 6-digit handover verification code if set
            expected_code = (req.get("pickup_code") or "").strip()
            if expected_code:
                if not pickup_code or pickup_code.strip() != expected_code:
                    raise ValueError(
                        f"Invalid pickup verification code. Please ask the patient for the 6-digit code on their ticket."
                    )

            # 2. Process each item
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved, availability_status
                FROM dispensary_request_item
                WHERE request_id = %s
                """,
                (request_id,),
            )
            items = cur.fetchall()

            # Map custom input quantities if provided
            input_qty_map = {}
            if items_input:
                for inp in items_input:
                    input_qty_map[inp["item_id"]] = inp.get("dispensed_quantity")

            for item in items:
                med_id = item["medicine_id"]
                req_qty = item["required_quantity"]
                disp_qty = input_qty_map.get(item["item_id"])
                if disp_qty is None:
                    disp_qty = req_qty

                if med_id and disp_qty > 0:
                    # Lock inventory row
                    cur.execute(
                        """
                        SELECT inventory_id, available_quantity, reserved_quantity
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        FOR UPDATE
                        """,
                        (dispensary_id, med_id),
                    )
                    inv = cur.fetchone()
                    if inv:
                        new_avail = max(0, inv["available_quantity"] - disp_qty)
                        new_res = max(0, inv["reserved_quantity"] - (disp_qty if item["reserved"] else 0))

                        cur.execute(
                            """
                            UPDATE inventory_dispensary_stock
                            SET available_quantity = %s,
                                reserved_quantity = %s,
                                updated_at = NOW()
                            WHERE inventory_id = %s
                            """,
                            (new_avail, new_res, inv["inventory_id"]),
                        )

                        # Transaction log
                        cur.execute(
                            """
                            INSERT INTO inventory_transaction (
                                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                            ) VALUES (%s, %s, %s, 'MEDICINE_DISPENSED', %s, %s, 'Dispensed to patient')
                            """,
                            (inv["inventory_id"], dispensary_id, med_id, disp_qty, request_id),
                        )

                # Mark item dispensed
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET dispensed_quantity = %s, availability_status = 'DISPENSED'
                    WHERE item_id = %s
                    """,
                    (disp_qty, item["item_id"]),
                )

            # 3. Mark request DISPENSED
            cur.execute(
                """
                UPDATE dispensary_request
                SET status = 'DISPENSED', dispensed_at = NOW(), notes = %s, updated_at = NOW()
                WHERE request_id = %s
                """,
                (notes, request_id),
            )

            # 4. Audit Log
            cur.execute(
                """
                INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
                VALUES (%s, 'DISPENSE_MEDICINE', 'DISPENSARY_REQUEST', %s, %s)
                """,
                (req["patient_user_id"], request_id, f"Medicines dispensed by dispensary_id={dispensary_id}"),
            )

            # 5. Notify Patient
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Medicines Dispensed', 'Your prescribed medicines have been successfully collected.', 'MEDICINE')
                """,
                (req["patient_user_id"],),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def confirm_or_approve_request(
    dispensary_id: int,
    request_id: int,
    estimated_prep_minutes: Optional[int] = 15,
    pharmacist_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Approve and confirm prescription fulfillment ticket.

    Reserves stock, records preparation time and confirmation notes, sets status to CONFIRMED.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot approve request in status '{req['status']}'.")

            # 2. Reserve available items
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved, availability_status
                FROM dispensary_request_item
                WHERE request_id = %s
                """,
                (request_id,),
            )
            items = cur.fetchall()

            for item in items:
                med_id = item["medicine_id"]
                req_qty = item["required_quantity"]

                if med_id and not item["reserved"]:
                    cur.execute(
                        """
                        SELECT inventory_id, available_quantity, reserved_quantity,
                               (available_quantity - reserved_quantity) AS free_stock
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        FOR UPDATE
                        """,
                        (dispensary_id, med_id),
                    )
                    inv = cur.fetchone()
                    if inv and (inv["free_stock"] or 0) >= req_qty:
                        cur.execute(
                            """
                            UPDATE inventory_dispensary_stock
                            SET reserved_quantity = reserved_quantity + %s,
                                updated_at = NOW()
                            WHERE inventory_id = %s
                            """,
                            (req_qty, inv["inventory_id"]),
                        )
                        cur.execute(
                            """
                            UPDATE dispensary_request_item
                            SET reserved = TRUE, availability_status = 'AVAILABLE'
                            WHERE item_id = %s
                            """,
                            (item["item_id"],),
                        )
                        cur.execute(
                            """
                            INSERT INTO inventory_transaction (
                                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                            ) VALUES (%s, %s, %s, 'MEDICINE_RESERVED', %s, %s, 'Reserved upon ticket confirmation')
                            """,
                            (inv["inventory_id"], dispensary_id, med_id, req_qty, request_id),
                        )

            prep_mins = estimated_prep_minutes if (estimated_prep_minutes and estimated_prep_minutes > 0) else 15
            est_time_expr = f"NOW() + INTERVAL '{prep_mins} minutes'"

            # 3. Update request status to CONFIRMED
            cur.execute(
                f"""
                UPDATE dispensary_request
                SET status = 'CONFIRMED',
                    estimated_ready_at = {est_time_expr},
                    pharmacist_notes = COALESCE(%s, pharmacist_notes),
                    reconsultation_reason = NULL,
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (pharmacist_notes, request_id),
            )

            # 4. Notify patient
            notes_addon = f' Note from pharmacist: "{pharmacist_notes}"' if pharmacist_notes else ""
            msg = (
                f"Your prescription order #{req['prescription_id']} has been APPROVED & CONFIRMED by {req['disp_name']}! "
                f"Estimated ready in ~{prep_mins} mins.{notes_addon}"
            )
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Dispensary Order Confirmed', %s, 'MEDICINE')
                """,
                (req["patient_user_id"], msg),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def request_reconsultation(
    dispensary_id: int,
    request_id: int,
    reason: str,
    pharmacist_notes: str,
    target: str = "DOCTOR",
    item_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Flag prescription ticket or specific medicines for doctor/patient reconsultation.

    Releases any reserved inventory so stock is not tied up, transitions status to RECONSULTATION_NEEDED,
    records the clinical advisory notes, and notifies the patient.
    """
    if not pharmacist_notes or not pharmacist_notes.strip():
        raise ValueError("Clinical notes describing the reconsultation reasoning are required.")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot reconsult request in status '{req['status']}'.")

            # 2. Release any reserved items for this request
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved
                FROM dispensary_request_item
                WHERE request_id = %s AND reserved = TRUE
                """,
                (request_id,),
            )
            reserved_items = cur.fetchall()
            for r_item in reserved_items:
                med_id = r_item["medicine_id"]
                req_qty = r_item["required_quantity"]
                if med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s),
                            updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (req_qty, dispensary_id, med_id),
                    )
                    cur.execute(
                        """
                        INSERT INTO inventory_transaction (
                            inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                        )
                        SELECT inventory_id, %s, %s, 'RESERVATION_CANCELLED', %s, %s, 'Released due to reconsultation'
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (dispensary_id, med_id, req_qty, request_id, dispensary_id, med_id),
                    )
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reserved = FALSE
                    WHERE item_id = %s
                    """,
                    (r_item["item_id"],),
                )

            # 3. If item_ids specified, flag those items
            if item_ids:
                for it_id in item_ids:
                    cur.execute(
                        """
                        UPDATE dispensary_request_item
                        SET reconsultation_needed = TRUE,
                            reconsultation_notes = %s,
                            availability_status = 'RECONSULTATION_NEEDED'
                        WHERE item_id = %s AND request_id = %s
                        """,
                        (pharmacist_notes.strip(), it_id, request_id),
                    )
            else:
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reconsultation_needed = TRUE,
                        reconsultation_notes = %s
                    WHERE request_id = %s
                    """,
                    (pharmacist_notes.strip(), request_id),
                )

            # 4. Update request status to RECONSULTATION_NEEDED
            clean_reason = reason.strip() if reason else "CLINICAL_RECONSULTATION"
            clean_target = (target or "DOCTOR").strip().upper()
            cur.execute(
                """
                UPDATE dispensary_request
                SET status = 'RECONSULTATION_NEEDED',
                    reconsultation_reason = %s,
                    pharmacist_notes = %s,
                    reconsultation_target = %s,
                    reconsultation_at = NOW(),
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (clean_reason, pharmacist_notes.strip(), clean_target, request_id),
            )

            # 5. Notify patient
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Doctor Reconsultation Advised by Pharmacist', %s, 'MEDICINE')
                """,
                (
                    req["patient_user_id"],
                    f"Pharmacist at {req['disp_name']} advises doctor reconsultation for prescription #{req['prescription_id']}: {pharmacist_notes.strip()}",
                ),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)



def cancel_request(dispensary_id: int, request_id: int, notes: Optional[str] = None) -> Dict[str, Any]:
    """Cancel a dispensary request and release any reserved inventory."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT req.request_id, req.patient_id, req.status, p.user_id AS patient_user_id
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError("Request not found.")
            if req["status"] == "DISPENSED":
                raise ValueError("Cannot cancel an already dispensed request.")

            # Release reservations
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved
                FROM dispensary_request_item
                WHERE request_id = %s AND reserved = TRUE
                """,
                (request_id,),
            )
            reserved_items = cur.fetchall()

            for item in reserved_items:
                med_id = item["medicine_id"]
                req_qty = item["required_quantity"]
                if med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s),
                            updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        RETURNING inventory_id
                        """,
                        (req_qty, dispensary_id, med_id),
                    )
                    inv_row = cur.fetchone()
                    if inv_row:
                        cur.execute(
                            """
                            INSERT INTO inventory_transaction (
                                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                            ) VALUES (%s, %s, %s, 'RESERVATION_CANCELLED', %s, %s, 'Request cancelled')
                            """,
                            (inv_row["inventory_id"], dispensary_id, med_id, req_qty, request_id),
                        )

            cur.execute(
                """
                UPDATE dispensary_request
                SET status = 'CANCELLED', notes = %s, updated_at = NOW()
                WHERE request_id = %s
                """,
                (notes, request_id),
            )

            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Dispensary Order Cancelled', 'Your dispensary request has been cancelled.', 'MEDICINE')
                """,
                (req["patient_user_id"],),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def confirm_or_approve_request(
    dispensary_id: int,
    request_id: int,
    estimated_prep_minutes: Optional[int] = 15,
    pharmacist_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Approve and confirm prescription fulfillment ticket.

    Reserves stock, records preparation time and confirmation notes, sets status to CONFIRMED.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot approve request in status '{req['status']}'.")

            # 2. Reserve available items
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved, availability_status
                FROM dispensary_request_item
                WHERE request_id = %s
                """,
                (request_id,),
            )
            items = cur.fetchall()

            for item in items:
                med_id = item["medicine_id"]
                req_qty = item["required_quantity"]

                if med_id and not item["reserved"]:
                    cur.execute(
                        """
                        SELECT inventory_id, available_quantity, reserved_quantity,
                               (available_quantity - reserved_quantity) AS free_stock
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        FOR UPDATE
                        """,
                        (dispensary_id, med_id),
                    )
                    inv = cur.fetchone()
                    if inv and (inv["free_stock"] or 0) >= req_qty:
                        cur.execute(
                            """
                            UPDATE inventory_dispensary_stock
                            SET reserved_quantity = reserved_quantity + %s,
                                updated_at = NOW()
                            WHERE inventory_id = %s
                            """,
                            (req_qty, inv["inventory_id"]),
                        )
                        cur.execute(
                            """
                            UPDATE dispensary_request_item
                            SET reserved = TRUE, availability_status = 'AVAILABLE'
                            WHERE item_id = %s
                            """,
                            (item["item_id"],),
                        )
                        cur.execute(
                            """
                            INSERT INTO inventory_transaction (
                                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                            ) VALUES (%s, %s, %s, 'MEDICINE_RESERVED', %s, %s, 'Reserved upon ticket confirmation')
                            """,
                            (inv["inventory_id"], dispensary_id, med_id, req_qty, request_id),
                        )

            prep_mins = estimated_prep_minutes if (estimated_prep_minutes and estimated_prep_minutes > 0) else 15
            est_time_expr = f"NOW() + INTERVAL '{prep_mins} minutes'"

            # 3. Update request status to CONFIRMED
            cur.execute(
                f"""
                UPDATE dispensary_request
                SET status = 'CONFIRMED',
                    estimated_ready_at = {est_time_expr},
                    pharmacist_notes = COALESCE(%s, pharmacist_notes),
                    reconsultation_reason = NULL,
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (pharmacist_notes, request_id),
            )

            # 4. Notify patient
            notes_addon = f' Note from pharmacist: "{pharmacist_notes}"' if pharmacist_notes else ""
            msg = (
                f"Your prescription order #{req['prescription_id']} has been APPROVED & CONFIRMED by {req['disp_name']}! "
                f"Estimated ready in ~{prep_mins} mins.{notes_addon}"
            )
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Dispensary Order Confirmed', %s, 'MEDICINE')
                """,
                (req["patient_user_id"], msg),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def request_reconsultation(
    dispensary_id: int,
    request_id: int,
    reason: str,
    pharmacist_notes: str,
    target: str = "DOCTOR",
    item_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Flag prescription ticket or specific medicines for doctor/patient reconsultation.

    Releases any reserved inventory so stock is not tied up, transitions status to RECONSULTATION_NEEDED,
    records the clinical advisory notes, and notifies the patient.
    """
    if not pharmacist_notes or not pharmacist_notes.strip():
        raise ValueError("Clinical notes describing the reconsultation reasoning are required.")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Fetch request with lock
            cur.execute(
                """
                SELECT req.request_id, req.prescription_id, req.patient_id, req.status,
                       p.user_id AS patient_user_id, d.name AS disp_name
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found for this dispensary.")

            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot reconsult request in status '{req['status']}'.")

            # 2. Release any reserved items for this request
            cur.execute(
                """
                SELECT item_id, medicine_id, required_quantity, reserved
                FROM dispensary_request_item
                WHERE request_id = %s AND reserved = TRUE
                """,
                (request_id,),
            )
            reserved_items = cur.fetchall()
            for r_item in reserved_items:
                med_id = r_item["medicine_id"]
                req_qty = r_item["required_quantity"]
                if med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s),
                            updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (req_qty, dispensary_id, med_id),
                    )
                    cur.execute(
                        """
                        INSERT INTO inventory_transaction (
                            inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                        )
                        SELECT inventory_id, %s, %s, 'RESERVATION_CANCELLED', %s, %s, 'Released due to reconsultation'
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (dispensary_id, med_id, req_qty, request_id, dispensary_id, med_id),
                    )
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reserved = FALSE
                    WHERE item_id = %s
                    """,
                    (r_item["item_id"],),
                )

            # 3. If item_ids specified, flag those items
            if item_ids:
                for it_id in item_ids:
                    cur.execute(
                        """
                        UPDATE dispensary_request_item
                        SET reconsultation_needed = TRUE,
                            reconsultation_notes = %s,
                            availability_status = 'RECONSULTATION_NEEDED'
                        WHERE item_id = %s AND request_id = %s
                        """,
                        (pharmacist_notes.strip(), it_id, request_id),
                    )
            else:
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET reconsultation_needed = TRUE,
                        reconsultation_notes = %s
                    WHERE request_id = %s
                    """,
                    (pharmacist_notes.strip(), request_id),
                )

            # 4. Update request status to RECONSULTATION_NEEDED
            clean_reason = reason.strip() if reason else "CLINICAL_RECONSULTATION"
            clean_target = (target or "DOCTOR").strip().upper()
            cur.execute(
                """
                UPDATE dispensary_request
                SET status = 'RECONSULTATION_NEEDED',
                    reconsultation_reason = %s,
                    pharmacist_notes = %s,
                    reconsultation_target = %s,
                    reconsultation_at = NOW(),
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (clean_reason, pharmacist_notes.strip(), clean_target, request_id),
            )

            # 5. Notify patient
            cur.execute(
                """
                INSERT INTO notification (user_id, title, message, type)
                VALUES (%s, 'Doctor Reconsultation Advised by Pharmacist', %s, 'MEDICINE')
                """,
                (
                    req["patient_user_id"],
                    f"Pharmacist at {req['disp_name']} advises doctor reconsultation for prescription #{req['prescription_id']}: {pharmacist_notes.strip()}",
                ),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)



# =============================================================================
# 5. Queue & Detail Queries
# =============================================================================

def get_dispensary_queue(dispensary_id: int, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return active queue for dispensary ordered FIFO (oldest first)."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where_extra = ""
            params: list = [dispensary_id]
            if status_filter and status_filter.upper() != "ALL":
                where_extra = "AND req.status = %s"
                params.append(status_filter.upper())

            cur.execute(
                f"""
                SELECT
                    req.request_id,
                    req.prescription_id,
                    req.patient_id,
                    u.full_name         AS patient_name,
                    pt.patient_code,
                    req.status,
                    req.estimated_ready_at,
                    req.pickup_code,
                    req.notes,
                    req.pharmacist_notes,
                    req.reconsultation_reason,
                    req.reconsultation_target,
                    req.reconsultation_at,
                    req.verified_by_user_id,
                    req.verified_at,
                    req.verification_signature,
                    req.verification_checklist,
                    verif_u.full_name   AS verified_by_name,
                    req.created_at,
                    COUNT(item.item_id) AS total_items
                FROM dispensary_request req
                JOIN patient pt  ON pt.patient_id = req.patient_id
                JOIN users   u   ON u.user_id      = pt.user_id
                LEFT JOIN dispensary_request_item item ON item.request_id = req.request_id
                WHERE req.dispensary_id = %s
                {where_extra}
                GROUP BY req.request_id, req.prescription_id, req.patient_id,
                         u.full_name, pt.patient_code, req.status, req.estimated_ready_at, req.pickup_code, req.notes, req.pharmacist_notes, req.reconsultation_reason, req.reconsultation_target, req.reconsultation_at, req.created_at
                ORDER BY req.created_at ASC
                """,
                params,
            )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                for k in ("estimated_ready_at", "created_at"):
                    if item.get(k):
                        item[k] = str(item[k])
                results.append(item)
            return results


def get_request_detail(dispensary_id: Optional[int], request_id: int) -> Optional[Dict[str, Any]]:
    """Return full request breakdown with prescription, patient, and item statuses."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            disp_clause = "AND req.dispensary_id = %s" if dispensary_id else ""
            params = [request_id, dispensary_id] if dispensary_id else [request_id]

            cur.execute(
                f"""
                SELECT
                    req.request_id,
                    req.prescription_id,
                    req.dispensary_id,
                    d.name              AS dispensary_name,
                    d.location          AS dispensary_location,
                    req.patient_id,
                    pt.patient_code,
                    u.full_name         AS patient_name,
                    u.email             AS patient_email,
                    u.phone             AS patient_phone,
                    pt.date_of_birth    AS patient_dob,
                    rx.issue_date,
                    rx.diagnosis,
                    rx.notes            AS prescription_notes,
                    doc_u.full_name     AS doctor_name,
                    doc.specialization  AS doctor_specialty,
                    req.status,
                    req.estimated_ready_at,
                    req.ready_at,
                    req.dispensed_at,
                    req.pickup_code,
                    req.notes,
                    req.pharmacist_notes,
                    req.reconsultation_reason,
                    req.reconsultation_target,
                    req.reconsultation_at,
                    req.verified_by_user_id,
                    req.verified_at,
                    req.verification_signature,
                    req.verification_checklist,
                    verif_u.full_name AS verified_by_name,
                    req.created_at,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'item_id', item.item_id,
                                    'prescription_medicine_id', item.prescription_medicine_id,
                                    'medicine_id', item.medicine_id,
                                    'prescribed_medicine_name', pm.name,
                                    'dosage', pm.dosage,
                                    'frequency', pm.frequency,
                                    'duration', pm.duration,
                                    'instructions', pm.instructions,
                                    'generic_name', m.generic_name,
                                    'brand_name', m.brand_name,
                                    'strength', m.strength,
                                    'form', m.form,
                                    'required_quantity', item.required_quantity,
                                    'dispensed_quantity', item.dispensed_quantity,
                                    'availability_status', item.availability_status,
                                    'reserved', item.reserved,
                                    'reconsultation_needed', COALESCE(item.reconsultation_needed, FALSE),
                                    'reconsultation_notes', item.reconsultation_notes,
                                    'suggested_substitute_id', item.suggested_substitute_id,
                                    'substitute_name', sub_m.generic_name,
                                    'substitute_brand', sub_m.brand_name,
                                    'substitute_strength', sub_m.strength,
                                    'substitute_form', sub_m.form::TEXT
                                ) ORDER BY item.item_id ASC
                            )
                            FROM dispensary_request_item item
                            JOIN prescription_medicine pm ON pm.prescription_medicine_id = item.prescription_medicine_id
                            LEFT JOIN medicine m ON m.medicine_id = item.medicine_id
                            LEFT JOIN medicine sub_m ON sub_m.medicine_id = item.suggested_substitute_id
                            WHERE item.request_id = req.request_id
                        ),
                        '[]'::json
                    ) AS items
                FROM dispensary_request req
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                JOIN patient pt   ON pt.patient_id   = req.patient_id
                JOIN users   u    ON u.user_id        = pt.user_id
                JOIN prescription rx ON rx.prescription_id = req.prescription_id
                LEFT JOIN doctor doc ON doc.doctor_id = rx.doctor_id
                LEFT JOIN users doc_u ON doc_u.user_id = doc.user_id
                LEFT JOIN users verif_u ON verif_u.user_id = req.verified_by_user_id
                WHERE req.request_id = %s {disp_clause}
                """,
                params,
            )
            row = cur.fetchone()
            if not row:
                return None

            request_detail = dict(row)
            for k in ("estimated_ready_at", "ready_at", "dispensed_at", "created_at", "issue_date", "patient_dob", "reconsultation_at", "verified_at"):
                if request_detail.get(k):
                    request_detail[k] = str(request_detail[k])

            return request_detail


def get_patient_dispensary_requests(patient_id: int) -> List[Dict[str, Any]]:
    """Return all dispensary requests for a patient across all dispensaries."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    req.request_id,
                    req.prescription_id,
                    req.dispensary_id,
                    d.name              AS dispensary_name,
                    d.location          AS dispensary_location,
                    req.patient_id,
                    pt.patient_code,
                    u.full_name         AS patient_name,
                    u.email             AS patient_email,
                    u.phone             AS patient_phone,
                    pt.date_of_birth    AS patient_dob,
                    rx.issue_date,
                    rx.diagnosis,
                    rx.notes            AS prescription_notes,
                    doc_u.full_name     AS doctor_name,
                    doc.specialization  AS doctor_specialty,
                    req.status,
                    req.estimated_ready_at,
                    req.ready_at,
                    req.dispensed_at,
                    req.pickup_code,
                    req.notes,
                    req.pharmacist_notes,
                    req.reconsultation_reason,
                    req.reconsultation_target,
                    req.reconsultation_at,
                    req.created_at,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'item_id', item.item_id,
                                    'prescription_medicine_id', item.prescription_medicine_id,
                                    'medicine_id', item.medicine_id,
                                    'prescribed_medicine_name', pm.name,
                                    'dosage', pm.dosage,
                                    'frequency', pm.frequency,
                                    'duration', pm.duration,
                                    'instructions', pm.instructions,
                                    'generic_name', m.generic_name,
                                    'brand_name', m.brand_name,
                                    'strength', m.strength,
                                    'form', m.form,
                                    'required_quantity', item.required_quantity,
                                    'dispensed_quantity', item.dispensed_quantity,
                                    'availability_status', item.availability_status,
                                    'reserved', item.reserved,
                                    'reconsultation_needed', COALESCE(item.reconsultation_needed, FALSE),
                                    'reconsultation_notes', item.reconsultation_notes,
                                    'suggested_substitute_id', item.suggested_substitute_id,
                                    'substitute_name', sub_m.generic_name,
                                    'substitute_brand', sub_m.brand_name,
                                    'substitute_strength', sub_m.strength,
                                    'substitute_form', sub_m.form::TEXT
                                ) ORDER BY item.item_id ASC
                            )
                            FROM dispensary_request_item item
                            JOIN prescription_medicine pm ON pm.prescription_medicine_id = item.prescription_medicine_id
                            LEFT JOIN medicine m ON m.medicine_id = item.medicine_id
                            LEFT JOIN medicine sub_m ON sub_m.medicine_id = item.suggested_substitute_id
                            WHERE item.request_id = req.request_id
                        ),
                        '[]'::json
                    ) AS items
                FROM dispensary_request req
                JOIN dispensary d ON d.dispensary_id = req.dispensary_id
                JOIN patient pt   ON pt.patient_id   = req.patient_id
                JOIN users   u    ON u.user_id        = pt.user_id
                JOIN prescription rx ON rx.prescription_id = req.prescription_id
                LEFT JOIN doctor doc ON doc.doctor_id = rx.doctor_id
                LEFT JOIN users doc_u ON doc_u.user_id = doc.user_id
                WHERE req.patient_id = %s
                ORDER BY req.created_at DESC
                """,
                (patient_id,),
            )
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                for k in ("estimated_ready_at", "ready_at", "dispensed_at", "created_at", "issue_date", "patient_dob", "reconsultation_at", "verified_at"):
                    if item.get(k):
                        item[k] = str(item[k])
                results.append(item)
            return results


# =============================================================================
# 6. Dashboard & Inventory Alerts
# =============================================================================

def get_dashboard_stats(dispensary_id: int) -> Dict[str, Any]:
    """Return dashboard counters for dispensary home screen."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE status = 'PENDING')             AS pending_count,
                    COUNT(*) FILTER (WHERE status = 'PROCESSING')          AS processing_count,
                    COUNT(*) FILTER (WHERE status = 'READY')               AS ready_count,
                    COUNT(*) FILTER (WHERE status = 'DISPENSED')           AS dispensed_count,
                    COUNT(*) FILTER (WHERE status = 'UNAVAILABLE')         AS unavailable_count,
                    COUNT(*) FILTER (WHERE status = 'PARTIALLY_AVAILABLE') AS partial_count
                FROM dispensary_request
                WHERE dispensary_id = %s
                """,
                (dispensary_id,),
            )
            req_stats = dict(cur.fetchone())

            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE (available_quantity - reserved_quantity) <= 0) AS out_of_stock_count,
                    COUNT(*) FILTER (WHERE (available_quantity - reserved_quantity) > 0 AND (available_quantity - reserved_quantity) <= reorder_level) AS low_stock_count,
                    COUNT(*) AS total_medicines
                FROM inventory_dispensary_stock
                WHERE dispensary_id = %s
                """,
                (dispensary_id,),
            )
            stock_stats = dict(cur.fetchone())

            return {
                "pending":          req_stats.get("pending_count", 0),
                "processing":       req_stats.get("processing_count", 0),
                "ready":            req_stats.get("ready_count", 0),
                "dispensed":        req_stats.get("dispensed_count", 0),
                "unavailable":      req_stats.get("unavailable_count", 0),
                "partial":          req_stats.get("partial_count", 0),
                "out_of_stock":     stock_stats.get("out_of_stock_count", 0),
                "low_stock":        stock_stats.get("low_stock_count", 0),
                "total_medicines":  stock_stats.get("total_medicines", 0),
            }


def get_inventory_alerts(dispensary_id: int) -> Dict[str, Any]:
    """Return low-stock and out-of-stock items for alerts screen."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    inv.inventory_id,
                    m.generic_name,
                    m.brand_name,
                    inv.available_quantity,
                    inv.reserved_quantity,
                    (inv.available_quantity - inv.reserved_quantity) AS free_stock,
                    inv.reorder_level,
                    inv.unit
                FROM inventory_dispensary_stock inv
                JOIN medicine m ON m.medicine_id = inv.medicine_id
                WHERE inv.dispensary_id = %s
                  AND (inv.available_quantity - inv.reserved_quantity) <= inv.reorder_level
                ORDER BY free_stock ASC
                """,
                (dispensary_id,),
            )
            alerts = [dict(r) for r in cur.fetchall()]
            return {
                "alerts": alerts,
                "total_alerts": len(alerts),
            }



# =============================================================================
# 7. Phase 1 Clinical Workflow: Per-Item Decisions, Verification & Audit Ledger
# =============================================================================

def update_request_item_decision(
    dispensary_id: int,
    request_id: int,
    item_id: int,
    decision: str,
    quantity: Optional[int] = None,
    substitute_medicine_id: Optional[int] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute per-medicine fulfillment decision (FULFILL, PARTIAL, SUBSTITUTE, UNAVAILABLE, RECONSULT).

    Adjusts inventory reservations and transactions, then recalibrates overall request status.
    """
    decision_clean = decision.strip().upper()
    valid_decisions = ("FULFILL", "PARTIAL", "SUBSTITUTE", "UNAVAILABLE", "RECONSULT")
    if decision_clean not in valid_decisions:
        raise ValueError(f"Invalid decision '{decision}'. Must be one of {valid_decisions}")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Lock request and item
            cur.execute(
                """
                SELECT req.request_id, req.dispensary_id, req.status, p.user_id AS patient_user_id
                FROM dispensary_request req
                JOIN patient p ON p.patient_id = req.patient_id
                WHERE req.request_id = %s AND req.dispensary_id = %s
                FOR UPDATE
                """,
                (request_id, dispensary_id),
            )
            req = cur.fetchone()
            if not req:
                raise ValueError(f"Request #{request_id} not found.")
            if req["status"] in ("DISPENSED", "CANCELLED"):
                raise ValueError(f"Cannot update item decisions for request in status '{req['status']}'.")

            cur.execute(
                """
                SELECT item_id, prescription_medicine_id, medicine_id, required_quantity,
                       dispensed_quantity, availability_status, reserved, suggested_substitute_id
                FROM dispensary_request_item
                WHERE item_id = %s AND request_id = %s
                FOR UPDATE
                """,
                (item_id, request_id),
            )
            item = cur.fetchone()
            if not item:
                raise ValueError(f"Item #{item_id} not found for this request.")

            med_id = item["medicine_id"]
            req_qty = item["required_quantity"]

            if decision_clean in ("FULFILL", "PARTIAL"):
                target_qty = quantity if (quantity is not None and quantity > 0) else req_qty

                # Check and reserve stock
                if med_id:
                    cur.execute(
                        """
                        SELECT inventory_id, (available_quantity - reserved_quantity) AS free_stock
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        FOR UPDATE
                        """,
                        (dispensary_id, med_id),
                    )
                    inv = cur.fetchone()
                    free = (inv["free_stock"] or 0) if inv else 0

                    # If not already reserved, reserve target_qty
                    if not item["reserved"] and inv and free >= target_qty:
                        cur.execute(
                            """
                            UPDATE inventory_dispensary_stock
                            SET reserved_quantity = reserved_quantity + %s, updated_at = NOW()
                            WHERE inventory_id = %s
                            """,
                            (target_qty, inv["inventory_id"]),
                        )
                        cur.execute(
                            """
                            INSERT INTO inventory_transaction (
                                inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                            ) VALUES (%s, %s, %s, 'MEDICINE_RESERVED', %s, %s, %s)
                            """,
                            (inv["inventory_id"], dispensary_id, med_id, target_qty, request_id, f"Item #{item_id} decision: {decision_clean}"),
                        )

                status_label = "AVAILABLE" if decision_clean == "FULFILL" else "PARTIAL"
                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET availability_status = %s,
                        dispensed_quantity = %s,
                        reserved = TRUE,
                        reconsultation_needed = FALSE,
                        notes = COALESCE(%s, notes)
                    WHERE item_id = %s
                    """,
                    (status_label, target_qty, notes, item_id),
                )

            elif decision_clean == "SUBSTITUTE":
                if not substitute_medicine_id:
                    raise ValueError("substitute_medicine_id is required when substituting an item.")

                # Release previous reservation if existed
                if item["reserved"] and med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s), updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (item["dispensed_quantity"] or req_qty, dispensary_id, med_id),
                    )

                sub_qty = quantity if (quantity is not None and quantity > 0) else req_qty
                # Reserve substitute medicine
                cur.execute(
                    """
                    SELECT inventory_id, (available_quantity - reserved_quantity) AS free_stock
                    FROM inventory_dispensary_stock
                    WHERE dispensary_id = %s AND medicine_id = %s
                    FOR UPDATE
                    """,
                    (dispensary_id, substitute_medicine_id),
                )
                sub_inv = cur.fetchone()
                if sub_inv and (sub_inv["free_stock"] or 0) >= sub_qty:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = reserved_quantity + %s, updated_at = NOW()
                        WHERE inventory_id = %s
                        """,
                        (sub_qty, sub_inv["inventory_id"]),
                    )
                    cur.execute(
                        """
                        INSERT INTO inventory_transaction (
                            inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                        ) VALUES (%s, %s, %s, 'MEDICINE_RESERVED', %s, %s, %s)
                        """,
                        (sub_inv["inventory_id"], dispensary_id, substitute_medicine_id, sub_qty, request_id, f"Substituted for item #{item_id}"),
                    )

                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET suggested_substitute_id = %s,
                        dispensed_quantity = %s,
                        availability_status = 'SUBSTITUTED',
                        reserved = TRUE,
                        reconsultation_needed = FALSE,
                        notes = COALESCE(%s, 'Pharmacist proposed generic substitute')
                    WHERE item_id = %s
                    """,
                    (substitute_medicine_id, sub_qty, notes, item_id),
                )

            elif decision_clean == "UNAVAILABLE":
                # Release reservation if existed
                if item["reserved"] and med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s), updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (item["dispensed_quantity"] or req_qty, dispensary_id, med_id),
                    )
                    cur.execute(
                        """
                        INSERT INTO inventory_transaction (
                            inventory_id, dispensary_id, medicine_id, txn_type, quantity, reference_id, notes
                        )
                        SELECT inventory_id, %s, %s, 'RESERVATION_CANCELLED', %s, %s, 'Item marked out of stock'
                        FROM inventory_dispensary_stock
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (dispensary_id, med_id, item["dispensed_quantity"] or req_qty, request_id, dispensary_id, med_id),
                    )

                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET availability_status = 'UNAVAILABLE',
                        dispensed_quantity = 0,
                        reserved = FALSE,
                        notes = COALESCE(%s, notes)
                    WHERE item_id = %s
                    """,
                    (notes, item_id),
                )

            elif decision_clean == "RECONSULT":
                if item["reserved"] and med_id:
                    cur.execute(
                        """
                        UPDATE inventory_dispensary_stock
                        SET reserved_quantity = GREATEST(0, reserved_quantity - %s), updated_at = NOW()
                        WHERE dispensary_id = %s AND medicine_id = %s
                        """,
                        (item["dispensed_quantity"] or req_qty, dispensary_id, med_id),
                    )

                cur.execute(
                    """
                    UPDATE dispensary_request_item
                    SET availability_status = 'RECONSULTATION_NEEDED',
                        reconsultation_needed = TRUE,
                        reconsultation_notes = COALESCE(%s, 'Doctor reconsultation advised'),
                        reserved = FALSE
                    WHERE item_id = %s
                    """,
                    (notes, item_id),
                )

            # 2. Recalibrate overall request status
            cur.execute(
                """
                SELECT availability_status, reconsultation_needed
                FROM dispensary_request_item
                WHERE request_id = %s
                """,
                (request_id,),
            )
            all_items = cur.fetchall()
            statuses = [it["availability_status"] for it in all_items]

            if any(it["reconsultation_needed"] for it in all_items) and not any(s in ("AVAILABLE", "SUBSTITUTED") for s in statuses):
                new_status = "RECONSULTATION_NEEDED"
            elif all(s in ("AVAILABLE", "SUBSTITUTED", "DISPENSED") for s in statuses):
                new_status = "CONFIRMED" if req["status"] in ("PENDING", "PARTIALLY_AVAILABLE", "UNAVAILABLE") else req["status"]
            elif any(s in ("AVAILABLE", "SUBSTITUTED", "PARTIAL") for s in statuses):
                new_status = "PARTIALLY_AVAILABLE"
            else:
                new_status = "UNAVAILABLE"

            cur.execute(
                "UPDATE dispensary_request SET status = %s, updated_at = NOW() WHERE request_id = %s",
                (new_status, request_id),
            )

            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def verify_prescription(
    dispensary_id: int,
    request_id: int,
    user_id: int,
    patient_checked: bool = True,
    dosage_checked: bool = True,
    interactions_checked: bool = True,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Record clinical pharmacist prescription review and verification sign-off."""
    import time
    from datetime import datetime, timezone

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT req.request_id, req.dispensary_id, req.status, u.full_name AS pharmacist_name
                FROM dispensary_request req
                LEFT JOIN users u ON u.user_id = %s
                WHERE req.request_id = %s AND req.dispensary_id = %s
                """,
                (user_id, request_id, dispensary_id),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("Request not found for this dispensary.")

            sig = f"RXF-V-{request_id}-{dispensary_id}-{int(time.time())}"
            import json
            checklist_dict = {
                "patient_identity_checked": patient_checked,
                "dosage_validity_checked": dosage_checked,
                "interactions_cleared": interactions_checked,
                "verified_by_user_id": user_id,
                "pharmacist_name": row["pharmacist_name"] or "Staff Pharmacist",
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "notes": notes,
            }

            cur.execute(
                """
                UPDATE dispensary_request
                SET verified_by_user_id = %s,
                    verified_at = NOW(),
                    verification_signature = %s,
                    verification_checklist = %s::jsonb,
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (user_id, sig, json.dumps(checklist_dict), request_id),
            )
            conn.commit()
            return get_request_detail(dispensary_id, request_id)


def get_inventory_transactions(
    dispensary_id: int,
    medicine_id: Optional[int] = None,
    txn_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Retrieve audit ledger of inventory movements (dispensed, reserved, added, cancelled)."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where_clauses = ["t.dispensary_id = %s"]
            params: list = [dispensary_id]

            if medicine_id:
                where_clauses.append("t.medicine_id = %s")
                params.append(medicine_id)

            if txn_type and txn_type.upper() != "ALL":
                where_clauses.append("t.txn_type = %s")
                params.append(txn_type.upper())

            where_str = " AND ".join(where_clauses)

            # Count
            cur.execute(f"SELECT COUNT(*) AS total FROM inventory_transaction t WHERE {where_str}", params)
            total = cur.fetchone()["total"]

            # Rows
            cur.execute(
                f"""
                SELECT
                    t.txn_id,
                    t.inventory_id,
                    t.dispensary_id,
                    t.medicine_id,
                    m.generic_name,
                    m.brand_name,
                    m.strength,
                    m.form::TEXT,
                    t.txn_type,
                    t.quantity,
                    t.reference_id,
                    t.notes,
                    t.created_at,
                    s.available_quantity,
                    s.reserved_quantity,
                    req.prescription_id,
                    pt_u.full_name AS patient_name
                FROM inventory_transaction t
                JOIN medicine m ON m.medicine_id = t.medicine_id
                LEFT JOIN inventory_dispensary_stock s ON s.inventory_id = t.inventory_id
                LEFT JOIN dispensary_request req ON req.request_id = t.reference_id
                LEFT JOIN patient pt ON pt.patient_id = req.patient_id
                LEFT JOIN users pt_u ON pt_u.user_id = pt.user_id
                WHERE {where_str}
                ORDER BY t.created_at DESC, t.txn_id DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()
            txns = []
            for r in rows:
                item = dict(r)
                if item.get("created_at"):
                    item["created_at"] = str(item["created_at"])
                txns.append(item)

            return {
                "transactions": txns,
                "total_count": total,
                "limit": limit,
                "offset": offset,
            }
