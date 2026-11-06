import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPrescriptions,
  fetchPrescription,
  fetchInventory,
  transitionPrescription,
  updateInventory,
  processRequestCommand,
  markReadyCommand,
  verifyPickupCommand,
  dispenseRequestCommand,
  cancelRequestCommand,
  updateItemDecisionCommand,
  reconsultDoctorCommand,
  aiResolveRequestCommand,
  fetchDashboardStats,
  fetchInventoryAlerts,
  addOrUpdateStock,
} from '../api';
import { Prescription, InventoryItem, BackendCommandResult, DispensaryDashboardStats } from '../types';

export function usePrescriptions(status?: string) {
  return useQuery<Prescription[], Error>({
    queryKey: ['prescriptions', status],
    queryFn: () => fetchPrescriptions(status),
    staleTime: 30000,
  });
}

export function usePrescription(id?: string) {
  return useQuery<Prescription, Error>({
    queryKey: ['prescription', id],
    queryFn: () => fetchPrescription(id!),
    enabled: Boolean(id),
  });
}

export function useInventory(medicineId?: string) {
  return useQuery<InventoryItem, Error>({
    queryKey: ['inventory', medicineId],
    queryFn: () => fetchInventory(medicineId!),
    enabled: Boolean(medicineId),
  });
}

export function useDashboardStats() {
  return useQuery<DispensaryDashboardStats, Error>({
    queryKey: ['dispensary_dashboard_stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000,
  });
}

export function useInventoryAlerts() {
  return useQuery<unknown[], Error>({
    queryKey: ['dispensary_alerts'],
    queryFn: fetchInventoryAlerts,
  });
}

export function useWorkflowCommands() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['dispensary_dashboard_stats'] });
  };

  const processMutation = useMutation<BackendCommandResult, Error, string>({
    mutationFn: (id) => processRequestCommand(id),
    onSuccess: invalidate,
  });
  const readyMutation = useMutation<BackendCommandResult, Error, string>({
    mutationFn: (id) => markReadyCommand(id),
    onSuccess: invalidate,
  });
  const verifyMutation = useMutation<BackendCommandResult, Error, { id: string; patientCode: string }>({
    mutationFn: ({ id, patientCode }) => verifyPickupCommand(id, patientCode),
    onSuccess: invalidate,
  });
  const dispenseMutation = useMutation<BackendCommandResult, Error, { id: string; patientCode: string }>({
    mutationFn: ({ id, patientCode }) => dispenseRequestCommand(id, patientCode),
    onSuccess: invalidate,
  });
  const cancelMutation = useMutation<BackendCommandResult, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => cancelRequestCommand(id, reason),
    onSuccess: invalidate,
  });

  return { processMutation, readyMutation, verifyMutation, dispenseMutation, cancelMutation };
}

export function useClinicalDecisions() {
  const queryClient = useQueryClient();

  const itemDecisionMutation = useMutation<
    BackendCommandResult,
    Error,
    { requestId: string; itemId: string; decision: string; qty?: number; notes?: string }
  >({
    mutationFn: ({ requestId, itemId, decision, qty, notes }) =>
      updateItemDecisionCommand(requestId, itemId, decision, qty, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const reconsultMutation = useMutation<
    BackendCommandResult,
    Error,
    { requestId: string; notes: string; urgent?: boolean }
  >({
    mutationFn: ({ requestId, notes, urgent }) => reconsultDoctorCommand(requestId, notes, urgent),
  });

  const aiResolveMutation = useMutation<BackendCommandResult, Error, string>({
    mutationFn: (requestId) => aiResolveRequestCommand(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  return { itemDecisionMutation, reconsultMutation, aiResolveMutation };
}

export function useTransitionPrescription() {
  const queryClient = useQueryClient();
  return useMutation<Prescription, Error, { id: string; targetStatus: Prescription['status'] }>({
    mutationFn: ({ id, targetStatus }) => transitionPrescription(id, targetStatus),
    onSuccess: (updated) => {
      queryClient.setQueryData<Prescription[]>(['prescriptions'], (old) =>
        old ? old.map((rx) => (rx.id === updated.id ? updated : rx)) : [updated]
      );
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation<InventoryItem, Error, { medicineId: string; updates: Partial<InventoryItem> }>({
    mutationFn: ({ medicineId, updates }) => updateInventory(medicineId, updates),
    onSuccess: (updated) => {
      queryClient.setQueryData(['inventory', updated.medicineId], updated);
    },
  });
}
