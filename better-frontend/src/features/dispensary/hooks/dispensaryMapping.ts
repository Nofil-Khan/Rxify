import { RequestDetail, InventoryItem } from '@/lib/dispensaryApi';
import { WorkspacePrescription, WorkspaceMedicine, FulfillmentStatus, RequestStatus } from '../types';

export function normalizeForm(form?: string | null): WorkspaceMedicine['form'] {
  const f = form?.toLowerCase() || '';
  if (f.includes('cap')) return 'Capsule';
  if (f.includes('syr') || f.includes('liq')) return 'Syrup';
  if (f.includes('inh')) return 'Inhaler';
  if (f.includes('inj')) return 'Injection';
  return 'Tablet';
}

export function mapStatus(status?: string | null): FulfillmentStatus {
  const s = status?.toUpperCase() || '';
  if (s === 'AVAILABLE' || s === 'FULFILL') return 'AVAILABLE';
  if (s === 'PARTIAL' || s === 'PARTIALLY_AVAILABLE') return 'PARTIAL';
  if (s === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (s === 'SUBSTITUTE' || s === 'SUBSTITUTED') return 'SUBSTITUTED';
  return 'AVAILABLE';
}

export function mapDetailToWorkspace(d: RequestDetail, invMap: Map<number, InventoryItem>): WorkspacePrescription {
  const medicines: WorkspaceMedicine[] = (d.items || []).map((item) => {
    const inv = item.medicine_id ? invMap.get(item.medicine_id) : undefined;
    const inStock = inv ? inv.available_quantity : (item.availability_status === 'AVAILABLE' ? Math.max(item.required_quantity * 3, 25) : 0);
    return {
      id: String(item.item_id),
      name: item.generic_name || item.prescribed_medicine_name || 'Medicine',
      strength: item.strength || '500 mg',
      form: normalizeForm(item.form),
      prescribedQuantity: item.required_quantity || 10,
      inStockQuantity: inStock,
      status: mapStatus(item.availability_status),
      dispensedQuantity: item.dispensed_quantity ?? undefined,
      dosageInstructions: item.dosage || item.instructions || undefined,
    };
  });

  const initials = (d.patient_name || 'Patient')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'PT';

  return {
    id: String(d.request_id),
    rxNumber: d.prescription_id ? `RX-2026-${d.prescription_id}` : `REQ-${d.request_id}`,
    patientName: d.patient_name || 'Patient',
    patientInitials: initials,
    patientAge: 28,
    patientGender: 'Male',
    date: new Date(d.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    doctorName: d.doctor_name || 'Dr. N. Verma',
    doctorSpecialty: d.doctor_specialty || 'General Medicine',
    diagnosis: d.diagnosis || 'Prescribed Therapy',
    notes: d.prescription_notes || d.notes || 'Take as prescribed.',
    status: (d.status?.toUpperCase() as RequestStatus) || 'PENDING',
    timeAgo: 'Just now',
    createdAt: d.created_at,
    priority: d.status === 'PENDING' ? 'URGENT' : 'NORMAL',
    medicines,
    hasAlert: medicines.some((m) => m.status === 'UNAVAILABLE' || m.status === 'PARTIAL'),
  };
}

