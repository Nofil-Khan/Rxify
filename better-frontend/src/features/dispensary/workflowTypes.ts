import { WorkspacePrescription, PipelineStats } from './types';

export type WorkflowStage =
  | 'NEW'
  | 'PREPARING'
  | 'READY'
  | 'READY_VERIFIED'
  | 'COMPLETED';

export type WorkflowStepId =
  | 'process'
  | 'ready'
  | 'verify'
  | 'complete';

export interface WorkflowState {
  prescription: WorkspacePrescription;
  pipelineStats: PipelineStats;
  stage: WorkflowStage;
  activeStepIndex: number;
  isReserveGuardOpen: boolean;
  isVerifyPickupOpen: boolean;
  verificationOtp: string;
  errorMessage: string | null;
  previousState?: WorkflowState;
}

export type WorkflowAction =
  | { type: 'PROCESS_REQUEST' }
  | { type: 'MARK_READY' }
  | { type: 'OPEN_VERIFY_PICKUP' }
  | { type: 'CLOSE_VERIFY_PICKUP' }
  | { type: 'VERIFY_OTP'; otp: string }
  | { type: 'COMPLETE_DISPENSE' }
  | { type: 'OPEN_RESERVE_GUARD' }
  | { type: 'CLOSE_RESERVE_GUARD' }
  | { type: 'FORCE_PARTIAL_RESERVE' }
  | { type: 'SUBSTITUTE_UNAVAILABLE'; medicineId: string; substituteName: string }
  | { type: 'ROLLBACK' }
  | { type: 'SET_PRESCRIPTION'; prescription: WorkspacePrescription };
