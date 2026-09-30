-- =============================================================================
-- Migration: Medicine Matching infrastructure
-- Run: psql -U postgres -d rxify -f database/migrations/001_medicine_matching.sql
-- Safe to run multiple times (all statements are idempotent).
-- =============================================================================

-- pg_trgm is required for similarity() and % operator (fuzzy text matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- medicine_alias
-- Allows manual mapping of brand names, OCR variants, and Indian trade names
-- to a canonical medicine_id in the medicine table.
-- Add rows here when you encounter recurring OCR mistakes or local brand names.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicine_alias (
    alias_id        SERIAL PRIMARY KEY,
    alias_name      TEXT NOT NULL,              -- the name as written on the prescription
    medicine_id     INTEGER NOT NULL REFERENCES medicine(medicine_id) ON DELETE CASCADE,
    alias_type      TEXT NOT NULL DEFAULT 'brand',  -- 'brand' | 'ocr_variant' | 'abbreviation'
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (alias_name)                         -- one alias maps to exactly one medicine
);

-- Fast lookup by alias name (case-insensitive via LOWER() index)
CREATE INDEX IF NOT EXISTS idx_medicine_alias_lower
    ON medicine_alias (LOWER(alias_name));

-- ---------------------------------------------------------------------------
-- GIN trigram indexes on the medicine catalog
-- These make similarity() queries fast even with 12k+ rows.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_medicine_generic_trgm
    ON medicine USING GIN (generic_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_medicine_brand_trgm
    ON medicine USING GIN (brand_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_medicine_rxnorm_trgm
    ON medicine USING GIN (rxnorm_name gin_trgm_ops);

-- Also index strength for compound matching
CREATE INDEX IF NOT EXISTS idx_medicine_strength
    ON medicine (strength);

-- ---------------------------------------------------------------------------
-- Seed common high-frequency brand and international aliases
-- ---------------------------------------------------------------------------
INSERT INTO medicine_alias (alias_name, medicine_id, alias_type, notes)
SELECT v.alias, v.med_id, v.atype, v.notes
FROM (VALUES
    ('janumet', 861819, 'brand', 'sitagliptin / metformin 500/50'),
    ('janumet 50/500', 861819, 'brand', 'sitagliptin / metformin 500/50'),
    ('janumet 50/500mg', 861819, 'brand', 'sitagliptin / metformin 500/50'),
    ('janumet 50/1000', 861769, 'brand', 'sitagliptin / metformin 1000/50'),
    ('janumet 50/1000mg', 861769, 'brand', 'sitagliptin / metformin 1000/50'),
    ('augmentin', 617296, 'brand', 'amoxicillin / clavulanate 500/125'),
    ('augmentin 625', 617296, 'brand', 'amoxicillin / clavulanate 500/125'),
    ('augmentin 625mg', 617296, 'brand', 'amoxicillin / clavulanate 500/125'),
    ('paracetamol', 198440, 'international_inn', 'acetaminophen 500mg tablet'),
    ('crocin', 198440, 'brand', 'acetaminophen 500mg tablet'),
    ('crocin 500', 198440, 'brand', 'acetaminophen 500mg tablet'),
    ('crocin 650', 198444, 'brand', 'acetaminophen 650mg tablet'),
    ('dolo', 198444, 'brand', 'acetaminophen 650mg tablet'),
    ('dolo 650', 198444, 'brand', 'acetaminophen 650mg tablet'),
    ('calpol', 198440, 'brand', 'acetaminophen 500mg tablet'),
    ('calpol 500', 198440, 'brand', 'acetaminophen 500mg tablet'),
    ('calpol 650', 198444, 'brand', 'acetaminophen 650mg tablet'),
    ('panadol', 198440, 'brand', 'acetaminophen 500mg tablet'),
    ('glucophage', 860975, 'brand', 'metformin 500mg tablet'),
    ('glucophage 500', 860975, 'brand', 'metformin 500mg tablet'),
    ('glucophage 850', 861010, 'brand', 'metformin 850mg tablet'),
    ('glucophage 1000', 861004, 'brand', 'metformin 1000mg tablet'),
    ('lipitor', 617310, 'brand', 'atorvastatin 20mg tablet'),
    ('lipitor 10', 617310, 'brand', 'atorvastatin tablet'),
    ('lipitor 20', 617310, 'brand', 'atorvastatin 20mg tablet'),
    ('lipitor 40', 617311, 'brand', 'atorvastatin 40mg tablet'),
    ('lipitor 80', 259255, 'brand', 'atorvastatin 80mg tablet')
) AS v(alias, med_id, atype, notes)
ON CONFLICT (alias_name) DO NOTHING;

