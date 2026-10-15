/* ─── Rxify Patient API Client ──────────────────────────────────────────────── */

import { authHeaders, ApiError } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

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

export type MatchStatus = 'MATCHED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'NOT_A_MEDICINE' | null;

export interface Medication {
  id: number;
  /** Gemini-extracted raw text — always present */
  raw_name: string;
  /** Matcher verdict. NULL means legacy row (treat like UNRESOLVED, not MATCHED). */
  match_status: MatchStatus;
  /** True when the patient themselves confirmed / selected the catalog match. */
  patient_resolved: boolean;
  /** Catalog medicine_id — only set when match_status === 'MATCHED' */
  medicine_id: number | null;
  /** Catalog display name: brand_name ?? generic_name ?? raw_name */
  name: string | null;
  generic_name: string | null;
  brand_name: string | null;
  strength: string | null;
  form: string | null;
  category: string | null;
  /** Doctor's instructions from the prescription — always preserved */
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  date: string | null;
}

export interface MedicineCandidate {
  medicine_id: number;
  generic_name: string | null;
  brand_name: string | null;
  strength: string | null;
  form: string | null;
  category: string | null;
  match_confidence: number;
  match_method: string;
}

export interface CandidatesResult {
  pm_id: number;
  raw_name: string;
  match_status: MatchStatus;
  candidates: MedicineCandidate[];
}

export interface ResolvedMedicine {
  pm_id: number;
  prescription_id: number;
  medicine_id: number;
  generic_name: string | null;
  brand_name: string | null;
  strength: string | null;
  form: string | null;
  category: string | null;
  patient_resolved: boolean;
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

/** GET /api/patient/prescriptions/{rxId}/medicines/{pmId}/candidates */
export function fetchMedicineCandidates(
  prescriptionId: number,
  pmId: number,
): Promise<CandidatesResult> {
  return req(`/api/patient/prescriptions/${prescriptionId}/medicines/${pmId}/candidates`);
}

/** PATCH /api/patient/prescriptions/{rxId}/medicines/{pmId}/resolve */
export function resolvePrescriptionMedicine(
  prescriptionId: number,
  pmId: number,
  medicineId: number,
): Promise<{ message: string; medicine: ResolvedMedicine }> {
  return req(`/api/patient/prescriptions/${prescriptionId}/medicines/${pmId}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ medicine_id: medicineId }),
  });
}

/** GET /api/medicine/search?q=...&limit=... */
export function searchMedicineCatalog(
  q: string,
  limit = 10,
): Promise<MedicineCandidate[]> {
  return req(`/api/medicine/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

/* ─── Timeline & Current Medication Types & API ────────────────────────────── */

export type MedicationTransition = 'STARTED' | 'CONTINUED' | 'DISCONTINUED' | 'COMPLETED';

export interface TimelineMedicationItem {
  current_medication_id: number;
  prescription_medicine_id?: number;
  medicine_id?: number | null;
  name: string;
  generic_name?: string | null;
  brand_name?: string | null;
  strength?: string | null;
  form?: string | null;
  category?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';
  effective_status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';
  notes?: string | null;
  prescription_id?: number | null;
  doctor_name?: string | null;
  diagnosis?: string | null;
  node_item_id: string;
  transition: MedicationTransition;
  connected_from?: string | null;
}

export interface TimelineMilestone {
  index: number;
  date: string;
  display_date: string;
  title: string;
  prescription_ids: number[];
  doctors: string[];
  diagnoses: string[];
  total_active_meds: number;
  medications: TimelineMedicationItem[];
}

export interface FlowchartLink {
  id: string;
  source: string;
  target: string;
  source_milestone: number;
  target_milestone: number;
  medicine_name: string;
  type: MedicationTransition;
}

export interface MedicationTimelineResponse {
  patient_id: number | null;
  milestones: TimelineMilestone[];
  flowchart_links: FlowchartLink[];
  active_now: TimelineMedicationItem[];
  summary: {
    total_prescriptions: number;
    total_tracked_medications: number;
    active_now_count: number;
    discontinued_count: number;
    completed_count: number;
    timeline_nodes_count: number;
  };
}

/** GET /api/patient/medication-timeline */
export function fetchMedicationTimeline(): Promise<MedicationTimelineResponse> {
  return req('/api/patient/medication-timeline');
}

/** PATCH /api/patient/current-medications/{current_medication_id}/status */
export function updateMedicationStatus(
  currentMedicationId: number,
  status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED',
  endDate?: string,
  notes?: string,
): Promise<{ success: boolean; message: string; medication: any }> {
  return req(`/api/patient/current-medications/${currentMedicationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      end_date: endDate,
      notes,
    }),
  });
}

