"""Inventory Availability Service — Rxify.

Responsibility: given a resolved medicine_id from the medicine matcher,
determine whether that medicine is currently available at a specific dispensary.

This layer is PURELY a read-only availability check.  It does NOT:
  - Decide which medicine a prescription refers to (that is medicine_matcher.py)
  - Reserve, order, or decrement stock (that is services/dispensary.py)
  - Create dispensary requests (that is create_dispensary_request_for_prescription)

Pipeline position:
    Prescription -> Gemini extraction -> medicine_matcher -> medicine_id
        -> THIS SERVICE -> AVAILABLE / NOT_AVAILABLE / UNRESOLVED
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import psycopg2.extras

from database.db import get_conn


# ---------------------------------------------------------------------------
# Status constants
# ---------------------------------------------------------------------------

STATUS_AVAILABLE = "AVAILABLE"
STATUS_NOT_AVAILABLE = "NOT_AVAILABLE"
STATUS_UNRESOLVED = "UNRESOLVED"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _medicine_exists(cur: psycopg2.extras.RealDictCursor, medicine_id: int) -> bool:
    """Return True if medicine_id exists in the global catalog."""
    cur.execute(
        "SELECT 1 FROM medicine WHERE medicine_id = %s",
        (medicine_id,),
    )
    return cur.fetchone() is not None


def _dispensary_exists(cur: psycopg2.extras.RealDictCursor, dispensary_id: int) -> bool:
    """Return True if dispensary_id exists."""
    cur.execute(
        "SELECT 1 FROM dispensary WHERE dispensary_id = %s",
        (dispensary_id,),
    )
    return cur.fetchone() is not None


def _fetch_stock_row(
    cur: psycopg2.extras.RealDictCursor,
    dispensary_id: int,
    medicine_id: int,
) -> Optional[Dict[str, Any]]:
    """Fetch the inventory row for this (dispensary, medicine) pair.

    Returns None if no stock row exists -- that is NOT an error condition.
    """
    cur.execute(
        """
        SELECT
            inv.inventory_id,
            inv.dispensary_id,
            inv.medicine_id,
            inv.available_quantity,
            inv.reserved_quantity,
            inv.unit,
            m.generic_name,
            m.brand_name,
            m.strength,
            m.form
        FROM inventory_dispensary_stock inv
        JOIN medicine m ON m.medicine_id = inv.medicine_id
        WHERE inv.dispensary_id = %s
          AND inv.medicine_id   = %s
        """,
        (dispensary_id, medicine_id),
    )
    row = cur.fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Public API: single-medicine availability check
# ---------------------------------------------------------------------------

def get_medicine_availability(
    dispensary_id: int,
    medicine_id: int,
) -> Dict[str, Any]:
    """Check whether medicine_id is available at dispensary_id.

    Returns a dict with the shape::

        {
            "medicine_id":        int,
            "dispensary_id":      int,
            "status":             "AVAILABLE" | "NOT_AVAILABLE" | "UNRESOLVED",
            "available_quantity": int,
            "generic_name":       str | None,
            "brand_name":         str | None,
            "strength":           str | None,
            "unit":               str | None,
            "message":            str,
        }

    Edge cases handled explicitly:

    1. medicine_id not in catalog        -> UNRESOLVED
    2. dispensary_id does not exist      -> raises ValueError (caller-level error)
    3. No stock row for this pair        -> NOT_AVAILABLE (quantity 0)
    4. Stock row exists, quantity == 0   -> NOT_AVAILABLE
    5. Stock row exists, quantity > 0    -> AVAILABLE
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Validate dispensary first (caller-level error, not a soft miss)
            if not _dispensary_exists(cur, dispensary_id):
                raise ValueError(f"Dispensary {dispensary_id} does not exist.")

            # Validate medicine
            if not _medicine_exists(cur, medicine_id):
                return {
                    "medicine_id": medicine_id,
                    "dispensary_id": dispensary_id,
                    "status": STATUS_UNRESOLVED,
                    "available_quantity": 0,
                    "generic_name": None,
                    "brand_name": None,
                    "strength": None,
                    "unit": None,
                    "message": f"Medicine ID {medicine_id} does not exist in the catalog.",
                }

            # Look up stock row (legitimately absent = no stock record yet)
            stock = _fetch_stock_row(cur, dispensary_id, medicine_id)

            if stock is None:
                # No stock row: medicine known to catalog but never stocked here
                cur.execute(
                    "SELECT generic_name, brand_name, strength FROM medicine WHERE medicine_id = %s",
                    (medicine_id,),
                )
                med = dict(cur.fetchone())
                return {
                    "medicine_id": medicine_id,
                    "dispensary_id": dispensary_id,
                    "status": STATUS_NOT_AVAILABLE,
                    "available_quantity": 0,
                    "generic_name": med["generic_name"],
                    "brand_name": med["brand_name"],
                    "strength": med["strength"],
                    "unit": None,
                    "message": "No stock record exists for this medicine at this dispensary.",
                }

            qty = stock["available_quantity"]

            if qty <= 0:
                return {
                    "medicine_id": medicine_id,
                    "dispensary_id": dispensary_id,
                    "status": STATUS_NOT_AVAILABLE,
                    "available_quantity": 0,
                    "generic_name": stock["generic_name"],
                    "brand_name": stock["brand_name"],
                    "strength": stock["strength"],
                    "unit": stock["unit"],
                    "message": "Medicine is out of stock at this dispensary.",
                }

            return {
                "medicine_id": medicine_id,
                "dispensary_id": dispensary_id,
                "status": STATUS_AVAILABLE,
                "available_quantity": qty,
                "generic_name": stock["generic_name"],
                "brand_name": stock["brand_name"],
                "strength": stock["strength"],
                "unit": stock["unit"],
                "message": f"Medicine is available ({qty} {stock['unit'] or 'units'} in stock).",
            }


# ---------------------------------------------------------------------------
# Public API: prescription-level batch availability check
# ---------------------------------------------------------------------------

def get_prescription_availability(
    dispensary_id: int,
    medicines: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Check availability for a list of resolved medicines at one dispensary.

    Args:
        dispensary_id: Target dispensary.
        medicines:     List of dicts with at least ``medicine_id`` and
                       optionally ``requested_quantity`` (int, default 1).

    Returns::

        {
            "dispensary_id": int,
            "overall_status": "ALL_AVAILABLE" | "PARTIALLY_AVAILABLE" | "NONE_AVAILABLE",
            "items": [
                {
                    "medicine_id":        int,
                    "status":             "AVAILABLE" | "NOT_AVAILABLE" | "UNRESOLVED",
                    "available_quantity": int,
                    "requested_quantity": int,
                    "generic_name":       str | None,
                    "brand_name":         str | None,
                    "strength":           str | None,
                    "unit":              str | None,
                    "message":            str,
                },
                ...
            ]
        }

    Note:
        - requested_quantity is informational only; no stock is reserved.
        - Each item is resolved independently; failures in one do not block others.
    """
    if not medicines:
        raise ValueError("medicines list must not be empty.")

    # Validate dispensary once up front
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if not _dispensary_exists(cur, dispensary_id):
                raise ValueError(f"Dispensary {dispensary_id} does not exist.")

    items: List[Dict[str, Any]] = []
    available_count = 0

    for entry in medicines:
        med_id = entry.get("medicine_id")
        requested_qty = int(entry.get("requested_quantity", entry.get("quantity", 1)))

        if not isinstance(med_id, int) or med_id <= 0:
            items.append({
                "medicine_id": med_id,
                "status": STATUS_UNRESOLVED,
                "available_quantity": 0,
                "requested_quantity": requested_qty,
                "generic_name": None,
                "brand_name": None,
                "strength": None,
                "unit": None,
                "message": f"Invalid medicine_id: {med_id!r}.",
            })
            continue

        result = get_medicine_availability(dispensary_id, med_id)

        items.append({
            "medicine_id": result["medicine_id"],
            "status": result["status"],
            "available_quantity": result["available_quantity"],
            "requested_quantity": requested_qty,
            "generic_name": result["generic_name"],
            "brand_name": result["brand_name"],
            "strength": result["strength"],
            "unit": result["unit"],
            "message": result["message"],
        })

        if result["status"] == STATUS_AVAILABLE:
            available_count += 1

    total = len(items)
    if available_count == total:
        overall = "ALL_AVAILABLE"
    elif available_count == 0:
        overall = "NONE_AVAILABLE"
    else:
        overall = "PARTIALLY_AVAILABLE"

    return {
        "dispensary_id": dispensary_id,
        "overall_status": overall,
        "items": items,
    }
