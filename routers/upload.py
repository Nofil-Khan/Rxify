from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app import gemini as gemini_service
from core.security import get_current_user
from services import prescription_db

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


@router.post("/upload")
async def upload_image(
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

    # ── Extract prescription data via Gemini ──────────────────────────────────
    extracted = gemini_service.extract_prescription_data(image_bytes, content_type)

    # ── Persist to database ───────────────────────────────────────────────────
    try:
        prescription_db.insert_prescription(extracted, user_id=current_user["id"])
    except Exception as e:
        print(f"Database insertion failed: {e}")

    return {"extracted": extracted, "image_path": str(file_path)}
