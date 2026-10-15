-- =============================================================================
-- Migration: Indian Specialty & Respiratory Medicines Catalog Expansion
-- Adds common Indian clinical brands (Doxofylline, Acebrophylline, Budesonide combos,
-- Rabeprazole+Domperidone, Montelukast+Levocetirizine, Indomethacin SR)
-- and their OCR/handwriting aliases.
-- =============================================================================

INSERT INTO medicine (medicine_id, generic_name, brand_name, strength, form, category, rxnorm_name)
VALUES
    (9000001, 'doxofylline', 'Doxolin 400', '400 MG', 'TABLET', 'Respiratory', 'Doxofylline 400 MG Oral Tablet [Doxolin 400]'),
    (9000002, 'doxofylline', 'Doxolin 650', '650 MG', 'TABLET', 'Respiratory', 'Doxofylline 650 MG Oral Tablet [Doxolin 650]'),
    (9000003, 'doxofylline', 'Doxoril 400', '400 MG', 'TABLET', 'Respiratory', 'Doxofylline 400 MG Oral Tablet [Doxoril 400]'),
    (9000004, 'rabeprazole / domperidone', 'Radyle-D', '20 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Rabeprazole sodium 20 MG / Domperidone 30 MG Extended-Release Oral Capsule [Radyle-D]'),
    (9000005, 'rabeprazole / domperidone', 'Razo-D', '20 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Rabeprazole sodium 20 MG / Domperidone 30 MG Oral Capsule [Razo-D]'),
    (9000006, 'rabeprazole / domperidone', 'Rablet-D', '20 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Rabeprazole sodium 20 MG / Domperidone 30 MG Oral Capsule [Rablet-D]'),
    (9000007, 'acebrophylline', 'Pulmoclear', '100 MG', 'CAPSULE', 'Respiratory', 'Acebrophylline 100 MG Oral Capsule [Pulmoclear]'),
    (9000008, 'acebrophylline', 'Polluton', '100 MG', 'TABLET', 'Respiratory', 'Acebrophylline 100 MG Oral Tablet [Polluton]'),
    (9000009, 'montelukast / levocetirizine', 'Montek-LC', '10 MG / 5 MG', 'TABLET', 'Respiratory', 'Montelukast 10 MG / Levocetirizine 5 MG Oral Tablet [Montek-LC]'),
    (9000010, 'montelukast / levocetirizine', 'Stonclos', '10 MG / 5 MG', 'TABLET', 'Respiratory', 'Montelukast 10 MG / Levocetirizine 5 MG Oral Tablet [Stonclos]'),
    (9000011, 'indomethacin', 'Indocap 100', '100 MG', 'CAPSULE', 'Analgesics', 'Indomethacin 100 MG Sustained-Release Oral Capsule [Indocap 100]'),
    (9000012, 'indomethacin', 'Indoclo 100', '100 MG', 'TABLET', 'Analgesics', 'Indomethacin 100 MG Oral Tablet [Indoclo 100]'),
    (9000013, 'budesonide', 'Buditone N', '400 MCG', 'OTHER', 'Respiratory', 'Budesonide 400 MCG Inhalation Powder [Buditone N]'),
    (9000014, 'budesonide', 'Budecort 400', '400 MCG', 'OTHER', 'Respiratory', 'Budesonide 400 MCG Inhalation Respule [Budecort 400]')
ON CONFLICT (medicine_id) DO UPDATE
SET generic_name = EXCLUDED.generic_name,
    brand_name = EXCLUDED.brand_name,
    strength = EXCLUDED.strength,
    form = EXCLUDED.form,
    category = EXCLUDED.category,
    rxnorm_name = EXCLUDED.rxnorm_name;

-- Brand & handwriting aliases
INSERT INTO medicine_alias (alias_name, medicine_id, alias_type, notes)
VALUES
    ('doxolin', 9000001, 'brand', 'Doxofylline 400mg standard brand'),
    ('doxolin 400', 9000001, 'brand', 'Doxofylline 400mg with strength'),
    ('doxoril', 9000003, 'brand', 'Doxofylline brand'),
    ('doxiflo', 9000001, 'brand', 'Doxofylline brand'),
    ('radyle', 9000004, 'brand', 'Rabeprazole + Domperidone brand'),
    ('radyle d', 9000004, 'brand', 'Rabeprazole + Domperidone brand'),
    ('cap radyle d', 9000004, 'brand', 'Rabeprazole + Domperidone with form prefix'),
    ('razo-d', 9000005, 'brand', 'Rabeprazole + Domperidone brand'),
    ('rablet-d', 9000006, 'brand', 'Rabeprazole + Domperidone brand'),
    ('pulmoclear', 9000007, 'brand', 'Acebrophylline brand'),
    ('polluton', 9000008, 'brand', 'Acebrophylline brand / OCR variant'),
    ('montek-lc', 9000009, 'brand', 'Montelukast + Levocetirizine brand'),
    ('stonclos', 9000010, 'brand', 'Montelukast + Levocetirizine brand / OCR variant'),
    ('indocap', 9000011, 'brand', 'Indomethacin SR brand'),
    ('indocap 100', 9000011, 'brand', 'Indomethacin SR 100mg'),
    ('indoclo', 9000012, 'ocr_variant', 'Indomethacin / Indocap OCR misread'),
    ('indoclo 100', 9000012, 'ocr_variant', 'Indomethacin / Indocap OCR misread with strength'),
    ('buditone', 9000013, 'brand', 'Budesonide respiratory brand'),
    ('buditone n', 9000013, 'brand', 'Budesonide respiratory brand'),
    ('buditone n syrup', 9000013, 'ocr_variant', 'Budesonide with syrup modifier'),
    ('budecort', 9000014, 'brand', 'Budesonide 400mcg brand'),
    ('budecort 400', 9000014, 'brand', 'Budesonide 400mcg brand')
ON CONFLICT (alias_name) DO UPDATE
SET medicine_id = EXCLUDED.medicine_id,
    notes = EXCLUDED.notes;
