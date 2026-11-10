"""Dispensary Repository — Encapsulated SQL Data Access for PostgreSQL."""

from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import psycopg2.extras
from database.db import get_conn, get_password_hash
from services.dispensary.domain import DispensaryProfile, StockItem, StockStatus

logger = logging.getLogger(__name__)


class DispensaryRepository:
    """Manages transactional database operations for the Dispensary domain."""

    # ── Dispensary Organization Profile ──────────────────────────────────────

    def create_dispensary(
        self,
        hospital_id: Optional[int],
        name: str,
        email: str,
        password: str,
        phone: Optional[str] = None,
        location: Optional[str] = None,
        operating_hours: Optional[str] = None,
        avg_prep_minutes: int = 15,
    ) -> Optional[Dict[str, Any]]:
        password_hash = get_password_hash(password)
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if hospital_id is not None:
                    cur.execute("SELECT 1 FROM hospital WHERE hospital_id = %s", (hospital_id,))
                    if not cur.fetchone():
                        raise ValueError(f"Hospital with ID {hospital_id} does not exist.")

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
                    (hospital_id, name, email, password_hash, phone, location, operating_hours, avg_prep_minutes),
                )
                row = dict(cur.fetchone())
                if row.get("created_at"):
                    row["created_at"] = str(row["created_at"])
                return row

    def get_by_id(self, dispensary_id: int) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT dispensary_id, hospital_id, name, email, phone, location,
                           address, latitude, longitude, operating_hours, avg_prep_minutes,
                           status, created_at
                    FROM dispensary
                    WHERE dispensary_id = %s
                    """,
                    (dispensary_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                res = dict(row)
                if res.get("created_at"):
                    res["created_at"] = str(res["created_at"])
                return res

    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT dispensary_id, hospital_id, name, email, password_hash, phone,
                           location, address, latitude, longitude, operating_hours,
                           avg_prep_minutes, status, created_at
                    FROM dispensary
                    WHERE email = %s
                    """,
                    (email,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                res = dict(row)
                if res.get("created_at"):
                    res["created_at"] = str(res["created_at"])
                return res

    def list_by_hospital(self, hospital_id: int) -> List[Dict[str, Any]]:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT dispensary_id, hospital_id, name, email, phone, location,
                           address, latitude, longitude, operating_hours, avg_prep_minutes,
                           status, created_at
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

    def update_location(
        self,
        dispensary_id: int,
        latitude: float,
        longitude: float,
        address: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        if not (-90.0 <= latitude <= 90.0):
            raise ValueError(f"latitude must be between -90 and 90, got {latitude}")
        if not (-180.0 <= longitude <= 180.0):
            raise ValueError(f"longitude must be between -180 and 180, got {longitude}")

        clean_address = None
        if address is not None:
            stripped = " ".join(address.split()).strip()
            if stripped:
                clean_address = stripped[:500]

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    UPDATE dispensary
                    SET latitude = %s, longitude = %s, address = %s, updated_at = NOW()
                    WHERE dispensary_id = %s
                    RETURNING dispensary_id, hospital_id, name, email, phone, location,
                              address, latitude, longitude, operating_hours, avg_prep_minutes,
                              status, created_at, updated_at
                    """,
                    (latitude, longitude, clean_address, dispensary_id),
                )
                row = cur.fetchone()
                if not row:
                    return None
                res = dict(row)
                for k in ("created_at", "updated_at"):
                    if res.get(k):
                        res[k] = str(res[k])
                return res

    # ── Inventory Stock Control ──────────────────────────────────────────────

    def get_stock(self, dispensary_id: int) -> List[Dict[str, Any]]:
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
                    ORDER BY inv.updated_at DESC, m.generic_name ASC
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

    def get_alerts(self, dispensary_id: int) -> Dict[str, Any]:
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
                return {"alerts": alerts, "total_alerts": len(alerts)}

    def get_transactions(
        self,
        dispensary_id: int,
        medicine_id: Optional[int] = None,
        txn_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
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
                cur.execute(f"SELECT COUNT(*) AS total FROM inventory_transaction t WHERE {where_str}", params)
                total = cur.fetchone()["total"]

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

    # ── Queue & Request Details ──────────────────────────────────────────────

    def get_dashboard_counts(self, dispensary_id: int) -> Dict[str, Any]:
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
                    "pending": req_stats.get("pending_count", 0),
                    "processing": req_stats.get("processing_count", 0),
                    "ready": req_stats.get("ready_count", 0),
                    "dispensed": req_stats.get("dispensed_count", 0),
                    "unavailable": req_stats.get("unavailable_count", 0),
                    "partial": req_stats.get("partial_count", 0),
                    "out_of_stock": stock_stats.get("out_of_stock_count", 0),
                    "low_stock": stock_stats.get("low_stock_count", 0),
                    "total_medicines": stock_stats.get("total_medicines", 0),
                }


default_dispensary_repo = DispensaryRepository()

