# Rxify — Intelligent Healthcare & Prescription Ecosystem

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Gemini Vision](https://img.shields.io/badge/AI-Google%20Gemini%20Vision-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![RxNorm](https://img.shields.io/badge/Catalog-RxNorm%20Clinical-10B981?style=for-the-badge)](https://www.nlm.nih.gov/research/umls/rxnorm/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

**A Next-Generation, Multimodal Healthcare Platform Bridging Patients, Physicians, Hospitals, and Dispensaries into a Unified, Zero-Friction Clinical Workflow.**

[Problem Statement](#-problem-statement) • [The Solution](#-the-rxify-solution) • [System Architecture](#-system-architecture--pipeline-flow) • [Features](#-core-platform-features) • [Developer Setup](#-developer-quickstart-guide) • [API Catalog](#-api-endpoints-reference) • [Testing](#-testing--diagnostics)

</div>

---

## 📌 Problem Statement

Medical prescriptions and clinical records remain the most vulnerable, fragmented, and error-prone link in modern healthcare delivery worldwide. Despite billions of dollars invested in enterprise Electronic Health Record (EHR) software, a massive portion of outpatient and clinical interactions still depend on **physical paper slips, handwritten doctor notes, and disconnected siloed systems**.

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80" alt="Physician Writing Physical Medical Prescription" width="100%" />
        <br/>
        <em>Figure 1: Manual, handwritten prescription workflows prone to interpretation errors.</em>
      </td>
      <td align="center" width="50%">
        <img src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80" alt="Pharmacy Medicine Dispensing Counter" width="100%" />
        <br/>
        <em>Figure 2: Dispensaries operating without unified real-time inventory and verification links.</em>
      </td>
    </tr>
  </table>
</div>

### 1. Illegible Handwriting & Preventable Adverse Drug Events (ADEs)
- **The Human Cost**: According to the *Institute of Medicine (IOM)* of the National Academies, preventable medication errors harm at least **1.5 million people annually** in the United States alone, causing over 7,000 to 9,000 deaths every year.
- **Interpretation Breakdowns**: Handwritten prescriptions with cryptic abbreviations, poor handwriting, ambiguous dosages (e.g., misreading `10mg` as `100mg` or confusing `QD` once daily with `QID` four times daily), and sound-alike/look-alike drug names (SALADs) regularly lead pharmacists to dispense incorrect medications or improper strengths.
- **The Financial Burden**: Morbidity and mortality resulting from medication-related errors cost the global healthcare ecosystem an estimated **$42 billion USD each year** (*World Health Organization*).

### 2. Disconnected Healthcare Silos & Polypharmacy Blindspots
- Patients routinely visit multiple independent general practitioners, specialists, dental clinics, and emergency rooms.
- Because these providers operate on completely isolated legacy record software or paper charts, **physicians have zero visibility into a patient's historical diagnoses, concurrent medications, or known drug allergies**.
- When new prescriptions are added without real-time cross-referencing, patients suffer from dangerous drug-drug interactions, duplicate therapies, or contraindicated prescriptions.

### 3. Pharmacy Inefficiency, Counter Feuds & Stock-Out Despair
- When a patient leaves a clinic with a paper prescription, they face an exhausting trial-and-error search across neighborhood pharmacies to find one that physically stocks their exact prescribed brands.
- Pharmacists have no digital pre-advice channel: when a patient presents a prescription at the counter, if an item is out of stock, the patient is turned away or handed an unverified substitute without physician coordination.
- Pharmacies struggle with stock reservation race conditions, double-dispensing, and the lack of a standardized clinical ontology to match commercial trade names to generic active ingredients.

### 4. Zero Patient Data Ownership & Insecure Record Sharing
- Patients rarely own their medical history in an actionable, machine-readable format.
- Handing over physical medical folders or sending unencrypted photos of lab reports over consumer messaging apps exposes sensitive Protected Health Information (PHI) to severe privacy violations and identity theft.

---

### 📊 Real-World Healthcare Data: Where Medication Errors Occur

Peer-reviewed clinical research (including the landmark *Harvard Medical Practice Study* and *Leape et al.*) illustrates that medication errors originate predominantly at the **Prescribing** stage due to manual interpretation issues:

| Error Stage | Share of Errors | Visual Impact Breakdown | Primary Clinical Breakdown Causes |
| :--- | :---: | :--- | :--- |
| **Prescribing** | **49%** | `█████████████████████████` | Illegible handwriting, dosage confusion, missed contraindications |
| **Administration** | **26%** | `█████████████` | Wrong timing, patient misreading labels, polypharmacy conflict |
| **Dispensing** | **14%** | `███████` | Look-alike brand mixups, incorrect strength, unverified substitution |
| **Transcribing** | **11%** | `██████` | Paper slip transcription mistakes, unstandardized Latin shorthands |

```text
Primary Root Causes of Outpatient Medication Errors (Normalized to 100%):

Illegible Doctor Handwriting    [38%]  ███████████████████
Disconnected Patient Records    [26%]  █████████████
Unchecked Drug Interactions     [18%]  █████████
Dosing / Unit Miscalculation    [12%]  ██████
Look-Alike / Sound-Alike Name   [ 6%]  ███
                               ─────
                        Total:  100%
```

---

## 💡 The Rxify Solution

**Rxify** reimagines prescription delivery from first principles. It unites the entire patient journey—from clinic consultation to doorstep pharmacy pickup—into an intelligent, auditable, and secure digital platform.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  1. MULTIMODAL INGESTION & VISION AI (app/gemini.py, app/jobs.py)                            │
│  Prescription Image (Paper / Scan / PDF) ──► Google Gemini Vision ──► Structured JSON        │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  2. CLINICAL NORMALIZATION & FALLBACK (services/medicine_matcher.py)                         │
│  Raw Prescribed Names ──► Exact / Alias / Trigram Match ──► Canonical RxNorm RxCUI          │
│       │                                                                                      │
│       └─► Ambiguous / Unresolved ──► Fast AI Fallback Engine (services/ai_medicine_fallback) │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  3. GEOSPATIAL DISCOVERY & MATCHING (services/dispensary_search.py)                          │
│  Patient GPS Coordinates ──► Haversine Distance (km) ──► Real-Time Stock Availability Matrix │
│       │                                                                                      │
│       ├─► Out-of-Stock Brand ──► Bioequivalent Generic Alternative Auto-Detection            │
│       └─► Multi-Criteria Score ──► Availability (65%) + Proximity (35%) + Speed Bonuses      │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  4. QUEUE & VERIFIED DISPENSING (services/dispensary.py)                                     │
│  Fulfillment Routing ──► Dispensary FIFO Queue ──► Pharmacist 3-Point Clinical Review        │
│       │                                                                                      │
│       ├─► Confirmation ──► Atomic Stock Reservation (PostgreSQL FOR UPDATE row locks)        │
│       ├─► Status Update ──► Order marked READY ──► Patient alerted with Collection ETA       │
│       └─► Counter Handover ──► 6-Digit Cryptographic Code / QR ──► Stock Deducted (DISPENSED)│
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼ (If adverse safety risk identified)
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  5. CLINICAL RECONSULTATION ADVISORY LOOP                                                    │
│  Pharmacist Flags Issue ──► Reserved Stock Released ──► Patient Portal Alert Banner          │
│       │                                                                                      │
│       └─► 1-Click Action: Direct Chat with Prescribing Doctor OR Instant Pharmacy Re-route   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Core Platform Features

### 1. 🧠 Multimodal Vision AI Extraction
- **Zero-Friction Ingestion**: Accepts images (`JPG`, `PNG`, `HEIC`, `WEBP`) or document scans of physical handwritten or printed prescriptions.
- **Google Gemini Vision Integration** ([`app/gemini.py`](file:///c:/CODING%20ONLY/PRO-JET/app/gemini.py)): Uses deep multimodal reasoning to extract diagnosis, doctor metadata, dates, and complete medication line items (active substance, dosage, frequency, administration route, duration, and clinical instructions).
- **Asynchronous Task Queue** ([`app/jobs.py`](file:///c:/CODING%20ONLY/PRO-JET/app/jobs.py)): Executes intensive vision processing in background threads without blocking user requests.

### 2. 💊 Canonical RxNorm Standardization & Fast AI Fallback
- **Clinical Ontology Matcher** ([`services/medicine_matcher.py`](file:///c:/CODING%20ONLY/PRO-JET/services/medicine_matcher.py)): Normalizes raw prescription text against the U.S. National Library of Medicine **RxNorm** catalog and regional drug dictionaries.
  - **Tier 1 (Exact)**: Direct match on brand name, generic name, or RxCUI.
  - **Tier 2 (Fuzzy & Trigram)**: Uses PostgreSQL `pg_trgm` GIN indexes and the `medicine_alias` catalog to resolve OCR typographical quirks and regional brand variants (e.g., *Dolo 650*, *Calpol*, *Pan-D*, *Augmentin*).
  - **Tier 3 (Classification)**: Tags items as `MATCHED`, `AMBIGUOUS`, or `UNRESOLVED`.
- **Fast AI Fallback Engine** ([`services/ai_medicine_fallback.py`](file:///c:/CODING%20ONLY/PRO-JET/services/ai_medicine_fallback.py)): Automatically disambiguates and predicts canonical equivalents for uncataloged drug records before order transmission.

### 3. 📍 Geospatial Discovery & Smart Pharmacy Matching
- **Haversine Distance Engine** ([`services/dispensary_search.py`](file:///c:/CODING%20ONLY/PRO-JET/services/dispensary_search.py)): Computes precise great-circle distance between the patient's GPS coordinates and active dispensaries.
- **Real-Time Stock Evaluation Without Side Effects**: Checks physical shelf counts across all prescribed drugs simultaneously.
- **Bioequivalent Generic Substitution**: If a prescribed trade brand is out of stock, the engine automatically checks whether the pharmacy stocks a therapeutic generic equivalent with identical active components.
- **Multi-Criteria Ranking Algorithm ($0 - 100$ Scale)**:
  $$\text{Rank Score} = (0.65 \times S_{\text{availability}}) + (0.35 \times S_{\text{distance}}) + \text{Operational Bonuses}$$
  Dispensaries are dynamically awarded badges: **"Top Recommendation"**, **"Runner-Up Match"**, or **"Top Alternative"**.

### 4. 📦 Dispensary Portal & Atomic Inventory Management
- **Pharmacist Command Center** ([`better-frontend/src/pages/dispensary/DispensaryPortal.tsx`](file:///c:/CODING%20ONLY/PRO-JET/better-frontend/src/pages/dispensary/DispensaryPortal.tsx)):
  - **Real-Time FIFO Queue**: Organizes incoming fulfillment requests with dynamic countdown timers.
  - **Quick Scanner**: Built-in webcam barcode & QR code reader ([`QrScannerModal.tsx`](file:///c:/CODING%20ONLY/PRO-JET/better-frontend/src/components/common/QrScannerModal.tsx)) supporting `RXF-P-...` (Patient), `RXF-RX-...` (Prescription), and ticket lookups.
  - **Clinical Sign-Off**: Mandatory 3-point clinical checklist (Identity checked, dosage validity cleared, drug interactions cleared) generating digital signatures (`RXF-V-...`).
  - **Row-Locked Atomic Transactions**: Utilizes PostgreSQL `SELECT ... FOR UPDATE` row locks to guarantee zero race conditions or negative inventory during concurrent orders.
  - **Item-Level Decisions**: Pharmacists can mark items as `FULFILL`, `PARTIAL`, `SUBSTITUTE`, `UNAVAILABLE`, or `RECONSULT`.

### 5. 🔄 Clinical Reconsultation Advisory Loop
- When a pharmacist identifies a safety hazard, contraindication, or critical stock shortage, they trigger the **Reconsultation Advisory** ([`services/dispensary.py`](file:///c:/CODING%20ONLY/PRO-JET/services/dispensary.py#L823)).
- **Stock Protection**: Any reserved stock is immediately unlocked and restored to free inventory.
- **Patient Action Banner**: The patient receives an immediate notification and a high-visibility advisory in their portal ([`DispensaryTab.tsx`](file:///c:/CODING%20ONLY/PRO-JET/better-frontend/src/pages/patient/tabs/DispensaryTab.tsx)):
  - Displays the pharmacist's clinical rationale.
  - **1-Click Doctor Consultation CTA**: Automatically transitions to real-time chat with the prescribing physician.
  - **Re-Route Option**: Allows the patient to cancel and transfer fulfillment to another dispensary with one click.

### 6. 🔐 Cryptographic 6-Digit Pickup Handshake
- When an order is routed, the platform generates a cryptographically random **6-digit handover code** (`pickup_code`) via Python's `secrets` module and encodes it in a secure QR token.
- At collection, the pharmacist enters or scans this code to authorize fulfillment. Physical stock is deducted, an immutable audit log is committed, and status moves to `DISPENSED`.

### 7. 🗓️ Active Medication Timeline & Adherence Regimen
- Tracks active therapies ([`services/medication_timeline.py`](file:///c:/CODING%20ONLY/PRO-JET/services/medication_timeline.py)), dosage schedules, and remaining durations.
- **Medication Reconciliation** ([`services/medication_reconciliation.py`](file:///c:/CODING%20ONLY/PRO-JET/services/medication_reconciliation.py)): Cross-analyzes prescriptions across multiple doctors to detect duplicate therapeutic classes and drug-drug conflicts.

### 8. 🏥 Multi-Tenant Hospital & Doctor Management
- **Hospital Administration**: Oversees medical departments, affiliates dispensaries, provisions doctors, and inspects enterprise audit logs ([`audit_log`](file:///c:/CODING%20ONLY/PRO-JET/database/db.py#L117)).
- **Doctor Portal**: Digital prescription generation, patient lookup via temporary QR tokens, appointment slot management, and live tele-consultation messaging ([`services/chat.py`](file:///c:/CODING%20ONLY/PRO-JET/services/chat.py)).

---

## 🏛️ System Architecture & Database Model

```text
   [ users ] (Authentication & Base Roles: PATIENT, DOCTOR, DISPENSARY, HOSPITAL)
      │
      ├── (1:1) ──► [ patient ] ────── (1:N) ──► [ prescription ] ── (1:N) ──► [ prescription_medicine ]
      │                                                │                                  │
      ├── (1:1) ──► [ doctor ] ◄──────── (1:N) ────────┘                                  │
      │                ▲                                                                  │
      │                │ (N:1)                                                            ▼
      │        [ hospital_doctor ]                                             [ dispensary_request_item ]
      │                │                                                                  ▲
      │                ▼ (N:1)                                                            │ (1:N)
      └── (1:1) ──► [ hospital ] ──── (1:N) ──► [ dispensary ] ── (1:N) ──► [ dispensary_request ]
                                                    │
                                                    ▼ (1:N)
                                         [ inventory_dispensary_stock ] ── (1:N) ──► [ inventory_transaction ]
                                                    │
                                                    ▼ (N:1)
                                               [ medicine ] ◄── (1:N) ── [ medicine_alias ]
```

| Primary Entity | Managed Attributes & Columns | Key Relational Links |
| :--- | :--- | :--- |
| **`patient`** | `patient_id`, `user_id`, `patient_code` (`RXF-P-XXXXX`), `dob`, `gender` | FK to `users`; Owns `prescription` and `dispensary_request` |
| **`doctor`** | `doctor_id`, `user_id`, `license_number`, `specialization`, `bio` | FK to `users`; Affiliated via `hospital_doctor` |
| **`hospital`** | `hospital_id`, `name`, `email`, `registration_number`, `status` | Employs doctors; Operates hospital-affiliated dispensaries |
| **`dispensary`** | `dispensary_id`, `name`, `latitude`, `longitude`, `avg_prep_minutes` | Authenticated organization; Holds inventory & fulfillment queues |
| **`prescription`** | `prescription_id`, `patient_id`, `doctor_id`, `diagnosis`, `issue_date` | Issued by doctor; Linked to `dispensary_request` tickets |
| **`inventory_dispensary_stock`**| `dispensary_id`, `medicine_id`, `available_quantity`, `reserved_quantity` | Locked with `FOR UPDATE` during queue confirmation & dispensing |
| **`dispensary_request`** | `request_id`, `prescription_id`, `dispensary_id`, `pickup_code`, `status` | Finite State Machine (`PENDING`, `CONFIRMED`, `READY`, `DISPENSED`) |
| **`inventory_transaction`** | `txn_id`, `inventory_id`, `txn_type`, `quantity`, `reference_id` | Immutable audit trail for all medicine additions, reserves, and disbursements |

---

## 💻 Tech Stack

| Layer | Technology | Key Libraries / Frameworks |
| :--- | :--- | :--- |
| **Backend API** | Python 3.12+ | FastAPI, Uvicorn, Pydantic v2, Starlette |
| **Database** | PostgreSQL 14+ | `psycopg2-binary` (Connection Pooling, `pg_trgm` extension) |
| **AI / Computer Vision**| Google Gemini Vision | `google-genai` Multimodal Vision Models |
| **Security & Auth** | OAuth2 / JWT | `python-jose`, `passlib[bcrypt]`, Cryptographic `secrets` |
| **Frontend Web** | React 18.3, TypeScript 5.7 | Vite, Lucide Icons, Modern CSS Design System |
| **Testing** | Pytest, Unittest | Custom E2E integration test harnesses |

---

## 🚀 Developer Quickstart Guide

Follow these steps to run the complete Rxify platform (FastAPI backend + Vite React frontend + PostgreSQL) locally.

### 🛠 Prerequisites
- **Python 3.12+**
- **Node.js 18+** & **npm**
- **PostgreSQL 14+** (running locally on port 5432 or cloud hosted via Supabase/Neon)
- **Google Gemini API Key** (free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey))

---

### Step 1: Clone the Codebase
```bash
git clone https://github.com/Nofil-Khan/Rxify.git
cd Rxify
```

---

### Step 2: Backend Setup (FastAPI & PostgreSQL)

#### 1. Create Virtual Environment
```bash
# Using conda:
conda create -n rxify python=3.12 -y
conda activate rxify

# Or using venv:
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

#### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

#### 3. Configure Environment Variables
Create your local `.env` configuration file:
```bash
# Windows:
copy .env.example .env
# macOS/Linux:
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/rxify

# Google Gemini Vision Key
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere...

# JWT Secret (generate with: python -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY=9f8e7d6c5b4a3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b
ACCESS_TOKEN_EXPIRE_MINUTES=120
```

#### 4. Initialize Database & Run Migrations
Create the database and apply the clinical schemas:
```bash
# 1. Create the database
psql -U postgres -c "CREATE DATABASE rxify;"

# 2. Apply initial relational schema
psql -U postgres -d rxify -f database/schema.sql

# 3. Apply medicine matching & trigram index migrations
psql -U postgres -d rxify -f database/migrations/001_medicine_matching.sql
```
*(Note: `database/db.py` contains idempotent auto-migration handlers that inspect and apply table columns on server boot).*

#### 5. Seed Realistic Dispensary & Clinical Demo Data
Populates the database with real-world hospitals, doctors, 15+ inventory medications, sample patients, and pre-staged FIFO fulfillment tickets:
```bash
python scripts/seed_dispensary_demo.py
```

#### 6. Start the Backend API Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- **Live API**: [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### Step 3: Modern Frontend Setup (`better-frontend`)

#### 1. Navigate to Frontend Directory
```bash
cd better-frontend
```

#### 2. Install Node Packages
```bash
npm install
```

#### 3. Start Development Server
```bash
npm run dev
```
Open your browser at 👉 **[http://localhost:3000](http://localhost:3000)**.

---

## 👥 Demo Credentials & Portals

The platform provides dedicated, role-tailored interfaces:

| Portal | URL Path | Demo Login | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Patient Portal** | `/` or `/auth` | `sarah.jenkins@example.com` | `password123` | View Rx history, upload prescriptions for OCR, find nearby pharmacies, track order ETAs, display 6-digit pickup QR |
| **Dispensary Portal** | `/dispensary` | `dispensary@citygeneral.com` | `password123` | Process live FIFO queue, scan patient/Rx barcodes, execute clinical sign-off, reserve stock, dispense medications |
| **Doctor Dashboard** | `/doctor/dashboard` | `dr.house@citygeneral.com` | `password123` | Consult patients via QR token, issue digital prescriptions, review OCR scans, manage booking calendar |
| **Hospital Admin** | `/hospital/auth` | `admin@citygeneral.com` | `password123` | Manage clinical staff, oversee affiliated pharmacies, review appointments, inspect audit logs |

---

## 📡 API Endpoints Reference

### 1. Vision OCR & Prescriptions
- `POST /api/upload` — Upload prescription image and trigger Gemini Vision OCR job.
- `GET /api/upload/jobs/{job_id}` — Poll status and retrieve structured medication extraction.
- `GET /api/prescriptions/{id}` — Fetch prescription detail with standardized RxNorm line items.

### 2. Patient & Geospatial Discovery
- `GET /api/patient/dispensaries/nearby` — Discover nearby pharmacies using GPS coordinates, radius, and multi-criteria availability scoring.
- `POST /api/patient/dispensary/fulfill` — Route prescription to chosen pharmacy; calculates queue ETA and generates secure 6-digit pickup code.
- `GET /api/patient/dispensary-requests` — Live status of all ongoing pickup tickets and collection instructions.
- `POST /api/patient/dispensary-requests/{id}/cancel` — Cancel ticket and release reservations.

### 3. Dispensary Operations
- `GET /api/dispensary/queue` — Fetch FIFO fulfillment queue (filterable by status: `PENDING`, `CONFIRMED`, `READY`, etc.).
- `GET /api/dispensary/lookup/{code}` — Instant lookup for scanned `RXF-P-...`, `RXF-RX-...`, or ticket numbers.
- `POST /api/dispensary/requests/{id}/verify` — Record pharmacist clinical verification sign-off.
- `POST /api/dispensary/requests/{id}/approve` — Approve ticket and atomically reserve stock.
- `PATCH /api/dispensary/requests/{id}/items/{item_id}` — Item-level decision (`FULFILL`, `PARTIAL`, `SUBSTITUTE`, `UNAVAILABLE`, `RECONSULT`).
- `POST /api/dispensary/requests/{id}/reconsult` — Flag clinical advisory and unfreeze reserved stock.
- `POST /api/dispensary/requests/{id}/ready` — Mark order ready for pickup and dispatch patient alert.
- `POST /api/dispensary/requests/{id}/dispense` — Validate 6-digit handover code, deduct inventory, and mark `DISPENSED`.

### 4. Inventory Control
- `GET /api/dispensary/inventory` — List physical stock and reserve levels.
- `POST /api/dispensary/inventory` — Add or replenish stock.
- `POST /api/dispensary/inventory/csv` — Bulk inventory upload via CSV file.
- `GET /api/dispensary/transactions` — Audit ledger of all stock additions, reservations, and disbursements.

### 5. Dispensary Dashboard Data Layer & CORS Configuration
The Rxify frontend supports dual operational data modes:
- **Mock Service Worker (Default)**: In development, MSW intercepts `/api/pharmacy/*`, `/api/prescriptions/*`, and `/api/inventory/*` with deterministic 100–300ms simulated latency and seed records.
- **FastAPI Real Mode**: Set `VITE_API_BASE_URL=http://localhost:8000` in `better-frontend/.env` to bypass MSW and route directly to the FastAPI backend.
- **CORS Notice**: When connecting to the FastAPI backend at `http://localhost:8000`, verify `main.py` permits requests from `http://localhost:3000` (or `http://127.0.0.1:3000`) in `CORSMiddleware`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

---

## 🧪 Testing & Diagnostics

The repository includes end-to-end integration test suites verifying clinical safety:

```bash
# Run complete test suite
pytest

# Test AI Medicine Fallback Disambiguation
pytest tests/test_ai_medicine_fallback.py

# Test Geospatial Discovery & Scoring Algorithm
pytest tests/test_dispensary_search.py

# Test Pharmacist Reconsultation Workflow
pytest tests/test_dispensary_reconsultation.py

# Test Active Medication Timeline & Interaction Reconciliation
pytest tests/test_medication_timeline.py
```

---

## 🔒 Security, Privacy & Compliance

- **Role-Based Access Control (RBAC)**: JWT access tokens strictly partition endpoints by role (`PATIENT`, `DOCTOR`, `DISPENSARY`, `HOSPITAL`).
- **HIPAA / GDPR Ready Data Exclusions**: Uploaded clinical images (`data/uploads/`), local database artifacts, and environment files (`.env`) are excluded from source control.
- **Auditable Ledger**: Every inventory adjustment and medicine dispensation commits an entry into `inventory_transaction` and `audit_log` with user IDs, timestamps, and reference IDs.
- **Handover Security**: Medicine collection requires physical validation of the 6-digit cryptographic token, eliminating unauthorized counter pickups.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for complete terms.
