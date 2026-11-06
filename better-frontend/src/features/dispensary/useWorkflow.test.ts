import { describe, it, expect } from 'vitest';
import {
  workflowReducer,
  createInitialWorkflowState,
} from './workflowReducer';
import { WorkspacePrescription, PipelineStats } from './types';

const mockPipelineStats: PipelineStats = {
  newCount: 12,
  preparingCount: 5,
  readyCount: 3,
  completedCount: 18,
};

const mockAvailablePrescription: WorkspacePrescription = {
  id: 'rx-test-avail',
  rxNumber: 'RX-2026-TEST1',
  patientName: 'Test Patient',
  patientInitials: 'TP',
  patientAge: 30,
  patientGender: 'Male',
  date: '03 Nov 2026',
  doctorName: 'Dr. Test',
  doctorSpecialty: 'General',
  diagnosis: 'Fever',
  notes: 'Rest and hydration',
  status: 'PENDING',
  timeAgo: 'Just now',
  medicines: [
    {
      id: 'med-1',
      name: 'Amoxicillin',
      strength: '500 mg',
      form: 'Capsule',
      prescribedQuantity: 10,
      inStockQuantity: 40,
      reservedQuantity: 0,
      status: 'AVAILABLE',
    },
  ],
};

const mockUnavailablePrescription: WorkspacePrescription = {
  ...mockAvailablePrescription,
  id: 'rx-test-unavail',
  rxNumber: 'RX-2026-TEST2',
  medicines: [
    {
      id: 'med-1',
      name: 'Amoxicillin',
      strength: '500 mg',
      form: 'Capsule',
      prescribedQuantity: 10,
      inStockQuantity: 40,
      reservedQuantity: 0,
      status: 'AVAILABLE',
    },
    {
      id: 'med-2',
      name: 'Pantoprazole',
      strength: '40 mg',
      form: 'Tablet',
      prescribedQuantity: 5,
      inStockQuantity: 0,
      reservedQuantity: 0,
      status: 'UNAVAILABLE',
    },
  ],
};

describe('Prescription Workflow Reducer', () => {
  it('handles the happy path transition from NEW to COMPLETED', () => {
    let state = createInitialWorkflowState(mockAvailablePrescription, mockPipelineStats);
    expect(state.stage).toBe('NEW');
    expect(state.activeStepIndex).toBe(0);

    // 1. Process Request -> PREPARING
    state = workflowReducer(state, { type: 'PROCESS_REQUEST' });
    expect(state.stage).toBe('PREPARING');
    expect(state.activeStepIndex).toBe(1);
    expect(state.prescription.status).toBe('PROCESSING');
    expect(state.pipelineStats.newCount).toBe(11);
    expect(state.pipelineStats.preparingCount).toBe(6);

    // 2. Reserve Stock -> PREPARING_RESERVED
    state = workflowReducer(state, { type: 'ATTEMPT_RESERVE' });
    expect(state.stage).toBe('PREPARING_RESERVED');
    expect(state.activeStepIndex).toBe(2);
    expect(state.prescription.medicines[0].reservedQuantity).toBe(10);
    expect(state.prescription.medicines[0].inStockQuantity).toBe(30);

    // 3. Mark Ready -> READY
    state = workflowReducer(state, { type: 'MARK_READY' });
    expect(state.stage).toBe('READY');
    expect(state.activeStepIndex).toBe(3);
    expect(state.prescription.status).toBe('READY');
    expect(state.pipelineStats.preparingCount).toBe(5);
    expect(state.pipelineStats.readyCount).toBe(4);

    // 4. Verify OTP -> READY_VERIFIED
    state = workflowReducer(state, { type: 'OPEN_VERIFY_PICKUP' });
    expect(state.isVerifyPickupOpen).toBe(true);

    state = workflowReducer(state, { type: 'VERIFY_OTP', otp: '749201' });
    expect(state.stage).toBe('READY_VERIFIED');
    expect(state.activeStepIndex).toBe(4);
    expect(state.isVerifyPickupOpen).toBe(false);

    // 5. Complete Dispense -> COMPLETED
    state = workflowReducer(state, { type: 'COMPLETE_DISPENSE' });
    expect(state.stage).toBe('COMPLETED');
    expect(state.activeStepIndex).toBe(5);
    expect(state.prescription.status).toBe('DISPENSED');
    expect(state.pipelineStats.readyCount).toBe(3);
    expect(state.pipelineStats.completedCount).toBe(19);
  });

  it('blocks Reserve Stock when any medicine has unavailable stock and opens guard dialog', () => {
    let state = createInitialWorkflowState(mockUnavailablePrescription, mockPipelineStats);
    state = workflowReducer(state, { type: 'PROCESS_REQUEST' });
    expect(state.stage).toBe('PREPARING');

    // Attempting reserve with unavailable medicine Pantoprazole (stock = 0)
    state = workflowReducer(state, { type: 'ATTEMPT_RESERVE' });
    expect(state.isReserveGuardOpen).toBe(true);
    expect(state.errorMessage).toContain('Unavailable stock');
    expect(state.stage).toBe('PREPARING'); // Still at step 1 (blocked)
  });

  it('unblocks via Partial Reserve when stock is partially available', () => {
    let state = createInitialWorkflowState(mockUnavailablePrescription, mockPipelineStats);
    state = workflowReducer(state, { type: 'PROCESS_REQUEST' });
    state = workflowReducer(state, { type: 'ATTEMPT_RESERVE' });
    expect(state.isReserveGuardOpen).toBe(true);

    // Resolve via Partial Reserve
    state = workflowReducer(state, { type: 'FORCE_PARTIAL_RESERVE' });
    expect(state.isReserveGuardOpen).toBe(false);
    expect(state.stage).toBe('PREPARING_RESERVED');
    expect(state.activeStepIndex).toBe(2);
    expect(state.prescription.medicines[1].status).toBe('PARTIAL');
  });

  it('unblocks via Substitute Equivalent medicine', () => {
    let state = createInitialWorkflowState(mockUnavailablePrescription, mockPipelineStats);
    state = workflowReducer(state, { type: 'PROCESS_REQUEST' });
    state = workflowReducer(state, { type: 'ATTEMPT_RESERVE' });

    // Resolve via substitution
    state = workflowReducer(state, {
      type: 'SUBSTITUTE_UNAVAILABLE',
      medicineId: 'med-2',
      substituteName: 'Omeprazole 40mg',
    });
    expect(state.isReserveGuardOpen).toBe(false);
    expect(state.stage).toBe('PREPARING_RESERVED');
    expect(state.activeStepIndex).toBe(2);
    expect(state.prescription.medicines[1].status).toBe('AVAILABLE');
    expect(state.prescription.medicines[1].name).toContain('Omeprazole');
  });

  it('rolls back state on error', () => {
    let state = createInitialWorkflowState(mockAvailablePrescription, mockPipelineStats);
    state = workflowReducer(state, { type: 'PROCESS_REQUEST' });
    expect(state.stage).toBe('PREPARING');

    // Rollback
    state = workflowReducer(state, { type: 'ROLLBACK' });
    expect(state.stage).toBe('NEW');
    expect(state.activeStepIndex).toBe(0);
  });
});

