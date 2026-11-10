"""Rxify Transactional Unit of Work.

Provides atomic multi-repository transaction management. Ensures that complex
domain workflows (e.g. order placement + inventory reservation + auditing)
commit together or rollback atomically if any step raises an error.
"""

from __future__ import annotations

import logging
from typing import Optional
from psycopg2.extensions import connection as PgConn

from database.db import get_pool, _acquire_conn

logger = logging.getLogger("core.unit_of_work")


class UnitOfWork:
    """Context manager encapsulating an atomic database transaction spanning multiple services."""

    def __init__(self, autocommit: bool = False) -> None:
        self.autocommit = autocommit
        self._conn: Optional[PgConn] = None
        self._committed = False

    def __enter__(self) -> UnitOfWork:
        pool = get_pool()
        self._conn = _acquire_conn(pool)
        self._conn.autocommit = self.autocommit
        self._committed = False
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._conn is None:
            return

        pool = get_pool()
        try:
            if exc_type is not None:
                # An exception occurred inside the block; roll back
                logger.warning(f"[UOW] Rolling back transaction due to error: {exc_val}")
                try:
                    self._conn.rollback()
                except Exception as rollback_err:
                    logger.error(f"[UOW] Rollback failed: {rollback_err}")
            elif not self._committed and not self.autocommit:
                # Successful exit without manual commit; commit automatically
                self._conn.commit()
                self._committed = True
        finally:
            pool.putconn(self._conn)
            self._conn = None

    @property
    def conn(self) -> PgConn:
        """The active pooled transaction connection."""
        if self._conn is None:
            raise RuntimeError("UnitOfWork transaction is not active. Use 'with UnitOfWork() as uow:'")
        return self._conn

    def commit(self) -> None:
        """Explicitly commit the transaction in progress."""
        if self._conn and not self._committed:
            self._conn.commit()
            self._committed = True

    def rollback(self) -> None:
        """Explicitly roll back the transaction in progress."""
        if self._conn:
            self._conn.rollback()
            self._committed = False

