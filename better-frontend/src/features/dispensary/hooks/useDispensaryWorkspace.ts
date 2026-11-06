import { create } from 'zustand';
import {
  WorkspacePrescription,
  WorkspaceMedicine,
  PipelineStats,
  FulfillmentStatus,
} from '../types';
import { MOCK_PRESCRIPTIONS, INITIAL_PIPELINE_STATS } from '../mocks/dispensaryMockData';

export type QueueSortOption = 'newest' | 'oldest' | 'urgent';

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

  // Modals state
  isAdjustModalOpen: boolean;
  editingMedicine: WorkspaceMedicine | null;
  isReconsultModalOpen: boolean;
  reconsultingMedicine: WorkspaceMedicine | null;
  isViewPrescriptionModalOpen: boolean;
  isManageStockModalOpen: boolean;

  // Actions
  selectPrescription: (id: string) => void;
  selectMedicine: (id: string) => void;
  updateMedicineDecision: (
    medicineId: string,
    status: FulfillmentStatus,
    dispensedQty: number,
    notes?: string
  ) => void;
  setWorkflowStep: (step: number) => void;
  advanceWorkflow: () => void;
  setActiveNavTab: (tab: 'workspace' | 'inventory' | 'orders' | 'analytics') => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: string) => void;
  setSortOrder: (order: QueueSortOption) => void;
  setFilterUnavailableOnly: (val: boolean | ((prev: boolean) => boolean)) => void;

  openAdjustModal: (medicine: WorkspaceMedicine) => void;
  closeAdjustModal: () => void;
  openReconsultModal: (medicine: WorkspaceMedicine) => void;
  closeReconsultModal: () => void;
  openViewPrescriptionModal: () => void;
  closeViewPrescriptionModal: () => void;
  openManageStockModal: () => void;
  closeManageStockModal: () => void;
}

export const useDispensaryWorkspace = create<DispensaryWorkspaceState>((set) => ({
  prescriptions: MOCK_PRESCRIPTIONS,
  selectedPrescriptionId: MOCK_PRESCRIPTIONS[0]?.id ?? '',
  selectedMedicineId: MOCK_PRESCRIPTIONS[0]?.medicines[0]?.id ?? '',
  pipelineStats: INITIAL_PIPELINE_STATS,
  activeNavTab: 'workspace',
  workflowStep: 0,
  searchQuery: '',
  statusFilter: 'ALL',
  sortOrder: 'newest',
  filterUnavailableOnly: false,

  isAdjustModalOpen: false,
  editingMedicine: null,
  isReconsultModalOpen: false,
  reconsultingMedicine: null,
  isViewPrescriptionModalOpen: false,
  isManageStockModalOpen: false,

  selectPrescription: (id: string) => {
    set((state) => {
      const target = state.prescriptions.find((p) => p.id === id);
      return {
        selectedPrescriptionId: id,
        selectedMedicineId: target?.medicines[0]?.id ?? state.selectedMedicineId,
        workflowStep: target?.status === 'READY' ? 2 : target?.status === 'PROCESSING' ? 1 : 0,
      };
    });
  },

  selectMedicine: (id: string) => set({ selectedMedicineId: id }),

  updateMedicineDecision: (medicineId, status, dispensedQty, notes) => {
    set((state) => {
      const updatedPrescriptions = state.prescriptions.map((prescription) => {
        if (prescription.id !== state.selectedPrescriptionId) return prescription;
        return {
          ...prescription,
          medicines: prescription.medicines.map((med) => {
            if (med.id !== medicineId) return med;
            return {
              ...med,
              status,
              dispensedQuantity: dispensedQty,
              reconsultationNotes: notes ?? med.reconsultationNotes,
            };
          }),
        };
      });
      return { prescriptions: updatedPrescriptions, isAdjustModalOpen: false, editingMedicine: null };
    });
  },

  setWorkflowStep: (step) => set({ workflowStep: step }),

  advanceWorkflow: () => {
    set((state) => {
      const nextStep = Math.min(state.workflowStep + 1, 4);
      return { workflowStep: nextStep };
    });
  },

  setActiveNavTab: (tab) => set({ activeNavTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setFilterUnavailableOnly: (val) =>
    set((state) => ({
      filterUnavailableOnly: typeof val === 'function' ? val(state.filterUnavailableOnly) : val,
    })),

  openAdjustModal: (medicine) => set({ isAdjustModalOpen: true, editingMedicine: medicine }),
  closeAdjustModal: () => set({ isAdjustModalOpen: false, editingMedicine: null }),
  openReconsultModal: (medicine) => set({ isReconsultModalOpen: true, reconsultingMedicine: medicine }),
  closeReconsultModal: () => set({ isReconsultModalOpen: false, reconsultingMedicine: null }),
  openViewPrescriptionModal: () => set({ isViewPrescriptionModalOpen: true }),
  closeViewPrescriptionModal: () => set({ isViewPrescriptionModalOpen: false }),
  openManageStockModal: () => set({ isManageStockModalOpen: true }),
  closeManageStockModal: () => set({ isManageStockModalOpen: false }),
}));
