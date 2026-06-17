from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from database.user_database import migrate_add_role_column
from routers import Medicine_info, auth, upload, doctor

app = FastAPI(
    title="MediLedger API",
    description="Prescription OCR backend with patient and doctor roles.",
    version="0.2.0",
)

# ── Run idempotent DB migrations on startup ───────────────────────────────────
migrate_add_role_column()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(Medicine_info.router)
app.include_router(doctor.router)

# ── Static / health ───────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def serve_index():
    index_path = Path(__file__).parent.parent / "frontend" / "index.html"
    return FileResponse(index_path)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "MediLedger API", "version": "0.2.0"}
