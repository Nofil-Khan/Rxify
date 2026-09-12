/* ─── Rxify Dispensary API Client ───────────────────────────────────────────── */

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

export interface DispensaryProfile {
  dispensary_id: number;
  dispensary_code?: string;
  hospital_id: number;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  operating_hours: string | null;
  avg_prep_minutes: number;
  status: string;
}

export interface InventoryItem {
  inventory_id: number;
  dispensary_id: number;
  medicine_id: number;
  generic_name: string;
  brand_name: string | null;
  category: string | null;
  strength: string | null;
  form: string;
  available_quantity: number;
  reserved_quantity: number;
  free_stock: number;
  reorder_level: number;
  unit: string | null;
  stock_status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  created_at: string;
  updated_at: string;
}

export interface CatalogMedicine {
  medicine_id: number;
  generic_name: string;
  brand_name: string | null;
  category: string | null;
  strength: string | null;
  form: string;
}

export interface QueueItemSummary {
  request_id: number;
  prescription_id: number;
  patient_id: number;
  patient_name: string;
  patient_code: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'DISPENSED' | 'CANCELLED';
  estimated_ready_at: string | null;
  created_at: string;
  total_items: number;
}

export interface RequestItemDetail {
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
  availability_status: string;
  reserved: boolean;
}

export interface RequestDetail {
  request_id: number;
  prescription_id: number;
  dispensary_id: number;
  dispensary_name: string;
  dispensary_location: string | null;
  patient_id: number;
  patient_code: string | null;
  patient_name: string;
  patient_email: string;
  patient_phone: string | null;
  patient_dob: string | null;
  issue_date: string | null;
  diagnosis: string | null;
  prescription_notes: string | null;
  doctor_name: string | null;
  doctor_specialty: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'DISPENSED' | 'CANCELLED';
  estimated_ready_at: string | null;
  ready_at: string | null;
  dispensed_at: string | null;
  notes: string | null;
  created_at: string;
  items: RequestItemDetail[];
}

export interface DispensaryDashboardStats {
  pending: number;
  processing: number;
  ready: number;
  dispensed: number;
  unavailable: number;
  partial: number;
  out_of_stock: number;
  low_stock: number;
  total_medicines: number;
}

export interface DispensaryRegisterData {
  hospital_id: number;
  name: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  operating_hours?: string;
  avg_prep_minutes?: number;
}

export interface PublicHospital {
  hospital_id: number;
  name: string;
  city?: string;
  state?: string;
  registration_number?: string;
}

/* ─── API Methods ───────────────────────────────────────────────────────────── */

/** GET /api/dispensary/hospitals */
export function fetchPublicHospitals(): Promise<PublicHospital[]> {
  return req('/api/dispensary/hospitals');
}

/** POST /api/dispensary/register */
export async function registerDispensary(data: DispensaryRegisterData): Promise<{
  message: string;
  dispensary: DispensaryProfile;
}> {
  return req('/api/dispensary/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** POST /api/dispensary/login */
export async function loginDispensary(email: string, password: string): Promise<{
  access_token: string;
  token_type: string;
  role: string;
  dispensary_id: number;
  hospital_id: number;
  name: string;
}> {
  return req('/api/dispensary/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/** GET /api/dispensary/me */
export function fetchDispensaryProfile(): Promise<DispensaryProfile> {
  return req('/api/dispensary/me');
}

/** GET /api/dispensary/inventory */
export function fetchInventory(): Promise<InventoryItem[]> {
  return req('/api/dispensary/inventory');
}

/** POST /api/dispensary/inventory */
export function addOrUpdateStock(data: {
  medicine_id: number;
  available_quantity: number;
  reorder_level?: number;
  unit?: string;
}): Promise<{ message: string; inventory: InventoryItem }> {
  return req('/api/dispensary/inventory', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PATCH /api/dispensary/inventory/:id */
export function updateStockPartial(
  inventoryId: number,
  data: { available_quantity?: number; reorder_level?: number; unit?: string }
): Promise<{ message: string; inventory: InventoryItem }> {
  return req(`/api/dispensary/inventory/${inventoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** GET /api/dispensary/catalog/medicines */
export function searchMedicineCatalog(q?: string): Promise<CatalogMedicine[]> {
  const queryParam = q ? `?q=${encodeURIComponent(q)}` : '';
  return req(`/api/dispensary/catalog/medicines${queryParam}`);
}

/** GET /api/dispensary/queue */
export function fetchDispensaryQueue(statusFilter?: string): Promise<QueueItemSummary[]> {
  const queryParam = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
  return req(`/api/dispensary/queue${queryParam}`);
}

/** GET /api/dispensary/requests/:id */
export function fetchDispensaryRequestDetail(requestId: number): Promise<RequestDetail> {
  return req(`/api/dispensary/requests/${requestId}`);
}

/** POST /api/dispensary/requests/:id/process */
export function processDispensaryRequest(requestId: number): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/process`, { method: 'POST' });
}

/** POST /api/dispensary/requests/:id/ready */
export function markDispensaryRequestReady(requestId: number): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/ready`, { method: 'POST' });
}

/** POST /api/dispensary/requests/:id/dispense */
export function dispenseDispensaryRequest(
  requestId: number,
  notes?: string
): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/dispense`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

/** POST /api/dispensary/requests/:id/cancel */
export function cancelDispensaryRequest(requestId: number, notes?: string): Promise<{ message: string; request: RequestDetail }> {
  const queryParam = notes ? `?notes=${encodeURIComponent(notes)}` : '';
  return req(`/api/dispensary/requests/${requestId}/cancel${queryParam}`, { method: 'POST' });
}

/** GET /api/dispensary/dashboard */
export function fetchDispensaryDashboardStats(): Promise<DispensaryDashboardStats> {
  return req('/api/dispensary/dashboard');
}

/** GET /api/dispensary/alerts */
export function fetchDispensaryAlerts(): Promise<{ alerts: any[]; total_alerts: number }> {
  return req('/api/dispensary/alerts');
}

/** POST /api/dispensary/inventory/bulk */
export function bulkAddStock(items: any[]): Promise<{ message: string; updated_count: number }> {
  return req('/api/dispensary/inventory/bulk', {
    method: 'POST',
    body: JSON.stringify(items),
  });
}

/** POST /api/dispensary/inventory/csv */
export async function uploadInventoryCsv(file: File): Promise<{ message: string; updated_count: number }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/dispensary/inventory/csv`, {
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

export interface DispensaryLookupResult {
  match_type: 'patient' | 'prescription' | 'request';
  patient_code?: string;
  prescription_id?: number;
  request_id?: number;
  total: number;
  requests: RequestDetail[];
}

/** GET /api/dispensary/lookup/:code */
export function lookupDispensaryCode(code: string): Promise<DispensaryLookupResult> {
  return req(`/api/dispensary/lookup/${encodeURIComponent(code.trim())}`);
}


