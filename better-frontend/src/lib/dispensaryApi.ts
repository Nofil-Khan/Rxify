/* â”€â”€â”€ Rxify Dispensary API Client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

import { authHeaders, ApiError } from "./api";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;

    try {
      const j = await res.json();
      detail = j.detail ?? detail;
    } catch {
      /* ignore */
    }

    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

/* â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface DispensaryProfile {
  dispensary_id: number;
  dispensary_code?: string;
  hospital_id?: number | null;
  name: string;
  email: string;
  phone: string | null;

  location: string | null; // legacy floor/wing text

  address: string | null; // GPS-resolved human-readable address

  latitude: number | null;
  longitude: number | null;
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
  stock_status: "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK";
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
  rxcui?: string | null;
}

export interface QueueItemSummary {
  request_id: number;
  prescription_id: number;
  patient_id: number;
  patient_name: string;
  patient_code: string | null;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "READY"
    | "PARTIALLY_AVAILABLE"
    | "UNAVAILABLE"
    | "DISPENSED"
    | "CANCELLED"
    | "RECONSULTATION_NEEDED";
  estimated_ready_at: string | null;
  pickup_code?: string | null;
  notes?: string | null;
  pharmacist_notes?: string | null;
  reconsultation_reason?: string | null;
  reconsultation_target?: string | null;
  reconsultation_at?: string | null;
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
  strength?: string | null;
  form: string | null;
  required_quantity: number;
  dispensed_quantity: number | null;
  availability_status: string;
  reserved: boolean;
  reconsultation_needed?: boolean;
  reconsultation_notes?: string | null;
  suggested_substitute_id?: number | null;
  substitute_name?: string | null;
  substitute_brand?: string | null;
  substitute_strength?: string | null;
  substitute_form?: string | null;
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
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "READY"
    | "PARTIALLY_AVAILABLE"
    | "UNAVAILABLE"
    | "DISPENSED"
    | "CANCELLED"
    | "RECONSULTATION_NEEDED";
  estimated_ready_at: string | null;
  ready_at: string | null;
  dispensed_at: string | null;
  pickup_code?: string | null;
  notes: string | null;
  pharmacist_notes?: string | null;
  reconsultation_reason?: string | null;
  reconsultation_target?: string | null;
  reconsultation_at?: string | null;
  verified_by_user_id?: number | null;
  verified_at?: string | null;
  verification_signature?: string | null;

  verification_checklist?: {
    patient_identity_checked?: boolean;
    dosage_validity_checked?: boolean;
    interactions_cleared?: boolean;
    notes?: string;
  } | null;
  verified_by_name?: string | null;
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
  hospital_id?: number;
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

/* â”€â”€â”€ API Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** GET /api/dispensary/hospitals */

export function fetchPublicHospitals(): Promise<PublicHospital[]> {
  return req("/api/dispensary/hospitals");
}

/** POST /api/dispensary/register */

export async function registerDispensary(
  data: DispensaryRegisterData,
): Promise<{
  message: string;
  dispensary: DispensaryProfile;
}> {
  return req("/api/dispensary/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /api/dispensary/login */

export async function loginDispensary(
  email: string,
  password: string,
): Promise<{
  access_token: string;
  token_type: string;
  role: string;
  dispensary_id: number;
  hospital_id: number;
  name: string;
}> {
  return req("/api/dispensary/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** GET /api/dispensary/me */

export function fetchDispensaryProfile(): Promise<DispensaryProfile> {
  return req("/api/dispensary/me");
}

/** GET /api/dispensary/inventory */

export function fetchInventory(): Promise<InventoryItem[]> {
  return req("/api/dispensary/inventory");
}

/** POST /api/dispensary/inventory */

export function addOrUpdateStock(data: {
  medicine_id: number;
  available_quantity: number;
  reorder_level?: number;
  unit?: string;
}): Promise<{ message: string; inventory: InventoryItem }> {
  return req("/api/dispensary/inventory", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** PATCH /api/dispensary/inventory/:id */

export function updateStockPartial(
  inventoryId: number,
  data: { available_quantity?: number; reorder_level?: number; unit?: string },
): Promise<{ message: string; inventory: InventoryItem }> {
  return req(`/api/dispensary/inventory/${inventoryId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** GET /api/dispensary/catalog/medicines */

export function searchMedicineCatalog(q?: string): Promise<CatalogMedicine[]> {
  const queryParam = q ? `?q=${encodeURIComponent(q)}` : "";

  return req(`/api/dispensary/catalog/medicines${queryParam}`);
}

/** GET /api/dispensary/queue */

export function fetchDispensaryQueue(
  statusFilter?: string,
): Promise<QueueItemSummary[]> {
  const queryParam = statusFilter
    ? `?status=${encodeURIComponent(statusFilter)}`
    : "";

  return req(`/api/dispensary/queue${queryParam}`);
}

/** GET /api/dispensary/requests/:id */

export function fetchDispensaryRequestDetail(
  requestId: number,
): Promise<RequestDetail> {
  return req(`/api/dispensary/requests/${requestId}`);
}

/** POST /api/dispensary/requests/:id/process */

export function processDispensaryRequest(
  requestId: number,
): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/process`, {
    method: "POST",
  });
}

/** POST /api/dispensary/requests/:id/approve */

export function approveDispensaryRequest(
  requestId: number,
  estimatedPrepMinutes?: number,
  pharmacistNotes?: string,
): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/approve`, {
    method: "POST",
    body: JSON.stringify({
      estimated_prep_minutes: estimatedPrepMinutes,
      pharmacist_notes: pharmacistNotes,
    }),
  });
}

/** POST /api/dispensary/requests/:id/reconsult */

export function reconsultDispensaryRequest(
  requestId: number,
  data: {
    reason: string;
    pharmacistNotes: string;
    target?: string;
    itemIds?: number[];
  },
): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/reconsult`, {
    method: "POST",
    body: JSON.stringify({
      reason: data.reason,
      pharmacist_notes: data.pharmacistNotes,
      target: data.target ?? "DOCTOR",
      item_ids: data.itemIds,
    }),
  });
}

/** POST /api/dispensary/requests/:id/ready */

export function markDispensaryRequestReady(
  requestId: number,
): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/ready`, { method: "POST" });
}

/** POST /api/dispensary/requests/:id/dispense */

export function dispenseDispensaryRequest(
  requestId: number,
  notes?: string,
  pickupCode?: string,
): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/dispense`, {
    method: "POST",
    body: JSON.stringify({ notes, pickup_code: pickupCode }),
  });
}

/** POST /api/dispensary/requests/:id/cancel */

export function cancelDispensaryRequest(
  requestId: number,
  notes?: string,
): Promise<{ message: string; request: RequestDetail }> {
  const queryParam = notes ? `?notes=${encodeURIComponent(notes)}` : "";

  return req(`/api/dispensary/requests/${requestId}/cancel${queryParam}`, {
    method: "POST",
  });
}

/** GET /api/dispensary/dashboard */

export function fetchDispensaryDashboardStats(): Promise<DispensaryDashboardStats> {
  return req("/api/dispensary/dashboard");
}

/** GET /api/dispensary/alerts */

export function fetchDispensaryAlerts(): Promise<{
  alerts: any[];
  total_alerts: number;
}> {
  return req("/api/dispensary/alerts");
}

export interface TopOrderedMedicine {
  medicine_id: number;
  generic_name: string;
  brand_name: string;
  category: string;
  strength: string;
  form: string;
  total_orders: number;
  total_prescribed_qty: number;
  total_dispensed_qty: number;
  in_stock_qty: number;
  reorder_level: number;
}

export interface CategoryDistribution {
  category: string;
  item_count: number;
  total_quantity: number;
}

export interface OrderTrendItem {
  day: string;
  total_orders: number;
  dispensed_orders: number;
  cancelled_orders: number;
}

export interface DispensaryAnalyticsData {
  top_medicines: TopOrderedMedicine[];
  categories: CategoryDistribution[];
  order_trend: OrderTrendItem[];
  kpis: {
    total_orders: number;
    total_dispensed: number;
    fulfillment_rate: number;
    avg_prep_time_minutes: number;
    total_medicines_tracked: number;
  };
}

export function fetchDispensaryAnalytics(days: number = 30): Promise<DispensaryAnalyticsData> {
  return req(`/api/dispensary/analytics?days=${days}`);
}

/** POST /api/dispensary/inventory/bulk */

export function bulkAddStock(
  items: any[],
): Promise<{ message: string; updated_count: number }> {
  return req("/api/dispensary/inventory/bulk", {
    method: "POST",
    body: JSON.stringify(items),
  });
}

/** POST /api/dispensary/inventory/csv */

export async function uploadInventoryCsv(
  file: File,
): Promise<{ message: string; updated_count: number }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/api/dispensary/inventory/csv`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;

    try {
      const j = await res.json();
      detail = j.detail ?? detail;
    } catch {
      /* ignore */
    }

    throw new ApiError(res.status, detail);
  }

  return res.json();
}

export interface DispensaryLookupResult {
  match_type: "patient" | "prescription" | "request";
  patient_code?: string;
  prescription_id?: number;
  request_id?: number;
  total: number;
  requests: RequestDetail[];
}

/** GET /api/dispensary/lookup/:code */

export function lookupDispensaryCode(
  code: string,
): Promise<DispensaryLookupResult> {
  return req(`/api/dispensary/lookup/${encodeURIComponent(code.trim())}`);
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string | null;
}

/** PATCH /api/dispensary/location */

export function updateDispensaryLocation(
  data: LocationData,
): Promise<{ message: string; dispensary: DispensaryProfile }> {
  return req("/api/dispensary/location", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export interface InventoryTransactionItem {
  txn_id: number;
  inventory_id: number;
  dispensary_id: number;
  medicine_id: number;
  generic_name: string;
  brand_name: string | null;
  strength: string | null;
  form: string;
  txn_type:
    | "STOCK_ADDED"
    | "STOCK_ADJUSTED"
    | "MEDICINE_RESERVED"
    | "RESERVATION_CANCELLED"
    | "MEDICINE_DISPENSED";
  quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface InventoryTransactionsResponse {
  transactions: InventoryTransactionItem[];
  total: number;
  limit: number;
  offset: number;
}

/** PATCH /api/dispensary/requests/:requestId/items/:itemId */

export function updateRequestItemDecision(
  requestId: number,
  itemId: number,
  data: {
    decision:
      "FULFILL" | "PARTIAL" | "SUBSTITUTE" | "UNAVAILABLE" | "RECONSULT";
    quantity?: number;
    substituteMedicineId?: number;
    notes?: string;
  },
): Promise<{ message: string; request: RequestDetail }> {
  return req(`/api/dispensary/requests/${requestId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({
      decision: data.decision,
      quantity: data.quantity,
      substitute_medicine_id: data.substituteMedicineId,
      notes: data.notes,
    }),
  });
}

/** POST /api/dispensary/requests/:requestId/verify */

export function verifyPrescription(
  requestId: number,
  data?: {
    patientIdentityChecked?: boolean;
    dosageValidityChecked?: boolean;
    interactionsCleared?: boolean;
    notes?: string;
  },
): Promise<{
  message: string;
  verification_signature: string;
  verified_at: string;
  verified_by_name: string;
  request: RequestDetail;
}> {
  return req(`/api/dispensary/requests/${requestId}/verify`, {
    method: "POST",
    body: JSON.stringify({
      patient_identity_checked: data?.patientIdentityChecked ?? true,
      dosage_validity_checked: data?.dosageValidityChecked ?? true,
      interactions_cleared: data?.interactionsCleared ?? true,
      notes: data?.notes,
    }),
  });
}

/** GET /api/dispensary/transactions */

export function fetchInventoryTransactions(params?: {
  medicineId?: number;
  txnType?: string;
  limit?: number;
  offset?: number;
}): Promise<InventoryTransactionsResponse> {
  const q = new URLSearchParams();
  if (params?.medicineId) q.set("medicine_id", String(params.medicineId));
  if (params?.txnType) q.set("txn_type", params.txnType);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  const query = q.toString() ? `?${q.toString()}` : "";

  return req(`/api/dispensary/transactions${query}`);
}

/** POST /api/dispensary/requests/:requestId/ai-resolve */
export function aiResolveRequestItems(requestId: number): Promise<{
  message: string;
  report: {
    prescription_id: number;
    resolved_count: number;
    resolved_items: Array<{
      prescription_medicine_id: number;
      raw_name: string;
      matched_medicine_id: number;
      generic_name: string;
      brand_name?: string;
      strength?: string;
      reasoning?: string;
    }>;
  };
  request: RequestDetail;
}> {
  return req(`/api/dispensary/requests/${requestId}/ai-resolve`, {
    method: "POST",
  });
}
