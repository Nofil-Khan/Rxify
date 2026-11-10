# Software Requirements Specification (SRS) & System Architecture
**Project:** Rxify — Intelligent Healthcare & Medication Management Platform  
**Architecture Paradigm:** Object-Oriented Domain-Driven Design (Service-Repository Pattern)  
**Status:** Living Engineering Reference  

---

## 1. System Vision & Architecture Overview

### 1.1 Purpose
Rxify is a modular platform connecting four healthcare domains: **Patients**, **Doctors/Hospitals**, **Clinical AI Knowledge Engines**, and **Dispensary Pharmacies**.

### 1.2 Architectural Principles
1. **Single Responsibility & Cohesion:** Eliminate monolithic files (>1000 lines). Every file has a single purpose (Repository, Service, Domain Entity, or View Component).
2. **Class-Based Encapsulation (Service-Repository):**
   - **Repository Classes:** Manage database connections, query execution, transactions, and entity mapping.
   - **Service Classes:** Encapsulate business rules, security policies, and orchestrate repositories.
   - **Routers / Controllers:** Thin declarative layer translating HTTP/WebSocket requests to Service calls.
3. **Frontend Modularity:**
   - Strict maximum file size (< 150 lines per component).
   - Server state cached via React Query; ephemeral UI state in Zustand. Zero parallel reducers.

---

## 2. Module 1: Authentication & Identity Management

### 2.1 Domain Entities (`services/auth/domain.py`)
- `AuthUser`:
  - `user_id: int` (Primary Key)
  - `email: str` (Unique Login Identifier)
  - `role: str` (`PATIENT`, `DOCTOR`, `DISPENSARY`, `HOSPITAL`)
  - `password_hash: str` (Bcrypt hash)
  - `status: str` (`ACTIVE`, `SUSPENDED`)
  - `patient_id`, `doctor_id`, `dispensary_id`, `hospital_id` (Domain-specific foreign keys)
- `TokenPayload`: Decoded claims with embedded permissions and role IDs.
- `AuthResult`: Typed immutable outcome of a successful login handshake.

### 2.2 Repositories & Services
```
services/auth/
├── __init__.py           # Public exports
├── domain.py             # AuthUser, TokenPayload, AuthResult
├── password_service.py   # PasswordService (Bcrypt hashing & verification)
├── token_service.py      # TokenService (JWT generation & validation)
├── repository.py         # UserRepository (SQL data access for accounts)
└── auth_service.py       # AuthService (Orchestrator for login/register across all roles)
```

### 2.3 Authentication & Authorization Architectural Flow

```mermaid
flowchart TD
    classDef client fill:#064E3B,stroke:#34D399,stroke-width:2px,color:#ECFDF5
    classDef facade fill:#065F46,stroke:#6EE7B7,stroke-width:2px,color:#FFFFFF
    classDef service fill:#047857,stroke:#A7F3D0,stroke-width:1.5px,color:#FFFFFF
    classDef db fill:#022C22,stroke:#059669,stroke-width:2px,color:#6EE7B7

    subgraph INGRESS["1. Client Ingress Layer"]
        C1["Patient / Doctor Client"]:::client
        C2["Dispensary Terminal"]:::client
        C3["Hospital Enterprise Portal"]:::client
    end

    subgraph ROUTERS["2. REST API Controllers"]
        R1["routers/auth.py<br/>/api/login"]:::service
        R2["routers/dispensary.py<br/>/api/dispensary/login"]:::service
        R3["routers/hospital.py<br/>/api/hospital/login"]:::service
    end

    subgraph CORE_AUTH["3. Modular OOP Auth Service Layer"]
        AUTH["AuthService (Facade)"]:::facade
        PASS["PasswordService<br/>(Bcrypt Salt & Verify)"]:::service
        TOKEN["TokenService<br/>(HS256 JWT Claims)"]:::service
        REPO["UserRepository<br/>(Parameterized SQL)"]:::service
    end

    subgraph STORAGE["4. Persistence Engine"]
        PG[("PostgreSQL 15+<br/>users | dispensary | hospital")]:::db
    end

    C1 -->|POST credentials| R1
    C2 -->|POST credentials| R2
    C3 -->|POST credentials| R3

    R1 -->|authenticate_general| AUTH
    R2 -->|authenticate_dispensary| AUTH
    R3 -->|authenticate_hospital| AUTH

    AUTH -->|1. Lookup user| REPO
    REPO -->|2. SELECT + JOINs| PG
    PG -->|3. Row tuple| REPO
    REPO -->|4. AuthUser Entity| AUTH

    AUTH -->|5. Verify hash| PASS
    PASS -->|6. Valid / Invalid| AUTH

    AUTH -->|7. Sign claims| TOKEN
    TOKEN -->|8. Signed JWT| AUTH
    AUTH -->|9. AuthResult| ROUTERS
    ROUTERS -->|10. JSON Bearer Response| INGRESS
```

### 2.4 In-Depth Authentication Lifecycle Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Frontend Client
    participant Router as routers/auth.py
    participant Auth as AuthService (Facade)
    participant Repo as UserRepository
    participant Password as PasswordService
    participant Token as TokenService
    participant DB as PostgreSQL Database

    Note over Client,Router: 1. Handshake & Ingress
    Client->>Router: POST /api/login (email, password)
    Router->>Auth: authenticate_general(email, password)

    Note over Auth,DB: 2. Identity Resolution
    Auth->>Repo: get_by_email(email)
    Repo->>DB: SELECT u.*, p.patient_id, d.doctor_id FROM users u ... WHERE email = %s
    DB-->>Repo: SQL Row Data
    Repo-->>Auth: AuthUser (Immutable Domain Entity)

    alt Account Suspended or Not Found
        Auth-->>Router: None (User Not Found or Inactive)
        Router-->>Client: 401 Unauthorized ("Incorrect username or password")
    else Account Active
        Note over Auth,Password: 3. Cryptographic Verification
        Auth->>Password: verify_password(plain, password_hash)
        Password-->>Auth: True (Constant-time match)
        
        Note over Auth,Token: 4. Token Generation & Claims Embedding
        Auth->>Token: create_token(AuthUser)
        Token-->>Auth: Signed JWT Token String
        
        Note over Auth,Client: 5. AuthResult Dispatch
        Auth-->>Router: AuthResult(access_token, role, uid, codes)
        Router-->>Client: 200 OK { access_token, token_type: 'bearer', role, ... }
    end
```

### 2.5 Protected Endpoint Authorization & Guard Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Authenticated Client
    participant Guard as core/security.py (require_role)
    participant Token as TokenService
    participant Repo as UserRepository
    participant Handler as Protected Route Handler

    Client->>Guard: GET /api/dispensary/queue (Authorization: Bearer <jwt>)
    Guard->>Token: decode_token(jwt)
    alt Invalid Signature or Expired
        Token-->>Guard: Raises PyJWTError
        Guard-->>Client: 401 Unauthorized ("Could not validate credentials")
    else Valid Token
        Token-->>Guard: TokenPayload(uid, role, dispensary_id)
        Guard->>Repo: get_by_id(payload.uid)
        Repo-->>Guard: AuthUser Entity
        
        alt Role Mismatch
            Guard-->>Client: 403 Forbidden ("Required role: DISPENSARY")
        else Role Authorized
            Guard->>Handler: Injects current_user context
            Handler-->>Client: 200 OK (Protected Data)
        end
    end
```

### 2.6 Endpoints Affected & Standardized

| Endpoint | Purpose | Handler Delegation |
| :--- | :--- | :--- |
| `POST /api/login` | General Patient & Doctor login | `default_auth_service.authenticate_general()` |
| `POST /api/register` | Patient & Doctor registration | `default_auth_service.register_user()` |
| `POST /api/dispensary/login` | Dispensary facility login | `default_auth_service.authenticate_dispensary()` |
| `POST /api/hospital/login` | Hospital enterprise login | `default_auth_service.authenticate_hospital()` |

---

## 3. Module 2: Prescription Intake & Clinical Ontology Normalization Engine

### 3.1 Domain Overview & Objectives
Rxify ingests prescriptions from multiple heterogeneous origins:
1. **Patient Mobile Uploads:** Optical Character Recognition (OCR) extractions from physical prescription paper slips.
2. **Doctor E-Prescription Portal:** Direct structured doctor orders.
3. **Hospital EHR Federated Sync:** HL7/FHIR medication statements.

Prescriptions commonly arrive with informal, regional brand names, dosage notations, and typos (e.g., *"Tab Crocin 650 TDS"*, *"Tylenol 500mg"*, *"Augmentin 625 Duo"*, *"Paracetamol BD"*). To ensure clinical safety, drug-drug interaction (DDI) checks, inventory availability, and dispensary fulfillment, every ingested drug string must be mapped to a canonical clinical concept (`medicine_id`, `rxcui`, `generic_name`).

### 3.2 Domain Entities (`services/clinical/domain.py` & `services/prescription/domain.py`)
- **`MatchStatus` (Enum):**
  - `MATCHED`: Successfully mapped to a single authoritative catalog item.
  - `AMBIGUOUS`: Multiple high-scoring candidates found (returned with top 3 ranked options).
  - `UNRESOLVED`: No confident match found (flagged for clinical review).
  - `NOT_A_MEDICINE`: Detected as dietary note, test instruction, or clinical noise.
- **`MatchCandidate`:**
  - `medicine_id: int`, `matched_name: str`, `rxcui: Optional[str]`, `confidence: float`, `method: str`, `form: Optional[str]`, `strength: Optional[str]`
- **`MatchResult`:**
  - Immutable outcome object containing `status`, `medicine_id`, `matched_name`, `confidence`, `method`, and ranked candidate lists.
- **`PrescriptionItem`:**
  - Line item inside a prescription: `raw_name`, `dosage`, `frequency`, `duration`, `instructions`, mapped `medicine_id`, and `match_status`.
- **`PrescriptionData`:**
  - Aggregate root for an ingested clinical document: `patient_id`, `issue_date`, `follow_up_date`, `diagnosis`, `notes`, and `medications: List[PrescriptionItem]`.

### 3.3 Repositories & Services Architecture
```
services/clinical/
├── __init__.py           # Public exports (MedicineMatcherService, default_matcher_service)
├── domain.py             # MatchStatus, MatchCandidate, MatchResult, ParsedMedication
├── synonyms.py           # SynonymBridge (BAN/IP/EP ↔ USAN/RxNorm international mapping)
├── normalizer.py         # ClinicalNormalizer (Token sanitization, form & strength parsing)
├── repository.py         # MedicineCatalogRepository (SQL parameterized queries + pg_trgm fuzzy matching)
└── matcher_service.py   # MedicineMatcherService (5-tier resolution orchestrator)

services/prescription/
├── __init__.py           # Public exports (PrescriptionService, default_prescription_service)
├── domain.py             # PrescriptionItem, PrescriptionData, PrescriptionRecord
├── parsers.py            # PrescriptionDateParser, DosageScheduleParser
├── repository.py         # PrescriptionRepository (CRUD operations on prescriptions, items & adherence)
└── prescription_service.py # PrescriptionService (Ingestion, clinical matching, timeline sync)
```

### 3.4 The 5-Tier Clinical Drug Resolution Pipeline

```mermaid
flowchart TD
    classDef input fill:#0F291E,stroke:#34D399,stroke-width:2px,color:#ECFDF5
    classDef guard fill:#022C22,stroke:#059669,stroke-width:1.5px,color:#6EE7B7
    classDef tier fill:#065F46,stroke:#6EE7B7,stroke-width:2px,color:#FFFFFF
    classDef match fill:#047857,stroke:#A7F3D0,stroke-width:2px,color:#FFFFFF
    classDef fail fill:#450A0A,stroke:#F87171,stroke-width:1.5px,color:#FEE2E2

    RAW["Raw Medicine String<br/>(e.g., 'Tab Crocin 650mg TDS')"]:::input --> NORM["ClinicalNormalizer<br/>Clean tokens, strip forms, extract strength"]:::guard
    
    NORM --> GUARD{"Is Non-Medicine<br/>Vocabulary?"}:::guard
    GUARD -->|Yes| NOT_MED["MatchResult: NOT_A_MEDICINE<br/>(Discard from Rx sync)"]:::fail
    GUARD -->|No| T1["Tier 1: Exact Alias Lookup<br/>(medicine_alias table)"]:::tier

    T1 -->|Found| RES1["MatchResult: MATCHED<br/>(Confidence: 1.0)"]:::match
    T1 -->|Miss| T2["Tier 2: Synonym Bridge<br/>(BAN / IP / EP ↔ USAN / RxNorm)"]:::tier

    T2 -->|Found| RES2["MatchResult: MATCHED<br/>(Confidence: 0.98)"]:::match
    T2 -->|Miss| T3["Tier 3: Exact Catalog Match<br/>(medicine table)"]:::tier

    T3 -->|Found| RES3["MatchResult: MATCHED<br/>(Confidence: 0.95)"]:::match
    T3 -->|Miss| T4["Tier 4: pg_trgm Fuzzy Similarity<br/>(Trigram Index > 0.35)"]:::tier

    T4 -->|Sim ≥ 0.70| RES4["MatchResult: MATCHED<br/>(Confidence: Sim)"]:::match
    T4 -->|0.45 ≤ Sim < 0.70 & Delta ≥ 0.10| RES4
    T4 -->|0.45 ≤ Sim < 0.70 & Ambiguous| AMB["MatchResult: AMBIGUOUS<br/>(Top 3 Ranked Candidates)"]:::fail
    T4 -->|Sim < 0.45| T5["Tier 5: Fast AI Clinical Fallback<br/>(Domain LLM Inference)"]:::tier

    T5 -->|AI Matched| RES5["MatchResult: MATCHED<br/>(Confidence: 0.85)"]:::match
    T5 -->|AI Unresolved| UNRES["MatchResult: UNRESOLVED<br/>(Flagged for Pharmacist Review)"]:::fail
```

### 3.5 Prescription Ingestion & Active Adherence Sync Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client as Patient / Doctor / OCR Worker
    participant Router as routers/upload.py or routers/patient.py
    participant RxService as PrescriptionService
    participant Parser as PrescriptionDateParser / DosageScheduleParser
    participant Matcher as MedicineMatcherService
    participant Repo as PrescriptionRepository
    participant DispQueue as Dispensary Queue Service
    participant DB as PostgreSQL 15+

    Client->>Router: POST /api/upload-prescription (Extracted JSON)
    Router->>RxService: ingest_extracted_prescription(extracted_dict, user_id)
    
    RxService->>Repo: get_or_create_patient_id(user_id)
    Repo->>DB: SELECT / INSERT INTO patient
    DB-->>Repo: patient_id
    Repo-->>RxService: patient_id

    RxService->>Parser: parse_date_string(issue_date, follow_up_date)
    Parser-->>RxService: Clean ISO Dates

    RxService->>Repo: create_prescription(patient_id, issue_date, follow_up, notes)
    Repo->>DB: INSERT INTO prescription RETURNING prescription_id
    DB-->>Repo: prescription_id
    Repo-->>RxService: prescription_id

    loop For Each Medication in Prescription
        RxService->>Repo: insert_prescription_item(rx_id, raw_name, dosage, frequency...)
        Repo->>DB: INSERT INTO prescription_medicine RETURNING id
        DB-->>Repo: prescription_medicine_id
        Repo-->>RxService: prescription_medicine_id

        RxService->>Matcher: resolve(raw_name, dosage, form)
        Note over Matcher: Executes Tier 1 - Tier 5 Pipeline
        Matcher-->>RxService: MatchResult(status, medicine_id, confidence)

        RxService->>Repo: update_item_resolution(pm_id, medicine_id, status)
        Repo->>DB: UPDATE prescription_medicine SET medicine_id, match_status
        DB-->>Repo: OK
    end

    Note over RxService,DB: Synchronize Active Adherence Timeline
    RxService->>Repo: insert_current_medication(patient_id, medicine_id, schedule...)
    Repo->>DB: INSERT / UPSERT INTO current_medication
    DB-->>Repo: OK

    Note over RxService,DispQueue: Trigger Dispensary Fulfillment Order
    RxService->>DispQueue: create_dispensary_request_for_prescription(rx_id)
    DispQueue->>DB: INSERT INTO dispensary_request (status: PENDING)
    DB-->>DispQueue: OK

    RxService-->>Router: prescription_id
    Router-->>Client: 201 Created { prescription_id, status: "processed" }
```

### 3.6 Endpoints & Service Delegations

| Endpoint | Purpose | Handler Delegation |
| :--- | :--- | :--- |
| `POST /api/upload-prescription` | Ingests OCR/Prescription JSON | `default_prescription_service.ingest_extracted_prescription()` |
| `GET /api/prescriptions/{id}/medicines` | Retrieves prescription items | `default_prescription_service.get_medicine_info()` |
| `POST /api/medicine/resolve` | Resolves raw medicine string | `default_matcher_service.resolve()` |
| `POST /api/medicine/resolve-batch` | Batch resolves drug strings | `default_matcher_service.resolve_batch()` |

---

## 4. Module 3: Dispensary Fulfillment & Inventory Stock Control

### 4.1 Domain Overview & Objectives
The Dispensary module transforms hospital pharmacies and independent dispensaries from isolated points of sale into intelligent fulfillment hubs:
1. **FIFO Ticket Fulfillment:** Prioritized queue automatically populated when clinical prescriptions are finalized.
2. **Deterministic Lifecycle Progression:** Multi-stage states (`PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PROCESSING` $\rightarrow$ `READY` $\rightarrow$ `DISPENSED`).
3. **Atomic Stock Reservation:** Uses PostgreSQL `SELECT ... FOR UPDATE` row locks to guarantee zero double-allocation across parallel pharmacist terminals.
4. **Clinical Verification Sign-Off:** Digital checklist (patient identity, dosage limits, DDI clearance) with cryptographic signature before physical dispensing.
5. **Two-Factor Handover Verification:** 6-digit patient OTP verification preventing accidental medication release to wrong individuals.
6. **Reconsultation Advisory Loop:** Seamless escalation (`RECONSULTATION_NEEDED`) returning invalid or unfulfillable prescriptions to doctor/patient while immediately releasing locked inventory.
7. **Bi-Directional WebSocket Channel:** Real-time push updates via `dispensary_ws_manager` eliminating client-side polling loops.

### 4.2 Domain Entities (`services/dispensary/domain.py`)
- **`DispensaryProfile`:** Facility registry entity containing `dispensary_id`, `hospital_id`, `location`, GPS coordinates (`latitude`, `longitude`), and operating hours.
- **`StockItem`:** Inventory entity tracking `available_quantity`, `reserved_quantity`, computed `free_stock` (`available - reserved`), `reorder_level`, and `stock_status` (`NORMAL`, `LOW_STOCK`, `OUT_OF_STOCK`).
- **`DispensaryRequestItem`:** Line item tracking required vs. dispensed quantity, stock availability, substitute recommendations (`suggested_substitute_id`), and pharmacist decisions (`FULFILL`, `PARTIAL`, `SUBSTITUTE`, `UNAVAILABLE`, `RECONSULT`).
- **`DispensaryOrder`:** Order aggregate root encapsulating patient metadata, pickup verification OTP, prep time estimates, pharmacist notes, and verification checklists.
- **`InventoryTransaction`:** Immutable ledger tracking stock adjustments (`STOCK_ADDED`, `MEDICINE_RESERVED`, `MEDICINE_DISPENSED`, `RESERVATION_CANCELLED`).

### 4.3 Modular OOP Package Architecture
```
services/dispensary/
├── __init__.py           # Public exports & backward-compatible facade functions
├── domain.py             # DispensaryProfile, StockItem, DispensaryOrder, RequestStatus
├── dispatcher.py         # DispensaryNotificationDispatcher (WebSockets & In-App Alerts)
├── repository.py         # DispensaryRepository (SQL parameterized queries & transactions)
├── stock_service.py      # StockAllocationService (Inventory CRUD, bulk CSV, reservations)
├── fulfillment_service.py# OrderFulfillmentService (Queue, order lifecycle, verification, OTP)
└── analytics_service.py  # DispensaryAnalyticsService (KPIs, turnaround time, order trends)
```

### 4.4 Dispensary Fulfillment State Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Prescription Ingested

    PENDING --> CONFIRMED: Pharmacist Confirms / Approves
    PENDING --> PARTIALLY_AVAILABLE: Partial Item Stock Detected
    PENDING --> UNAVAILABLE: No Items in Stock
    PENDING --> CANCELLED: Order Cancelled

    PARTIALLY_AVAILABLE --> CONFIRMED: Pharmacist Substitutes / Approves Partial
    PARTIALLY_AVAILABLE --> RECONSULTATION_NEEDED: Doctor Advice Required

    CONFIRMED --> PROCESSING: Pharmacist Begins Preparation
    PROCESSING --> READY: Packaged & Sealed for Collection
    READY --> DISPENSED: 6-Digit OTP Verified & Handover Complete

    CONFIRMED --> RECONSULTATION_NEEDED: Clinical Conflict Flagged
    PROCESSING --> RECONSULTATION_NEEDED: Clinical Conflict Flagged

    RECONSULTATION_NEEDED --> CONFIRMED: Doctor Updates / Confirms Prescription
    CONFIRMED --> CANCELLED: Order Cancelled
    PROCESSING --> CANCELLED: Order Cancelled
    READY --> CANCELLED: Patient Unreachable / Cancelled

    DISPENSED --> [*]: Handover Recorded to Audit Ledger
    CANCELLED --> [*]: Stock Reservations Released
```

### 4.5 Handover Verification & Stock Reservation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Pharmacist as Dispensary Pharmacist
    actor Patient as Patient / Courier
    participant Terminal as Dispensary Workspace (React)
    participant WS as WebSocket Channel
    participant Service as OrderFulfillmentService
    participant Repo as DispensaryRepository
    participant Stock as StockAllocationService
    participant DB as PostgreSQL 15+

    Note over Pharmacist,Terminal: Step 1: Ticket Confirmation & Inventory Reservation
    Pharmacist->>Terminal: Click "Approve / Confirm Order"
    Terminal->>Service: confirm_or_approve_request(dispensary_id, request_id)
    Service->>DB: SELECT * FROM dispensary_request WHERE request_id = %s FOR UPDATE
    Service->>DB: SELECT * FROM inventory_dispensary_stock FOR UPDATE
    Service->>DB: UPDATE inventory_dispensary_stock SET reserved_quantity = reserved_quantity + qty
    Service->>DB: INSERT INTO inventory_transaction (txn_type='MEDICINE_RESERVED')
    Service->>DB: UPDATE dispensary_request SET status = 'CONFIRMED'
    Service->>WS: Broadcast EVENT: STATUS_CHANGED (CONFIRMED)
    WS-->>Terminal: Update Kanban Column to Confirmed

    Note over Pharmacist,Terminal: Step 2: Clinical Verification Sign-Off
    Pharmacist->>Terminal: Submit Verification Checklist (ID, DDI, Dosage)
    Terminal->>Service: verify_prescription(request_id, checklist)
    Service->>DB: UPDATE dispensary_request SET verified_at = NOW(), signature = %s
    DB-->>Service: OK

    Note over Pharmacist,Terminal: Step 3: Preparation & Ready Notice
    Pharmacist->>Terminal: Click "Mark Ready for Pickup"
    Terminal->>Service: mark_request_ready(dispensary_id, request_id)
    Service->>DB: UPDATE dispensary_request SET status = 'READY', ready_at = NOW()
    Service->>Service: Send Patient Notification ("Medicines Ready with 6-digit OTP")
    Service->>WS: Broadcast EVENT: STATUS_CHANGED (READY)

    Note over Patient,Terminal: Step 4: OTP Verification & Physical Dispensing Handover
    Patient->>Pharmacist: Presents 6-Digit Pickup Code ("482910")
    Pharmacist->>Terminal: Enter Code & Click "Complete Dispensing"
    Terminal->>Service: dispense_request(request_id, pickup_code='482910')
    Service->>DB: SELECT pickup_code FROM dispensary_request FOR UPDATE
    Note over Service: Validates OTP match
    Service->>DB: UPDATE inventory_dispensary_stock SET available_quantity = available_quantity - qty, reserved_quantity = reserved_quantity - qty
    Service->>DB: INSERT INTO inventory_transaction (txn_type='MEDICINE_DISPENSED')
    Service->>DB: UPDATE dispensary_request SET status = 'DISPENSED', dispensed_at = NOW()
    Service->>WS: Broadcast EVENT: STATUS_CHANGED (DISPENSED)
    Service-->>Terminal: 200 OK (Handover Complete)
```

### 4.6 Endpoints & Service Delegations

| Endpoint | Method | Purpose | OOP Handler Delegation |
| :--- | :--- | :--- | :--- |
| `/api/dispensary/inventory` | `GET` | List inventory stock with free-stock calculations | `default_stock_service.get_inventory_stock()` |
| `/api/dispensary/inventory` | `POST` | Upsert medicine inventory row | `default_stock_service.add_or_update_stock()` |
| `/api/dispensary/inventory/bulk`| `POST` | Bulk upsert medicine stock | `default_stock_service.bulk_add_or_update_stock()` |
| `/api/dispensary/inventory/csv` | `POST` | Parse and import CSV stock file | `default_stock_service.import_stock_from_csv()` |
| `/api/dispensary/inventory/{id}`| `PATCH`| Partial update of stock thresholds | `default_stock_service.update_stock_partial()` |
| `/api/dispensary/queue` | `GET` | Active FIFO dispensary order queue | `default_fulfillment_service.get_dispensary_queue()` |
| `/api/dispensary/requests/{id}` | `GET` | Full order detail with patient & items | `default_fulfillment_service.get_request_detail()` |
| `/api/dispensary/requests/{id}/approve` | `POST` | Confirm ticket & reserve inventory | `default_fulfillment_service.confirm_or_approve_request()` |
| `/api/dispensary/requests/{id}/process` | `POST` | Transition ticket to processing | `default_fulfillment_service.process_request()` |
| `/api/dispensary/requests/{id}/ready` | `POST` | Mark order packaged and ready | `default_fulfillment_service.mark_request_ready()` |
| `/api/dispensary/requests/{id}/dispense`| `POST` | Validate OTP & finalize handover | `default_fulfillment_service.dispense_request()` |
| `/api/dispensary/requests/{id}/cancel` | `POST` | Cancel order & release held stock | `default_fulfillment_service.cancel_request()` |
| `/api/dispensary/requests/{id}/reconsult`| `POST`| Flag ticket for doctor reconsultation | `default_fulfillment_service.request_reconsultation()` |
| `/api/dispensary/requests/{id}/items/{item_id}` | `PATCH` | Per-item decision (substitute, partial) | `default_fulfillment_service.update_request_item_decision()` |
| `/api/dispensary/requests/{id}/verify` | `POST` | Clinical pharmacist verification sign-off | `default_fulfillment_service.verify_prescription()` |
| `/api/dispensary/dashboard` | `GET` | Real-time queue counters & alerts | `default_analytics_service.get_dashboard_stats()` |
| `/api/dispensary/analytics` | `GET` | Turnaround time & order trends | `default_analytics_service.get_dispensary_analytics()` |
| `/api/dispensary/transactions` | `GET` | Audit ledger of inventory movements | `default_stock_service.get_inventory_transactions()` |
| `/api/dispensary/ws/{id}` | `WS` | Real-time bi-directional WebSocket | `dispensary_ws_manager` & `default_dispatcher` |

---

## 5. Module 4: Patient Adherence & Medication Schedule Engine

### 5.1 Domain Overview & Objectives
Patient care within Rxify bridges prescription ingestion, personal adherence routines, and clinical doctor feedback loops:
1. **Patient-Isolated Multi-Tenancy:** Strict privacy barriers ensuring patients can only inspect and modify their own health records (`pt.user_id = %s`).
2. **Chronological Milestone Flowcharts:** Visual medication history grouped by clinical consultation events, automatically detecting drug transitions (`STARTED`, `CONTINUED`, `DISCONTINUED`, `COMPLETED`).
3. **Patient-in-the-Loop Disambiguation:** When OCR matching flags an item as `AMBIGUOUS` or `UNRESOLVED`, the patient selects the exact drug from fuzzy candidates, updating the catalog mapping and persisting self-learned synonyms in `medicine_alias`.
4. **Automated Dispensary Re-Evaluation:** When a patient clarifies an unmapped medicine, the dispensary fulfillment order automatically updates and triggers stock availability checks.
5. **Doctor Connection Lifecycle:** Outgoing consultation requests with status progression (`pending` $\rightarrow$ `active` or `rejected`).
6. **Active Course Status Controls:** Direct patient controls to mark ongoing treatments as `ACTIVE`, `DISCONTINUED`, or `COMPLETED` with date and reason tracking.

### 5.2 Domain Entities (`services/patient_care/domain.py`)
- **`PatientStats`:** Aggregate summary metrics: `patient_id`, `patient_code`, `rx_count`, `pending_requests`, `active_shares`.
- **`DoctorProfile`:** Public clinician profile: `doctor_id`, `doctor_code`, `display_name`, `specialty`, `experience_years`.
- **`TimelineMedication`:** Line item tracking `current_medication_id`, `dosage`, `frequency`, `duration`, `start_date`, `end_date`, `effective_status`, and milestone linkage.
- **`TimelineMilestone`:** Chronological event node containing consultation date, prescribing physician, diagnoses, and medication roster.
- **`FlowchartLink`:** Directed graph edge tracking a drug's trajectory between milestone nodes (`STARTED`, `CONTINUED`, `DISCONTINUED`).

### 5.3 Modular OOP Package Architecture
```
services/patient_care/
├── __init__.py           # Public exports & singletons
├── domain.py             # PatientStats, DoctorProfile, TimelineMilestone, FlowchartLink
├── repository.py         # PatientRepository (Parameterized SQL for patient domain)
├── timeline_service.py   # MedicationTimelineService (Graph milestone synthesis & backfill)
└── care_service.py       # PatientCareService (Clarification, doctor linking, status updates)

services/patient.py       # Facade layer delegating to services.patient_care
```

### 5.4 Patient Clarification & Self-Learning Resolution Loop

```mermaid
flowchart TD
    classDef client fill:#064E3B,stroke:#34D399,stroke-width:2px,color:#ECFDF5
    classDef service fill:#065F46,stroke:#6EE7B7,stroke-width:2px,color:#FFFFFF
    classDef db fill:#022C22,stroke:#059669,stroke-width:2px,color:#6EE7B7
    classDef loop fill:#047857,stroke:#A7F3D0,stroke-width:2px,color:#FFFFFF

    CLI["Patient Portal UI"]:::client -->|GET /api/patient/prescriptions/{id}| DET["PatientCareService<br/>get_my_prescription_detail()"]:::service
    DET -->|"Medication: match_status='AMBIGUOUS'"| AMB["Patient Review Required"]:::client

    AMB -->|GET /api/patient/medicine-candidates| CAND["PatientCareService<br/>get_medicine_candidates()"]:::service
    CAND -->|pg_trgm Ranked Drug List| AMB

    AMB -->|POST /api/patient/resolve-medicine (medicine_id)| RES["PatientCareService<br/>resolve_prescription_medicine()"]:::service
    
    RES -->|1. Commit Choice| P1["UPDATE prescription_medicine<br/>SET match_status='MATCHED', patient_resolved=TRUE"]:::db
    RES -->|2. Store Self-Learned Synonym| P2["INSERT INTO medicine_alias<br/>(alias_name, medicine_id, alias_type='user_learned')"]:::loop
    RES -->|3. Trigger Dispensary Re-Evaluation| P3["DispensaryOrderFulfillmentService<br/>create_dispensary_request_for_prescription()"]:::service

    P3 -->|4. Real-Time Stock Availability Sync| WS["Dispensary Queue & Live WebSocket"]:::client
```

### 5.5 Medication Adherence Timeline & Milestone Generation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Authenticated Patient
    participant Router as routers/patient.py
    participant Timeline as MedicationTimelineService
    participant Repo as PatientRepository
    participant DB as PostgreSQL 15+

    Patient->>Router: GET /api/patient/medication-timeline
    Router->>Timeline: get_patient_medication_timeline(patient_user_id)
    Timeline->>Repo: get_patient_id_by_user_id(patient_user_id)
    Repo-->>Timeline: patient_id

    Note over Timeline,DB: Step 1: Backfill Legacy Prescriptions
    Timeline->>Timeline: backfill_patient_current_medications(patient_id)
    Timeline->>DB: INSERT INTO current_medication (if missing from historical rx)

    Note over Timeline,DB: Step 2: Fetch Current Medications
    Timeline->>DB: SELECT cm.*, pm.*, rx.*, m.* FROM current_medication cm ... WHERE cm.patient_id = %s
    DB-->>Timeline: Raw Medication List

    Note over Timeline: Step 3: Chronological Milestone Grouping
    Timeline->>Timeline: Compute milestone_dates = sorted(distinct start_dates)
    loop For Each Milestone Date
        Timeline->>Timeline: Classify drugs: STARTED | CONTINUED | DISCONTINUED | COMPLETED
        Timeline->>Timeline: Synthesize FlowchartLink(source_node -> target_node)
    end

    Note over Timeline: Step 4: Aggregate Active Regimen (Today)
    Timeline->>Timeline: Filter active_now where status='ACTIVE' and end_date >= today

    Timeline-->>Router: { patient_id, milestones, flowchart_links, active_now, summary }
    Router-->>Patient: 200 OK (Timeline Graph Payload)
```

### 5.6 Endpoints & Service Delegations

| Endpoint | Method | Purpose | Handler Delegation |
| :--- | :--- | :--- | :--- |
| `/api/patient/stats` | `GET` | Dashboard overview counts | `default_care_service.get_patient_stats()` |
| `/api/patient/prescriptions` | `GET` | List patient's prescriptions | `default_care_service.get_my_prescriptions()` |
| `/api/patient/prescriptions/{id}` | `GET` | Prescription details with drugs & status | `default_care_service.get_my_prescription_detail()` |
| `/api/patient/doctor/lookup/{id}` | `GET` | Look up clinician public details | `default_care_service.lookup_doctor()` |
| `/api/patient/request-doctor` | `POST` | Send doctor consultation request | `default_care_service.send_doctor_request()` |
| `/api/patient/my-requests` | `GET` | List outgoing doctor requests | `default_care_service.get_my_requests()` |
| `/api/patient/my-doctor` | `GET` | Fetch actively assigned doctor | `default_care_service.get_assigned_doctor()` |
| `/api/patient/medicine-candidates`| `GET` | Get ranked options for ambiguous drug | `default_care_service.get_medicine_candidates()` |
| `/api/patient/resolve-medicine` | `POST` | Patient confirms drug match & learns alias | `default_care_service.resolve_prescription_medicine()` |
| `/api/patient/medication-timeline` | `GET` | Interactive health milestone flowchart | `default_timeline_service.get_patient_medication_timeline()` |
| `/api/patient/current-medications/{id}/status` | `PATCH` | Update course status (ACTIVE/STOPPED) | `default_care_service.update_patient_medication_status()` |
| `/api/patient/timeline-prescriptions` | `GET` | 3D spatial chronological prescription records | `default_timeline_service.get_patient_timeline_prescriptions()` |

---

## 6. Module 5: Clinical Appointments & Consultation Scheduling

### 6.1 Domain Overview & Objectives
The Consultation Scheduling module coordinates patient appointment discovery and clinical calendar allocations:
1. **Clinician Discovery:** Fast search across doctors by medical specialization and qualifications.
2. **Smart Time-Period Matching:** Automatic classification into `morning` (06:00–12:00), `afternoon` (12:00–17:00), and `evening` (17:00–21:00) windows.
3. **Graceful Fallback Scoring:** If no exact matches are available in the preferred time period, the nearest open slots are returned with `suggested=True` to prevent empty dead-ends.
4. **Race-Free Concurrency Control:** Employs PostgreSQL row-level locks (`SELECT ... FROM appointment_slot WHERE slot_id = %s FOR UPDATE`) during booking to ensure that parallel users cannot overbook slot capacity (`max_patients`).
5. **Double-Booking Prevention:** Validates that the patient does not already hold an active booking in the same slot.
6. **Patient-Isolated History & Cancellation:** Enables patients to view upcoming or past consultations and cancel `BOOKED` or `CONFIRMED` visits.

### 6.2 Domain Entities (`services/appointments/domain.py`)
- **`TimePeriod` (Enum):** `MORNING`, `AFTERNOON`, `EVENING`, `ANY`.
- **`AppointmentStatus` (Enum):** `BOOKED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- **`DoctorSearchResult`:** Doctor profile metadata (`doctor_id`, `doctor_name`, `specialization`, `qualification`, `experience_years`).
- **`AppointmentSlot`:** Capacity-tracked calendar slot (`slot_id`, `slot_date`, `start_time`, `end_time`, `max_patients`, `remaining_capacity`, `clinic_name`, `suggested`).
- **`AppointmentRecord`:** Patient booking entity (`appointment_id`, `patient_id`, `doctor_id`, `slot_date`, `status`, `reason_for_visit`).

### 6.3 Modular OOP Package Architecture
```
services/appointments/
├── __init__.py           # Public exports & singletons
├── domain.py             # TimePeriod, AppointmentStatus, AppointmentSlot, DoctorSearchResult
├── slot_matcher.py       # SmartSlotMatcher (Window math & fallback recommendation scoring)
├── repository.py         # AppointmentRepository (SQL data access & row-level FOR UPDATE locks)
└── appointment_service.py# AppointmentBookingService (Orchestrator for search, matching & booking)

services/patient_appointment.py # Backwards-compatible facade delegating to services.appointments
```

### 6.4 Smart Slot Matching & Fallback Scoring Pipeline

```mermaid
flowchart TD
    classDef input fill:#0F291E,stroke:#34D399,stroke-width:2px,color:#ECFDF5
    classDef engine fill:#065F46,stroke:#6EE7B7,stroke-width:2px,color:#FFFFFF
    classDef match fill:#047857,stroke:#A7F3D0,stroke-width:2px,color:#FFFFFF
    classDef fallback fill:#450A0A,stroke:#F87171,stroke-width:1.5px,color:#FEE2E2

    REQ["Patient Request<br/>(Doctor ID, Preferred Date, Time Period)"]:::input --> FETCH["AppointmentRepository<br/>Fetch Open Slots >= from_date with remaining_capacity > 0"]:::engine
    
    FETCH --> MATCHER["SmartSlotMatcher<br/>Evaluate start_time against Period Window"]:::engine

    MATCHER --> COND{"Preferred Slots<br/>Found?"}:::engine

    COND -->|Yes| RES1["Return Preferred Slots<br/>(suggested: False) + Top 3 Fallbacks"]:::match
    COND -->|No| RES2["Return Nearest Available Slots<br/>(suggested: True Fallback)"]:::fallback
```

### 6.5 Race-Free Appointment Booking Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Authenticated Patient
    participant Router as routers/patient.py
    participant Service as AppointmentBookingService
    participant Matcher as SmartSlotMatcher
    participant Repo as AppointmentRepository
    participant DB as PostgreSQL 15+

    Patient->>Router: POST /api/patient/appointments (doctor_id, slot_id / preferences)
    Router->>Service: book_appointment(user_id, doctor_id, slot_id, preferred_date, period)
    Service->>DB: Resolve patient_id from user_id

    alt Slot ID Not Provided
        Service->>Matcher: get_available_slots_smart(doctor_id, preferred_date, period)
        Matcher-->>Service: Ranked Candidate Slots (select top slot)
    end

    Note over Service,DB: Transaction & Concurrency Guard (ACID Isolation)
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: SELECT * FROM appointment_slot WHERE slot_id = %s FOR UPDATE
    DB-->>Service: Locked Slot Row (max_patients)

    Service->>DB: SELECT COUNT(*) FROM appointment WHERE slot_id = %s AND status NOT IN ('CANCELLED', 'NO_SHOW')
    DB-->>Service: booked_count

    alt Capacity Exceeded (booked_count >= max_patients)
        Service-->>Router: Raises ValueError ("Slot fully booked")
        Router-->>Patient: 400 Bad Request
    else Capacity Available
        Service->>DB: SELECT 1 FROM appointment WHERE patient_id = %s AND slot_id = %s
        alt Duplicate Active Booking
            Service-->>Router: Raises ValueError ("Already booked")
            Router-->>Patient: 400 Bad Request
        else Valid Booking
            Service->>DB: INSERT INTO appointment (patient_id, doctor_id, slot_id, status='BOOKED')
            Service->>DB: COMMIT TRANSACTION
            Service-->>Router: Appointment Confirmation Record
            Router-->>Patient: 201 Created { appointment_id, status: 'BOOKED', slot_matched: true }
        end
    end
```

### 6.6 Endpoints & Service Delegations

| Endpoint | Method | Purpose | Handler Delegation |
| :--- | :--- | :--- | :--- |
| `/api/patient/appointments/doctors` | `GET` | Browse doctors by specialty | `default_appointment_service.search_doctors_by_specialty()` |
| `/api/patient/appointments/doctors/{id}/slots`| `GET` | Smart slot matching with fallbacks | `default_appointment_service.get_available_slots_smart()` |
| `/api/patient/appointments` | `POST` | Book consultation with concurrency lock | `default_appointment_service.book_appointment()` |
| `/api/patient/appointments` | `GET` | List patient's booked consultations | `default_appointment_service.get_patient_appointments()` |
| `/api/patient/appointments/{id}` | `DELETE`| Cancel booked consultation | `default_appointment_service.cancel_appointment()` |

---

## 7. Module 6: Doctor Practice & Hospital Enterprise Operations

### 7.1 Domain Overview & Objectives
Clinical operations in Rxify unify multi-tenant institutional hospital governance with independent doctor practice workflows:
1. **Multi-Hospital Affiliated Clinician Roster:** Hospitals register clinicians into a localized directory (`hospital_doctor`), linking doctors without duplicating clinician records across institutions.
2. **Federated Patient Code EHR Ingress:** Doctors and hospitals can look up any patient using their unique public alphanumeric identifier (`patient_code`), accessing longitudinal historical prescriptions, active medications, and consultation notes across the entire healthcare network.
3. **Immutable HIPAA-Compliant Access Audit Trail:** Every retrieval of sensitive patient health records or appointment creation by a hospital records a non-repudiable audit event in `audit_log` (`hospital_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`).
4. **Institutional Slot Allocation & Multi-Tenant Scheduling:** Hospital administrators manage consultation slots (`appointment_slot`) on behalf of their affiliated doctors, enforcing clinic room assignment and booking capacity.
5. **Doctor-Scoped Privacy & Caseload Isolation:** Clinicians can only inspect medical details and prescriptions for patients actively assigned to their practice (`patient_doctor.status = 'active'`).
6. **Patient Connection Request Triage:** Clinicians review inbound patient connection requests (`pending`), with full workflow authority to accept (`active`) or reject (`rejected`).

### 7.2 Domain Entities (`services/clinical_ops/domain.py`)
- **`HospitalProfile`:** Healthcare institution entity: `hospital_id`, `name`, `email`, `phone`, `address`, `city`, `state`, `registration_number`, `status`.
- **`AffiliatedDoctor`:** Clinician attached to hospital: `doctor_id`, `doctor_name`, `doctor_email`, `specialization`, `qualification`, `department`, `active_patient_count`.
- **`PatientEHRSummary`:** Public patient identification record: `patient_id`, `patient_code`, `full_name`, `date_of_birth`, `blood_group`, `total_prescriptions`.
- **`DoctorDashboardStats`:** Clinician operational KPIs: `patient_count`, `rx_count`, `pending_requests`, `upcoming_followups`.
- **`HospitalDashboardData`:** Institutional governance metrics: `total_accesses`, `unique_patients_accessed`, `accesses_today`, `recent_activity`.

### 7.3 Modular OOP Package Architecture
```
services/clinical_ops/
├── __init__.py           # Public exports & singletons
├── domain.py             # HospitalProfile, AffiliatedDoctor, PatientEHRSummary, DoctorDashboardStats
├── repository.py         # ClinicalOpsRepository (SQL data access for doctor & hospital operations)
├── hospital_service.py   # HospitalEnterpriseService (Hospital profiles, EHR lookup, audit logging, slots)
└── doctor_service.py     # DoctorPracticeService (Prescription caseload, patient triage, profile)

services/hospital.py      # Backwards-compatible facade delegating to services.clinical_ops
services/doctor.py        # Backwards-compatible facade delegating to services.clinical_ops
```

### 7.4 Multi-Tenant Clinician Roster & Federated Patient EHR Ingress

```mermaid
flowchart TD
    classDef client fill:#064E3B,stroke:#34D399,stroke-width:2px,color:#ECFDF5
    classDef facade fill:#065F46,stroke:#6EE7B7,stroke-width:2px,color:#FFFFFF
    classDef service fill:#047857,stroke:#A7F3D0,stroke-width:1.5px,color:#FFFFFF
    classDef db fill:#022C22,stroke:#059669,stroke-width:2px,color:#6EE7B7
    classDef audit fill:#78350F,stroke:#FBBF24,stroke-width:1.5px,color:#FEF3C7

    subgraph CLIENTS["Clinical Clients Layer"]
        DOC["Doctor Practice Portal"]:::client
        HOSP["Hospital Enterprise Admin"]:::client
    end

    subgraph ROUTERS["API Routing Layer"]
        R_DOC["routers/doctor.py<br/>/api/doctor/*"]:::service
        R_HOSP["routers/hospital.py<br/>/api/hospital/*"]:::service
    end

    subgraph SERVICES["OOP Clinical Operations Services"]
        DS["DoctorPracticeService<br/>Caseload Scoping & Triage"]:::facade
        HS["HospitalEnterpriseService<br/>EHR Ingress & Affiliation"]:::facade
        REPO["ClinicalOpsRepository<br/>Parameterized SQL Engine"]:::service
    end

    subgraph STORAGE["Persistence & Audit Storage"]
        PG[("PostgreSQL 15+<br/>hospital | doctor | hospital_doctor<br/>patient | prescription | appointment_slot")]:::db
        AUDIT[("Audit Ledger<br/>audit_log (HIPAA Compliant)")]:::audit
    end

    DOC --> R_DOC
    HOSP --> R_HOSP

    R_DOC --> DS
    R_HOSP --> HS

    DS --> REPO
    HS --> REPO

    REPO -->|Query / Upsert| PG
    HS -->|Record Data Access Event| AUDIT
```

### 7.5 Hospital-Mediated Patient Booking & Audit Lifecycle Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Hospital Admin
    participant Router as routers/hospital.py
    participant Service as HospitalEnterpriseService
    participant Repo as ClinicalOpsRepository
    participant DB as PostgreSQL 15+
    participant Audit as Audit Log Ledger

    Note over Admin,Router: Step 1: Institutional Booking Request
    Admin->>Router: POST /api/hospital/book-appointment (patient_code, doctor_id, slot_id, reason)
    Router->>Service: book_appointment_for_patient(hospital_id, patient_code, doctor_id, slot_id, reason)

    Note over Service,DB: Step 2: Validation & Affiliation Guard
    Service->>Repo: book_appointment_for_patient(...)
    Repo->>DB: SELECT patient_id FROM patient WHERE patient_code = %s
    DB-->>Repo: patient_id
    Repo->>DB: SELECT 1 FROM hospital_doctor WHERE hospital_id = %s AND doctor_id = %s AND is_active = TRUE
    DB-->>Repo: Affiliation Confirmed

    Note over Service,DB: Step 3: Slot Capacity Verification
    Repo->>DB: SELECT slot_id, max_patients, booked_count FROM appointment_slot ...
    DB-->>Repo: slot_details (booked_count < max_patients)

    Note over Service,DB: Step 4: Appointment Creation
    Repo->>DB: INSERT INTO appointment (patient_id, doctor_id, clinic_id, slot_id, status='BOOKED')
    DB-->>Repo: appointment record

    Note over Service,Audit: Step 5: HIPAA Audit Logging
    Repo->>Audit: INSERT INTO audit_log (hospital_id, action='BOOK_APPOINTMENT', entity_type='APPOINTMENT', entity_id)
    Audit-->>Repo: Confirmed
    Repo-->>Service: appointment dict
    Service-->>Router: appointment response
    Router-->>Admin: 201 Created { appointment_id, status: 'BOOKED', patient_id }
```

### 7.6 Endpoints & Service Delegations

| Endpoint | Method | Purpose | Handler Delegation |
| :--- | :--- | :--- | :--- |
| `/api/doctor/stats` | `GET` | Doctor dashboard operational KPIs | `default_doctor_service.get_stats()` |
| `/api/doctor/my-patients` | `GET` | List assigned patient roster | `default_doctor_service.get_patients()` |
| `/api/doctor/my-prescriptions` | `GET` | Paginated doctor-scoped prescriptions | `default_doctor_service.get_prescriptions()` |
| `/api/doctor/my-prescriptions/{id}` | `GET` | Detail of doctor's prescription | `default_doctor_service.get_prescription_detail()` |
| `/api/doctor/patient-prescriptions` | `GET` | All prescriptions for an assigned patient | `default_doctor_service.get_patient_prescriptions_scoped()` |
| `/api/doctor/connection-requests` | `GET` | List pending patient connection requests | `default_doctor_service.get_pending_requests()` |
| `/api/doctor/connection-requests/{id}`| `POST` | Accept or reject connection request | `default_doctor_service.respond_to_request()` |
| `/api/doctor/lookup-patient` | `GET` | Lookup patient via public patient_code | `default_doctor_service.lookup_patient_by_code()` |
| `/api/doctor/connect-patient` | `POST` | Directly link patient to practice | `default_doctor_service.connect_patient()` |
| `/api/doctor/profile` | `PUT` | Update clinician profile & specialty | `default_doctor_service.update_profile()` |
| `/api/hospital/register` | `POST` | Register hospital enterprise account | `default_hospital_service.register_hospital()` |
| `/api/hospital/login` | `POST` | Authenticate hospital credentials | `default_auth_service.authenticate_hospital()` |
| `/api/hospital/dashboard` | `GET` | Aggregate enterprise activity metrics | `default_hospital_service.get_dashboard_data()` |
| `/api/hospital/lookup-patient` | `GET` | Lookup patient summary by patient_code | `default_hospital_service.lookup_patient_by_code()` |
| `/api/hospital/patient-prescriptions` | `GET` | Access patient prescriptions & audit log | `default_hospital_service.get_patient_prescriptions()` |
| `/api/hospital/patient-current-medications`| `GET` | Access active patient medications | `default_hospital_service.get_patient_current_medications()` |
| `/api/hospital/doctors` | `GET` | List hospital's affiliated clinicians | `default_hospital_service.get_hospital_doctors()` |
| `/api/hospital/doctors/affiliate` | `POST` | Affiliate doctor to hospital roster | `default_hospital_service.affiliate_doctor()` |
| `/api/hospital/doctors/{id}` | `DELETE`| Remove doctor affiliation | `default_hospital_service.remove_doctor_affiliation()` |
| `/api/hospital/doctors/{id}/patients` | `GET` | View patients under affiliated doctor | `default_hospital_service.get_doctor_patients_for_hospital()` |
| `/api/hospital/slots` | `POST` | Create appointment slot for doctor | `default_hospital_service.create_slot_for_doctor()` |
| `/api/hospital/slots/{id}` | `PATCH` | Update doctor slot time/capacity | `default_hospital_service.update_slot()` |
| `/api/hospital/slots/{id}` | `DELETE`| Delete doctor slot | `default_hospital_service.delete_slot()` |
| `/api/hospital/book-appointment` | `POST` | Hospital books appointment for patient | `default_hospital_service.book_appointment_for_patient()` |





