import * as React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowReducer, createInitialWorkflowState } from './workflowReducer';
import { useDispensaryWorkspace } from './hooks/useDispensaryWorkspace';
import { WorkflowAction } from './workflowTypes';
import {
  processRequestCommand,
  markReadyCommand,
  verifyPickupCommand,
  dispenseRequestCommand,
  updateItemDecisionCommand,
} from './api';

export function useWorkflow() {
  const { prescriptions, selectedPrescriptionId, pipelineStats } = useDispensaryWorkspace();
  const queryClient = useQueryClient();

  const currentRx = React.useMemo(() => {
    return prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
  }, [prescriptions, selectedPrescriptionId]);

  const [state, dispatch] = React.useReducer(
    workflowReducer,
    createInitialWorkflowState(currentRx, pipelineStats)
  );

  React.useEffect(() => {
    if (currentRx && currentRx.id !== state.prescription?.id) {
      dispatch({ type: 'SET_PRESCRIPTION', prescription: currentRx });
    }
  }, [currentRx, state.prescription?.id]);

  const stepMutation = useMutation({
    mutationFn: async (action: WorkflowAction) => {
      const rxId = state.prescription?.id;
      if (!rxId) return action;
      if (action.type === 'PROCESS_REQUEST') {
        await processRequestCommand(rxId);
      } else if (action.type === 'MARK_READY') {
        await markReadyCommand(rxId);
      } else if (action.type === 'VERIFY_OTP') {
        await verifyPickupCommand(rxId, action.otp);
      } else if (action.type === 'COMPLETE_DISPENSE') {
        await dispenseRequestCommand(rxId, state.verificationOtp);
      } else if (action.type === 'FORCE_PARTIAL_RESERVE') {
        await updateItemDecisionCommand(rxId, 'all', 'PARTIAL');
      } else if (action.type === 'SUBSTITUTE_UNAVAILABLE') {
        await updateItemDecisionCommand(rxId, action.medicineId, 'SUBSTITUTE', undefined, action.substituteName);
      }
      return action;
    },
    onMutate: (action) => dispatch(action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary_dashboard_stats'] });
    },
    onError: () => dispatch({ type: 'ROLLBACK' }),
  });

  const handleStepClick = React.useCallback(
    (stepIndex: number) => {
      const rx = state.prescription;
      if (!rx?.id) return;

      if (stepIndex === 0) {
        if (state.stage === 'NEW' || rx.status === 'PENDING') {
          stepMutation.mutate({ type: 'PROCESS_REQUEST' });
        }
      } else if (stepIndex === 1) {
        if (state.stage === 'PREPARING' || rx.status === 'PROCESSING') {
          stepMutation.mutate({ type: 'MARK_READY' });
        }
      } else if (stepIndex === 2) {
        if (state.stage === 'READY' || state.stage === 'READY_VERIFIED' || rx.status === 'READY') {
          dispatch({ type: 'OPEN_VERIFY_PICKUP' });
        }
      } else if (stepIndex === 3) {
        if (state.stage === 'READY_VERIFIED') {
          stepMutation.mutate({ type: 'COMPLETE_DISPENSE' });
        } else if (state.stage === 'READY' || rx.status === 'READY') {
          // If verify hasn't been completed yet, open verify dialog first
          dispatch({ type: 'OPEN_VERIFY_PICKUP' });
        }
      }
    },
    [state.prescription, state.stage, stepMutation]
  );

  useHotkeys('enter', (e) => {
    const activeEl = document.activeElement;
    const isInput =
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl?.getAttribute('role') === 'combobox';
    if (!isInput && !state.isReserveGuardOpen && !state.isVerifyPickupOpen) {
      e.preventDefault();
      handleStepClick(state.activeStepIndex);
    }
  });

  return {
    state,
    dispatch,
    handleStepClick,
    triggerActiveStep: () => handleStepClick(state.activeStepIndex),
    isPending: stepMutation.isPending,
  };
}

export default useWorkflow;
