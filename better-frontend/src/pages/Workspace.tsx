import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import SceneBackground from '@/features/dispensary/components/SceneBackground';
import TopNav from '@/features/dispensary/components/TopNav';
import Hero from '@/features/dispensary/components/Hero';
import PipelineArc from '@/features/dispensary/components/PipelineArc';
import QueuePanel from '@/features/dispensary/components/QueuePanel';
import PrescriptionCard from '@/features/dispensary/components/PrescriptionCard';
import StockPanel from '@/features/dispensary/components/StockPanel';
import WorkflowBar from '@/features/dispensary/components/WorkflowBar';
import AriaLiveRegion from '@/features/dispensary/components/AriaLiveRegion';
import AdjustFulfillmentModal from '@/features/dispensary/components/AdjustFulfillmentModal';
import ReconsultationModal from '@/features/dispensary/components/ReconsultationModal';
import ViewPrescriptionDialog from '@/features/dispensary/components/ViewPrescriptionDialog';
import ManageStockModal from '@/features/dispensary/components/ManageStockModal';
import { useBackendDispensarySync } from '@/features/dispensary/hooks/useBackendDispensarySync';
import InventoryView from '@/features/dispensary/components/inventory/InventoryView';
import OrdersView from '@/features/dispensary/components/orders/OrdersView';
import AnalyticsView from '@/features/dispensary/components/analytics/AnalyticsView';

export const Workspace: React.FC = () => {
  useBackendDispensarySync();
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation();

  const isInventory = location.pathname.startsWith('/inventory');
  const isOrders = location.pathname.startsWith('/orders');
  const isAnalytics = location.pathname.startsWith('/analytics');
  const isSubView = isInventory || isOrders || isAnalytics;

  return (
    <div className={`relative flex min-h-screen w-full flex-col justify-between overflow-x-hidden text-white select-none ${isSubView ? 'overflow-y-auto' : 'lg:h-[100dvh] lg:overflow-hidden'}`}>
      {/* Screen Reader Live Status Region */}
      <AriaLiveRegion />

      {/* Layered Botanical Background Scene & Animated Ambient Props */}
      <SceneBackground />

      {/* Top Header & Navigation Bar */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full shrink-0 z-30"
      >
        <TopNav />
      </motion.div>

      {/* Render Subview if on /inventory, /orders, or /analytics */}
      {isInventory ? (
        <main className="relative z-20 flex-1 px-4 lg:px-14 py-6 min-h-0">
          <InventoryView />
        </main>
      ) : isOrders ? (
        <main className="relative z-20 flex-1 px-4 lg:px-14 py-6 min-h-0">
          <OrdersView />
        </main>
      ) : isAnalytics ? (
        <main className="relative z-20 flex-1 px-4 lg:px-14 py-6 min-h-0">
          <AnalyticsView />
        </main>
      ) : (
        <>
          {/* Subheader: Hero Banner & Pipeline Tracker Arc */}
          <motion.section
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
            className="relative z-20 w-full shrink-0 px-6 lg:px-14 pt-2 pb-2"
            aria-label="Dispensary Overview"
          >
            <div className="mx-auto dispensary-overview-bar">
              <Hero />
              <PipelineArc />
            </div>
          </motion.section>

          {/* Main 3-Column 3D Perspective Workspace Grid */}
          <main
            className="relative z-20 flex-1 px-4 lg:px-14 py-2 min-h-0 flex items-stretch lg:items-center"
            style={{ perspective: '1600px' }}
          >
            <div className="mx-auto dispensary-grid">
              {/* Left Panel: Prescriptions Queue (Tilted Left 3.5deg, stagger 0.14s) */}
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.14, ease: 'easeOut' }}
                className="h-[520px] lg:h-full"
              >
                <QueuePanel />
              </motion.div>

              {/* Center Card: Cream Prescription Detail Card (stagger 0.20s) */}
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2, ease: 'easeOut' }}
                className="h-auto lg:h-full"
              >
                <PrescriptionCard />
              </motion.div>

              {/* Right Panel: Stock & Dispense Inventory (Tilted Right -3.5deg, stagger 0.26s) */}
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.26, ease: 'easeOut' }}
                className="h-[520px] lg:h-full"
              >
                <StockPanel />
              </motion.div>
            </div>
          </main>

          {/* Bottom Floating Action Workflow Bar (stagger 0.32s) */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.32, ease: 'easeOut' }}
            className="w-full shrink-0 z-30"
          >
            <WorkflowBar />
          </motion.div>
        </>
      )}

      {/* Dialogs and Modals */}
      <AdjustFulfillmentModal />
      <ReconsultationModal />
      <ViewPrescriptionDialog />
      <ManageStockModal />
    </div>
  );
};

export default Workspace;
