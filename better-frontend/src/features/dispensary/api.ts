import {
  Prescription,
  PrescriptionSchema,
  BackendCommandResult,
  BackendCommandResultSchema,
} from './types';
import { z } from 'zod';
import { getAuthHeaders } from './inventoryApi';

export * from './inventoryApi';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

async function handleResponse<T>(res: Response, schema: z.ZodSchema<T>): Promise<T> {
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return schema.parse(data);
}

export async function fetchPrescriptions(status?: string): Promise<Prescription[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('rxify_token') : null;
  const endpoint = token ? `${API_BASE}/api/dispensary/queue${query}` : `${API_BASE}/api/pharmacy/prescriptions`;
  const res = await fetch(endpoint, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (Array.isArray(data)) {
    const normalized = data.map((item: any) => {
      if (item.request_id && !item.rxNumber) {
        return {
          id: String(item.request_id),
          rxNumber: item.prescription_id ? `RX-2026-${item.prescription_id}` : `REQ-${item.request_id}`,
          status: item.status === 'PENDING' ? 'NEW' : (item.status === 'PROCESSING' ? 'PREPARING' : (item.status === 'READY' ? 'READY' : 'COMPLETED')),
          createdAt: item.created_at || new Date().toISOString(),
          patient: {
            id: String(item.patient_id || 'p-1'),
            name: item.patient_name || 'Patient',
            age: 28,
            gender: 'Male',
            initials: (item.patient_name || 'PT').slice(0, 2).toUpperCase(),
          },
          doctor: {
            id: 'doc-1',
            name: item.doctor_name || 'Dr. N. Verma',
            specialty: item.doctor_specialty || 'General Medicine',
          },
          diagnosis: item.diagnosis || 'Prescribed Medication',
          notes: item.notes || item.pharmacist_notes || 'Complete full course as directed.',
          items: item.items && item.items.length > 0 ? item.items.map((it: any) => ({
            medicine: {
              id: String(it.medicine_id || it.item_id || 'med-1'),
              name: it.generic_name || it.prescribed_medicine_name || 'Medicine',
              strength: it.strength || '500 mg',
              form: 'Tablet',
            },
            qty: it.required_quantity || it.qty || 10,
            inStock: it.available_quantity || 25,
          })) : [
            {
              medicine: { id: 'm-1', name: 'Amoxicillin', strength: '500 mg', form: 'Capsule' },
              qty: 10,
              inStock: 40,
            }
          ],
          flagged: false,
          timeAgo: 'Just now',
        };
      }
      return item;
    });
    return z.array(PrescriptionSchema).parse(normalized);
  }
  return [];
}

export async function fetchPrescription(id: string): Promise<Prescription> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rxify_token') : null;
  const endpoint = token ? `${API_BASE}/api/dispensary/requests/${id}` : `${API_BASE}/api/prescriptions/${id}`;
  const res = await fetch(endpoint, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const item = await res.json();
  if (item.request_id && !item.rxNumber) {
    const normalized = {
      id: String(item.request_id),
      rxNumber: item.prescription_id ? `RX-2026-${item.prescription_id}` : `REQ-${item.request_id}`,
      status: item.status === 'PENDING' ? 'NEW' : (item.status === 'PROCESSING' ? 'PREPARING' : (item.status === 'READY' ? 'READY' : 'COMPLETED')),
      createdAt: item.created_at || new Date().toISOString(),
      patient: {
        id: String(item.patient_id || 'p-1'),
        name: item.patient_name || 'Patient',
        age: 28,
        gender: 'Male',
        initials: (item.patient_name || 'PT').slice(0, 2).toUpperCase(),
      },
      doctor: {
        id: 'doc-1',
        name: item.doctor_name || 'Dr. N. Verma',
        specialty: item.doctor_specialty || 'General Medicine',
      },
      diagnosis: item.diagnosis || 'Prescribed Medication',
      notes: item.prescription_notes || item.notes || 'Take after meals.',
      items: item.items && item.items.length > 0 ? item.items.map((it: any) => ({
        medicine: {
          id: String(it.medicine_id || it.item_id || 'med-1'),
          name: it.generic_name || it.prescribed_medicine_name || 'Medicine',
          strength: it.strength || '500 mg',
          form: 'Tablet',
        },
        qty: it.required_quantity || it.qty || 10,
        inStock: it.available_quantity || 25,
      })) : [],
      flagged: false,
      timeAgo: 'Just now',
    };
    return PrescriptionSchema.parse(normalized);
  }
  return PrescriptionSchema.parse(item);
}

export async function transitionPrescription(
  id: string,
  targetStatus: Prescription['status']
): Promise<Prescription> {
  const res = await fetch(`${API_BASE}/api/prescriptions/${id}/transition`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetStatus }),
  });
  return handleResponse(res, PrescriptionSchema);
}

export async function processRequestCommand(requestId: string): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/process`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, BackendCommandResultSchema);
}

export async function markReadyCommand(requestId: string): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/ready`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, BackendCommandResultSchema);
}

export async function verifyPickupCommand(
  requestId: string,
  patientCode: string
): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ patient_code: patientCode }),
  });
  return handleResponse(res, BackendCommandResultSchema);
}

export async function dispenseRequestCommand(
  requestId: string,
  patientCode: string
): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/dispense`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ patient_code: patientCode }),
  });
  return handleResponse(res, BackendCommandResultSchema);
}

export async function cancelRequestCommand(
  requestId: string,
  reason?: string
): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason: reason || 'Pharmacist cancelled' }),
  });
  return handleResponse(res, BackendCommandResultSchema);
}

export async function updateItemDecisionCommand(
  requestId: string,
  itemId: string,
  decision: string,
  dispensedQuantity?: number,
  notes?: string
): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/items/${itemId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      decision,
      dispensed_quantity: dispensedQuantity,
      pharmacist_notes: notes,
    }),
  });
  return handleResponse(res, BackendCommandResultSchema);
}

export async function reconsultDoctorCommand(
  requestId: string,
  notes: string,
  urgent: boolean = false
): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/reconsult`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes, urgent }),
  });
  return handleResponse(res, BackendCommandResultSchema);
}

export async function aiResolveRequestCommand(requestId: string): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/requests/${requestId}/ai-resolve`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, BackendCommandResultSchema);
}
