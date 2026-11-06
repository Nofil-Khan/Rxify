/**
 * useBackendDispensarySync Hook
 * =============================================================================
 * Real-time dispensary data synchronization.
 *
 * REPLACES HTTP POLLING WITH WEBSOCKET REACTIVE SYNC:
 * 1. Initial Load:
 *    When the dashboard opens, `syncData()` fetches profile, queue, and stats once.
 * 2. Real-Time Push:
 *    `useDispensaryWebSocket` connects to the server's WebSocket event stream.
 *    Whenever a new ticket is submitted or an order is updated, the server pushes
 *    a lightweight notification, triggering `syncData()` immediately (< 50ms latency).
 * 3. Zero Idle Polling:
 *    There is no `setInterval` burning server CPU and database connections.
 * =============================================================================
 */

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
import { mapDetailToWorkspace } from './dispensaryMapping';
import { useDispensaryWebSocket } from './useDispensaryWebSocket';

export function useBackendDispensarySync() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isFetchingRef = React.useRef(false);
  const detailsCacheRef = React.useRef<Map<number, RequestDetail>>(new Map());

  const syncData = React.useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const [profile, stats, queue, inventory] = await Promise.allSettled([
        fetchDispensaryProfile(),
        fetchDispensaryDashboardStats(),
        fetchDispensaryQueue(),
        fetchInventory(),
      ]);

      // 1. Sync Profile Name
      if (profile.status === 'fulfilled' && profile.value?.name) {
        const authState = useAuthStore.getState();
        if (authState.displayName !== profile.value.name) {
          authState.updateProfileData({ displayName: profile.value.name });
        }
      }

      // 2. Build Inventory Map
      const invMap = new Map<number, InventoryItem>();
      if (inventory.status === 'fulfilled' && Array.isArray(inventory.value)) {
        for (const item of inventory.value) {
          invMap.set(item.medicine_id, item);
        }
      }

      // 3. Sync Queue Items
      if (queue.status === 'fulfilled' && Array.isArray(queue.value)) {
        if (queue.value.length === 0) {
          useDispensaryWorkspace.setState({
            prescriptions: [],
            selectedPrescriptionId: '',
            selectedMedicineId: '',
          });
        } else {
          const itemsToFetch = queue.value.slice(0, 10);
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

      // 4. Sync Pipeline Counters
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
  }, []);

  // Initial fetch on mount
  React.useEffect(() => {
    if (token && isAuthenticated) {
      syncData();
    }
  }, [token, isAuthenticated, syncData]);

  // Connect to live WebSocket: whenever an event occurs, immediately trigger syncData()
  useDispensaryWebSocket({
    onQueueUpdate: syncData,
  });
}

export default useBackendDispensarySync;
