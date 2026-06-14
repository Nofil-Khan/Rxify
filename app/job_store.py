"""Thread-safe in-memory store for background OCR job tracking.

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

import threading
import time
from typing import Any, Dict, Optional

_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}

# How long (seconds) to keep completed/failed jobs before they are evicted.
_TTL_SECONDS = 3600  # 1 hour


def create(job_id: str, image_path: str) -> None:
    """Register a new job as 'processing'."""
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "processing",
            "image_path": image_path,
            "created_at": time.time(),
            "extracted": None,
            "error": None,
            "prescription_id": None,
        }


def set_done(job_id: str, extracted: dict, prescription_id: Optional[int] = None) -> None:
    """Mark a job as successfully completed with extracted data."""
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["extracted"] = extracted
            _jobs[job_id]["prescription_id"] = prescription_id


def set_error(job_id: str, error: str) -> None:
    """Mark a job as failed with an error message."""
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"] = error


def get(job_id: str) -> Optional[Dict[str, Any]]:
    """Return a copy of the job dict, or None if not found."""
    _evict_old_jobs()
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _evict_old_jobs() -> None:
    """Remove completed/failed jobs older than TTL to prevent memory leaks."""
    cutoff = time.time() - _TTL_SECONDS
    with _lock:
        to_delete = [
            jid for jid, job in _jobs.items()
            if job["status"] != "processing" and job["created_at"] < cutoff
        ]
        for jid in to_delete:
            del _jobs[jid]
