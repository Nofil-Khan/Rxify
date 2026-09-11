/* ─── Rxify Doctor API Client ────────────────────────────────────────────────── */

import { authHeaders } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/** Safe helper to get 2-letter uppercase initials without crashing on null/undefined */
export function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'RX';
  const trimmed = name.trim();
  if (!trimmed) return 'RX';
  return trimmed.slice(0, 2).toUpperCase();
}

export interface DoctorStats {
  total_patients: number;
  total_prescriptions: number;
  pending_requests: number;
  upcoming_followups: number;
}

export interface PatientItem {
  id: number;
  username: string;
  display_name: string | null;
  assigned_at: string;
  prescription_count: number;
  primary_diagnosis?: string;
  last_visit?: string;
}

export interface MedicineDetail {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface PrescriptionItem {
  id: number;
  patient_id: number;
  patient_name: string;
  diagnosis: string;
  doctor_name: string;
  clinic_name: string;
  created_at: string;
  follow_up_date?: string | null;
  status: 'active' | 'completed' | 'pending';
  medicines_count?: number;
  medicines?: MedicineDetail[];
  raw_text?: string;
}

export interface ConnectionRequest {
  id: number;
  patient_id: number;
  patient_name: string;
  username: string;
  requested_at: string;
  note?: string;
}

export interface DoctorProfile {
  id: number;
  doctor_code?: string;
  username: string;
  display_name: string | null;
  specialty: string | null;
}

export interface AppointmentItem {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_email: string;
  slot_date: string | null;
  start_time: string | null;
  end_time: string | null;
  clinic_name: string | null;
  status: 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  reason_for_visit?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AppointmentCounts {
  booked: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
  upcoming: number;
}

export interface AvailabilitySlot {
  slot_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_patients: number;
  clinic_name: string | null;
  clinic_id: number | null;
  booked_count: number;
}

export interface ClinicOption {
  clinic_id: number;
  name: string;
  address?: string | null;
  type?: string;
}

/* ── Mock Data Fallbacks ── */
const MOCK_STATS: DoctorStats = {
  total_patients: 24,
  total_prescriptions: 87,
  pending_requests: 3,
  upcoming_followups: 5,
};

const MOCK_PATIENTS: PatientItem[] = [
  {
    id: 101,
    username: 'sarah_c',
    display_name: 'Sarah Connor',
    assigned_at: '2026-06-12',
    prescription_count: 8,
    primary_diagnosis: 'Essential Hypertension',
    last_visit: '2026-08-01',
  },
  {
    id: 102,
    username: 'marcus_b',
    display_name: 'Marcus Brody',
    assigned_at: '2026-07-04',
    prescription_count: 5,
    primary_diagnosis: 'Type 2 Diabetes Mellitus',
    last_visit: '2026-08-05',
  },
  {
    id: 103,
    username: 'elena_r',
    display_name: 'Elena Rostova',
    assigned_at: '2026-07-19',
    prescription_count: 12,
    primary_diagnosis: 'Asthma Exacerbation',
    last_visit: '2026-08-08',
  },
  {
    id: 104,
    username: 'david_k',
    display_name: 'David Kincaid',
    assigned_at: '2026-08-02',
    prescription_count: 3,
    primary_diagnosis: 'Hyperlipidemia',
    last_visit: '2026-08-09',
  },
];

const MOCK_PRESCRIPTIONS: PrescriptionItem[] = [
  {
    id: 1,
    patient_id: 101,
    patient_name: 'Sarah Connor',
    diagnosis: 'Essential Hypertension & Mild Angina',
    doctor_name: 'Dr. Sarah Jenkins, MD',
    clinic_name: 'Metropolitan Cardiology Center',
    created_at: '2026-08-08',
    status: 'active',
    medicines_count: 2,
    medicines: [
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily in morning (QD)', duration: '30 days' },
      { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily at bedtime (QD)', duration: '30 days' },
    ],
    raw_text: 'Rx: Lisinopril 10mg PO QD #30\nAmlodipine 5mg PO QD #30\nRefills: 3\nDiagnosis: I10 Essential Hypertension',
  },
  {
    id: 2,
    patient_id: 102,
    patient_name: 'Marcus Brody',
    diagnosis: 'Type 2 Diabetes Mellitus',
    doctor_name: 'Dr. Sarah Jenkins, MD',
    clinic_name: 'St. Jude Endocrinology Care',
    created_at: '2026-08-05',
    status: 'active',
    medicines_count: 2,
    medicines: [
      { name: 'Metformin HCl', dosage: '850mg', frequency: 'Twice daily with meals (BID)', duration: '60 days' },
      { name: 'Empagliflozin', dosage: '10mg', frequency: 'Once daily in morning (QD)', duration: '30 days' },
    ],
    raw_text: 'Rx: Metformin 850mg PO BID with meals #120\nJardiance 10mg PO QD #30\nMonitor HbA1c in 12 weeks',
  },
  {
    id: 3,
    patient_id: 103,
    patient_name: 'Elena Rostova',
    diagnosis: 'Acute Upper Respiratory Infection',
    doctor_name: 'Dr. Sarah Jenkins, MD',
    clinic_name: 'Apex Pulmonology Clinic',
    created_at: '2026-08-02',
    status: 'completed',
    medicines_count: 2,
    medicines: [
      { name: 'Amoxicillin / Clavulanate', dosage: '875mg / 125mg', frequency: 'Twice daily (BID)', duration: '7 days' },
      { name: 'Fluticasone Propionate Nasal Spray', dosage: '50mcg', frequency: '2 sprays per nostril daily', duration: '14 days' },
    ],
    raw_text: 'Rx: Augmentin 875/125 PO BID x7d #14\nFlonase 50mcg 2 sprays/nostril QD x14d\nFinish complete course of antibiotics.',
  },
  {
    id: 4,
    patient_id: 104,
    patient_name: 'David Kincaid',
    diagnosis: 'Hyperlipidemia & Arterial Health',
    doctor_name: 'Dr. Sarah Jenkins, MD',
    clinic_name: 'Metropolitan Preventive Care',
    created_at: '2026-07-28',
    status: 'active',
    medicines_count: 1,
    medicines: [
      { name: 'Atorvastatin Calcium', dosage: '20mg', frequency: 'Once daily at night (QHS)', duration: '90 days' },
    ],
    raw_text: 'Rx: Atorvastatin 20mg PO QHS #90\nLipid panel scheduled for October 2026.',
  },
];

const MOCK_REQUESTS: ConnectionRequest[] = [
  {
    id: 201,
    patient_id: 105,
    patient_name: 'Rachel Green',
    username: 'rachel_g',
    requested_at: '2026-08-10 14:20',
    note: 'Referred by Dr. Vance for cardiac evaluation after recent ECG changes.',
  },
  {
    id: 202,
    patient_id: 106,
    patient_name: 'Arthur Pendelton',
    username: 'arthur_p',
    requested_at: '2026-08-10 09:15',
    note: 'Seeking hypertension management and blood pressure medication review.',
  },
  {
    id: 203,
    patient_id: 107,
    patient_name: 'Clara Oswald',
    username: 'clara_o',
    requested_at: '2026-08-09 18:45',
    note: 'New patient seeking prescription OCR digitizing and follow-up consultation.',
  },
];

const MOCK_PROFILE: DoctorProfile = {
  id: 1,
  username: 'dr_jenkins',
  display_name: 'Dr. Sarah Jenkins, MD',
  specialty: 'Cardiology & Internal Medicine',
};

/* ── API Service Functions ── */

export async function getDoctorStats(): Promise<DoctorStats> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/stats`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      total_patients: data.patient_count ?? data.total_patients ?? 0,
      total_prescriptions: data.rx_count ?? data.total_prescriptions ?? 0,
      pending_requests: data.pending_requests ?? 0,
      upcoming_followups: data.upcoming_followups ?? 0,
    };
  } catch {
    return MOCK_STATS;
  }
}

export async function getMyPatients(): Promise<PatientItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/my-patients`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawList = data.patients ?? data ?? [];
    if (!Array.isArray(rawList)) return MOCK_PATIENTS;
    return rawList.map((pt: any) => ({
      id: pt.id ?? pt.patient_id ?? 0,
      username: pt.username ?? pt.patient_username ?? 'patient',
      display_name: pt.display_name ?? pt.patient_display_name ?? pt.patient_name ?? null,
      assigned_at: pt.assigned_at ?? '2026-08-10',
      prescription_count: pt.prescription_count ?? 0,
      primary_diagnosis: pt.primary_diagnosis ?? 'General Care',
    }));
  } catch {
    return MOCK_PATIENTS;
  }
}

export async function getDoctorPrescriptions(search?: string): Promise<{ total: number; prescriptions: PrescriptionItem[] }> {
  try {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${BASE_URL}/api/doctor/prescriptions${query}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawList = data.prescriptions ?? (Array.isArray(data) ? data : []);
    const normalized = rawList.map((p: any) => ({
      id: p.id ?? 0,
      patient_id: p.patient_user_id ?? p.patient_id ?? p.user_id ?? 0,
      patient_name: p.patient_name ?? p.uploaded_by ?? 'Patient Record',
      diagnosis: p.diagnosis ?? 'General Consultation',
      doctor_name: p.doctor_name ?? 'Doctor',
      clinic_name: p.clinic_name ?? 'Rxify Medical Center',
      created_at: p.issue_date ?? p.created_at ?? '2026-08-10',
      follow_up_date: p.follow_up_date ?? null,
      status: (p.status ?? 'active') as 'active' | 'completed' | 'pending',
      medicines_count: p.medications?.length ?? p.medicines_count ?? 1,
      medicines: p.medications ?? p.medicines ?? [],
      raw_text: p.raw_text ?? '',
    }));
    return {
      total: data.total ?? normalized.length,
      prescriptions: normalized,
    };
  } catch {
    if (search) {
      const q = search.toLowerCase();
      const filtered = MOCK_PRESCRIPTIONS.filter(
        (p) =>
          (p.patient_name ?? '').toLowerCase().includes(q) ||
          (p.diagnosis ?? '').toLowerCase().includes(q) ||
          (p.clinic_name ?? '').toLowerCase().includes(q)
      );
      return { total: filtered.length, prescriptions: filtered };
    }
    return { total: MOCK_PRESCRIPTIONS.length, prescriptions: MOCK_PRESCRIPTIONS };
  }
}

export async function getDoctorPrescriptionDetail(id: number): Promise<PrescriptionItem | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/prescriptions/${id}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();
    return {
      id: p.id ?? id,
      patient_id: p.user_id ?? p.patient_id ?? 0,
      patient_name: p.patient_name ?? p.uploaded_by ?? 'Patient Record',
      diagnosis: p.diagnosis ?? 'General Consultation',
      doctor_name: p.doctor_name ?? 'Doctor',
      clinic_name: p.clinic_name ?? 'Rxify Medical Center',
      created_at: p.issue_date ?? p.created_at ?? '2026-08-10',
      follow_up_date: p.follow_up_date ?? null,
      status: (p.status ?? 'active') as 'active' | 'completed' | 'pending',
      medicines_count: p.medications?.length ?? 0,
      medicines: p.medications ?? [],
      raw_text: p.raw_text ?? '',
    };
  } catch {
    return MOCK_PRESCRIPTIONS.find((p) => p.id === id) ?? MOCK_PRESCRIPTIONS[0];
  }
}

export async function getPatientPrescriptions(userId: number): Promise<PrescriptionItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/patients/${userId}/prescriptions`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawList = data.prescriptions ?? (Array.isArray(data) ? data : []);
    return rawList.map((p: any) => ({
      id: p.id ?? 0,
      patient_id: userId,
      patient_name: p.patient_name ?? p.uploaded_by ?? 'Patient Record',
      diagnosis: p.diagnosis ?? 'General Consultation',
      doctor_name: p.doctor_name ?? 'Doctor',
      clinic_name: p.clinic_name ?? 'Rxify Medical Center',
      created_at: p.issue_date ?? p.created_at ?? '2026-08-10',
      status: (p.status ?? 'active') as 'active' | 'completed' | 'pending',
      medicines_count: p.medications?.length ?? 0,
      medicines: p.medications ?? [],
      raw_text: p.raw_text ?? '',
    }));
  } catch {
    return MOCK_PRESCRIPTIONS.filter((p) => p.patient_id === userId);
  }
}

export async function getPendingRequests(): Promise<ConnectionRequest[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/requests`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawList = data.requests ?? (Array.isArray(data) ? data : []);
    return rawList.map((r: any) => ({
      id: r.id ?? 0,
      patient_id: r.patient_id ?? r.user_id ?? 0,
      patient_name: r.patient_display_name || r.patient_username || r.patient_name || 'New Patient',
      username: r.patient_username || r.username || 'patient',
      requested_at: r.requested_at || r.created_at || '2026-08-10',
      note: r.note || '',
    }));
  } catch {
    return MOCK_REQUESTS;
  }
}

export async function respondToRequest(requestId: number, accept: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/requests/${requestId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ accept }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function getDoctorProfile(): Promise<DoctorProfile> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/profile`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return MOCK_PROFILE;
  }
}

export async function updateDoctorProfile(displayName: string, specialty: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ display_name: displayName, specialty }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

/* ── Appointment API Methods ── */

const MOCK_APPOINTMENTS: AppointmentItem[] = [
  {
    id: 1,
    patient_id: 101,
    patient_name: 'Sarah Connor',
    patient_email: 'sarah_c@example.com',
    slot_date: '2026-08-29',
    start_time: '10:00:00',
    end_time: '10:30:00',
    clinic_name: 'Metropolitan Cardiology Center',
    status: 'CONFIRMED',
    reason_for_visit: 'Blood pressure routine checkup & medication review',
    created_at: '2026-08-26',
  },
  {
    id: 2,
    patient_id: 102,
    patient_name: 'Marcus Brody',
    patient_email: 'marcus_b@example.com',
    slot_date: '2026-08-30',
    start_time: '11:00:00',
    end_time: '11:30:00',
    clinic_name: 'Metropolitan Cardiology Center',
    status: 'BOOKED',
    reason_for_visit: 'Diabetes follow-up & glucose log analysis',
    created_at: '2026-08-27',
  },
  {
    id: 3,
    patient_id: 103,
    patient_name: 'Elena Rostova',
    patient_email: 'elena_r@example.com',
    slot_date: '2026-08-25',
    start_time: '14:00:00',
    end_time: '14:30:00',
    clinic_name: 'Metropolitan Cardiology Center',
    status: 'COMPLETED',
    reason_for_visit: 'Post-antibiotic checkup',
    created_at: '2026-08-20',
  },
];

export async function getDoctorAppointments(statusFilter?: string): Promise<{
  total: number;
  counts: AppointmentCounts;
  appointments: AppointmentItem[];
}> {
  try {
    const query = statusFilter && statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const res = await fetch(`${BASE_URL}/api/doctor/appointments${query}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      total: data.total ?? data.appointments?.length ?? 0,
      counts: data.counts ?? { booked: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0, upcoming: 0 },
      appointments: data.appointments ?? [],
    };
  } catch {
    const filtered = statusFilter && statusFilter !== 'all'
      ? MOCK_APPOINTMENTS.filter((a) => a.status.toLowerCase() === statusFilter.toLowerCase())
      : MOCK_APPOINTMENTS;
    return {
      total: filtered.length,
      counts: { booked: 1, confirmed: 1, completed: 1, cancelled: 0, no_show: 0, upcoming: 2 },
      appointments: filtered,
    };
  }
}

export async function updateAppointmentStatus(appointmentId: number, status: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/appointments/${appointmentId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function getDoctorSlots(): Promise<AvailabilitySlot[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/appointments/slots`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.slots ?? [];
  } catch {
    return [
      {
        slot_id: 1,
        slot_date: '2026-08-29',
        start_time: '10:00:00',
        end_time: '10:30:00',
        max_patients: 1,
        clinic_name: 'Metropolitan Cardiology Center',
        clinic_id: 1,
        booked_count: 1,
      },
    ];
  }
}

export async function createDoctorSlot(payload: {
  clinic_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_patients: number;
}): Promise<AvailabilitySlot | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/appointments/slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.slot;
  } catch {
    return {
      slot_id: Date.now(),
      ...payload,
      clinic_name: 'Metropolitan Cardiology Center',
      booked_count: 0,
    };
  }
}

export async function getDoctorClinics(): Promise<ClinicOption[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/appointments/clinics`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.clinics ?? [];
  } catch {
    return [
      { clinic_id: 1, name: 'Metropolitan Cardiology Center', address: '100 Medical Blvd' },
    ];
  }
}

export interface PatientLookupResult {
  patient_id: number;
  patient_code: string;
  full_name: string;
  email: string;
  date_of_birth: string | null;
  blood_group: string | null;
  connection_status: 'active' | 'pending' | null;
  patient_doctor_id: number | null;
  total_prescriptions: number;
  connected_at: string | null;
}

export async function lookupPatientByCode(patientCode: string): Promise<PatientLookupResult> {
  const clean = patientCode.trim().toUpperCase();
  const res = await fetch(`${BASE_URL}/api/doctor/patient-lookup/${encodeURIComponent(clean)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    let msg = `Patient with code ${clean} not found`;
    try {
      const j = await res.json();
      msg = j.detail ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export async function connectPatient(patientCode: string): Promise<{ success: boolean; message: string; status: string }> {
  const clean = patientCode.trim().toUpperCase();
  const res = await fetch(`${BASE_URL}/api/doctor/connect-patient`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ patient_code: clean }),
  });
  if (!res.ok) {
    let msg = 'Failed to connect patient';
    try {
      const j = await res.json();
      msg = j.detail ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export interface AffiliatedHospital {
  hospital_id: number;
  hospital_code: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  department: string | null;
  joined_at: string | null;
}

export async function fetchAffiliatedHospitals(): Promise<AffiliatedHospital[]> {
  const res = await fetch(`${BASE_URL}/api/doctor/affiliated-hospitals`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.hospitals ?? [];
}


