import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { WorkspacePrescription } from '../types';

interface PrescriptionQueueItemProps {
  prescription: WorkspacePrescription;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isLast: boolean;
}

export const PrescriptionQueueItem: React.FC<PrescriptionQueueItemProps> = ({
  prescription,
  isSelected,
  onSelect,
  isLast,
}) => {
  return (
    <div className="relative flex items-start gap-3">
      {/* Timeline Track & Node Indicator */}
      <div className="relative flex flex-col items-center self-stretch">
        <div
          className={`h-2.5 w-2.5 rounded-full transition-all ${
            isSelected
              ? 'bg-mint-400 ring-4 ring-mint-400/30 shadow-glow-mint'
              : 'bg-emerald-500/40'
          }`}
          aria-hidden="true"
        />
        {!isLast && (
          <div className="w-px flex-1 bg-mint-400/20 my-1 min-h-[44px]" aria-hidden="true" />
        )}
      </div>

      {/* Prescription Item Card */}
      <div className="flex-1 pb-3">
        <button
          type="button"
          onClick={() => onSelect(prescription.id)}
          className={`group flex w-full items-center justify-between rounded-2xl p-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none ${
            isSelected
              ? 'bg-emerald-500/20 border border-mint-400/50 shadow-glow-mint'
              : 'border border-transparent hover:bg-bg-1/40 hover:border-mint-400/20'
          }`}
          aria-label={`Select prescription for ${prescription.patientName}, ${prescription.rxNumber}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Patient Initials Circle */}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-mint-400/30 text-mint-300 ring-1 ring-mint-400/60'
                  : 'bg-bg-0/60 text-emerald-200/80 ring-1 ring-mint-400/20'
              }`}
            >
              {prescription.patientInitials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-white">
                  {prescription.patientName}
                </span>
                {prescription.hasAlert && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-sm" />
                )}
              </div>
              <p className="truncate text-[11px] text-emerald-200/60">
                {prescription.rxNumber} · {prescription.medicines.length} medicines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span className="text-[10px] text-emerald-200/50">{prescription.timeAgo}</span>
            {isSelected && <ChevronRight className="h-3.5 w-3.5 text-mint-300" />}
          </div>
        </button>
      </div>
    </div>
  );
};

export default PrescriptionQueueItem;

