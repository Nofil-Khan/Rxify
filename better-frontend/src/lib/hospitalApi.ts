/* ─── Rxify Hospital API Client ─────────────────────────────────────────────── */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function hHeaders(): Record<string, string> {
  const t = localStorage.getItem('rxify_hospital_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function go<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail ?? detail;
    } catch {
      /* */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export interface HospitalLoginResponse {
  access_token: string;
  token_type: string;
  role: 'HOSPITAL';
  hospital_id: number;
  hospital_code?: string;
  name: string;
}

export interface HospitalProfile {
  hospital_id: number;
  hospital_code?: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  registration_number: string | null;
  status: string;
}

export interface DashboardData {
  total_accesses: number;
  unique_patients_accessed: number;
  accesses_today: number;
  recent_activity: AuditEntry[];
}

export interface AuditEntry {
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

export interface PatientLookup {
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
  blood_group: string | null;
}

export interface Prescription {
  id: number;
  diagnosis: string | null;
  issue_date: string | null;
  follow_up_date: string | null;
  notes: string | null;
  clinic_name: string | null;
  doctor_name: string | null;
  doctor_specialty: string | null;
}

export interface Medication {
  id: number;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  date: string;
}

export interface HospitalDoctor {
  doctor_id: number;
  doctor_code: string;
  full_name: string;
  email: string;
  specialization: string | null;
  department: string | null;
  joined_at: string;
  active_patients_count: number;
}

export interface HospitalDispensary {
  dispensary_id: number;
  dispensary_code: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  operating_hours: string | null;
  avg_prep_minutes: number;
  status: string;
  created_at: string;
  total_inventory_items: number;
  active_queue_count: number;
}

export async function hospitalLogin(email: string, password: string): Promise<HospitalLoginResponse> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${BASE}/api/hospital/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return go<HospitalLoginResponse>(res);
}

export async function getHospitalMe(): Promise<HospitalProfile> {
  const res = await fetch(`${BASE}/api/hospital/me`, { headers: hHeaders() });
  return go<HospitalProfile>(res);
}

export async function getHospitalDashboard(): Promise<DashboardData> {
  const res = await fetch(`${BASE}/api/hospital/dashboard`, { headers: hHeaders() });
  return go<DashboardData>(res);
}

export async function lookupPatient(code: string): Promise<PatientLookup> {
  const res = await fetch(`${BASE}/api/hospital/patients/${code.toUpperCase()}`, { headers: hHeaders() });
  return go<PatientLookup>(res);
}

export async function getPatientPrescriptions(code: string): Promise<{ total: number; prescriptions: Prescription[] }> {
  const res = await fetch(`${BASE}/api/hospital/patients/${code.toUpperCase()}/prescriptions`, { headers: hHeaders() });
  return go(res);
}

export async function getPatientMedications(code: string): Promise<{ total: number; medications: Medication[] }> {
  const res = await fetch(`${BASE}/api/hospital/patients/${code.toUpperCase()}/medications`, { headers: hHeaders() });
  return go(res);
}

export async function fetchHospitalDoctors(): Promise<{ total: number; doctors: HospitalDoctor[] }> {
  const res = await fetch(`${BASE}/api/hospital/doctors`, { headers: hHeaders() });
  return go(res);
}

export async function affiliateDoctorToHospital(doctorId: number | string, department?: string): Promise<any> {
  const res = await fetch(`${BASE}/api/hospital/doctors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...hHeaders() },
    body: JSON.stringify({ doctor_id: doctorId, department }),
  });
  return go(res);
}

export async function removeDoctorAffiliation(doctorId: number): Promise<any> {
  const res = await fetch(`${BASE}/api/hospital/doctors/${doctorId}`, {
    method: 'DELETE',
    headers: hHeaders(),
  });
  return go(res);
}

export async function fetchHospitalDispensaries(): Promise<{ total: number; dispensaries: HospitalDispensary[] }> {
  const res = await fetch(`${BASE}/api/hospital/dispensaries`, { headers: hHeaders() });
  return go(res);
}

export async function registerHospital(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  registration_number?: string;
  city?: string;
  state?: string;
  address?: string;
}): Promise<{ message: string; hospital_id: number }> {
  const res = await fetch(`${BASE}/api/hospital/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return go(res);
}
