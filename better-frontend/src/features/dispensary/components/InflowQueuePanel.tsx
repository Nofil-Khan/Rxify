import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

type FilterKey = 'ALL' | 'PREPARING' | 'READY' | 'ON_HOLD';

export const InflowQueuePanel: React.FC = () => {
  const { prescriptions, selectedPrescriptionId, selectPrescription } = useDispensaryWorkspace();
  const [filter, setFilter] = React.useState<FilterKey>('ALL');

  const filteredTickets = React.useMemo(() => {
    return prescriptions.filter((rx) => {
      if (filter === 'PREPARING') return rx.status === 'PROCESSING' || rx.status === 'PENDING';
      if (filter === 'READY') return rx.status === 'READY';
      if (filter === 'ON_HOLD') return rx.status === 'RECONSULTATION_NEEDED' || rx.isOnHold;
      return true;
    });
  }, [prescriptions, filter]);

  const counts = React.useMemo(() => ({
    all: prescriptions.length,
    preparing: prescriptions.filter((p) => p.status === 'PROCESSING' || p.status === 'PENDING').length,
    ready: prescriptions.filter((p) => p.status === 'READY').length,
    onHold: prescriptions.filter((p) => p.status === 'RECONSULTATION_NEEDED' || p.isOnHold).length,
  }), [prescriptions]);

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'PREPARING', label: 'Prep', count: counts.preparing },
    { key: 'READY', label: 'Ready', count: counts.ready },
    { key: 'ON_HOLD', label: 'Hold', count: counts.onHold },
  ];

  return (
    <aside
      aria-label="Inflow Prescription Queue"
      className="ti-border-right flex flex-col h-full select-none overflow-hidden"
      style={{ background: 'var(--ti-canvas)', paddingTop: 20, paddingBottom: 104 }}
    >
      {/* Filter Bar with shared layout pill */}
      <div className="relative flex items-center px-4 pb-3" style={{ borderBottom: '1px solid var(--ti-hairline)' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-label={`Filter by ${f.label}`}
            className="relative flex-1 py-1.5 text-center text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ti-sage focus-visible:outline-none rounded-full z-10"
            style={{ color: filter === f.key ? 'var(--ti-ink)' : 'var(--ti-ink-subtle)' }}
          >
            {filter === f.key && (
              <motion.div
                layoutId="filterPill"
                className="absolute inset-0 rounded-full"
                style={{ background: 'rgba(255,255,255,0.75)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              />
            )}
            <span className="relative z-10">{f.label} ({f.count})</span>
          </button>
        ))}
      </div>

      {/* Timeline Queue */}
      <div className="flex-1 overflow-y-auto ti-scroll" style={{ padding: '12px 0' }}>
        {/* Vertical track line */}
        <div className="relative pl-10 pr-4 space-y-0.5">
          <div
            className="absolute left-[22px] top-0 bottom-0 w-px"
            style={{ background: 'var(--ti-hairline)' }}
            aria-hidden="true"
          />
          <AnimatePresence>
            {filteredTickets.map((rx) => {
              const isSelected = rx.id === selectedPrescriptionId;
              const isHold = rx.status === 'RECONSULTATION_NEEDED' || rx.isOnHold;
              const isReady = rx.status === 'READY';

              const statusColor = isHold
                ? 'var(--ti-amber)'
                : isReady
                ? 'var(--ti-sage)'
                : rx.status === 'DISPENSED'
                ? 'var(--ti-ink-subtle)'
                : 'var(--ti-ink-muted)';

              return (
                <motion.div
                  key={rx.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                >
                  <button
                    type="button"
                    onClick={() => selectPrescription(rx.id)}
                    aria-label={`Select prescription ${rx.rxNumber} for ${rx.patientName}`}
                    className="relative w-full text-left py-3 px-3 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ti-sage focus-visible:outline-none group"
                  >
                    {/* Shared layout floating pill indicator */}
                    {isSelected && (
                      <motion.div
                        layoutId="activeQueuePill"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
                        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                      />
                    )}

                    {/* Timeline node */}
                    <div
                      className="absolute -left-[22px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full border-2 transition-colors z-10"
                      style={{
                        borderColor: isSelected ? 'var(--ti-sage)' : 'var(--ti-hairline-strong)',
                        background: isSelected ? 'var(--ti-sage)' : 'var(--ti-canvas)',
                      }}
                    />

                    <div className="relative z-10 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--ti-sage)' }}>
                          {rx.rxNumber}
                        </span>
                        <span className="font-mono text-[9px]" style={{ color: 'var(--ti-ink-subtle)' }}>
                          {rx.timeAgo}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[12px] truncate" style={{ color: 'var(--ti-ink)' }}>
                          {rx.patientName}
                        </span>
                        <span className="text-[9px] ml-2 shrink-0" style={{ color: 'var(--ti-ink-subtle)' }}>
                          {rx.medicines.length}rx
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase font-bold" style={{ color: statusColor }}>
                          {isHold ? 'ON HOLD' : isReady ? 'READY' : rx.status === 'DISPENSED' ? 'DONE' : 'PREPARING'}
                        </span>
                        {rx.priority === 'URGENT' && (
                          <span className="font-mono text-[9px] font-bold" style={{ color: 'var(--ti-ruby)' }}>
                            URGENT
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
};

export default InflowQueuePanel;
