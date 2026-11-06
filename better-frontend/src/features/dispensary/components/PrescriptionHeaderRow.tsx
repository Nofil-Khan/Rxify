import * as React from 'react';
import { Calendar, User, ExternalLink } from 'lucide-react';
import { WorkspacePrescription } from '../types';
import StatusPill from './StatusPill';

interface PrescriptionHeaderRowProps {
  prescription: WorkspacePrescription;
  onViewPrescription: () => void;
}

export const PrescriptionHeaderRow: React.FC<PrescriptionHeaderRowProps> = ({
  prescription,
  onViewPrescription,
}) => {
  return (
    <div className="flex flex-col gap-3 border-b border-ink/10 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: 56px pale green circle avatar + Rx ID and Patient info */}
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E2F0D9] font-serif text-lg font-bold text-ink shadow-xs border border-emerald-600/15"
            aria-hidden="true"
          >
            {prescription.patientInitials}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <h2 className="font-serif text-[22px] font-bold tracking-tight text-ink leading-tight">
                {prescription.rxNumber}
              </h2>
              <StatusPill status={prescription.status} />
            </div>
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">{prescription.patientName}</span>
              {' · '}
              {prescription.patientAge} years · {prescription.patientGender}
            </p>
          </div>
        </div>

        {/* Right: Date Chip, Doctor Chip, and View Prescription pill button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/75 px-3 py-1.5 text-xs font-medium text-ink-muted border border-ink/10 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-ink-subtle" />
            <span>{prescription.date}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/75 px-3 py-1 text-xs text-ink-muted border border-ink/10 shadow-xs">
            <User className="h-3.5 w-3.5 text-ink-subtle shrink-0" />
            <div className="leading-tight">
              <span className="block font-semibold text-ink">{prescription.doctorName}</span>
              <span className="block text-[10px] text-ink-subtle">({prescription.doctorSpecialty})</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewPrescription}
            className="flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-ink border border-ink/15 shadow-xs hover:bg-white transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
            aria-label="View original digital prescription slip"
          >
            <span>View Prescription</span>
            <ExternalLink className="h-3.5 w-3.5 text-ink-subtle" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionHeaderRow;

