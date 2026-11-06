import { WorkflowState, WorkflowAction, WorkflowStage } from './workflowTypes';
import { WorkspacePrescription, PipelineStats } from './types';

export function deriveStage(rx?: WorkspacePrescription | null): WorkflowStage {
  if (!rx) return 'NEW';
  if (rx.status === 'DISPENSED') return 'COMPLETED';
  if (rx.status === 'READY') return 'READY';
  if (rx.status === 'PROCESSING') return 'PREPARING';
  return 'NEW';
}

export function getActiveStepIndex(stage: WorkflowStage): number {
  const map: Record<WorkflowStage, number> = {
    NEW: 0, PREPARING: 1, PREPARING_RESERVED: 2, READY: 3, READY_VERIFIED: 4, COMPLETED: 5,
  };
  return map[stage];
}

export function createInitialWorkflowState(
  prescription?: WorkspacePrescription | null,
  pipelineStats?: PipelineStats
): WorkflowState {
  const stage = deriveStage(prescription);
  const fallbackRx: WorkspacePrescription = prescription || {
    id: '',
    rxNumber: '',
    patientName: '',
    patientInitials: '',
    patientAge: 0,
    patientGender: 'Male',
    date: '',
    doctorName: '',
    doctorSpecialty: '',
    diagnosis: '',
    notes: '',
    status: 'PENDING',
    timeAgo: '',
    medicines: [],
  };
  return {
    prescription: fallbackRx,
    pipelineStats: pipelineStats || { newCount: 0, preparingCount: 0, readyCount: 0, completedCount: 0 },
    stage,
    activeStepIndex: getActiveStepIndex(stage),
    isReserveGuardOpen: false,
    isVerifyPickupOpen: false,
    verificationOtp: '749201',
    errorMessage: null,
  };
}

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  const prev = { ...state, previousState: state, errorMessage: null };

  switch (action.type) {
    case 'PROCESS_REQUEST':
      if (state.stage !== 'NEW') return state;
      return {
        ...prev, stage: 'PREPARING', activeStepIndex: 1,
        prescription: { ...state.prescription, status: 'PROCESSING' },
        pipelineStats: {
          ...state.pipelineStats,
          newCount: Math.max(0, state.pipelineStats.newCount - 1),
          preparingCount: state.pipelineStats.preparingCount + 1,
        },
      };

    case 'ATTEMPT_RESERVE': {
      if (state.stage !== 'PREPARING') return state;
      const blocked = state.prescription.medicines.some((m) => m.inStockQuantity === 0 || m.status === 'UNAVAILABLE');
      if (blocked) return { ...state, isReserveGuardOpen: true, errorMessage: 'Unavailable stock detected' };
      const meds = state.prescription.medicines.map((m) => ({
        ...m, reservedQuantity: (m.reservedQuantity ?? 0) + m.prescribedQuantity,
        inStockQuantity: Math.max(0, m.inStockQuantity - m.prescribedQuantity),
      }));
      return { ...prev, stage: 'PREPARING_RESERVED', activeStepIndex: 2, prescription: { ...state.prescription, medicines: meds } };
    }

    case 'FORCE_PARTIAL_RESERVE': {
      const meds = state.prescription.medicines.map((m) => {
        const can = Math.min(m.inStockQuantity, m.prescribedQuantity);
        return {
          ...m, status: m.inStockQuantity >= m.prescribedQuantity ? m.status : ('PARTIAL' as const),
          reservedQuantity: (m.reservedQuantity ?? 0) + can,
          inStockQuantity: Math.max(0, m.inStockQuantity - can),
        };
      });
      return { ...prev, isReserveGuardOpen: false, stage: 'PREPARING_RESERVED', activeStepIndex: 2, prescription: { ...state.prescription, medicines: meds } };
    }

    case 'SUBSTITUTE_UNAVAILABLE': {
      const meds = state.prescription.medicines.map((m) => m.id === action.medicineId || m.status === 'UNAVAILABLE'
        ? { ...m, name: `${m.name} (${action.substituteName})`, status: 'AVAILABLE' as const, inStockQuantity: 30, reservedQuantity: m.prescribedQuantity }
        : m
      );
      return { ...prev, isReserveGuardOpen: false, stage: 'PREPARING_RESERVED', activeStepIndex: 2, prescription: { ...state.prescription, medicines: meds } };
    }

    case 'CLOSE_RESERVE_GUARD': return { ...state, isReserveGuardOpen: false };

    case 'MARK_READY':
      if (state.stage !== 'PREPARING_RESERVED') return state;
      return {
        ...prev, stage: 'READY', activeStepIndex: 3,
        prescription: { ...state.prescription, status: 'READY' },
        pipelineStats: {
          ...state.pipelineStats,
          preparingCount: Math.max(0, state.pipelineStats.preparingCount - 1),
          readyCount: state.pipelineStats.readyCount + 1,
        },
      };

    case 'OPEN_VERIFY_PICKUP': return { ...state, isVerifyPickupOpen: true };
    case 'CLOSE_VERIFY_PICKUP': return { ...state, isVerifyPickupOpen: false };

    case 'VERIFY_OTP':
      if (action.otp.trim() !== state.verificationOtp) return { ...state, errorMessage: 'Invalid verification OTP code' };
      return { ...prev, isVerifyPickupOpen: false, stage: 'READY_VERIFIED', activeStepIndex: 4 };

    case 'COMPLETE_DISPENSE':
      if (state.stage !== 'READY_VERIFIED') return state;
      return {
        ...prev, stage: 'COMPLETED', activeStepIndex: 5,
        prescription: { ...state.prescription, status: 'DISPENSED' },
        pipelineStats: {
          ...state.pipelineStats,
          readyCount: Math.max(0, state.pipelineStats.readyCount - 1),
          completedCount: state.pipelineStats.completedCount + 1,
        },
      };

    case 'ROLLBACK': return state.previousState ? { ...state.previousState } : state;
    case 'SET_PRESCRIPTION': return createInitialWorkflowState(action.prescription, state.pipelineStats);
    default: return state;
  }
}
