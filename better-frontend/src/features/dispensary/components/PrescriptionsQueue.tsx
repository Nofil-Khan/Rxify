import * as React from 'react';
import { Layers, SlidersHorizontal } from 'lucide-react';
import GlassPanel from './GlassPanel';
import PrescriptionQueueItem from './PrescriptionQueueItem';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const PrescriptionsQueue: React.FC = () => {
  const {
    prescriptions,
    selectedPrescriptionId,
    selectPrescription,
    searchQuery,
    statusFilter,
    setStatusFilter,
    pipelineStats,
  } = useDispensaryWorkspace();

  const filtered = React.useMemo(() => {
    return prescriptions.filter((p) => {
      const matchQuery =
        p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.rxNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [prescriptions, searchQuery, statusFilter]);

  return (
    <GlassPanel
      tilt="left"
      data-testid="slot-queue-panel"
      className="flex h-full flex-col p-5 border-mint-400/25 overflow-hidden"
      aria-label="Prescriptions Queue List"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-mint-400/15">
        <div className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 text-mint-300" />
          <h2 className="font-sans text-sm font-bold tracking-tight text-white">Prescriptions</h2>
          <span className="flex h-5 items-center justify-center rounded-full bg-emerald-500/20 px-2 text-[11px] font-bold text-mint-300 ring-1 ring-mint-400/30">
            {pipelineStats.newCount}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ALL' ? 'PENDING' : 'ALL')}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-mint-400/20 bg-bg-1/40 text-emerald-200/70 hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
          aria-label="Filter Prescriptions by Status"
          title={`Current filter: ${statusFilter}`}
        >
          <SlidersHorizontal className="h-3 w-3" />
        </button>
      </div>

      {/* Queue Items Timeline Scroll Area */}
      <div
        className="mt-3 flex-1 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar"
        tabIndex={0}
        aria-label="Prescriptions list scrollable region"
      >
        {filtered.map((prescription, index) => (
          <PrescriptionQueueItem
            key={prescription.id}
            prescription={prescription}
            isSelected={prescription.id === selectedPrescriptionId}
            onSelect={selectPrescription}
            isLast={index === filtered.length - 1}
          />
        ))}
      </div>
    </GlassPanel>
  );
};

export default PrescriptionsQueue;
