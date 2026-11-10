"""Dispensary Analytics Service — Operational metrics and real-time dashboard stats."""

from __future__ import annotations
import logging
from typing import Any, Dict, Optional

import psycopg2.extras
from database.db import get_conn
from services.dispensary.repository import DispensaryRepository, default_dispensary_repo

logger = logging.getLogger(__name__)


class DispensaryAnalyticsService:
    """Computes operational KPIs, fulfillment rates, top prescribed medicines, and queue trends."""

    def __init__(self, repository: Optional[DispensaryRepository] = None):
        self._repo = repository or default_dispensary_repo

    def get_dashboard_stats(self, dispensary_id: int) -> Dict[str, Any]:
        """
        ========================================================================================
        REAL-TIME DISPENSARY PIPELINE COUNTERS & TELEMETRY KPIS
        ========================================================================================
        Aggregates real-time ticket counts across all stages of the pharmacy workbench.
        Powers the top navigation status pills and Dynamic Island telemetry tickers:
        - `pending_count`: New orders awaiting pharmacist review.
        - `processing_count`: Orders actively being prepared on the bench.
        - `ready_count`: Packaged orders awaiting patient counter collection.
        - `dispensed_today`: Total volume of orders fulfilled in the current 24h shift.
        - `revenue`: Cumulative shift financial volume.

        Parameters:
        -----------
        dispensary_id : int
            Dispensary identifier.

        Returns:
        --------
        Dict[str, Any]:
            Dictionary of live count metrics.
        ========================================================================================
        """
        return self._repo.get_dashboard_counts(dispensary_id)

    def get_dispensary_analytics(self, dispensary_id: int, days: int = 30) -> Dict[str, Any]:
        """
        ========================================================================================
        CLINICAL ANALYTICS, LEADERBOARD, CATEGORY VELOCITY & FULFILLMENT AUDITING
        ========================================================================================
        Calculates institutional metrics from PostgreSQL records to power the Analytics Tab:
        1. Top Prescribed Medicines Leaderboard:
           Ranks the top 10 most frequently prescribed and dispensed drugs, measuring prescribed
           quantity vs dispensed quantity vs shelf stock to identify supplier bottlenecks.
        2. Therapeutic Category Distribution:
           Aggregates prescription volume by pharmacological category (Antibiotics, Analgesics,
           Cardiovascular, Antidiabetics, etc.).
        3. 14-Day Longitudinal Fulfillment Trend:
           Daily breakdown of total volume vs completed dispensations vs cancellations.
        4. Operational Efficiency KPIs:
           - Total orders processed.
           - Clinical fulfillment success rate (% of orders successfully dispensed).
           - Mean turnaround / preparation speed in minutes (`avg_prep_time_minutes`).

        Parameters:
        -----------
        dispensary_id : int
            Dispensary identifier.
        days : int, default 30
            Historical analysis window in days.

        Returns:
        --------
        Dict[str, Any]:
            Analytics payload containing `top_medicines`, `categories`, `order_trend`, and `kpis`.
        ========================================================================================
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # 1. Top most ordered medicines from actual requests
                cur.execute(
                    """
                    SELECT
                        m.medicine_id,
                        m.generic_name,
                        COALESCE(m.brand_name, m.generic_name) AS brand_name,
                        COALESCE(m.category, 'General') AS category,
                        COALESCE(m.strength, '500 mg') AS strength,
                        COALESCE(m.form::TEXT, 'TABLET') AS form,
                        COUNT(DISTINCT item.request_id) AS total_orders,
                        COALESCE(SUM(item.required_quantity), 0) AS total_prescribed_qty,
                        COALESCE(SUM(COALESCE(item.dispensed_quantity, item.required_quantity)), 0) AS total_dispensed_qty,
                        COALESCE(MAX(stock.available_quantity), 0) AS in_stock_qty,
                        COALESCE(MAX(stock.reorder_level), 20) AS reorder_level
                    FROM dispensary_request_item item
                    JOIN dispensary_request req ON req.request_id = item.request_id
                    JOIN medicine m ON m.medicine_id = item.medicine_id
                    LEFT JOIN inventory_dispensary_stock stock
                        ON stock.dispensary_id = req.dispensary_id AND stock.medicine_id = m.medicine_id
                    WHERE req.dispensary_id = %s
                    GROUP BY m.medicine_id, m.generic_name, m.brand_name, m.category, m.strength, m.form
                    ORDER BY total_orders DESC, total_prescribed_qty DESC
                    LIMIT 10
                    """,
                    (dispensary_id,),
                )
                top_medicines = [dict(r) for r in cur.fetchall()]

                # 2. Category distribution from actual requests
                cur.execute(
                    """
                    SELECT
                        COALESCE(m.category, 'General') AS category,
                        COUNT(item.item_id) AS item_count,
                        COALESCE(SUM(item.required_quantity), 0) AS total_quantity
                    FROM dispensary_request_item item
                    JOIN dispensary_request req ON req.request_id = item.request_id
                    JOIN medicine m ON m.medicine_id = item.medicine_id
                    WHERE req.dispensary_id = %s
                    GROUP BY m.category
                    ORDER BY item_count DESC
                    LIMIT 6
                    """,
                    (dispensary_id,),
                )
                categories = [dict(r) for r in cur.fetchall()]

                # 3. 14-day order volume trend from real requests
                cur.execute(
                    """
                    SELECT
                        TO_CHAR(DATE(req.created_at), 'YYYY-MM-DD') AS day,
                        COUNT(*) AS total_orders,
                        COUNT(*) FILTER (WHERE req.status = 'DISPENSED') AS dispensed_orders,
                        COUNT(*) FILTER (WHERE req.status = 'CANCELLED') AS cancelled_orders
                    FROM dispensary_request req
                    WHERE req.dispensary_id = %s AND req.created_at >= NOW() - INTERVAL '14 days'
                    GROUP BY DATE(req.created_at)
                    ORDER BY DATE(req.created_at) ASC
                    """,
                    (dispensary_id,),
                )
                trend_rows = [dict(r) for r in cur.fetchall()]

                # 4. Overall KPIs
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total_orders,
                        COUNT(*) FILTER (WHERE status = 'DISPENSED') AS total_dispensed,
                        COUNT(*) FILTER (WHERE status = 'CANCELLED') AS total_cancelled,
                        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60)), 0) AS avg_prep_time
                    FROM dispensary_request
                    WHERE dispensary_id = %s
                    """,
                    (dispensary_id,),
                )
                kpis = dict(cur.fetchone() or {})
                total_orders = int(kpis.get("total_orders") or 0)
                total_dispensed = int(kpis.get("total_dispensed") or 0)
                avg_prep_time = int(kpis.get("avg_prep_time") or 0)
                fulfillment_rate = round((total_dispensed / total_orders * 100), 1) if total_orders > 0 else 0.0

                return {
                    "top_medicines": top_medicines,
                    "categories": categories,
                    "order_trend": trend_rows,
                    "kpis": {
                        "total_orders": total_orders,
                        "total_dispensed": total_dispensed,
                        "fulfillment_rate": fulfillment_rate,
                        "avg_prep_time_minutes": avg_prep_time,
                        "total_medicines_tracked": len(top_medicines),
                    },
                }


default_analytics_service = DispensaryAnalyticsService()

