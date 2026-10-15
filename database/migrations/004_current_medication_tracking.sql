-- =============================================================================
-- Migration 004: current_medication tracking & timeline support
-- =============================================================================

DO $$
BEGIN
    -- Ensure UNIQUE constraint on (patient_id, prescription_medicine_id) for ON CONFLICT upsert
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_current_med_patient_pm'
    ) THEN
        ALTER TABLE current_medication
            ADD CONSTRAINT uq_current_med_patient_pm
            UNIQUE (patient_id, prescription_medicine_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_current_med_patient_status
    ON current_medication (patient_id, status);

CREATE INDEX IF NOT EXISTS idx_current_med_timeline
    ON current_medication (patient_id, start_date, end_date);
