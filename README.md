# Rxify — Intelligent Healthcare & Prescription Ecosystem

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Gemini Vision](https://img.shields.io/badge/AI-Gemini%20Vision-4285F4?style=flat-square&logo=google)](https://aistudio.google.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 📌 Problem Statement

Medical prescriptions and health records remain one of the most critical yet fragmented links in healthcare delivery today:

1. **Illegible Handwriting & Adverse Drug Events (ADEs)**:
   Physical, hand-written doctor prescriptions are notoriously prone to misinterpretation. Pharmacists and patients misreading dosages, drug brand names, or frequencies leads to thousands of preventable adverse drug events and hospital readmissions annually.
2. **Disconnected Healthcare Silos**:
   Patients consult multiple specialists across various clinics and hospitals. Because records are kept on scattered paper slips or isolated Electronic Health Record (EHR) systems, physicians frequently treat patients without visibility into historical diagnoses, active medications, or allergies.
3. **Dispensary & Pharmacy Inefficiencies**:
   Dispensaries face friction in verifying authentic prescriptions, managing patient medicine regimens, and preventing fraudulent or duplicated dispensations without a seamless verification handshake.
4. **Lack of Patient Data Ownership**:
   Patients rarely possess a consolidated, structured timeline of their medical history and prescriptions that they can securely grant access to at will.

### 💡 The Rxify Solution

**Rxify** bridges these gaps by providing an intelligent, unified digital prescription and hospital ecosystem:

- **Multimodal AI OCR**: Uses Google Gemini Vision to extract medicine names, dosages, durations, instructions, and doctor metadata from uploaded images of handwritten and printed prescriptions.
- **Role-Based Portals**: Dedicated, secure environments for **Patients**, **Doctors**, **Hospitals**, and **Dispensaries**.
- **Instant QR Verification**: Patients can generate encrypted time-bound QR tokens or share access codes for instant doctor lookup or pharmacy fulfillment without leaking sensitive credentials.
- **Connected Operations**: Built-in doctor appointment scheduling, hospital staff management, dispensary fulfillment logs, and real-time consult features.

---

## 🚀 How to Use It as a Developer

Follow this guide to get the full stack (FastAPI backend + Vite React frontend + PostgreSQL) running locally on your development machine.

### 🛠 Prerequisites

Make sure you have installed:

- **Python 3.12+** (or Anaconda / Miniconda)
- **Node.js 18+** & **npm**
- **PostgreSQL 14+** (running locally or a cloud instance like Supabase / Neon)
- A **Google Gemini API Key** (available free from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **Git**

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/Nofil-Khan/Rxify.git
cd Rxify
```

---

### Step 2: Backend Setup (Python & FastAPI)

#### 1. Set Up Virtual Environment

Using **Conda**:

```bash
conda create -n py312 python=3.12 -y
conda activate py312
```

Or using **venv**:

```bash
python -m venv .venv

# On Windows:
.venv\Scripts\activate

# On macOS/Linux:
source .venv/bin/activate
```

#### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

#### 3. Configure Environment Variables

Copy `.env.example` to create your local `.env`:

```bash
# On Windows (cmd/PowerShell):
copy .env.example .env

# On macOS/Linux:
cp .env.example .env
```

Open `.env` and configure your credentials:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/rxify

# Gemini Vision API Key
GEMINI_API_KEY=AIzaSyYourKeyHere...

# JWT Secret (generate with: python -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY=replace_with_a_secure_32_character_random_string

# Optional Token Lifetime (minutes)
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

#### 4. Prepare the Database

Create the PostgreSQL database:

```bash
psql -U postgres -c "CREATE DATABASE rxify;"
```

Apply the database schema and optional seed data:

```bash
# Apply initial tables and relations
psql -U postgres -d rxify -f database/schema.sql

# (Optional) Populate demo hospitals, doctors, and dispensaries
psql -U postgres -d rxify -f database/seed.sql
```

_(Note: If running against a fresh DB, `database/db.py` will also attempt auto-migration upon application startup)._

#### 5. Verify Backend Routes

Run the route verification script to check endpoint registrations:

```bash
python check_routes.py
```

#### 6. Start the Backend Dev Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### Step 3: Modern Frontend Setup (`better-frontend`)

The primary frontend is built with React 18, TypeScript, Vite, and modern UI components with role-based routing.

#### 1. Navigate to the Frontend Directory

```bash
cd better-frontend
```

#### 2. Install Node Dependencies

```bash
npm install
```

#### 3. Start Frontend Development Server

```bash
npm run dev
```

The Vite dev server will start at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### Step 4: Role-Based Portals & Workflows

Once both servers are running, access the portal switcher or direct URLs:

| Portal                | URL Route           | Target Users           | Key Capabilities                                                                                                 |
| :-------------------- | :------------------ | :--------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Patient Portal**    | `/` or `/auth`      | Patients               | View prescription history, upload Rx images for OCR, schedule appointments, generate temporary QR tokens         |
| **Doctor Dashboard**  | `/doctor/dashboard` | Doctors & Specialists  | Access patient records via QR/token, view OCR extractions, issue digital prescriptions, manage appointment slots |
| **Hospital Admin**    | `/hospital/auth`    | Hospital Admins        | Register doctors, oversee departments, manage hospital-affiliated dispensaries, inspect appointments             |
| **Dispensary Portal** | `/dispensary/auth`  | Pharmacists & Chemists | Scan patient QR codes, verify active prescriptions, dispense medications, log inventory status                   |

---

## 📁 Repository Structure

```text
Rxify/
├── app/
│   ├── main.py                   # FastAPI application initialization & middleware
│   ├── gemini.py                 # Google Gemini Vision prompt engineering & OCR pipeline
│   └── jobs.py                   # Background task runner for asynchronous OCR jobs
├── core/
│   ├── config.py                 # Pydantic Settings & environment loader
│   └── security.py               # Password hashing (bcrypt) & JWT token handlers
├── database/
│   ├── db.py                     # PostgreSQL connection pool & query execution helpers
│   ├── schema.sql                # Complete relational schema (patients, doctors, dispensaries, etc.)
│   └── seed.sql                  # Seed data for quick local onboarding
├── models/                       # Pydantic schemas for request/response validation
│   ├── auth.py
│   ├── appointment.py
│   ├── dispensary.py
│   ├── doctor.py
│   ├── hospital.py
│   └── patient.py
├── routers/                      # FastAPI endpoint controllers
│   ├── appointment.py            # Slot booking, status management
│   ├── auth.py                   # Login, registration, token exchange
│   ├── dispensary.py             # Dispensary inventory & medication fulfillment
│   ├── doctor.py                 # Doctor profiles & patient lookup
│   ├── hospital.py               # Hospital administration
│   ├── patient.py                # Patient profile & prescription list
│   └── upload.py                 # Prescription image upload & OCR job dispatch
├── services/                     # Business logic & database transactions
│   ├── appointment.py
│   ├── dispensary.py
│   ├── doctor.py
│   ├── hospital.py
│   ├── patient.py
│   └── prescription.py
├── better-frontend/              # Modern React + Vite + TypeScript application
│   ├── src/
│   │   ├── components/common/    # Reusable UI (QR Scanner, Share ID Modal, Portal Switcher)
│   │   ├── lib/                  # Strongly-typed API client services
│   │   ├── pages/
│   │   │   ├── doctor/           # Doctor Dashboard & consultations
│   │   │   ├── dispensary/       # Dispensary Portal & fulfillment
│   │   │   ├── hospital/         # Hospital Admin & doctor management
│   │   │   └── patient/          # Patient Dashboard & timeline
│   │   ├── styles/               # CSS modules & modal styling
│   │   ├── App.tsx               # Client router & state providers
│   │   └── main.tsx              # React DOM mounting
│   └── package.json
├── data/
│   └── uploads/                  # Temporary image uploads (kept local via .gitkeep)
├── check_routes.py               # Utility script to inspect registered backend routes
├── requirements.txt              # Pinned Python backend dependencies
└── README.md
```

---

## 🧪 Testing & Diagnostics

### Run Route Checks

Verify that all FastAPI endpoints and routers mount without errors:

```bash
python check_routes.py
```

### Run Unit/Integration Tests

```bash
pytest
```

---

## 🔒 Security & Environment Rules

- **Secrets**: Never commit real `.env` files, `.key`, or `.pem` certificates. All `.env*` files are strictly filtered via `.gitignore`.
- **Database & Uploads**: Local databases (`*.db`, `*.sqlite`) and uploaded patient prescription images (`data/uploads/*`) are excluded from version control to maintain HIPAA/GDPR privacy standards.
- **Token Security**: Always configure a cryptographically random `SECRET_KEY` in production environments.

---

## 📄 License

This project is licensed under the GREAT NOFIL License. DO NOT USE THIS CODE OTHERWISE ACTIONS WILL BE TAKEN TOWARDS YOU (JK)
