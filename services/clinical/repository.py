"""Data access repository for central drug catalog and alias indices."""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import psycopg2.extras
from database.db import get_conn


class MedicineCatalogRepository:
    """Encapsulates SQL catalog searches, alias queries, and trigram fuzzy matching."""

    def lookup_alias(self, alias_name: str) -> Optional[Dict[str, Any]]:
        """Query medicine_alias table for exact match on brand names or known abbreviations."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT m.medicine_id, m.generic_name, m.brand_name, m.rxcui,
                           m.form, m.strength, m.category, ma.alias_name
                    FROM medicine_alias ma
                    JOIN medicine m ON m.medicine_id = ma.medicine_id
                    WHERE LOWER(ma.alias_name) = LOWER(%s)
                    LIMIT 1
                    """,
                    (alias_name.strip(),),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    def lookup_exact(self, name: str) -> List[Dict[str, Any]]:
        """Query medicine table for exact match against generic_name or brand_name."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, rxcui, form, strength, category
                    FROM medicine
                    WHERE LOWER(generic_name) = LOWER(%s)
                       OR LOWER(brand_name) = LOWER(%s)
                       OR LOWER(COALESCE(rxnorm_name, '')) = LOWER(%s)
                    """,
                    (name.strip(), name.strip(), name.strip()),
                )
                return [dict(r) for r in cur.fetchall()]

    def lookup_trgm(self, name: str, min_similarity: float = 0.30, limit: int = 10) -> List[Dict[str, Any]]:
        """Perform PostgreSQL pg_trgm fuzzy similarity search on generic and brand names."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, rxcui, form, strength, category,
                           GREATEST(
                               similarity(generic_name, %s),
                               similarity(COALESCE(brand_name, ''), %s)
                           ) AS sim
                    FROM medicine
                    WHERE similarity(generic_name, %s) >= %s
                       OR similarity(COALESCE(brand_name, ''), %s) >= %s
                    ORDER BY sim DESC, medicine_id ASC
                    LIMIT %s
                    """,
                    (name, name, name, min_similarity, name, min_similarity, limit),
                )
                return [dict(r) for r in cur.fetchall()]

    def get_by_id(self, medicine_id: int) -> Optional[Dict[str, Any]]:
        """Fetch a canonical medicine record by its integer primary key."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT medicine_id, generic_name, brand_name, rxcui, form, strength, category
                    FROM medicine
                    WHERE medicine_id = %s
                    """,
                    (medicine_id,),
                )
                row = cur.fetchone()
                return dict(row) if row else None

