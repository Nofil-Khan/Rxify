-- =============================================================================
-- Rxify — Seed Data for Demo & Testing
-- Usage: psql -U postgres -d rxify -f database/seed.sql
-- =============================================================================

-- ── 1. Demo Hospital ─────────────────────────────────────────────────────────
INSERT INTO hospital (name, email, password_hash, phone, address, city, state, registration_number)
VALUES (
  'City General Hospital',
  'admin@citygeneral.com',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', -- password123
  '+1-555-0100',
  '100 Healthcare Way',
  'Metro City',
  'CA',
  'REG-CGH-9912'
) ON CONFLICT DO NOTHING;

-- ── 2. Demo Dispensary ───────────────────────────────────────────────────────
-- Demo login: dispensary@citygeneral.com / password123
INSERT INTO dispensary (hospital_id, name, email, password_hash, phone, location, operating_hours, avg_prep_minutes)
VALUES (
  1,
  'City General Main Pharmacy',
  'dispensary@citygeneral.com',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', -- password123
  '+1-555-0199',
  'Ground Floor, Counter 2',
  '08:00 - 20:00 Daily',
  15
) ON CONFLICT DO NOTHING;

-- ── 3. Demo Medicines Catalog ────────────────────────────────────────────────
INSERT INTO medicine (generic_name, brand_name, category, strength, form)
VALUES
  ('Amoxicillin', 'Amoxil', 'Antibiotic', '500mg', 'CAPSULE'),
  ('Paracetamol', 'Panadol', 'Analgesic', '500mg', 'TABLET'),
  ('Ibuprofen', 'Advil', 'NSAID', '400mg', 'TABLET'),
  ('Metformin', 'Glucophage', 'Antidiabetic', '850mg', 'TABLET'),
  ('Omeprazole', 'Prilosec', 'Antacid / PPI', '20mg', 'CAPSULE'),
  ('Atorvastatin', 'Lipitor', 'Statin / Cholesterol', '20mg', 'TABLET'),
  ('Azithromycin', 'Zithromax', 'Antibiotic', '250mg', 'TABLET'),
  ('Cetirizine', 'Zyrtec', 'Antihistamine', '10mg', 'TABLET'),
  ('Salbutamol', 'Ventolin', 'Bronchodilator', '100mcg', 'OTHER'),
  ('Ciprofloxacin', 'Cipro', 'Antibiotic', '500mg', 'TABLET')
ON CONFLICT DO NOTHING;

-- ── 4. Initial Dispensary Stock ──────────────────────────────────────────────
-- Populate stock for City General Main Pharmacy (dispensary_id = 1)
INSERT INTO inventory_dispensary_stock (dispensary_id, medicine_id, available_quantity, reserved_quantity, reorder_level, unit)
VALUES
  (1, 1, 150, 0, 20, 'capsules'),
  (1, 2, 500, 0, 50, 'tablets'),
  (1, 3, 200, 0, 30, 'tablets'),
  (1, 4, 300, 0, 25, 'tablets'),
  (1, 5, 80,  0, 15, 'capsules')
ON CONFLICT (dispensary_id, medicine_id) DO UPDATE 
SET available_quantity = EXCLUDED.available_quantity,
    updated_at = NOW();
