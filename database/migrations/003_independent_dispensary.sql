-- =============================================================================
-- Migration 003: Decouple Dispensary from Hospital
-- Makes dispensaries independent standalone entities.
--
-- Run:
--   psql -U postgres -d rxify -f database/migrations/003_independent_dispensary.sql
--
-- Changes:
--   1. Drops NOT NULL constraint on dispensary.hospital_id.
--   2. Drops strict ON DELETE CASCADE foreign key constraint (dispensary_hospital_id_fkey).
--   3. Replaces with optional ON DELETE SET NULL foreign key so dispensaries
--      can operate completely standalone, and deleting any hospital never
--      deletes or impacts an independent dispensary.
-- =============================================================================

-- 1. Make hospital_id optional (allows independent dispensaries without a hospital)
ALTER TABLE dispensary 
    ALTER COLUMN hospital_id DROP NOT NULL;

-- 2. Drop the strict cascade foreign key constraint
ALTER TABLE dispensary 
    DROP CONSTRAINT IF EXISTS dispensary_hospital_id_fkey;

-- 3. Re-add as an optional reference with ON DELETE SET NULL
ALTER TABLE dispensary 
    ADD CONSTRAINT dispensary_hospital_id_fkey 
    FOREIGN KEY (hospital_id) 
    REFERENCES hospital(hospital_id) 
    ON DELETE SET NULL;

-- 4. Update column comment
COMMENT ON COLUMN dispensary.hospital_id IS 
    'Optional reference to an affiliated hospital. NULL indicates an independent, standalone dispensary.';
