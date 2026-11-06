import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspacePrescription } from '../types';

interface QueueItemProps {
  prescription: WorkspacePrescription;
  isSelected: boolean;
  onSelect: (id: string) => void;
  index: number;
  isLast: boolean;
}

function getAvatarBackground(initials: string): string {
  const tones = [
    'bg-[#062c20] text-mint-300 border-mint-400/30',
    'bg-[#093526] text-teal-300 border-teal-400/30',
    'bg-[#04281c] text-emerald-300 border-emerald-400/30',
    'bg-[#0b3d2c] text-mint-400 border-mint-400/30',
  ];
  const charCode = (initials.charCodeAt(0) || 0) + (initials.charCodeAt(1) || 0);
  return tones[charCode % tones.length];
}

export const QueueItem: React.FC<QueueItemProps> = ({
  prescription,
  isSelected,
  onSelect,
  index,
  isLast,
}) => {
  const timeLabel = React.useMemo(() => {
    if (prescription.timeAgo) return prescription.timeAgo;
    if (prescription.createdAt) {
      const diffMs = Date.now() - new Date(prescription.createdAt).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 2) return 'Just now';
      if (diffMin < 60) return `${diffMin} min ago`;
      const diffHours = Math.floor(diffMin / 60);
      return diffHours === 1 ? '1 hr ago' : `${diffHours} hrs ago`;
    }
    return 'Just now';
  }, [prescription]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.28, ease: 'easeOut' }}
      className="relative flex items-start gap-2.5"
    >
      {/* 1px Vertical Timeline Rail & Small Indicator Dot */}
      <div className="relative flex flex-col items-center self-stretch pt-4">
        <div
          className={`h-2 w-2 rounded-full transition-all duration-300 ${
            isSelected
              ? 'bg-mint-400 ring-4 ring-mint-400/30 shadow-glow-mint'
              : 'bg-emerald-500/40 ring-1 ring-bg-1'
          }`}
          aria-hidden="true"
        />
        {!isLast && (
          <div className="w-px flex-1 bg-mint-400/20 my-1 min-h-[46px]" aria-hidden="true" />
        )}
      </div>

      {/* Main Item Content */}
      <div className="flex-1 pb-2.5">
        {/* Relative Time Label Above Item */}
        <span className="block text-[10px] font-medium text-emerald-200/50 mb-1 pl-1">
          {timeLabel}
        </span>

        <button
          type="button"
          onClick={() => onSelect(prescription.id)}
          className={`group relative flex w-full items-center justify-between rounded-2xl p-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400 ${
            isSelected
              ? 'bg-gradient-to-r from-mint-400/20 to-emerald-500/15 border border-mint-400/60 shadow-glow-mint'
              : 'border border-transparent hover:border-mint-400/20 hover:bg-bg-1/40'
          }`}
          aria-label={`Select prescription ${prescription.rxNumber} for ${prescription.patientName}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* 44px Initials Avatar */}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-sans text-xs font-bold shadow-sm ${getAvatarBackground(
                prescription.patientInitials
              )}`}
            >
              {prescription.patientInitials}
            </div>

            {/* Patient Name & Prescription Subtitle */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-semibold text-white">
                  {prescription.patientName}
                </span>
                {/* Optional Orange Alert Dot for Flagged Prescriptions (as in Reference) */}
                {prescription.hasAlert && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-sm ring-2 ring-bg-1"
                    title="Action required or stock note"
                  />
                )}
              </div>
              <p className="truncate text-[11px] text-emerald-200/60 mt-0.5">
                {prescription.rxNumber} · {prescription.medicines.length} medicines
              </p>
            </div>
          </div>

          {/* Right Chevron for Selected State */}
          {isSelected && (
            <ChevronRight className="h-4 w-4 shrink-0 text-mint-300 ml-1" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default QueueItem;
