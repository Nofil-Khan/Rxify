import * as React from 'react';
import { useAuthStore } from '@/lib/auth';
import {
  fetchDispensaryProfile,
  fetchDispensaryQueue,
  fetchDispensaryRequestDetail,
  fetchDispensaryDashboardStats,
  fetchInventory,
  RequestDetail,
  InventoryItem,
} from '@/lib/dispensaryApi';
import { useDispensaryWorkspace } from './useDispensaryWorkspace';
import { WorkspacePrescription, WorkspaceMedicine, FulfillmentStatus, RequestStatus } from '../types';

function normalizeForm(form?: string | null): WorkspaceMedicine['form'] {
  const f = form?.toLowerCase() || '';
  if (f.includes('cap')) return 'Capsule';
  if (f.includes('syr') || f.includes('liq')) return 'Syrup';
  if (f.includes('inh')) return 'Inhaler';
  if (f.includes('inj')) return 'Injection';
  return 'Tablet';
}

function mapStatus(status?: string | null): FulfillmentStatus {
  const s = status?.toUpperCase() || '';
  if (s === 'AVAILABLE' || s === 'FULFILL') return 'AVAILABLE';
  if (s === 'PARTIAL' || s === 'PARTIALLY_AVAILABLE') return 'PARTIAL';
  if (s === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (s === 'SUBSTITUTE' || s === 'SUBSTITUTED') return 'SUBSTITUTED';
  return 'AVAILABLE';
}

function mapDetailToWorkspace(d: RequestDetail, invMap: Map<number, InventoryItem>): WorkspacePrescription {
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

export function useBackendDispensarySync() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isFetchingRef = React.useRef(false);
  const detailsCacheRef = React.useRef<Map<number, RequestDetail>>(new Map());

  React.useEffect(() => {
    if (!token && !isAuthenticated) return;

    let active = true;

    async function syncData() {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        const [profile, stats, queue, inventory] = await Promise.allSettled([
          fetchDispensaryProfile(),
          fetchDispensaryDashboardStats(),
          fetchDispensaryQueue(),
          fetchInventory(),
        ]);

        if (!active) return;

        // Only update profile if name actually changed
        if (profile.status === 'fulfilled' && profile.value?.name) {
          const authState = useAuthStore.getState();
          if (authState.displayName !== profile.value.name) {
            authState.updateProfileData({ displayName: profile.value.name });
          }
        }

        const invMap = new Map<number, InventoryItem>();
        if (inventory.status === 'fulfilled' && Array.isArray(inventory.value)) {
          for (const item of inventory.value) {
            invMap.set(item.medicine_id, item);
          }
        }

        if (queue.status === 'fulfilled' && Array.isArray(queue.value)) {
          if (queue.value.length === 0) {
            useDispensaryWorkspace.setState({
              prescriptions: [],
              selectedPrescriptionId: '',
              selectedMedicineId: '',
            });
          } else {
            // Fetch details only for items not already cached to prevent hammering
            const itemsToFetch = queue.value.slice(0, 8);
            await Promise.all(
              itemsToFetch.map(async (q) => {
                if (!detailsCacheRef.current.has(q.request_id)) {
                  try {
                    const detail = await fetchDispensaryRequestDetail(q.request_id);
                    if (detail) detailsCacheRef.current.set(q.request_id, detail);
                  } catch {
                    /* ignore single item failure */
                  }
                }
              })
            );

            if (!active) return;

            const details = itemsToFetch
              .map((q) => detailsCacheRef.current.get(q.request_id))
              .filter(Boolean) as RequestDetail[];

            if (details.length > 0) {
              const mapped = details.map((d) => mapDetailToWorkspace(d, invMap));
              useDispensaryWorkspace.setState((state) => {
                const currentValid = mapped.some((m) => m.id === state.selectedPrescriptionId);
                return {
                  prescriptions: mapped,
                  selectedPrescriptionId: currentValid ? state.selectedPrescriptionId : mapped[0].id,
                  selectedMedicineId: currentValid ? state.selectedMedicineId : (mapped[0].medicines[0]?.id || state.selectedMedicineId),
                };
              });
            }
          }
        }

        if (stats.status === 'fulfilled' && stats.value) {
          const s = stats.value as unknown as Record<string, number>;
          useDispensaryWorkspace.setState({
            pipelineStats: {
              newCount: s.pending_count ?? s.pending ?? 0,
              preparingCount: s.processing_count ?? s.processing ?? 0,
              readyCount: s.ready_count ?? s.ready ?? 0,
              completedCount: s.dispensed_count ?? s.dispensed ?? 0,
            },
          });
        }
      } catch (err) {
        console.error('Failed to sync backend dispensary data:', err);
      } finally {
        isFetchingRef.current = false;
      }
    }

    syncData();
    const interval = setInterval(syncData, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token, isAuthenticated]);
}

export default useBackendDispensarySync;
