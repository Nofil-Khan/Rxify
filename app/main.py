from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from database.db import init_db
from routers import auth, upload, patient, doctor, prescription, chat, dispensary, hospital, appointment

app = FastAPI(
    title="Rxify API",
    description="Prescription OCR backend with patient and doctor roles.",
    version="0.5.0",
)

# ── Run idempotent DB migrations on startup ────────────────────────────────────
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "https://rxify-three.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(patient.router)
app.include_router(doctor.router)
app.include_router(prescription.router)
app.include_router(chat.router)
app.include_router(dispensary.router)
app.include_router(hospital.router)
app.include_router(appointment.router)

# ── Static / health ────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def serve_index():
    index_path = Path(__file__).parent.parent / "frontend" / "index.html"
    return FileResponse(index_path)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Rxify API", "version": "0.5.0"}
