-- =============================================================================
-- Rxify — Full PostgreSQL Schema
-- Matches the ER Diagram exactly.
-- Run via: psql -U postgres -d rxify -f schema.sql
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMs ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('PATIENT', 'DOCTOR', 'LAB', 'HOSPITAL_ADMIN', 'DISPENSARY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE clinic_type AS ENUM ('CLINIC', 'HOSPITAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE relationship_type AS ENUM ('CONSULTING', 'PRIMARY', 'REFERRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE medicine_form AS ENUM ('TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE medication_status AS ENUM ('ACTIVE', 'COMPLETED', 'DISCONTINUED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE report_type AS ENUM ('BLOOD_TEST', 'X_RAY', 'MRI', 'CT_SCAN', 'ULTRASOUND', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE report_uploader AS ENUM ('LAB', 'DOCTOR', 'PATIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sender_type AS ENUM ('PATIENT', 'DOCTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM ('PRESCRIPTION', 'REPORT', 'ALL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('APPOINTMENT', 'MEDICINE', 'REPORT', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE dispensary_status AS ENUM (
        'PENDING', 'PROCESSING', 'READY',
        'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'DISPENSED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inventory_txn_type AS ENUM (
        'STOCK_ADDED', 'STOCK_REMOVED', 'MEDICINE_DISPENSED',
        'MEDICINE_RESERVED', 'RESERVATION_CANCELLED',
        'EXPIRED', 'DAMAGED', 'STOCK_ADJUSTMENT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    user_id         SERIAL PRIMARY KEY,
    full_name       TEXT,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    phone           TEXT,
    gender          TEXT,
    role            user_role NOT NULL DEFAULT 'PATIENT',
    status          user_status NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. patient
CREATE TABLE IF NOT EXISTS patient (
    patient_id              SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    date_of_birth           DATE,
    blood_group             TEXT,
    address                 TEXT,
    emergency_contact_name  TEXT,
    emergency_contact_phone TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. doctor
CREATE TABLE IF NOT EXISTS doctor (
    doctor_id           SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    specialization      TEXT,
    qualification       TEXT,
    license_number      TEXT UNIQUE,
    experience_years    INTEGER,
    about               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3b. dispensary — authenticated org entity (like hospital, NOT a user profile)
-- Each dispensary belongs to a hospital and manages its own inventory + requests.
CREATE TABLE IF NOT EXISTS dispensary (
    dispensary_id       SERIAL PRIMARY KEY,
    hospital_id         INTEGER NOT NULL REFERENCES hospital(hospital_id) ON DELETE CASCADE,
    name                TEXT NOT NULL DEFAULT 'Main Dispensary',
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    phone               TEXT,
    location            TEXT,           -- e.g. "Ground Floor, Block A"
    operating_hours     TEXT,           -- e.g. "08:00-20:00 daily"
    avg_prep_minutes    INTEGER NOT NULL DEFAULT 15,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. clinic_hospital
CREATE TABLE IF NOT EXISTS clinic_hospital (
    clinic_id   SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    address     TEXT,
    phone       TEXT,
    email       TEXT,
    type        clinic_type NOT NULL DEFAULT 'CLINIC',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. doctor_clinic (junction: which clinics a doctor works at)
CREATE TABLE IF NOT EXISTS doctor_clinic (
    doctor_clinic_id    SERIAL PRIMARY KEY,
    doctor_id           INTEGER NOT NULL REFERENCES doctor(doctor_id) ON DELETE CASCADE,
    clinic_id           INTEGER NOT NULL REFERENCES clinic_hospital(clinic_id) ON DELETE CASCADE,
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (doctor_id, clinic_id)
);

-- 6. patient_doctor (doctor-patient relationship, replaces old doctor_patient_assignments + patient_doctor_requests)
CREATE TABLE IF NOT EXISTS patient_doctor (
    patient_doctor_id   SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id           INTEGER NOT NULL REFERENCES doctor(doctor_id) ON DELETE CASCADE,
    clinic_id           INTEGER REFERENCES clinic_hospital(clinic_id),
    relationship_type   relationship_type NOT NULL DEFAULT 'CONSULTING',
    status              TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'active', 'rejected', 'inactive'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, doctor_id)
);

-- =============================================================================
-- PRESCRIPTION TABLES
-- =============================================================================

-- 7. medicine
CREATE TABLE IF NOT EXISTS medicine (
    medicine_id     SERIAL PRIMARY KEY,
    generic_name    TEXT NOT NULL,
    brand_name      TEXT,
    category        TEXT,
    strength        TEXT,
    form            medicine_form NOT NULL DEFAULT 'TABLET',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. prescription
CREATE TABLE IF NOT EXISTS prescription (
    prescription_id     SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id           INTEGER REFERENCES doctor(doctor_id),
    clinic_id           INTEGER REFERENCES clinic_hospital(clinic_id),
    issue_date          DATE,
    follow_up_date      DATE,
    diagnosis           TEXT,
    notes               TEXT,
    raw_text            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. prescription_medicine
CREATE TABLE IF NOT EXISTS prescription_medicine (
    prescription_medicine_id    SERIAL PRIMARY KEY,
    prescription_id             INTEGER NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
    medicine_id                 INTEGER REFERENCES medicine(medicine_id),   -- nullable: "as written"
    name                        TEXT NOT NULL,   -- free-text name as written on Rx
    dosage                      TEXT,
    frequency                   TEXT,
    duration                    TEXT,
    instructions                TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. current_medication
CREATE TABLE IF NOT EXISTS current_medication (
    current_medication_id       SERIAL PRIMARY KEY,
    patient_id                  INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    prescription_medicine_id    INTEGER REFERENCES prescription_medicine(prescription_medicine_id),
    medicine_id                 INTEGER REFERENCES medicine(medicine_id),
    dosage                      TEXT,
    frequency                   TEXT,
    start_date                  DATE,
    end_date                    DATE,
    status                      medication_status NOT NULL DEFAULT 'ACTIVE',
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- DISPENSARY / INVENTORY
-- =============================================================================

-- 11. inventory_dispensary_stock
--     Owned by a dispensary. available_quantity - reserved_quantity = free stock.
CREATE TABLE IF NOT EXISTS inventory_dispensary_stock (
    inventory_id        SERIAL PRIMARY KEY,
    dispensary_id       INTEGER NOT NULL REFERENCES dispensary(dispensary_id) ON DELETE CASCADE,
    medicine_id         INTEGER NOT NULL REFERENCES medicine(medicine_id) ON DELETE CASCADE,
    available_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    reorder_level       INTEGER NOT NULL DEFAULT 10,
    unit                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (dispensary_id, medicine_id)
);

-- 12. dispensary_request — ONE per prescription
CREATE TABLE IF NOT EXISTS dispensary_request (
    request_id          SERIAL PRIMARY KEY,
    prescription_id     INTEGER NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
    dispensary_id       INTEGER NOT NULL REFERENCES dispensary(dispensary_id),
    patient_id          INTEGER NOT NULL REFERENCES patient(patient_id),
    status              dispensary_status NOT NULL DEFAULT 'PENDING',
    estimated_ready_at  TIMESTAMPTZ,
    ready_at            TIMESTAMPTZ,
    dispensed_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prescription_id, dispensary_id)  -- one request per prescription per dispensary
);

-- 13. dispensary_request_item — ONE per prescribed medicine
CREATE TABLE IF NOT EXISTS dispensary_request_item (
    item_id                     SERIAL PRIMARY KEY,
    request_id                  INTEGER NOT NULL REFERENCES dispensary_request(request_id) ON DELETE CASCADE,
    prescription_medicine_id    INTEGER NOT NULL REFERENCES prescription_medicine(prescription_medicine_id),
    medicine_id                 INTEGER REFERENCES medicine(medicine_id),
    required_quantity           INTEGER NOT NULL DEFAULT 1,
    dispensed_quantity          INTEGER,
    availability_status         TEXT NOT NULL DEFAULT 'CHECKING',  -- AVAILABLE / PARTIAL / UNAVAILABLE
    reserved                    BOOLEAN NOT NULL DEFAULT FALSE,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. inventory_transaction — audit trail for every stock movement
CREATE TABLE IF NOT EXISTS inventory_transaction (
    txn_id          SERIAL PRIMARY KEY,
    inventory_id    INTEGER NOT NULL REFERENCES inventory_dispensary_stock(inventory_id),
    dispensary_id   INTEGER NOT NULL REFERENCES dispensary(dispensary_id),
    medicine_id     INTEGER NOT NULL REFERENCES medicine(medicine_id),
    txn_type        inventory_txn_type NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),  -- always positive; txn_type describes direction
    reference_id    INTEGER,   -- request_id or other entity
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MEDICAL REPORTS
-- =============================================================================

-- 13. medical_report
CREATE TABLE IF NOT EXISTS medical_report (
    report_id       SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    clinic_id       INTEGER REFERENCES clinic_hospital(clinic_id),
    report_type     report_type NOT NULL DEFAULT 'OTHER',
    report_date     DATE,
    file_url        TEXT,
    uploaded_by     report_uploader NOT NULL DEFAULT 'PATIENT',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- APPOINTMENTS
-- =============================================================================

-- 14. appointment_slot
CREATE TABLE IF NOT EXISTS appointment_slot (
    slot_id         SERIAL PRIMARY KEY,
    doctor_id       INTEGER NOT NULL REFERENCES doctor(doctor_id) ON DELETE CASCADE,
    clinic_id       INTEGER NOT NULL REFERENCES clinic_hospital(clinic_id) ON DELETE CASCADE,
    slot_date       DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    max_patients    INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. appointment
CREATE TABLE IF NOT EXISTS appointment (
    appointment_id      SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id           INTEGER NOT NULL REFERENCES doctor(doctor_id),
    clinic_id           INTEGER REFERENCES clinic_hospital(clinic_id),
    slot_id             INTEGER REFERENCES appointment_slot(slot_id),
    status              appointment_status NOT NULL DEFAULT 'BOOKED',
    reason_for_visit    TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CHAT / MESSAGING
-- =============================================================================

-- 16. chat_conversation
CREATE TABLE IF NOT EXISTS chat_conversation (
    conversation_id     SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id           INTEGER NOT NULL REFERENCES doctor(doctor_id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, doctor_id)
);

-- 17. chat_message
CREATE TABLE IF NOT EXISTS chat_message (
    message_id          SERIAL PRIMARY KEY,
    conversation_id     INTEGER NOT NULL REFERENCES chat_conversation(conversation_id) ON DELETE CASCADE,
    sender_id           INTEGER NOT NULL REFERENCES users(user_id),
    sender_type         sender_type NOT NULL,
    message_text        TEXT NOT NULL,
    attachment_url      TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read             BOOLEAN NOT NULL DEFAULT FALSE
);

-- =============================================================================
-- LAB
-- =============================================================================

-- 18. lab
CREATE TABLE IF NOT EXISTS lab (
    lab_id      SERIAL PRIMARY KEY,
    clinic_id   INTEGER REFERENCES clinic_hospital(clinic_id),
    name        TEXT NOT NULL,
    address     TEXT,
    email       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ACCESS / AUDIT
-- =============================================================================

-- 19. access_permission
CREATE TABLE IF NOT EXISTS access_permission (
    permission_id   SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id       INTEGER NOT NULL REFERENCES doctor(doctor_id) ON DELETE CASCADE,
    resource_type   resource_type NOT NULL DEFAULT 'ALL',
    resource_id     INTEGER,    -- NULL means all resources of that type
    can_view        BOOLEAN NOT NULL DEFAULT TRUE,
    can_download    BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. notification
CREATE TABLE IF NOT EXISTS notification (
    notification_id     SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    message             TEXT,
    type                notification_type NOT NULL DEFAULT 'GENERAL',
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. audit_log
CREATE TABLE IF NOT EXISTS audit_log (
    log_id      SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(user_id),
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   INTEGER,
    details     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- APP-SPECIFIC: patient_share_tokens (not in ER diagram, kept for app functionality)
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_share_tokens (
    id          SERIAL PRIMARY KEY,
    patient_id  INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    label       TEXT,
    expires_at  TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_patient_user_id              ON patient(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_user_id               ON doctor(user_id);
CREATE INDEX IF NOT EXISTS idx_dispensary_hospital_id       ON dispensary(hospital_id);
CREATE INDEX IF NOT EXISTS idx_dispensary_email             ON dispensary(email);
CREATE INDEX IF NOT EXISTS idx_prescription_patient_id      ON prescription(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_doctor_id       ON prescription(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prx_med_prescription_id      ON prescription_medicine(prescription_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_ids           ON patient_doctor(patient_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_id             ON chat_message(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_sender_id           ON chat_message(sender_id);
CREATE INDEX IF NOT EXISTS idx_share_token_token            ON patient_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_notification_user_id         ON notification(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id            ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_dispensary_id      ON inventory_dispensary_stock(dispensary_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine_id        ON inventory_dispensary_stock(medicine_id);
CREATE INDEX IF NOT EXISTS idx_disp_req_dispensary_id       ON dispensary_request(dispensary_id);
CREATE INDEX IF NOT EXISTS idx_disp_req_prescription_id     ON dispensary_request(prescription_id);
CREATE INDEX IF NOT EXISTS idx_disp_req_status              ON dispensary_request(status);
CREATE INDEX IF NOT EXISTS idx_disp_req_patient_id          ON dispensary_request(patient_id);
CREATE INDEX IF NOT EXISTS idx_disp_req_item_request_id     ON dispensary_request_item(request_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_dispensary_id        ON inventory_transaction(dispensary_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_inventory_id         ON inventory_transaction(inventory_id);

-- =============================================================================
-- HOSPITAL MODULE
-- =============================================================================

-- Hospital organization entity (separate from users — organizations, not people)
CREATE TABLE IF NOT EXISTS hospital (
    hospital_id         SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    phone               TEXT,
    address             TEXT,
    city                TEXT,
    state               TEXT,
    registration_number TEXT UNIQUE,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE / SUSPENDED
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patient public identifier (for hospital lookups and future QR codes)
-- QR code contains ONLY this code — no medical data
ALTER TABLE patient ADD COLUMN IF NOT EXISTS patient_code TEXT UNIQUE;

-- Hospital audit trail (nullable — rows with user_id track user actions, rows with hospital_id track hospital actions)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospital(hospital_id);

-- Auto-generate patient_code on INSERT (format: RXF-P-XXXXX)
CREATE OR REPLACE FUNCTION generate_patient_code() RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    chars    TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no I/O/0/1 to avoid ambiguity
    i        INT;
    attempts INT := 0;
BEGIN
    IF NEW.patient_code IS NULL THEN
        LOOP
            new_code := 'RXF-P-';
            FOR i IN 1..5 LOOP
                new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
            END LOOP;
            PERFORM 1 FROM patient WHERE patient_code = new_code;
            IF NOT FOUND THEN
                NEW.patient_code := new_code;
                RETURN NEW;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN
                RAISE EXCEPTION 'Could not generate unique patient_code after 100 attempts';
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_patient_code ON patient;
CREATE TRIGGER trg_generate_patient_code
    BEFORE INSERT OR UPDATE ON patient
    FOR EACH ROW
    EXECUTE FUNCTION generate_patient_code();

-- Hospital ↔ Doctor affiliation (hospital org account links to doctor profiles)
-- Hospital is the primary slot manager; doctors have override rights.
CREATE TABLE IF NOT EXISTS hospital_doctor (
    hospital_doctor_id  SERIAL PRIMARY KEY,
    hospital_id         INTEGER NOT NULL REFERENCES hospital(hospital_id) ON DELETE CASCADE,
    doctor_id           INTEGER NOT NULL REFERENCES doctor(doctor_id)     ON DELETE CASCADE,
    department          TEXT,           -- e.g. "Cardiology", "Orthopedics"
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hospital_id, doctor_id)
);

-- Hospital indexes
CREATE INDEX IF NOT EXISTS idx_hospital_email          ON hospital(email);
CREATE INDEX IF NOT EXISTS idx_patient_code            ON patient(patient_code);
CREATE INDEX IF NOT EXISTS idx_audit_log_hospital_id   ON audit_log(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctor_h       ON hospital_doctor(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctor_d       ON hospital_doctor(doctor_id);
