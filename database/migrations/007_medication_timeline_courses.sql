-- =============================================================================
-- Migration 007: Longitudinal Medication Timeline & Courses Infrastructure
-- Idempotent script for Rxify medication courses, prescription linkage,
-- adherence status, and audit history.
-- =============================================================================

-- 1. Extend medication_status enum safely
DO $$ BEGIN
    ALTER TYPE medication_status ADD VALUE IF NOT EXISTS 'ON_HOLD';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE medication_status ADD VALUE IF NOT EXISTS 'UNCERTAIN';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. New enum for Patient Adherence / Actual Medication Use
DO $$ BEGIN
    CREATE TYPE medication_confirmation_status AS ENUM (
        'NEEDS_CONFIRMATION',
        'CONFIRMED_TAKING',
        'CONFIRMED_PAUSED',
        'CONFIRMED_STOPPED',
        'NOT_STARTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. New enum for Status Provenance Source
DO $$ BEGIN
    CREATE TYPE medication_status_source AS ENUM (
        'SYSTEM_INFERRED',
        'PATIENT_REPORTED',
        'CLINICIAN_CONFIRMED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. New enum for Course Prescription Event Role
DO $$ BEGIN
    CREATE TYPE course_event_type AS ENUM (
        'NEW_COURSE',
        'CONTINUATION',
        'DOSE_CHANGED',
        'RESTARTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Unified Medication Course Table
CREATE TABLE IF NOT EXISTS medication_course (
    course_id                   SERIAL PRIMARY KEY,
    patient_id                  INTEGER NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    canonical_medicine_id       INTEGER REFERENCES medicine(medicine_id) ON DELETE SET NULL,
    display_name                TEXT NOT NULL,
    generic_name                TEXT,
    brand_name                  TEXT,
    rxcui                       TEXT,
    active_strength             TEXT,
    active_dosage               TEXT,
    active_frequency            TEXT,
    active_form                 TEXT,
    start_date                  DATE NOT NULL,
    end_date                    DATE,
    expected_end_date           DATE,
    status                      medication_status NOT NULL DEFAULT 'ACTIVE',
    confirmation_status         medication_confirmation_status NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    status_source               medication_status_source NOT NULL DEFAULT 'SYSTEM_INFERRED',
    is_chronic                  BOOLEAN NOT NULL DEFAULT FALSE,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_course_patient_status
    ON medication_course (patient_id, status);

CREATE INDEX IF NOT EXISTS idx_med_course_timeline
    ON medication_course (patient_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_med_course_canonical_med
    ON medication_course (canonical_medicine_id);

-- 6. Junction linking source prescription line items to the course
-- Unique constraint on prescription_medicine_id enforces strict idempotency
CREATE TABLE IF NOT EXISTS medication_course_prescription (
    link_id                     SERIAL PRIMARY KEY,
    course_id                   INTEGER NOT NULL REFERENCES medication_course(course_id) ON DELETE CASCADE,
    prescription_id             INTEGER NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
    prescription_medicine_id    INTEGER NOT NULL REFERENCES prescription_medicine(prescription_medicine_id) ON DELETE CASCADE,
    prescribed_name             TEXT NOT NULL,
    prescribed_strength         TEXT,
    prescribed_dosage           TEXT,
    prescribed_frequency        TEXT,
    prescribed_duration         TEXT,
    prescribed_instructions     TEXT,
    event_type                  course_event_type NOT NULL DEFAULT 'NEW_COURSE',
    event_date                  DATE NOT NULL,
    doctor_id                   INTEGER REFERENCES doctor(doctor_id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_prescription_pm UNIQUE (prescription_medicine_id)
);

CREATE INDEX IF NOT EXISTS idx_course_prescription_course
    ON medication_course_prescription (course_id);

CREATE INDEX IF NOT EXISTS idx_course_prescription_rx
    ON medication_course_prescription (prescription_id);

-- 7. Audit History Table for all status & confirmation changes
CREATE TABLE IF NOT EXISTS medication_status_history (
    history_id                  SERIAL PRIMARY KEY,
    course_id                   INTEGER NOT NULL REFERENCES medication_course(course_id) ON DELETE CASCADE,
    previous_status             medication_status,
    new_status                  medication_status NOT NULL,
    previous_confirmation       medication_confirmation_status,
    new_confirmation            medication_confirmation_status,
    change_reason               TEXT,
    source                      medication_status_source NOT NULL,
    changed_by_user_id          INTEGER REFERENCES users(user_id),
    effective_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_status_hist_course
    ON medication_status_history (course_id);

-- 8. Add course_id pointer to legacy current_medication table for backwards compatibility
ALTER TABLE current_medication
    ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES medication_course(course_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_current_med_course_id
    ON current_medication (course_id);
