# Rxify — Intelligent Healthcare & Prescription Ecosystem

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Gemini Vision](https://img.shields.io/badge/AI-Gemini%20Vision-4285F4?style=flat-square&logo=google)](https://aistudio.google.com)
[![RxNorm](https://img.shields.io/badge/Catalog-RxNorm%20Clinical-10B981?style=flat-square)](https://www.nlm.nih.gov/research/umls/rxnorm/)
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
   Dispensaries face friction in verifying authentic prescriptions, managing patient medicine regimens, matching handwritten drug names to standard clinical databases, and preventing duplicated dispensations without a seamless verification handshake.
4. **Lack of Patient Data Ownership**:
   Patients rarely possess a consolidated, structured timeline of their medical history and prescriptions that they can securely grant access to at will.

### 💡 The Rxify Solution

**Rxify** bridges these gaps by providing an intelligent, unified digital prescription and hospital ecosystem:

- **Multimodal AI OCR**: Uses Google Gemini Vision to extract medicine names, dosages, durations, instructions, and doctor metadata from uploaded images of handwritten and printed prescriptions.
- **Clinical Medicine Matcher & RxNorm Catalog**: Standardizes free-form prescribed drug names to canonical RxNorm clinical codes via multi-tier exact, alias, and fuzzy matching algorithms.
- **Inventory Availability Layer**: Evaluates medicine availability across hospital dispensaries in real time without premature stock reservation.
- **Role-Based Portals**: Dedicated, secure environments for **Patients**, **Doctors**, **Hospitals**, and **Dispensaries**.
- **Instant QR Verification**: Patients can generate encrypted time-bound QR tokens or share access codes for instant doctor lookup or pharmacy fulfillment without leaking sensitive credentials.
- **Production Dispensary Portal**: High-efficiency pharmacist application featuring FIFO queue management, slide-over request drawers, inventory control, and operational alerts.

---

## 🏗️ Architecture & Pipeline Flow

```text
Prescription Image (Handwritten / Printed)
       │
       ▼
Google Gemini Vision Multimodal Extraction
       │ (JSON: drug names, dosages, frequency, instructions)
       ▼
RxNorm Medicine Matcher (`services/medicine_matcher.py`)
       │
       ├─► Exact / Alias / Fuzzy match ──► MATCHED (RxNorm medicine_id)
       ├─► Ambiguous candidates         ──► AMBIGUOUS (pharmacist review)
       └─► Catalog miss / Non-clinical  ──► UNRESOLVED / NOT_A_MEDICINE
       │
       ▼
Dispensary Inventory Availability Layer (`services/inventory_availability.py`)
       │ (Evaluates stock levels without side-effects)
       ├─► Available stock >= requested ──► AVAILABLE
       ├─► 0 < stock < requested        ──► PARTIAL
       └─► Stock = 0 or unstocked       ──► UNAVAILABLE
       │
       ▼
Automated Dispensary Request Creation (`services/dispensary.py`)
       │
       ▼
Pharmacist Queue & Fulfillment Workflow
   [ PENDING ] ──► [ PROCESSING ] ──► [ READY ] ──► [ DISPENSED ]
                    (Reserve Stock)                 (Deduct Stock)
```

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

Apply the database schema and migrations:

```bash
# Apply initial tables, types, and relations
psql -U postgres -d rxify -f database/schema.sql

# Apply medicine matching & alias migrations
psql -U postgres -d rxify -f database/migrations/001_medicine_matching.sql
```

_(Note: `database/db.py` will also automatically verify and apply necessary schema additions upon application startup)._

#### 5. Seed Dispensary Demo Data (Optional)

To quickly populate realistic test data for the dispensary portal (including stocked medicines, active queue requests across all statuses, low-stock alerts, and sample patients):

```bash
python scripts/seed_dispensary_demo.py
```

This seeds:
- **Dispensary Profile**: City General Central Pharmacy (`dispensary@citygeneral.com` / `password123`)
- **Inventory**: 15 medicines with In-Stock, Low-Stock (< reorder level), and Out-of-Stock states.
- **Live Queue**: 5 requests covering `PENDING`, `PROCESSING`, `READY`, `DISPENSED`, and `AMBIGUOUS` edge cases.

#### 6. Start the Backend Dev Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### Step 3: Modern Frontend Setup (`better-frontend`)

The frontend is built with React 18, TypeScript, Vite, and dedicated design systems.

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

To run a production bundle verification:

```bash
npm run build
```

---

### Step 4: Role-Based Portals & Workflows

Once both servers are running, access the portal switcher or direct URLs:

| Portal | URL Route | Target Users | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Patient Portal** | `/` or `/auth` | Patients | View prescription history, upload Rx images for OCR, schedule appointments, generate temporary QR tokens |
| **Doctor Dashboard** | `/doctor/dashboard` | Doctors & Specialists | Access patient records via QR/token, view OCR extractions, issue digital prescriptions, manage appointment slots |
| **Hospital Admin** | `/hospital/auth` | Hospital Admins | Register doctors, oversee departments, manage hospital-affiliated dispensaries, inspect appointments |
| **Dispensary Portal** | `/dispensary` | Pharmacists & Dispensaries | Live FIFO queue, slide-over request drawers, inventory control with RxNorm catalog search, stock alerts |

#### 🔑 Demo Accounts

- **Dispensary**: `dispensary@citygeneral.com` / `password123`
- **Patient**: `sarah.jenkins@example.com` / `password123`
- **Doctor**: `dr.house@citygeneral.com` / `password123`

---

## 📁 Repository Structure

```text
Rxify/
├── app/
│   ├── main.py                   # FastAPI app initialization, CORS, router mounting
│   ├── gemini.py                 # Google Gemini Vision prompt engineering & OCR pipeline
│   └── jobs.py                   # Background task runner for asynchronous OCR jobs
├── core/
│   ├── config.py                 # Pydantic Settings & environment loader
│   └── security.py               # Password hashing (bcrypt) & JWT token handlers
├── database/
│   ├── db.py                     # PostgreSQL connection pool & schema verification
│   ├── schema.sql                # Complete relational schema (patients, doctors, dispensaries)
│   ├── seed.sql                  # Initial seed data
│   └── migrations/               # Schema migrations (medicine aliases, match statuses)
├── models/                       # Pydantic validation schemas
│   ├── appointment.py
│   ├── auth.py
│   ├── dispensary.py
│   ├── doctor.py
│   ├── hospital.py
│   └── patient.py
├── routers/                      # FastAPI endpoint controllers
│   ├── appointment.py            # Slot booking & appointments
│   ├── auth.py                   # Authentication & token issuing
│   ├── dispensary.py             # Inventory, queue, fulfillment & availability endpoints
│   ├── doctor.py                 # Doctor profiles & patient lookup
│   ├── hospital.py               # Hospital administration
│   ├── patient.py                # Patient profile & prescription list
│   └── upload.py                 # Prescription image upload & OCR job dispatch
├── services/                     # Business logic & database operations
│   ├── appointment.py            # Appointment management
│   ├── dispensary.py             # Queue operations, stock reservations, dispensing
│   ├── doctor.py                 # Doctor services
│   ├── hospital.py               # Hospital services
│   ├── inventory_availability.py # Real-time read-only inventory availability evaluation
│   ├── medicine_matcher.py       # RxNorm catalog resolution & multi-tier string matching
│   ├── patient.py                # Patient records
│   └── prescription.py           # Prescription ingestion & OCR pipeline integration
├── scripts/
│   └── seed_dispensary_demo.py   # Seeding script for realistic dispensary demo data
├── better-frontend/              # Modern React + Vite + TypeScript application
│   ├── src/
│   │   ├── components/common/    # Reusable UI (QR Scanner, Share ID Modal, Portal Switcher)
│   │   ├── lib/                  # Strongly-typed API clients (dispensaryApi, api)
│   │   ├── pages/
│   │   │   ├── dispensary/       # Dispensary Portal
│   │   │   │   ├── components/   # StatusBadge, RequestDetailPanel, StockModals, useToast
│   │   │   │   ├── DispensaryAuth.tsx
│   │   │   │   └── DispensaryPortal.tsx
│   │   │   ├── doctor/           # Doctor Dashboard & consultations
│   │   │   ├── hospital/         # Hospital Admin & doctor management
│   │   │   └── patient/          # Patient Dashboard & timeline
│   │   ├── styles/               # CSS stylesheets (dispensary.css, globals.css, etc.)
│   │   ├── App.tsx               # Client router & state providers
│   │   └── main.tsx              # React DOM mounting
│   └── package.json
├── check_routes.py               # Utility script to inspect registered backend routes
├── test_pipeline_integration.py  # End-to-end integration test suite
├── requirements.txt              # Pinned Python backend dependencies
└── README.md
```

---

## 🧪 Testing & Diagnostics

### Run Integration Test Suite

Verify the end-to-end pipeline (`Prescription -> medicine_matcher -> inventory_availability -> dispensary_request_item`):

```bash
python test_pipeline_integration.py
```

### Run Route Checks

Verify all FastAPI endpoints and routers mount without errors:

```bash
python check_routes.py
```

### Run Unit Tests

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

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
