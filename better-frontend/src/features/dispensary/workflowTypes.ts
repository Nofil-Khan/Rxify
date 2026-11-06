import { WorkspacePrescription, PipelineStats } from './types';

export type WorkflowStage =
  | 'NEW'
  | 'PREPARING'
  | 'PREPARING_RESERVED'
  | 'READY'
  | 'READY_VERIFIED'
  | 'COMPLETED';

export type WorkflowStepId =
  | 'process'
  | 'reserve'
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
  | { type: 'ATTEMPT_RESERVE' }
  | { type: 'FORCE_PARTIAL_RESERVE' }
  | { type: 'SUBSTITUTE_UNAVAILABLE'; medicineId: string; substituteName: string }
  | { type: 'CLOSE_RESERVE_GUARD' }
  | { type: 'MARK_READY' }
  | { type: 'OPEN_VERIFY_PICKUP' }
  | { type: 'CLOSE_VERIFY_PICKUP' }
  | { type: 'VERIFY_OTP'; otp: string }
  | { type: 'COMPLETE_DISPENSE' }
  | { type: 'ROLLBACK' }
  | { type: 'SET_PRESCRIPTION'; prescription: WorkspacePrescription };

