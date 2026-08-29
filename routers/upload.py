from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from app import gemini as gemini_service
from app import job_store
from core.security import get_current_user
from services import prescription as prescription_service

router = APIRouter(prefix="/api", tags=["upload"])

_ALLOWED_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}

_UPLOADS_DIR = Path(__file__).parent.parent / "data" / "uploads"


# ── Background worker ──────────────────────────────────────────────────────────

def _run_ocr_and_save(
    job_id: str,
    image_bytes: bytes,
    mime_type: str,
    user_id: int,
) -> None:
    """Runs entirely on the server — survives browser tab being closed."""
    import traceback

    try:
        extracted = gemini_service.extract_prescription_data(image_bytes, mime_type)

        prescription_id: int | None = None
        try:
            prescription_id = prescription_service.insert_prescription(extracted, user_id=user_id)
        except Exception as db_err:
            print(f"[job {job_id}] DB insert failed: {db_err}")
            traceback.print_exc()

        job_store.set_done(job_id, extracted, prescription_id=prescription_id)
        print(f"[job {job_id}] OCR done — prescription_id={prescription_id}")

    except Exception as exc:
        error_msg = str(exc)
        traceback.print_exc()
        job_store.set_error(job_id, error_msg)
        print(f"[job {job_id}] OCR failed: {error_msg}")


# ── Upload endpoint ────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    # ── Validate file type ────────────────────────────────────────────────────
    content_type = file.content_type or "image/jpeg"
    if content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    image_bytes = await file.read()

    # ── Save upload locally with a unique filename ────────────────────────────
    _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = file.filename or "upload.jpg"
    file_path = _UPLOADS_DIR / filename

    counter = 1
    stem, suffix = file_path.stem, file_path.suffix
    while file_path.exists():
        file_path = _UPLOADS_DIR / f"{stem}-{counter}{suffix}"
        counter += 1

    file_path.write_bytes(image_bytes)

    # ── Register background OCR job and return immediately ────────────────────
    job_id = str(uuid.uuid4())
    job_store.create(job_id, image_path=str(file_path))

    background_tasks.add_task(
        _run_ocr_and_save,
        job_id,
        image_bytes,
        content_type,
        current_user["id"],
    )

    return {
        "job_id": job_id,
        "status": "processing",
        "image_path": str(file_path),
        "message": "Image received. OCR is running in the background.",
    }


# ── Job status endpoint ────────────────────────────────────────────────────────

@router.get("/job/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Poll this endpoint to check OCR progress."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or already expired.")
    return job
