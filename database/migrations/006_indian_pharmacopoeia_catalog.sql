-- =============================================================================
-- Migration 006: Indian Pharmacopoeia & Essential Clinical Medicines Catalog
-- Seeds the essential clinical drug molecules and combinations prescribed in
-- Indian clinical practice across Respiratory, Gastroenterology, Cardiology,
-- Diabetology, Antibiotics, and Pain Management.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. Insert Core Indian Clinical Medicines
-- ---------------------------------------------------------------------------
INSERT INTO medicine (medicine_id, generic_name, brand_name, strength, form, category, rxnorm_name)
VALUES
    -- Respiratory
    (9000101, 'doxofylline', 'Doxolin 400', '400 MG', 'TABLET', 'Respiratory', 'Doxofylline 400 MG Oral Tablet [Doxolin 400]'),
    (9000102, 'doxofylline', 'Doxolin 650', '650 MG', 'TABLET', 'Respiratory', 'Doxofylline 650 MG Oral Tablet [Doxolin 650]'),
    (9000103, 'acebrophylline', 'Pulmoclear', '100 MG', 'CAPSULE', 'Respiratory', 'Acebrophylline 100 MG Oral Capsule [Pulmoclear]'),
    (9000104, 'acebrophylline', 'AB Phylline 100', '100 MG', 'CAPSULE', 'Respiratory', 'Acebrophylline 100 MG Oral Capsule [AB Phylline]'),
    (9000105, 'budesonide / formoterol', 'Foracort 200', '200 MCG / 6 MCG', 'OTHER', 'Respiratory', 'Budesonide 200 MCG / Formoterol fumarate 6 MCG Inhaler [Foracort 200]'),
    (9000106, 'budesonide / formoterol', 'Foracort 400', '400 MCG / 6 MCG', 'OTHER', 'Respiratory', 'Budesonide 400 MCG / Formoterol fumarate 6 MCG Inhaler [Foracort 400]'),
    (9000107, 'levosalbutamol / ipratropium', 'Duolin Inhaler', '50 MCG / 20 MCG', 'OTHER', 'Respiratory', 'Levosalbutamol 50 MCG / Ipratropium bromide 20 MCG Inhalation [Duolin]'),
    (9000108, 'levosalbutamol / ipratropium', 'Duolin Respules', '1.25 MG / 500 MCG', 'OTHER', 'Respiratory', 'Levosalbutamol 1.25 MG / Ipratropium 500 MCG Respules [Duolin]'),
    (9000109, 'montelukast / levocetirizine', 'Montek-LC', '10 MG / 5 MG', 'TABLET', 'Respiratory', 'Montelukast sodium 10 MG / Levocetirizine dihydrochloride 5 MG [Montek-LC]'),
    (9000110, 'montelukast / levocetirizine', 'Montair-LC', '10 MG / 5 MG', 'TABLET', 'Respiratory', 'Montelukast sodium 10 MG / Levocetirizine dihydrochloride 5 MG [Montair-LC]'),
    (9000111, 'theophylline / etofylline', 'Deriphyllin Retard 150', '115 MG / 35 MG', 'TABLET', 'Respiratory', 'Etofylline 115 MG / Theophylline 35 MG Modified Release [Deriphyllin]'),
    (9000112, 'theophylline / etofylline', 'Deriphyllin Retard 300', '231 MG / 69 MG', 'TABLET', 'Respiratory', 'Etofylline 231 MG / Theophylline 69 MG Modified Release [Deriphyllin]'),
    (9000113, 'acetylcysteine', 'Mucinac 600', '600 MG', 'TABLET', 'Respiratory', 'Acetylcysteine 600 MG Effervescent Oral Tablet [Mucinac]'),
    (9000114, 'salbutamol', 'Asthalin 4', '4 MG', 'TABLET', 'Respiratory', 'Salbutamol 4 MG Oral Tablet [Asthalin]'),
    (9000115, 'salbutamol', 'Asthalin Inhaler', '100 MCG', 'OTHER', 'Respiratory', 'Salbutamol 100 MCG Inhalation [Asthalin]'),

    -- Gastroenterology & PPI Combinations
    (9000201, 'rabeprazole / domperidone', 'Razo-D', '20 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Rabeprazole 20 MG / Domperidone 30 MG Sustained Release [Razo-D]'),
    (9000202, 'rabeprazole / domperidone', 'Rablet-D', '20 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Rabeprazole 20 MG / Domperidone 30 MG Sustained Release [Rablet-D]'),
    (9000203, 'rabeprazole / domperidone', 'Rabicip-D', '20 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Rabeprazole 20 MG / Domperidone 30 MG Sustained Release [Rabicip-D]'),
    (9000204, 'pantoprazole / domperidone', 'Pan-D', '40 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Pantoprazole 40 MG / Domperidone 30 MG Sustained Release [Pan-D]'),
    (9000205, 'pantoprazole / domperidone', 'Pantocid-D', '40 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Pantoprazole 40 MG / Domperidone 30 MG Sustained Release [Pantocid-D]'),
    (9000206, 'omeprazole / domperidone', 'Omez-D', '20 MG / 10 MG', 'CAPSULE', 'Gastrointestinal', 'Omeprazole 20 MG / Domperidone 10 MG Oral Capsule [Omez-D]'),
    (9000207, 'esomeprazole / domperidone', 'Nexpro-D', '40 MG / 30 MG', 'CAPSULE', 'Gastrointestinal', 'Esomeprazole 40 MG / Domperidone 30 MG [Nexpro-D]'),
    (9000208, 'sucralfate / oxetacaine', 'Sucrafil-O Suspension', '1000 MG / 20 MG', 'SYRUP', 'Gastrointestinal', 'Sucralfate 1000 MG / Oxetacaine 20 MG per 10ml Oral Suspension'),
    (9000209, 'levosulpiride / rabeprazole', 'Razo-L', '75 MG / 20 MG', 'CAPSULE', 'Gastrointestinal', 'Levosulpiride 75 MG / Rabeprazole 20 MG [Razo-L]'),
    (9000210, 'ondansetron', 'Emeset 4', '4 MG', 'TABLET', 'Gastrointestinal', 'Ondansetron 4 MG Oral Tablet [Emeset]'),

    -- Cardiology & Hypertension Combinations
    (9000301, 'telmisartan / amlodipine', 'Telma-AM', '40 MG / 5 MG', 'TABLET', 'Cardiovascular', 'Telmisartan 40 MG / Amlodipine 5 MG Oral Tablet [Telma-AM]'),
    (9000302, 'telmisartan / hydrochlorothiazide', 'Telma-H', '40 MG / 12.5 MG', 'TABLET', 'Cardiovascular', 'Telmisartan 40 MG / Hydrochlorothiazide 12.5 MG [Telma-H]'),
    (9000303, 'telmisartan / chlorthalidone', 'Telma-CT 40/12.5', '40 MG / 12.5 MG', 'TABLET', 'Cardiovascular', 'Telmisartan 40 MG / Chlorthalidone 12.5 MG [Telma-CT]'),
    (9000304, 'amlodipine / atenolol', 'Amlong-A', '5 MG / 50 MG', 'TABLET', 'Cardiovascular', 'Amlodipine 5 MG / Atenolol 50 MG Oral Tablet [Amlong-A]'),
    (9000305, 'rosuvastatin / aspirin', 'Rosuvas-CV 10', '10 MG / 75 MG', 'CAPSULE', 'Cardiovascular', 'Rosuvastatin 10 MG / Aspirin 75 MG Oral Capsule [Rosuvas-CV]'),
    (9000306, 'atorvastatin / aspirin', 'Atorva-ASP 75', '10 MG / 75 MG', 'CAPSULE', 'Cardiovascular', 'Atorvastatin 10 MG / Aspirin 75 MG Oral Capsule [Atorva-ASP]'),

    -- Diabetes Combinations
    (9000401, 'glimepiride / metformin', 'Glycomet-GP 1', '1 MG / 500 MG', 'TABLET', 'Endocrine/Diabetes', 'Glimepiride 1 MG / Metformin 500 MG PR Tablet [Glycomet-GP 1]'),
    (9000402, 'glimepiride / metformin', 'Glycomet-GP 2', '2 MG / 500 MG', 'TABLET', 'Endocrine/Diabetes', 'Glimepiride 2 MG / Metformin 500 MG PR Tablet [Glycomet-GP 2]'),
    (9000403, 'glimepiride / metformin / voglibose', 'Voglimac-GM 1', '1 MG / 500 MG / 0.2 MG', 'TABLET', 'Endocrine/Diabetes', 'Glimepiride 1 MG / Metformin 500 MG / Voglibose 0.2 MG [Voglimac-GM]'),
    (9000404, 'glimepiride / metformin / voglibose', 'Voglimac-GM 2', '2 MG / 500 MG / 0.2 MG', 'TABLET', 'Endocrine/Diabetes', 'Glimepiride 2 MG / Metformin 500 MG / Voglibose 0.2 MG [Voglimac-GM]'),
    (9000405, 'teneligliptin / metformin', 'Teniva-M 20/500', '20 MG / 500 MG', 'TABLET', 'Endocrine/Diabetes', 'Teneligliptin 20 MG / Metformin 500 MG [Teniva-M]'),
    (9000406, 'dapagliflozin / metformin', 'Oxra-M 10/500', '10 MG / 500 MG', 'TABLET', 'Endocrine/Diabetes', 'Dapagliflozin 10 MG / Metformin 500 MG Extended Release [Oxra-M]'),

    -- Antibiotics & Anti-Infectives
    (9000501, 'cefixime / ofloxacin', 'Cefolac-OF', '200 MG / 200 MG', 'TABLET', 'Anti-Infective', 'Cefixime 200 MG / Ofloxacin 200 MG Oral Tablet [Cefolac-OF]'),
    (9000502, 'cefixime / ofloxacin', 'Mahacef-Plus', '200 MG / 200 MG', 'TABLET', 'Anti-Infective', 'Cefixime 200 MG / Ofloxacin 200 MG Oral Tablet [Mahacef-Plus]'),
    (9000503, 'amoxicillin / clavulanate', 'Augmentin 625 Duo', '500 MG / 125 MG', 'TABLET', 'Anti-Infective', 'Amoxicillin 500 MG / Clavulanic acid 125 MG [Augmentin 625 Duo]'),
    (9000504, 'amoxicillin / clavulanate', 'Moxikind-CV 625', '500 MG / 125 MG', 'TABLET', 'Anti-Infective', 'Amoxicillin 500 MG / Clavulanic acid 125 MG [Moxikind-CV 625]'),
    (9000505, 'amoxicillin / clavulanate', 'Clavam 625', '500 MG / 125 MG', 'TABLET', 'Anti-Infective', 'Amoxicillin 500 MG / Clavulanic acid 125 MG [Clavam 625]'),
    (9000506, 'azithromycin', 'Azithral 500', '500 MG', 'TABLET', 'Anti-Infective', 'Azithromycin 500 MG Oral Tablet [Azithral 500]'),
    (9000507, 'azithromycin', 'Azee 500', '500 MG', 'TABLET', 'Anti-Infective', 'Azithromycin 500 MG Oral Tablet [Azee 500]'),
    (9000508, 'faropenem', 'Farobact 200', '200 MG', 'TABLET', 'Anti-Infective', 'Faropenem sodium 200 MG Oral Tablet [Farobact 200]'),
    (9000509, 'ciprofloxacin / tinidazole', 'Ciplox-TZ', '500 MG / 600 MG', 'TABLET', 'Anti-Infective', 'Ciprofloxacin 500 MG / Tinidazole 600 MG [Ciplox-TZ]'),

    -- Pain Management & Anti-inflammatory
    (9000601, 'aceclofenac / paracetamol', 'Zerodol-P', '100 MG / 325 MG', 'TABLET', 'Analgesics', 'Aceclofenac 100 MG / Paracetamol 325 MG [Zerodol-P]'),
    (9000602, 'aceclofenac / paracetamol / serratiopeptidase', 'Zerodol-SP', '100 MG / 325 MG / 15 MG', 'TABLET', 'Analgesics', 'Aceclofenac 100 MG / Paracetamol 325 MG / Serratiopeptidase 15 MG [Zerodol-SP]'),
    (9000603, 'aceclofenac / paracetamol / serratiopeptidase', 'Hifenac-SP', '100 MG / 325 MG / 15 MG', 'TABLET', 'Analgesics', 'Aceclofenac 100 MG / Paracetamol 325 MG / Serratiopeptidase 15 MG [Hifenac-SP]'),
    (9000604, 'trypsin / chymotrypsin', 'Chymoral Forte', '100000 IU', 'TABLET', 'Analgesics', 'Trypsin-Chymotrypsin 100000 Armour Units [Chymoral Forte]'),
    (9000605, 'tramadol / paracetamol', 'Ultracet', '37.5 MG / 325 MG', 'TABLET', 'Analgesics', 'Tramadol hydrochloride 37.5 MG / Paracetamol 325 MG [Ultracet]'),
    (9000606, 'etoricoxib', 'Nucoxia 90', '90 MG', 'TABLET', 'Analgesics', 'Etoricoxib 90 MG Oral Tablet [Nucoxia 90]'),
    (9000607, 'etoricoxib', 'Etoshine 90', '90 MG', 'TABLET', 'Analgesics', 'Etoricoxib 90 MG Oral Tablet [Etoshine 90]')
ON CONFLICT (medicine_id) DO UPDATE
SET generic_name = EXCLUDED.generic_name,
    brand_name = EXCLUDED.brand_name,
    strength = EXCLUDED.strength,
    form = EXCLUDED.form,
    category = EXCLUDED.category,
    rxnorm_name = EXCLUDED.rxnorm_name;

-- ---------------------------------------------------------------------------
-- 2. Seed Brand Aliases and Phonetic Variants
-- ---------------------------------------------------------------------------
INSERT INTO medicine_alias (alias_name, medicine_id, alias_type, notes)
VALUES
    -- Respiratory
    ('doxolin', 9000101, 'brand', 'Doxofylline 400'),
    ('doxolin 400', 9000101, 'brand', 'Doxofylline 400'),
    ('doxoril', 9000101, 'brand', 'Doxofylline'),
    ('doxoril 400', 9000101, 'brand', 'Doxofylline'),
    ('doxiflo', 9000101, 'brand', 'Doxofylline'),
    ('doxolin 650', 9000102, 'brand', 'Doxofylline 650'),
    ('pulmoclear', 9000103, 'brand', 'Acebrophylline 100'),
    ('ab phylline', 9000104, 'brand', 'Acebrophylline'),
    ('pulrest', 9000103, 'brand', 'Acebrophylline'),
    ('macphylline', 9000103, 'brand', 'Acebrophylline'),
    ('foracort', 9000105, 'brand', 'Budesonide + Formoterol'),
    ('foracort 200', 9000105, 'brand', 'Budesonide + Formoterol 200'),
    ('foracort 400', 9000106, 'brand', 'Budesonide + Formoterol 400'),
    ('budetrol', 9000105, 'brand', 'Budesonide + Formoterol'),
    ('budetrol 400', 9000106, 'brand', 'Budesonide + Formoterol 400'),
    ('duolin', 9000107, 'brand', 'Levosalbutamol + Ipratropium'),
    ('duolin inhaler', 9000107, 'brand', 'Levosalbutamol + Ipratropium'),
    ('duolin respules', 9000108, 'brand', 'Levosalbutamol + Ipratropium respules'),
    ('montek-lc', 9000109, 'brand', 'Montelukast + Levocetirizine'),
    ('montek lc', 9000109, 'brand', 'Montelukast + Levocetirizine'),
    ('montair-lc', 9000110, 'brand', 'Montelukast + Levocetirizine'),
    ('montair lc', 9000110, 'brand', 'Montelukast + Levocetirizine'),
    ('montas-l', 9000109, 'brand', 'Montelukast + Levocetirizine'),
    ('telekast-l', 9000109, 'brand', 'Montelukast + Levocetirizine'),
    ('deriphyllin', 9000111, 'brand', 'Theophylline + Etofylline'),
    ('deriphyllin retard', 9000111, 'brand', 'Theophylline + Etofylline'),
    ('mucinac', 9000113, 'brand', 'Acetylcysteine 600'),
    ('mucinac 600', 9000113, 'brand', 'Acetylcysteine 600'),
    ('asthalin', 9000114, 'brand', 'Salbutamol 4'),
    ('asthalin inhaler', 9000115, 'brand', 'Salbutamol 100mcg'),

    -- Gastro / PPI combinations
    ('razo-d', 9000201, 'brand', 'Rabeprazole + Domperidone'),
    ('razo d', 9000201, 'brand', 'Rabeprazole + Domperidone'),
    ('rablet-d', 9000202, 'brand', 'Rabeprazole + Domperidone'),
    ('rablet d', 9000202, 'brand', 'Rabeprazole + Domperidone'),
    ('rabicip-d', 9000203, 'brand', 'Rabeprazole + Domperidone'),
    ('happi-d', 9000201, 'brand', 'Rabeprazole + Domperidone'),
    ('cyra-d', 9000201, 'brand', 'Rabeprazole + Domperidone'),
    ('pan-d', 9000204, 'brand', 'Pantoprazole + Domperidone'),
    ('pan d', 9000204, 'brand', 'Pantoprazole + Domperidone'),
    ('pantocid-d', 9000205, 'brand', 'Pantoprazole + Domperidone'),
    ('pantop-d', 9000204, 'brand', 'Pantoprazole + Domperidone'),
    ('omez-d', 9000206, 'brand', 'Omeprazole + Domperidone'),
    ('nexpro-d', 9000207, 'brand', 'Esomeprazole + Domperidone'),
    ('sucrafil-o', 9000208, 'brand', 'Sucralfate + Oxetacaine'),
    ('mucaine gel', 9000208, 'brand', 'Sucralfate + Oxetacaine suspension'),
    ('razo-l', 9000209, 'brand', 'Levosulpiride + Rabeprazole'),
    ('emeset', 9000210, 'brand', 'Ondansetron 4mg'),
    ('zofer', 9000210, 'brand', 'Ondansetron 4mg'),

    -- Cardio / Hypertension
    ('telma-am', 9000301, 'brand', 'Telmisartan + Amlodipine'),
    ('telmikind-am', 9000301, 'brand', 'Telmisartan + Amlodipine'),
    ('telpres-am', 9000301, 'brand', 'Telmisartan + Amlodipine'),
    ('telma-h', 9000302, 'brand', 'Telmisartan + HCTZ'),
    ('telmikind-h', 9000302, 'brand', 'Telmisartan + HCTZ'),
    ('telma-ct', 9000303, 'brand', 'Telmisartan + Chlorthalidone'),
    ('amlong-a', 9000304, 'brand', 'Amlodipine + Atenolol'),
    ('amlopres-at', 9000304, 'brand', 'Amlodipine + Atenolol'),
    ('rosuvas-cv', 9000305, 'brand', 'Rosuvastatin + Aspirin'),
    ('rozavel-a', 9000305, 'brand', 'Rosuvastatin + Aspirin'),
    ('atorva-asp', 9000306, 'brand', 'Atorvastatin + Aspirin'),

    -- Diabetes
    ('glycomet-gp 1', 9000401, 'brand', 'Glimepiride 1 + Metformin 500'),
    ('glycomet gp 1', 9000401, 'brand', 'Glimepiride 1 + Metformin 500'),
    ('glycomet-gp 2', 9000402, 'brand', 'Glimepiride 2 + Metformin 500'),
    ('glycomet gp 2', 9000402, 'brand', 'Glimepiride 2 + Metformin 500'),
    ('amaryl-m', 9000401, 'brand', 'Glimepiride + Metformin'),
    ('voglimac-gm 1', 9000403, 'brand', 'Glimepiride + Metformin + Voglibose 1'),
    ('voglimac-gm 2', 9000404, 'brand', 'Glimepiride + Metformin + Voglibose 2'),
    ('teniva-m', 9000405, 'brand', 'Teneligliptin + Metformin'),
    ('ziten-m', 9000405, 'brand', 'Teneligliptin + Metformin'),
    ('oxra-m', 9000406, 'brand', 'Dapagliflozin + Metformin'),

    -- Antibiotics
    ('cefolac-of', 9000501, 'brand', 'Cefixime + Ofloxacin'),
    ('mahacef-plus', 9000502, 'brand', 'Cefixime + Ofloxacin'),
    ('taxim-o of', 9000501, 'brand', 'Cefixime + Ofloxacin'),
    ('augmentin 625', 9000503, 'brand', 'Amoxicillin + Clavulanate 625'),
    ('moxikind-cv 625', 9000504, 'brand', 'Amoxicillin + Clavulanate 625'),
    ('clavam 625', 9000505, 'brand', 'Amoxicillin + Clavulanate 625'),
    ('azithral 500', 9000506, 'brand', 'Azithromycin 500'),
    ('azee 500', 9000507, 'brand', 'Azithromycin 500'),
    ('farobact', 9000508, 'brand', 'Faropenem 200'),
    ('faronem', 9000508, 'brand', 'Faropenem 200'),
    ('ciplox-tz', 9000509, 'brand', 'Ciprofloxacin + Tinidazole'),

    -- Pain Management
    ('zerodol-p', 9000601, 'brand', 'Aceclofenac + Paracetamol'),
    ('hifenac-p', 9000601, 'brand', 'Aceclofenac + Paracetamol'),
    ('zerodol-sp', 9000602, 'brand', 'Aceclofenac + Paracetamol + Serratiopeptidase'),
    ('hifenac-sp', 9000603, 'brand', 'Aceclofenac + Paracetamol + Serratiopeptidase'),
    ('chymoral forte', 9000604, 'brand', 'Trypsin-Chymotrypsin 100k IU'),
    ('ultracet', 9000605, 'brand', 'Tramadol + Paracetamol'),
    ('nucoxia 90', 9000606, 'brand', 'Etoricoxib 90'),
    ('etoshine 90', 9000607, 'brand', 'Etoricoxib 90')
ON CONFLICT (alias_name) DO UPDATE
SET medicine_id = EXCLUDED.medicine_id,
    notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- 3. Phonetic and Fuzzy Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_medicine_dmetaphone_generic
    ON medicine (dmetaphone(generic_name));

CREATE INDEX IF NOT EXISTS idx_medicine_dmetaphone_brand
    ON medicine (dmetaphone(brand_name));

CREATE INDEX IF NOT EXISTS idx_medicine_alias_dmetaphone
    ON medicine_alias (dmetaphone(alias_name));
