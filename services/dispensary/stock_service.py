"""Dispensary Stock Allocation & Inventory Management Service."""

from __future__ import annotations
import csv
import io
import logging
from typing import Any, Dict, List, Optional

import psycopg2.extras
from database.db import get_conn
from services.dispensary.repository import DispensaryRepository, default_dispensary_repo

logger = logging.getLogger(__name__)


class StockAllocationService:
    """Encapsulates dispensary stock queries, allocation reserves, and CSV batch processing."""

    def __init__(self, repository: Optional[DispensaryRepository] = None):
        self._repo = repository or default_dispensary_repo

    def get_inventory_stock(self, dispensary_id: int) -> List[Dict[str, Any]]:
        """
        ========================================================================================
        DISPENSARY INVENTORY LEDGER & DYNAMIC FREE STOCK RETRIEVAL
        ========================================================================================
        Fetches the complete medicine shelf catalog for a dispensary, computing dynamic
        unreserved free stock: `free_stock = (available_quantity - reserved_quantity)`.
        Assigns normalized health statuses ('NORMAL', 'LOW_STOCK', 'OUT_OF_STOCK') based
        on each drug's configured reorder threshold.

        Parameters:
        -----------
        dispensary_id : int
            The unique identifier of the dispensary.

        Returns:
        --------
        List[Dict[str, Any]]:
            List of inventory items with medicine details, quantities, and reorder levels.
        ========================================================================================
        """
        return self._repo.get_stock(dispensary_id)

    def add_or_update_stock(
        self,
        dispensary_id: int,
        medicine_id: int,
        available_quantity: int,
        reorder_level: int = 10,
        unit: Optional[str] = "units",
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        SINGLE-MEDICINE STOCK INGESTION & INVENTORY TRANSACTION LOGGING
        ========================================================================================
        Adds a new pharmaceutical SKU to the dispensary's inventory shelf or updates an
        existing record using an UPSERT (`ON CONFLICT (dispensary_id, medicine_id) DO UPDATE`).

        Financial & Audit Trail:
        -----------------------
        - Automatically creates an immutable audit row in `inventory_transaction` with
          `txn_type = 'STOCK_ADDED'`.
        - Prevents phantom records by validating that `medicine_id` exists in the master catalog.
        - Guarantees `updated_at = NOW()` for real-time synchronization.

        Parameters:
        -----------
        dispensary_id : int
            Dispensary identifier.
        medicine_id : int
            Central pharmaceutical catalog ID from `medicine`.
        available_quantity : int
            Physical unreserved units added to shelf inventory.
        reorder_level : int, default 10
            Threshold triggering low-stock alert badges.
        unit : Optional[str], default 'units'
            Dispensing unit measurement (e.g. 'tablets', 'capsules', 'vials', 'ml').

        Returns:
        --------
        Dict[str, Any]:
            Updated inventory row dictionary.
        ========================================================================================
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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
        self,
        dispensary_id: int,
        items: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        BATCH PHARMACEUTICAL STOCK INGESTION & AUTO-DISCOVERY
        ========================================================================================
        Ingests multiple inventory records in a single atomic database transaction.
        If a medicine item specifies a generic name that does not exist in the catalog,
        it automatically provisions a new row in `medicine` to prevent ingestion failure.

        Parameters:
        -----------
        dispensary_id : int
            Dispensary identifier.
        items : List[Dict[str, Any]]
            Array of inventory objects containing `medicine_id` or `generic_name`,
            `available_quantity`, `reorder_level`, and `unit`.

        Returns:
        --------
        Dict[str, Any]:
            Dictionary reporting total `updated_count`.
        ========================================================================================
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

    def import_stock_from_csv(self, dispensary_id: int, csv_content: str) -> Dict[str, Any]:
        """
        ========================================================================================
        RFC-4180 CSV BULK INVENTORY IMPORT
        ========================================================================================
        Parses uploaded CSV files containing supplier shipments or warehouse counts and
        merges them into dispensary shelf inventory.

        Supported Column Variations (case-insensitive):
        - Generic / Medicine Name: 'generic_name', 'medicine', 'name'
        - Commercial Brand: 'brand_name', 'brand'
        - Quantities: 'quantity', 'available_quantity', 'qty'
        - Reorder Threshold: 'reorder_level', 'reorder'
        - Unit: 'unit', 'form'
        ========================================================================================
        """
        reader = csv.DictReader(io.StringIO(csv_content))
        items_to_import = []
        for row in reader:
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

        return self.bulk_add_or_update_stock(dispensary_id, items_to_import)

    def update_stock_partial(
        self,
        dispensary_id: int,
        inventory_id: int,
        available_quantity: Optional[int] = None,
        reorder_level: Optional[int] = None,
        unit: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        ========================================================================================
        GRANULAR INLINE STOCK QUANTITY & THRESHOLD ADJUSTMENT (PATCH)
        ========================================================================================
        Allows live adjustments from the UI (such as clicking the + / - steppers on stock cards
        or updating the reorder trigger in the Manage Stock modal).

        Audit Ledger Logging:
        ---------------------
        Automatically computes `diff = abs(new_qty - old_qty)` and logs:
        - `txn_type = 'STOCK_ADDED'` if inventory increased.
        - `txn_type = 'STOCK_REMOVED'` if inventory decreased.

        Parameters:
        -----------
        dispensary_id : int
            Dispensary owning the inventory row.
        inventory_id : int
            The `inventory_dispensary_stock.inventory_id` being updated.
        available_quantity : Optional[int]
            New physical shelf count.
        reorder_level : Optional[int]
            New minimum stock alert threshold.
        unit : Optional[str]
            Dispensing unit measurement.

        Returns:
        --------
        Optional[Dict[str, Any]]:
            Updated inventory row dictionary.
        ========================================================================================
        """
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

    def get_inventory_alerts(self, dispensary_id: int) -> Dict[str, Any]:
        """
        ========================================================================================
        LOW-STOCK & OUT-OF-STOCK HEALTH MONITOR
        ========================================================================================
        Queries the inventory table to identify drugs requiring immediate wholesaler reorder.
        Identifies items where `free_stock <= reorder_level` or `free_stock == 0`.
        ========================================================================================
        """
        return self._repo.get_alerts(dispensary_id)

    def get_inventory_transactions(
        self,
        dispensary_id: int,
        medicine_id: Optional[int] = None,
        txn_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        ========================================================================================
        IMMUTABLE PHARMACY AUDIT TRAIL & LEDGER MOVEMENTS
        ========================================================================================
        Retrieves the chronological audit log of physical movements:
        'STOCK_ADDED', 'STOCK_REMOVED', 'MEDICINE_RESERVED', 'RESERVATION_CANCELLED', 'MEDICINE_DISPENSED'.
        Provides institutional accountability for controlled substances and stock reconciliation.
        ========================================================================================
        """
        return self._repo.get_transactions(dispensary_id, medicine_id, txn_type, limit, offset)


default_stock_service = StockAllocationService()

