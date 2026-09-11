/* ─── Rxify Patient API Client ──────────────────────────────────────────────── */

import { authHeaders, ApiError } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail ?? detail;
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface PatientStats {
  rx_count: number;
  pending_requests: number;
  active_shares: number;
  patient_id?: number;
  patient_code?: string;
  full_name?: string;
  email?: string;
}

export interface Prescription {
  id: number;
  patient_name: string | null;
  patient_age: string | null;
  patient_gender: string | null;
  doctor_name: string | null;
  clinic_name: string | null;
  diagnosis: string | null;
  issue_date: string | null;
  follow_up_date: string | null;
  notes: string | null;
}

export interface Medication {
  id: number;
  name: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  date: string | null;
}

export interface PrescriptionDetail extends Prescription {
  clinic_address: string | null;
  clinic_phone: string | null;
  raw_text: string | null;
  medications: Medication[];
}

export interface DoctorInfo {
  id: number;
  doctor_code?: string;
  username: string;
  display_name: string | null;
  specialty: string | null;
  assigned_at?: string;
}

export interface DoctorRequest {
  id: number;
  doctor_id: number;
  doctor_username: string;
  doctor_display_name: string | null;
  doctor_specialty: string | null;
  requested_at: string;
  status: 'pending' | 'accepted' | 'rejected';
}

/* ─── API Calls ─────────────────────────────────────────────────────────────── */

/** GET /api/patient/stats */
export function fetchPatientStats(): Promise<PatientStats> {
  return req('/api/patient/stats');
}

/** GET /api/patient/prescriptions */
export function fetchMyPrescriptions(): Promise<{ total: number; prescriptions: Prescription[] }> {
  return req('/api/patient/prescriptions');
}

/** GET /api/patient/prescriptions/:id */
export function fetchPrescriptionDetail(id: number): Promise<PrescriptionDetail> {
  return req(`/api/patient/prescriptions/${id}`);
}

/** GET /api/patient/my-doctor */
export function fetchMyDoctor(): Promise<{ doctor: DoctorInfo | null }> {
  return req('/api/patient/my-doctor');
}

/** GET /api/patient/my-requests */
export function fetchMyRequests(): Promise<{ requests: DoctorRequest[] }> {
  return req('/api/patient/my-requests');
}

export interface ShareTokenItem {
  id: number;
  token: string;
  label: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** GET /api/patient/doctor/lookup/:idOrCode */
export function lookupDoctor(doctorId: number | string): Promise<DoctorInfo> {
  return req(`/api/patient/doctor/lookup/${encodeURIComponent(String(doctorId))}`);
}

/** POST /api/patient/request-doctor */
export function requestDoctor(doctorId: number | string): Promise<{ success: boolean; message: string }> {
  return req('/api/patient/request-doctor', {
    method: 'POST',
    body: JSON.stringify({ doctor_id: doctorId }),
  });
}

/** POST /api/patient/share-tokens */
export function createShareToken(label?: string, expiresInDays?: number | null): Promise<{ message: string; token: ShareTokenItem }> {
  return req('/api/patient/share-tokens', {
    method: 'POST',
    body: JSON.stringify({ label, expires_in_days: expiresInDays }),
  });
}

/** GET /api/patient/share-tokens */
export function fetchShareTokens(): Promise<{ tokens: ShareTokenItem[] }> {
  return req('/api/patient/share-tokens');
}

/** DELETE /api/patient/share-tokens/:id */
export function revokeShareToken(tokenId: number): Promise<{ message: string }> {
  return req(`/api/patient/share-tokens/${tokenId}`, {
    method: 'DELETE',
  });
}

/** POST /api/upload (multipart) */
export async function uploadPrescription(file: File): Promise<{ job_id: string; status: string; message: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail ?? detail; } catch { /* ignore */ }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

/** GET /api/job/:jobId */
export function pollJob(jobId: string): Promise<{
  status: 'processing' | 'done' | 'error';
  result?: PrescriptionDetail;
  error?: string;
  prescription_id?: number;
}> {
  return req(`/api/job/${jobId}`);
}

export interface DispensaryRequestItem {
  item_id: number;
  prescription_medicine_id: number;
  medicine_id: number | null;
  prescribed_medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  generic_name: string | null;
  brand_name: string | null;
  form: string | null;
  required_quantity: number;
  dispensed_quantity: number | null;
  availability_status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'DISPENSED' | 'CHECKING';
  reserved: boolean;
}

export interface PatientDispensaryRequest {
  request_id: number;
  prescription_id: number;
  dispensary_id: number;
  dispensary_name: string;
  dispensary_location: string | null;
  patient_id: number;
  patient_code: string | null;
  patient_name: string;
  doctor_name: string | null;
  doctor_specialty: string | null;
  diagnosis: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'DISPENSED' | 'CANCELLED';
  estimated_ready_at: string | null;
  ready_at: string | null;
  dispensed_at: string | null;
  notes: string | null;
  created_at: string;
  items: DispensaryRequestItem[];
}

/** GET /api/patient/dispensary-requests */
export function fetchMyDispensaryRequests(): Promise<{ requests: PatientDispensaryRequest[] }> {
  return req('/api/patient/dispensary-requests');
}

