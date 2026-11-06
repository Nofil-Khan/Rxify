import * as React from 'react';
import { Bookmark, Package, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GlassPanel from './GlassPanel';
import StockTabsContent from './StockTabsContent';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import capStock3D from '@/assets/props/capsule-stock-3d.svg';

export const StockPanel: React.FC = () => {
  const {
    prescriptions,
    selectedPrescriptionId,
    selectedMedicineId,
    openManageStockModal,
  } = useDispensaryWorkspace();

  const [activeTab, setActiveTab] = React.useState<string>('stock');
  const [isBookmarked, setIsBookmarked] = React.useState<boolean>(false);

  const selectedMedicine = React.useMemo(() => {
    const rx =
      prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
    return (
      rx?.medicines.find((m) => m.id === selectedMedicineId) ??
      rx?.medicines[0]
    );
  }, [prescriptions, selectedPrescriptionId, selectedMedicineId]);

  if (!selectedMedicine) return null;

  return (
    <GlassPanel
      tilt="right"
      tabIndex={0}
      data-testid="slot-stock-panel"
      className="relative flex h-full min-w-0 flex-col justify-between p-6 overflow-visible border-mint-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
      aria-label={`Stock details for ${selectedMedicine.name}`}
    >
      {/* 3D Floating Overlapping Capsule Prop with subtle hover parallax */}
      <motion.div
        className="absolute -top-8 right-14 z-30 pointer-events-none"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ y: -8, rotate: -36, scale: 1.05 }}
        aria-hidden="true"
      >
        <img
          src={capStock3D}
          alt=""
          width={88}
          height={88}
          loading="lazy"
          className="drop-shadow-2xl select-none"
        />
      </motion.div>

      {/* Top Header Row: Medicine Title, Subtitle, and Bookmark Toggle */}
      <div className="flex items-start justify-between z-20">
        <div className="flex flex-col min-w-0 pr-4">
          <h2 className="font-serif text-[28px] font-normal tracking-tight text-cream-from leading-none truncate">
            {selectedMedicine.name}
          </h2>
          <p className="text-xs text-emerald-200/60 font-medium mt-1">
            {selectedMedicine.strength} · {selectedMedicine.form}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBookmarked((prev) => !prev)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-emerald-200/70 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
          aria-label={
            isBookmarked
              ? `Unpin ${selectedMedicine.name}`
              : `Pin ${selectedMedicine.name} to quick access`
          }
        >
          <Bookmark
            className={`h-4 w-4 transition-all ${
              isBookmarked
                ? 'fill-mint-300 text-mint-300 drop-shadow-[0_0_6px_rgba(110,231,183,0.8)]'
                : 'text-emerald-200/70'
            }`}
          />
        </button>
      </div>

      {/* Main Content Crossfades on Medicine Selection */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedMedicine.id}
          initial={{ opacity: 0.8, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0.8, y: -4 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col flex-1 justify-between min-h-0 pt-4 z-10"
        >
          {/* Radix Tabs with Animated Mint Underline */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col justify-between"
          >
            <TabsList className="bg-transparent justify-start gap-6 border-b border-mint-400/15 p-0 h-auto rounded-none w-full">
              {(['stock', 'batch', 'info'] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative pb-2 px-0 text-xs font-semibold uppercase tracking-wider capitalize text-emerald-200/50 data-[state=active]:text-mint-300 data-[state=active]:bg-transparent rounded-none transition-colors cursor-pointer"
                >
                  {tab === 'stock' ? 'Stock' : tab === 'batch' ? 'Batch' : 'Info'}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="stockTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-mint-400 shadow-[0_0_8px_rgba(110,231,183,0.85)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <StockTabsContent medicine={selectedMedicine} />
          </Tabs>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Action: Full-Width Mint Gradient Button */}
      <div className="pt-3 z-10">
        <button
          type="button"
          onClick={openManageStockModal}
          className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-500/25 to-mint-400/20 border border-mint-400/35 px-4 py-3 text-xs font-semibold text-white backdrop-blur-md transition-all hover:from-emerald-500/40 hover:to-mint-400/30 hover:border-mint-400/60 shadow-glass focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
          aria-label="Open Manage Stock dialog"
        >
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-mint-300" />
            <span className="font-semibold text-white">Manage Stock</span>
          </span>
          <ChevronRight className="h-4 w-4 text-mint-300" />
        </button>
      </div>
    </GlassPanel>
  );
};

export default StockPanel;
