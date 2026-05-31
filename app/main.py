from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from routers import auth, upload

app = FastAPI(
    title="Fake Doctor Minimal API",
    description="OCR BACKEND ENDPOINT",
    version="0.1.0",
)

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


# ── Static / health ───────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def serve_index():
    index_path = Path(__file__).parent.parent / "frontend" / "index.html"
    return FileResponse(index_path)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Minimal Gemini API"}
