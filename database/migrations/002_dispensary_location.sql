-- =============================================================================
-- Migration 002: Dispensary Physical Location
-- Adds latitude, longitude, and address fields to the dispensary table.
--
-- Run:
--   psql -U postgres -d rxify -f database/migrations/002_dispensary_location.sql
--
-- Safe to run multiple times — all ALTER statements are guarded with
-- IF NOT EXISTS so existing data and columns are never touched twice.
-- Existing dispensary rows will have NULL in all three new columns,
-- which is valid (location selection is optional at registration time).
-- =============================================================================

-- Add latitude (DOUBLE PRECISION, -90..90)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dispensary' AND column_name = 'latitude'
    ) THEN
        ALTER TABLE dispensary ADD COLUMN latitude DOUBLE PRECISION;
        COMMENT ON COLUMN dispensary.latitude IS
            'GPS latitude of the physical dispensary location (-90 to 90). NULL = not yet set.';
    END IF;
END $$;

-- Add longitude (DOUBLE PRECISION, -180..180)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dispensary' AND column_name = 'longitude'
    ) THEN
        ALTER TABLE dispensary ADD COLUMN longitude DOUBLE PRECISION;
        COMMENT ON COLUMN dispensary.longitude IS
            'GPS longitude of the physical dispensary location (-180 to 180). NULL = not yet set.';
    END IF;
END $$;

-- Add address (TEXT -- human-readable from Google reverse geocoding)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dispensary' AND column_name = 'address'
    ) THEN
        ALTER TABLE dispensary ADD COLUMN address TEXT;
        COMMENT ON COLUMN dispensary.address IS
            'Human-readable address resolved via reverse geocoding. May differ from the legacy location column.';
    END IF;
END $$;

-- Optional: index for future nearby-dispensary queries (non-spatial, simple box filter)
CREATE INDEX IF NOT EXISTS idx_dispensary_lat_lng
    ON dispensary (latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
