import { describe, it, expect } from 'vitest';
import {
  PatientSchema,
  DoctorSchema,
  MedicineSchema,
  InventoryItemSchema,
  PrescriptionSchema,
} from './types';
import { INITIAL_PRESCRIPTIONS, INITIAL_INVENTORY } from './mocks/mockDb';

describe('Dispensary Zod Schema Validations', () => {
  it('validates Patient and Doctor schemas', () => {
    const patient = PatientSchema.parse({
      id: 'p-1',
      name: 'Aarav Raj',
      age: 23,
      gender: 'Male',
      initials: 'AR',
    });
    expect(patient.name).toBe('Aarav Raj');

    const doctor = DoctorSchema.parse({
      id: 'd-1',
      name: 'Dr. N. Verma',
      specialty: 'ENT',
    });
    expect(doctor.specialty).toBe('ENT');
  });

  it('validates Medicine and InventoryItem schemas with batches', () => {
    const medicine = MedicineSchema.parse({
      id: 'med-amox',
      name: 'Amoxicillin',
      strength: '500 mg',
      form: 'Capsule',
    });
    expect(medicine.form).toBe('Capsule');

    const inv = InventoryItemSchema.parse(INITIAL_INVENTORY['med-amox']);
    expect(inv.available).toBe(40);
    expect(inv.batches.length).toBeGreaterThan(0);
    expect(inv.batches[0].batchNumber).toBe('AMX-2026-B9');
  });

  it('validates Prescription schema against Aarav Raj exact reference', () => {
    const aaravRx = INITIAL_PRESCRIPTIONS[0];
    const parsed = PrescriptionSchema.parse(aaravRx);
    expect(parsed.rxNumber).toBe('RX-2026-1042');
    expect(parsed.patient.name).toBe('Aarav Raj');
    expect(parsed.diagnosis).toBe('Acute Sinusitis');
    expect(parsed.items.length).toBe(3);
    expect(parsed.items[0].medicine.name).toBe('Amoxicillin');
    expect(parsed.items[0].inStock).toBe(40);
    expect(parsed.items[1].medicine.name).toBe('Paracetamol');
    expect(parsed.items[1].inStock).toBe(5);
    expect(parsed.items[2].medicine.name).toBe('Pantoprazole');
    expect(parsed.items[2].inStock).toBe(0);
  });
});

