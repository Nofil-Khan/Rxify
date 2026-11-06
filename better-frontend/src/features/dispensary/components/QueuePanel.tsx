import * as React from 'react';
import GlassPanel from './GlassPanel';
import QueueHeader from './QueueHeader';
import QueueItem from './QueueItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const QueuePanel: React.FC = () => {
  const {
    prescriptions,
    selectedPrescriptionId,
    selectPrescription,
    searchQuery,
    statusFilter,
    sortOrder,
    filterUnavailableOnly,
  } = useDispensaryWorkspace();

  const filteredPrescriptions = React.useMemo(() => {
    return prescriptions
      .filter((rx) => {
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          rx.patientName.toLowerCase().includes(query) ||
          rx.rxNumber.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'ALL' || rx.status === statusFilter;
        const matchesStock =
          !filterUnavailableOnly ||
          rx.hasAlert ||
          rx.medicines.some(
            (m) => m.status === 'UNAVAILABLE' || m.status === 'PARTIAL'
          );
        return matchesQuery && matchesStatus && matchesStock;
      })
      .sort((a, b) => {
        if (sortOrder === 'urgent') {
          if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
          if (b.priority === 'URGENT' && a.priority !== 'URGENT') return 1;
        }
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
      });
  }, [prescriptions, searchQuery, statusFilter, sortOrder, filterUnavailableOnly]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = filteredPrescriptions.findIndex((p) => p.id === selectedPrescriptionId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, filteredPrescriptions.length - 1);
      if (filteredPrescriptions[nextIndex]) {
        selectPrescription(filteredPrescriptions[nextIndex].id);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      if (filteredPrescriptions[prevIndex]) {
        selectPrescription(filteredPrescriptions[prevIndex].id);
      }
    }
  };

  return (
    <GlassPanel
      tilt="left"
      data-testid="slot-queue-panel"
      className="flex h-full flex-col p-5 border-mint-400/25 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
      aria-label="Prescriptions Queue Panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <QueueHeader totalCount={filteredPrescriptions.length} />

      <ScrollArea
        className="mt-3 flex-1 pr-2"
        style={{
          maskImage: 'linear-gradient(to bottom, black 86%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 86%, transparent 100%)',
        }}
      >
        <div className="space-y-1">
          {filteredPrescriptions.map((prescription, idx) => (
            <QueueItem
              key={prescription.id}
              prescription={prescription}
              isSelected={prescription.id === selectedPrescriptionId}
              onSelect={selectPrescription}
              index={idx}
              isLast={idx === filteredPrescriptions.length - 1}
            />
          ))}

          {filteredPrescriptions.length === 0 && (
            <div className="py-12 text-center text-xs text-emerald-200/50">
              No prescriptions match the selected filter.
            </div>
          )}
        </div>
      </ScrollArea>
    </GlassPanel>
  );
};

export default QueuePanel;

