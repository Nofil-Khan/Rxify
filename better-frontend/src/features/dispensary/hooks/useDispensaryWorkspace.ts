import { create } from 'zustand';
import { WorkspacePrescription, WorkspaceMedicine, PipelineStats, FulfillmentStatus, RequestStatus } from '../types';
import { MOCK_PRESCRIPTIONS, INITIAL_PIPELINE_STATS } from '../mocks/dispensaryMockData';
import {
  markReadyCommand,
  dispenseRequestCommand,
  reconsultDoctorCommand,
  processRequestCommand,
  cancelRequestCommand,
} from '../api';

export type QueueSortOption = 'newest' | 'oldest' | 'urgent';

export interface StockTarget {
  inventoryId?: number;
  medicineId?: number | string;
  name: string;
  strength?: string;
  form?: string;
  availableQuantity: number;
  reorderLevel: number;
  unit?: string;
}

interface DispensaryWorkspaceState {
  prescriptions: WorkspacePrescription[];
  selectedPrescriptionId: string;
  selectedMedicineId: string;
  pipelineStats: PipelineStats;
  activeNavTab: 'workspace' | 'inventory' | 'orders' | 'analytics';
  workflowStep: number;
  searchQuery: string;
  statusFilter: string;
  sortOrder: QueueSortOption;
  filterUnavailableOnly: boolean;
  isCommandPaletteOpen: boolean;
  isAdjustModalOpen: boolean;
  editingMedicine: WorkspaceMedicine | null;
  isReconsultModalOpen: boolean;
  reconsultingMedicine: WorkspaceMedicine | null;
  isViewPrescriptionModalOpen: boolean;
  isManageStockModalOpen: boolean;
  isAddMedicineModalOpen: boolean;
  managingStockTarget: StockTarget | null;

  selectPrescription: (id: string) => void;
  selectMedicine: (id: string) => void;
  updatePrescriptionStatus: (id: string, status: RequestStatus) => void;
  updateMedicineDecision: (medicineId: string, status: FulfillmentStatus, dispensedQty: number, notes?: string) => void;
  toggleMedicinePicked: (medicineId: string) => void;
  substituteMedicine: (medicineId: string, sub: { name: string; form: string; rack: string; inStock: number; salt: string }) => void;
  pickAllMedicines: () => void;
  markReady: (rxId: string) => void;
  completeHandover: (rxId: string) => void;
  holdPrescription: (rxId: string, reason: string) => void;
  setWorkflowStep: (step: number) => void;
  setActiveNavTab: (tab: 'workspace' | 'inventory' | 'orders' | 'analytics') => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: string) => void;
  setSortOrder: (order: QueueSortOption) => void;
  setFilterUnavailableOnly: (val: boolean | ((prev: boolean) => boolean)) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openAdjustModal: (medicine: WorkspaceMedicine) => void;
  closeAdjustModal: () => void;
  openReconsultModal: (medicine: WorkspaceMedicine) => void;
  closeReconsultModal: () => void;
  openViewPrescriptionModal: () => void;
  closeViewPrescriptionModal: () => void;
  openManageStockModal: (target?: StockTarget) => void;
  closeManageStockModal: () => void;
  openAddMedicineModal: () => void;
  closeAddMedicineModal: () => void;
}

export const useDispensaryWorkspace = create<DispensaryWorkspaceState>((set) => ({
  prescriptions: MOCK_PRESCRIPTIONS,
  selectedPrescriptionId: MOCK_PRESCRIPTIONS[0]?.id || '',
  selectedMedicineId: MOCK_PRESCRIPTIONS[0]?.medicines[0]?.id || '',
  pipelineStats: INITIAL_PIPELINE_STATS,
  activeNavTab: 'workspace',
  workflowStep: 1,
  searchQuery: '',
  statusFilter: 'ALL',
  sortOrder: 'newest',
  filterUnavailableOnly: false,
  isCommandPaletteOpen: false,
  isAdjustModalOpen: false,
  editingMedicine: null,
  isReconsultModalOpen: false,
  reconsultingMedicine: null,
  isViewPrescriptionModalOpen: false,
  isManageStockModalOpen: false,
  isAddMedicineModalOpen: false,
  managingStockTarget: null,

  selectPrescription: (id) => set((s) => {
    const rx = s.prescriptions.find((p) => p.id === id);
    return {
      selectedPrescriptionId: id,
      selectedMedicineId: rx?.medicines[0]?.id ?? s.selectedMedicineId,
      workflowStep: rx?.status === 'READY' ? 2 : rx?.status === 'PROCESSING' ? 1 : 0,
    };
  }),

  selectMedicine: (id) => set({ selectedMedicineId: id }),

  updatePrescriptionStatus: (id, status) => set((s) => ({
    prescriptions: s.prescriptions.map((rx) => rx.id === id ? { ...rx, status } : rx),
  })),

  updateMedicineDecision: (medId, status, qty, notes) => set((s) => ({
    prescriptions: s.prescriptions.map((rx) => rx.id !== s.selectedPrescriptionId ? rx : {
      ...rx,
      medicines: rx.medicines.map((m) => m.id !== medId ? m : { ...m, status, dispensedQuantity: qty, reconsultationNotes: notes ?? m.reconsultationNotes }),
    }),
    isAdjustModalOpen: false,
    editingMedicine: null,
  })),

  toggleMedicinePicked: (medId) => set((s) => ({
    prescriptions: s.prescriptions.map((rx) => rx.id !== s.selectedPrescriptionId ? rx : {
      ...rx,
      medicines: rx.medicines.map((m) => m.id !== medId ? m : { ...m, picked: !m.picked }),
    }),
  })),

  substituteMedicine: (medId, sub) => set((s) => ({
    prescriptions: s.prescriptions.map((rx) => rx.id !== s.selectedPrescriptionId ? rx : {
      ...rx,
      medicines: rx.medicines.map((m) => m.id !== medId ? m : {
        ...m,
        originalName: m.originalName || m.name,
        name: sub.name,
        form: (sub.form as any) || m.form,
        saltComposition: sub.salt,
        rackLocation: `${sub.rack} · Cold Chain: No`,
        inStockQuantity: sub.inStock,
        isSubstituted: true,
        picked: true,
      }),
    }),
  })),

  pickAllMedicines: () => set((s) => ({
    prescriptions: s.prescriptions.map((rx) => rx.id !== s.selectedPrescriptionId ? rx : {
      ...rx,
      medicines: rx.medicines.map((m) => ({ ...m, picked: true })),
    }),
  })),

  markReady: (rxId) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rxify_token') : null;
    if (token) {
      markReadyCommand(rxId).catch((e) => console.warn('[markReady API]', e));
    }
    set((s) => ({
      prescriptions: s.prescriptions.map((rx) => rx.id === rxId ? { ...rx, status: 'READY' } : rx),
      workflowStep: 2,
      pipelineStats: { ...s.pipelineStats, preparingCount: Math.max(0, s.pipelineStats.preparingCount - 1), readyCount: s.pipelineStats.readyCount + 1 },
    }));
  },

  completeHandover: (rxId) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rxify_token') : null;
    if (token) {
      dispenseRequestCommand(rxId).catch((e) => console.warn('[dispense API]', e));
    }
    set((s) => {
      const updated = s.prescriptions.map((rx) => rx.id === rxId ? {
        ...rx,
        status: 'DISPENSED' as RequestStatus,
        medicines: rx.medicines.map((m) => ({ ...m, inStockQuantity: Math.max(0, m.inStockQuantity - m.prescribedQuantity) })),
      } : rx);
      const remainingPending = updated.find((rx) => rx.id !== rxId && (rx.status === 'PROCESSING' || rx.status === 'PENDING' || rx.status === 'READY'));
      return {
        prescriptions: updated,
        pipelineStats: { ...s.pipelineStats, readyCount: Math.max(0, s.pipelineStats.readyCount - 1), completedCount: s.pipelineStats.completedCount + 1 },
        selectedPrescriptionId: remainingPending ? remainingPending.id : s.selectedPrescriptionId,
        selectedMedicineId: remainingPending?.medicines[0]?.id ?? s.selectedMedicineId,
      };
    });
  },

  holdPrescription: (rxId, reason) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rxify_token') : null;
    if (token) {
      reconsultDoctorCommand(rxId, reason, false).catch((e) => console.warn('[reconsult API]', e));
    }
    set((s) => ({
      prescriptions: s.prescriptions.map((rx) => rx.id === rxId ? { ...rx, status: 'RECONSULTATION_NEEDED', isOnHold: true, holdReason: reason } : rx),
    }));
  },

  setWorkflowStep: (step) => set({ workflowStep: step }),
  setActiveNavTab: (tab) => set({ activeNavTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setStatusFilter: (f) => set({ statusFilter: f }),
  setSortOrder: (o) => set({ sortOrder: o }),
  setFilterUnavailableOnly: (val) => set((s) => ({ filterUnavailableOnly: typeof val === 'function' ? val(s.filterUnavailableOnly) : val })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  openAdjustModal: (m) => set({ isAdjustModalOpen: true, editingMedicine: m }),
  closeAdjustModal: () => set({ isAdjustModalOpen: false, editingMedicine: null }),
  openReconsultModal: (m) => set({ isReconsultModalOpen: true, reconsultingMedicine: m }),
  closeReconsultModal: () => set({ isReconsultModalOpen: false, reconsultingMedicine: null }),
  openViewPrescriptionModal: () => set({ isViewPrescriptionModalOpen: true }),
  closeViewPrescriptionModal: () => set({ isViewPrescriptionModalOpen: false }),
  openManageStockModal: (t) => set({ isManageStockModalOpen: true, managingStockTarget: t || null }),
  closeManageStockModal: () => set({ isManageStockModalOpen: false, managingStockTarget: null }),
  openAddMedicineModal: () => set({ isAddMedicineModalOpen: true }),
  closeAddMedicineModal: () => set({ isAddMedicineModalOpen: false }),
}));
