import * as React from 'react';
import { useLocation } from '@tanstack/react-router';
import TopNav from '@/features/dispensary/components/TopNav';
import InflowQueuePanel from '@/features/dispensary/components/InflowQueuePanel';
import PrescriptionSlipSheet from '@/features/dispensary/components/PrescriptionSlipSheet';
import TelemetryHud from '@/features/dispensary/components/TelemetryHud';
import DynamicPrescriptionIsland from '@/features/dispensary/components/DynamicPrescriptionIsland';
import DoctorQueryModal from '@/features/dispensary/components/DoctorQueryModal';
import InventoryView from '@/features/dispensary/components/inventory/InventoryView';
import OrdersView from '@/features/dispensary/components/orders/OrdersView';
import AnalyticsView from '@/features/dispensary/components/analytics/AnalyticsView';
import SettingsView from '@/features/dispensary/components/settings/SettingsView';
import AddMedicineModal from '@/features/dispensary/components/AddMedicineModal';
import ManageStockModal from '@/features/dispensary/components/ManageStockModal';
import { useBackendDispensarySync } from '@/features/dispensary/hooks/useBackendDispensarySync';

/** Which sub-view is active based on current URL pathname. */
function useActiveView() {
  const location = useLocation();
  const path = location.pathname;
  if (path === '/inventory') return 'inventory';
  if (path === '/orders') return 'orders';
  if (path === '/analytics') return 'analytics';
  if (path === '/settings') return 'settings';
  return 'workspace'; // /dispensary or /workspace
}

export const Workspace: React.FC = () => {
  useBackendDispensarySync();
  const activeView = useActiveView();

  const [isDoctorModalOpen, setIsDoctorModalOpen] = React.useState(false);
  const [forceOpenVerify, setForceOpenVerify] = React.useState(false);
  const [triggerSubstituteIndex, setTriggerSubstituteIndex] = React.useState<number | null>(null);

  const handleTriggerVerify = () => setForceOpenVerify(true);
  const handleTriggerSubstitute = () => {
    setTriggerSubstituteIndex(0);
    setTimeout(() => setTriggerSubstituteIndex(null), 2500);
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none flex flex-col"
      style={{ background: 'var(--ti-canvas, #EFECE6)', color: 'var(--ti-ink, #181816)' }}
    >
      {/* SVG Noise Grain Overlay */}
      <div className="ti-noise-overlay" aria-hidden="true" />

      {/* Radial Ambient Bloom */}
      <div className="ti-bloom" aria-hidden="true" />

      {/* Top Command Ribbon (always visible) */}
      <div className="relative z-20 shrink-0">
        <TopNav
          onOpenDoctorModal={() => setIsDoctorModalOpen(true)}
          onTriggerVerify={handleTriggerVerify}
          onTriggerSubstitute={handleTriggerSubstitute}
        />
      </div>

      {/* Main content area */}
      {activeView === 'workspace' ? (
        <>
          {/* Crosshair decorators */}
          <div
            className="ti-crosshair"
            style={{ position: 'absolute', top: 56, left: 310, zIndex: 10 }}
            aria-hidden="true"
          />
          <div
            className="ti-crosshair"
            style={{ position: 'absolute', top: 56, right: 340, zIndex: 10 }}
            aria-hidden="true"
          />

          {/* 3-Column Spatial Grid */}
          <main
            className="relative z-10 flex-1 min-h-0 overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: '310px minmax(520px, 1fr) 340px',
              gap: 0,
            }}
            aria-label="Dispensary workspace"
          >
            <InflowQueuePanel />
            <div className="flex flex-col h-full overflow-hidden">
              <PrescriptionSlipSheet
                onOpenDoctorModal={() => setIsDoctorModalOpen(true)}
                triggerSubstituteItemIndex={triggerSubstituteIndex}
              />
            </div>
            <TelemetryHud />
          </main>

          {/* Dynamic Island & Doctor Modal */}
          <DynamicPrescriptionIsland
            forceOpenVerify={forceOpenVerify}
            onCloseVerify={() => setForceOpenVerify(false)}
          />
          <DoctorQueryModal
            open={isDoctorModalOpen}
            onClose={() => setIsDoctorModalOpen(false)}
          />
        </>
      ) : (
        /* Scrollable sub-page canvas */
        <main
          className="relative z-10 flex-1 min-h-0 overflow-y-auto px-10 pt-10"
          aria-label={`Dispensary ${activeView}`}
        >
          {activeView === 'inventory' && <InventoryView />}
          {activeView === 'orders' && <OrdersView />}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      )}
      {/* Global modals — available on ALL routes */}
      <AddMedicineModal />
      <ManageStockModal />
    </div>
  );
};

export default Workspace;
