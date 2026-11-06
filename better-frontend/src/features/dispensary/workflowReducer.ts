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
    NEW: 0,
    PREPARING: 1,
    READY: 2,
    READY_VERIFIED: 3,
    COMPLETED: 4,
  };
  return map[stage] ?? 0;
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
      return {
        ...prev,
        stage: 'PREPARING',
        activeStepIndex: 1,
        prescription: { ...state.prescription, status: 'PROCESSING' },
        pipelineStats: {
          ...state.pipelineStats,
          newCount: Math.max(0, state.pipelineStats.newCount - 1),
          preparingCount: state.pipelineStats.preparingCount + 1,
        },
      };

    case 'MARK_READY':
      return {
        ...prev,
        stage: 'READY',
        activeStepIndex: 2,
        prescription: { ...state.prescription, status: 'READY' },
        pipelineStats: {
          ...state.pipelineStats,
          preparingCount: Math.max(0, state.pipelineStats.preparingCount - 1),
          readyCount: state.pipelineStats.readyCount + 1,
        },
      };

    case 'OPEN_VERIFY_PICKUP':
      return { ...state, isVerifyPickupOpen: true, errorMessage: null };

    case 'CLOSE_VERIFY_PICKUP':
      return { ...state, isVerifyPickupOpen: false };

    case 'VERIFY_OTP':
      if (!action.otp || action.otp.trim().length !== 6) {
        return { ...state, errorMessage: 'Please enter a valid 6-digit code' };
      }
      return {
        ...prev,
        isVerifyPickupOpen: false,
        stage: 'READY_VERIFIED',
        activeStepIndex: 3,
        verificationOtp: action.otp.trim(),
      };

    case 'COMPLETE_DISPENSE':
      return {
        ...prev,
        stage: 'COMPLETED',
        activeStepIndex: 4,
        prescription: { ...state.prescription, status: 'DISPENSED' },
        pipelineStats: {
          ...state.pipelineStats,
          readyCount: Math.max(0, state.pipelineStats.readyCount - 1),
          completedCount: state.pipelineStats.completedCount + 1,
        },
      };

    case 'OPEN_RESERVE_GUARD':
      return { ...state, isReserveGuardOpen: true };

    case 'CLOSE_RESERVE_GUARD':
      return { ...state, isReserveGuardOpen: false };

    case 'FORCE_PARTIAL_RESERVE':
      return { ...prev, isReserveGuardOpen: false };

    case 'SUBSTITUTE_UNAVAILABLE':
      return { ...prev, isReserveGuardOpen: false };

    case 'ROLLBACK':
      return state.previousState ? { ...state.previousState } : state;

    case 'SET_PRESCRIPTION':
      return createInitialWorkflowState(action.prescription, state.pipelineStats);

    default:
      return state;
  }
}
