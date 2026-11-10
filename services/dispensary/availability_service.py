"""Inventory Availability Service — Real-time Medicine Stock Inquiries.

Provides read-only stock availability checks for single medicines and batch
prescription rosters at specific dispensaries without decrementing stock.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import psycopg2.extras

from database.db import get_conn

STATUS_AVAILABLE = "AVAILABLE"
STATUS_NOT_AVAILABLE = "NOT_AVAILABLE"
STATUS_UNRESOLVED = "UNRESOLVED"


class InventoryAvailabilityService:
    """Evaluates catalog medicine availability across dispensaries."""

    def _medicine_exists(self, cur: psycopg2.extras.RealDictCursor, medicine_id: int) -> bool:
        cur.execute("SELECT 1 FROM medicine WHERE medicine_id = %s", (medicine_id,))
        return cur.fetchone() is not None

    def _dispensary_exists(self, cur: psycopg2.extras.RealDictCursor, dispensary_id: int) -> bool:
        cur.execute("SELECT 1 FROM dispensary WHERE dispensary_id = %s", (dispensary_id,))
        return cur.fetchone() is not None

    def _fetch_stock_row(
        self, cur: psycopg2.extras.RealDictCursor, dispensary_id: int, medicine_id: int
    ) -> Optional[Dict[str, Any]]:
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

    def get_medicine_availability(
        self, dispensary_id: int, medicine_id: int
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        REAL-TIME SINGLE MEDICINE SHELF AVAILABILITY CHECK
        ========================================================================================
        Inspects whether a specific drug SKU is currently stocked and ready for immediate
        dispensing at a particular dispensary.

        Status Categorization:
        ----------------------
        - 'AVAILABLE': Medicine is in stock (`available_quantity > 0`).
        - 'NOT_AVAILABLE': Drug is known in the catalog, but current shelf count is 0.
        - 'UNRESOLVED': Medicine ID does not exist in the master database catalog.

        Parameters:
        -----------
        dispensary_id : int
            Dispensary identifier.
        medicine_id : int
            Medicine catalog ID.

        Returns:
        --------
        Dict[str, Any]:
            Payload with `status`, `available_quantity`, generic/brand names, and unit.
        ========================================================================================
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if not self._dispensary_exists(cur, dispensary_id):
                    raise ValueError(f"Dispensary {dispensary_id} does not exist.")

                if not self._medicine_exists(cur, medicine_id):
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

                stock = self._fetch_stock_row(cur, dispensary_id, medicine_id)
                if stock is None:
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
                        "generic_name": med.get("generic_name"),
                        "brand_name": med.get("brand_name"),
                        "strength": med.get("strength"),
                        "unit": None,
                        "message": "No stock record exists for this medicine at this dispensary.",
                    }

                qty = stock.get("available_quantity", 0)
                if qty <= 0:
                    return {
                        "medicine_id": medicine_id,
                        "dispensary_id": dispensary_id,
                        "status": STATUS_NOT_AVAILABLE,
                        "available_quantity": 0,
                        "generic_name": stock.get("generic_name"),
                        "brand_name": stock.get("brand_name"),
                        "strength": stock.get("strength"),
                        "unit": stock.get("unit"),
                        "message": "Medicine is out of stock at this dispensary.",
                    }

                return {
                    "medicine_id": medicine_id,
                    "dispensary_id": dispensary_id,
                    "status": STATUS_AVAILABLE,
                    "available_quantity": qty,
                    "generic_name": stock.get("generic_name"),
                    "brand_name": stock.get("brand_name"),
                    "strength": stock.get("strength"),
                    "unit": stock.get("unit"),
                    "message": f"Medicine is available ({qty} {stock.get('unit') or 'units'} in stock).",
                }

    def get_prescription_availability(
        self, dispensary_id: int, medicines: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        PRESCRIPTION BATCH INVENTORY CROSS-CHECK & OVERALL STATUS RESOLUTION
        ========================================================================================
        Evaluates a complete basket of medications for an active prescription against a
        target dispensary's warehouse inventory.

        Overall Status Aggregate Logic:
        ------------------------------
        - 'ALL_AVAILABLE': Every single prescribed medication is in stock with sufficient quantity.
        - 'PARTIALLY_AVAILABLE': At least one medicine is available, but one or more are out of stock.
        - 'NONE_AVAILABLE': Zero items from the prescription are currently available on shelf.

        Powers:
        -------
        - Patient discovery search results: Displays "All items in stock" or "Partial stock" pills.
        - Automatic transfer routing: Helps patient or clinical coordinator route unfilled
          items to an alternative nearby partner dispensary.

        Parameters:
        -----------
        dispensary_id : int
            Target dispensary ID.
        medicines : List[Dict[str, Any]]
            Array of requested items with `medicine_id` and `requested_quantity`.

        Returns:
        --------
        Dict[str, Any]:
            Dictionary containing `overall_status`, `available_count`, `total_count`, and
            per-item status reports.
        ========================================================================================
        """
        if not medicines:
            raise ValueError("medicines list must not be empty.")

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if not self._dispensary_exists(cur, dispensary_id):
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

            result = self.get_medicine_availability(dispensary_id, med_id)
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


default_availability_service = InventoryAvailabilityService()

