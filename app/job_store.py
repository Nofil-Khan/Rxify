"""Thread-safe persistent store for background OCR job tracking.

Maintains an in-memory cache backed by the PostgreSQL `ocr_job` table so that
multiple worker processes and server restarts preserve job state seamlessly.

Each job has the shape:
  {
    "status":     "processing" | "done" | "error",
    "job_id":     str,
    "image_path": str,
    "created_at": float,           # time.time()
    "extracted":  dict | None,     # set when status == "done"
    "error":      str  | None,     # set when status == "error"
    "prescription_id": int | None, # DB row id, set when status == "done"
  }
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any, Dict, Optional

import psycopg2.extras
from database.db import get_conn

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}

# How long (seconds) to keep completed/failed jobs before they are evicted from memory.
_TTL_SECONDS = 3600  # 1 hour


def create(job_id: str, image_path: str) -> None:
    """Register a new job as 'processing' both in memory and persistent storage."""
    now = time.time()
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "processing",
            "image_path": image_path,
            "created_at": now,
            "extracted": None,
            "error": None,
            "prescription_id": None,
        }

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ocr_job (job_id, status, image_path, created_at, updated_at)
                    VALUES (%s, 'processing', %s, NOW(), NOW())
                    ON CONFLICT (job_id) DO NOTHING
                    """,
                    (job_id, image_path),
                )
    except Exception as exc:
        logger.warning(f"Failed to persist OCR job {job_id} to database: {exc}")


def set_done(job_id: str, extracted: dict, prescription_id: Optional[int] = None) -> None:
    """Mark a job as successfully completed with extracted data in memory and DB."""
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["extracted"] = extracted
            _jobs[job_id]["prescription_id"] = prescription_id

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ocr_job
                    SET status = 'done',
                        extracted = %s::jsonb,
                        prescription_id = %s,
                        updated_at = NOW()
                    WHERE job_id = %s
                    """,
                    (json.dumps(extracted), prescription_id, job_id),
                )
    except Exception as exc:
        logger.warning(f"Failed to update OCR job {job_id} status to done in DB: {exc}")


def set_error(job_id: str, error: str) -> None:
    """Mark a job as failed with an error message in memory and DB."""
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"] = error

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE ocr_job
                    SET status = 'error',
                        error = %s,
                        updated_at = NOW()
                    WHERE job_id = %s
                    """,
                    (str(error), job_id),
                )
    except Exception as exc:
        logger.warning(f"Failed to update OCR job {job_id} status to error in DB: {exc}")


def get(job_id: str) -> Optional[Dict[str, Any]]:
    """Return a copy of the job dict. Falls back to PostgreSQL if not in memory."""
    _evict_old_jobs()
    with _lock:
        job = _jobs.get(job_id)
        if job:
            return dict(job)

    # Cross-worker / Post-restart fallback to DB
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT job_id, status, image_path, extracted, error, prescription_id,
                           EXTRACT(EPOCH FROM created_at) AS created_at
                    FROM ocr_job
                    WHERE job_id = %s
                    """,
                    (job_id,),
                )
                row = cur.fetchone()
                if row:
                    job_dict = dict(row)
                    with _lock:
                        _jobs[job_id] = job_dict
                    return job_dict
    except Exception as exc:
        logger.warning(f"Failed to query OCR job {job_id} from database: {exc}")

    return None


def _evict_old_jobs() -> None:
    """Remove completed/failed jobs older than TTL from memory cache."""
    cutoff = time.time() - _TTL_SECONDS
    with _lock:
        to_delete = [
            jid for jid, job in _jobs.items()
            if job.get("status") != "processing" and (job.get("created_at") or 0) < cutoff
        ]
        for jid in to_delete:
            del _jobs[jid]
