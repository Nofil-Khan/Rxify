from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import json
import os
import sqlite3
# from app.preprocess import main 

from pathlib import Path
from app import gemini as gemini_service
load_dotenv()
# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

app = FastAPI(
    title="Fake Doctor Minimal API",
    description="OCR BACKEND ENDPOINT",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the minimal static frontend (index.html) from the project root.
# API routes like /api/* are still handled by FastAPI; the static mount serves
# the file at `/` and any other static assets in the repo root.
@app.get("/", include_in_schema=False)
def serve_index():
    index_path = Path(__file__).parent.parent / "frontend" / "index.html"
    return FileResponse(index_path)

#to check api health
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Minimal Gemini API"}


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    # Basic validation
    allowed_types = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
    }
    content_type = file.content_type or "image/jpeg"
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    image_bytes = await file.read()

    # Save upload locally
    filename = file.filename or "upload.jpg"
    uploads_dir = Path(__file__).parent.parent / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    file_path = uploads_dir / filename

    # Ensure unique filename if exists
    counter = 1
    stem = file_path.stem
    suffix = file_path.suffix
    while file_path.exists():
        file_path = uploads_dir / f"{stem}-{counter}{suffix}"
        counter += 1

    file_path.write_bytes(image_bytes)
    mime_type = file.content_type or "image/jpeg"

    extracted = gemini_service.extract_prescription_data(image_bytes, mime_type)   #IMAGE BYTES IS THE BINARY REPRESANTATION OF THE IMAGE
    
    # Database Insertion
    try:
        db_dir = Path(__file__).parent.parent / "database"
        conn_rx = sqlite3.connect(db_dir / 'prescriptions.db')
        cursor_rx = conn_rx.cursor()
        conn_med = sqlite3.connect(db_dir / 'medicines.db')
        cursor_med = conn_med.cursor()

        # Get the default patient user
        cursor_rx.execute("SELECT id FROM users WHERE username = 'patient1'")
        rx_user_row = cursor_rx.fetchone()
        rx_user_id = rx_user_row[0] if rx_user_row else 1

        cursor_med.execute("SELECT id FROM users WHERE username = 'patient1'")
        med_user_row = cursor_med.fetchone()
        med_user_id = med_user_row[0] if med_user_row else 1

        # Insert prescription
        cursor_rx.execute('''
        INSERT INTO prescriptions (
            user_id, doctor_name, clinic_name, clinic_address, clinic_phone, 
            patient_name, patient_age, patient_gender, issue_date, follow_up_date, 
            diagnosis, notes, raw_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            rx_user_id,
            extracted.get("doctor_name"),
            extracted.get("clinic_name"),
            extracted.get("clinic_address"),
            extracted.get("clinic_phone"),
            extracted.get("patient_name"),
            extracted.get("patient_age"),
            extracted.get("patient_gender"),
            extracted.get("issue_date"),
            extracted.get("follow_up_date"),
            extracted.get("diagnosis"),
            extracted.get("notes"),
            extracted.get("raw_text")
        ))
        
        prescription_id = cursor_rx.lastrowid

        # Insert medications
        medications = extracted.get("medications", [])
        for med in medications:
            # Into prescriptions.db
            cursor_rx.execute('''
            INSERT INTO prescription_medications (
                prescription_id, name, dosage, frequency, duration, instructions
            ) VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                prescription_id,
                med.get("name"),
                med.get("dosage"),
                med.get("frequency"),
                med.get("duration"),
                med.get("instructions")
            ))

            # Into medicines.db
            cursor_med.execute('''
            INSERT INTO medicines (
                user_id, name, dosage, frequency, duration, instructions, start_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                med_user_id,
                med.get("name"),
                med.get("dosage"),
                med.get("frequency"),
                med.get("duration"),
                med.get("instructions"),
                extracted.get("issue_date")
            ))

        conn_rx.commit()
        conn_med.commit()

    except Exception as e:
        print(f"Database insertion failed: {e}")
    finally:
        conn_rx.close()
        conn_med.close()

    # main()  # Call the preprocessing function to clean and save the data
    

    return {"extracted": extracted, "image_path": str(file_path)}
