// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  PROTOTYPE SAMPLE DATA — not connected to the Rxify backend.
//     All names, dates, clinical details, and identifiers are fictional.
//     Replace this module with live API data when integrating the backend.
// ─────────────────────────────────────────────────────────────────────────────

export type MedStatus = 'Taking' | 'Completed' | 'Needs confirmation' | 'Paused';

export interface SampleMedication {
  id: string;
  name: string;
  strength: string;
  form: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: MedStatus;
  /** CSS hex color for the pill icon accent */
  accentColor: string;
}

export interface SamplePrescription {
  id: string;
  /** ISO date string */
  date: string;
  /** Human-readable date shown in the UI */
  displayDate: string;
  condition: string;
  visitType: string;
  /** Marks the chronologically current prescription */
  isLatest?: boolean;
  doctorName: string;
  doctorSpecialty: string;
  hospitalName: string;
  hospitalCity: string;
  doctorNotes: string;
  prescriptionCode: string;
  medications: SampleMedication[];
}

// ---------------------------------------------------------------------------

export const SAMPLE_PRESCRIPTIONS: SamplePrescription[] = [
  /* ── 0: Oldest ─────────────────────────────────────────────────────────── */
  {
    id: 'rx-proto-2026-0720',
    date: '2026-07-20',
    displayDate: 'Jul 20, 2026',
    condition: 'Hypertension — Baseline',
    visitType: 'OPD',
    doctorName: 'Dr. S. Mirza',
    doctorSpecialty: 'Cardiologist',
    hospitalName: 'National Heart Centre',
    hospitalCity: 'Karachi, PK',
    doctorNotes:
      'Blood pressure consistently elevated. Starting antihypertensive therapy. ' +
      'Lifestyle changes: low-sodium diet, daily walking.',
    prescriptionCode: 'RX-2026-0720-001',
    medications: [
      {
        id: 'mp-01', name: 'Amlodipine', strength: '5 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Once daily (morning)',
        duration: 'For 30 days', status: 'Completed', accentColor: '#3B82F6',
      },
    ],
  },

  /* ── 1: Older ───────────────────────────────────────────────────────────── */
  {
    id: 'rx-proto-2026-0915',
    date: '2026-09-15',
    displayDate: 'Sep 15, 2026',
    condition: 'Type 2 Diabetes — Routine',
    visitType: 'Follow-up',
    doctorName: 'Dr. A. Qureshi',
    doctorSpecialty: 'Endocrinologist',
    hospitalName: 'City Diabetes Care',
    hospitalCity: 'Lahore, PK',
    doctorNotes:
      'HbA1c slightly elevated at 7.8%. Adjusting Metformin dose. ' +
      'Increase physical activity to 30 min/day. Follow-up in 6 weeks.',
    prescriptionCode: 'RX-2026-0915-002',
    medications: [
      {
        id: 'mp-02', name: 'Metformin', strength: '500 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Twice daily (with meals)',
        duration: 'For 30 days', status: 'Completed', accentColor: '#10B981',
      },
      {
        id: 'mp-03', name: 'Glimepiride', strength: '2 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Once daily (morning)',
        duration: 'For 30 days', status: 'Completed', accentColor: '#F59E0B',
      },
    ],
  },

  /* ── 2: ACTIVE / LATEST ─────────────────────────────────────────────────── */
  {
    id: 'rx-proto-2026-1020',
    date: '2026-10-20',
    displayDate: 'Oct 20, 2026',
    condition: 'Hypertension + Type 2 Diabetes',
    visitType: 'OPD',
    isLatest: true,
    doctorName: 'Dr. Ayesha Khan',
    doctorSpecialty: 'Internal Medicine',
    hospitalName: 'Royal Care Hospital',
    hospitalCity: 'Lahore, PK',
    doctorNotes:
      'Take all medications as prescribed. Complete the full course. ' +
      'Monitor blood pressure twice daily and log readings. Avoid grapefruit with Atorvastatin. ' +
      'Follow up after 3 weeks.',
    prescriptionCode: 'RX-2026-1020-003',
    medications: [
      {
        id: 'mp-04', name: 'Amlodipine', strength: '5 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Once daily (morning)',
        duration: 'For 30 days', status: 'Taking', accentColor: '#3B82F6',
      },
      {
        id: 'mp-05', name: 'Metformin', strength: '1000 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Twice daily (with meals)',
        duration: 'For 30 days', status: 'Taking', accentColor: '#10B981',
      },
      {
        id: 'mp-06', name: 'Atorvastatin', strength: '20 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Once daily (bedtime)',
        duration: 'For 30 days', status: 'Needs confirmation', accentColor: '#F59E0B',
      },
      {
        id: 'mp-07', name: 'Aspirin', strength: '75 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Once daily (with food)',
        duration: 'Long term', status: 'Taking', accentColor: '#EF4444',
      },
    ],
  },

  /* ── 3: Newer (future / upcoming) ────────────────────────────────────────── */
  {
    id: 'rx-proto-2026-1110',
    date: '2026-11-10',
    displayDate: 'Nov 10, 2026',
    condition: 'Respiratory Infection',
    visitType: 'Emergency',
    doctorName: 'Dr. Usman Ali',
    doctorSpecialty: 'General Physician',
    hospitalName: 'Allied Hospital',
    hospitalCity: 'Faisalabad, PK',
    doctorNotes:
      'Short antibiotic course for upper respiratory tract infection. Rest and plenty of fluids. ' +
      'Return if fever persists beyond 3 days.',
    prescriptionCode: 'RX-2026-1110-004',
    medications: [
      {
        id: 'mp-08', name: 'Amoxicillin', strength: '500 mg', form: 'Capsule',
        dosage: '1 capsule', frequency: 'Thrice daily',
        duration: 'For 7 days', status: 'Taking', accentColor: '#EC4899',
      },
      {
        id: 'mp-09', name: 'Cetirizine', strength: '10 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Once daily (bedtime)',
        duration: 'For 5 days', status: 'Taking', accentColor: '#8B5CF6',
      },
    ],
  },

  /* ── 4: Future Follow-up ─────────────────────────────────────────────────── */
  {
    id: 'rx-proto-2026-1205',
    date: '2026-12-05',
    displayDate: 'Dec 05, 2026',
    condition: 'Cardiac & Lipid Review',
    visitType: 'Consultation',
    doctorName: 'Dr. Tariq Mahmood',
    doctorSpecialty: 'Cardiologist',
    hospitalName: 'Cardio Vascular Institute',
    hospitalCity: 'Islamabad, PK',
    doctorNotes:
      'Routine lipid profile review. Blood pressure stabilized. Continue current regimen.',
    prescriptionCode: 'RX-2026-1205-005',
    medications: [
      {
        id: 'mp-10', name: 'Rosuvastatin', strength: '10 mg', form: 'Tablet',
        dosage: '1 tablet', frequency: 'Once daily (night)',
        duration: 'For 60 days', status: 'Taking', accentColor: '#3B82F6',
      },
    ],
  },
];

/** Index of the prescription to display as "current" in the centre panel */
export const ACTIVE_INDEX = 2;

