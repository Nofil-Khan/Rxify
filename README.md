# Rxify

**Rxify** is a prescription OCR and management platform built with FastAPI and Google Gemini Vision.

## Features
- Upload prescription images for AI-powered OCR extraction (Gemini Vision)
- Patient & Doctor role-based access control with JWT auth
- Doctor-patient connection request workflow
- Paginated prescription history with full medication detail
- Background job processing (OCR runs server-side even after tab close)

## Stack
- **Backend**: FastAPI (Python 3.12)
- **AI**: Google Gemini Vision API
- **Database**: SQLite (via prescriptions.db)
- **Auth**: JWT (PyJWT + bcrypt)
- **Frontend**: Vanilla HTML/CSS/JS (rontend/index.html)

## Setup

`ash
# 1. Clone the repo
git clone https://github.com/Nofil-Khan/Rxify.git rxify
cd rxify

# 2. Create conda env (Python 3.12)
conda create -n py312 python=3.12
conda activate py312

# 3. Install dependencies
pip install fastapi uvicorn python-dotenv pyjwt bcrypt google-genai python-multipart

# 4. Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY and SECRET_KEY

# 5. Run
uvicorn app.main:app --reload
`

The API will be available at http://localhost:8000.  
Interactive docs: http://localhost:8000/docs

## Project Structure

`
rxify/
├── app/          # Entry point, Gemini wrapper, job store
├── core/         # Config loader, JWT security
├── database/     # SQLite connection helpers & migrations
├── models/       # Pydantic schemas
├── routers/      # FastAPI route handlers
├── services/     # Business logic & DB queries
├── frontend/     # Single-page UI (index.html)
└── data/uploads/ # Uploaded prescription images (git-ignored)
`

## Environment Variables

See .env.example for all required variables.

| Variable | Description |
|---|---|
| GEMINI_API_KEY | Google Gemini Vision API key |
| SECRET_KEY | JWT signing secret (min 32 chars) |
| ACCESS_TOKEN_EXPIRE_MINUTES | Token lifetime (default: 30) |
