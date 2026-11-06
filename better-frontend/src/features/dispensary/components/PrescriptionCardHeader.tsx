import * as React from 'react';
import { Calendar, User, ExternalLink } from 'lucide-react';
import { WorkspacePrescription } from '../types';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

interface PrescriptionCardHeaderProps {
  prescription: WorkspacePrescription;
}

export const PrescriptionCardHeader: React.FC<PrescriptionCardHeaderProps> = ({
  prescription,
}) => {
  const { openViewPrescriptionModal } = useDispensaryWorkspace();

  return (
    <div className="flex flex-col gap-3 border-b border-ink/10 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Patient Avatar & Rx ID */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-cream-from shadow-sm">
            {prescription.patientInitials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-base font-bold tracking-tight text-ink">
                {prescription.rxNumber}
              </h2>
              <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                New
              </span>
            </div>
            <p className="text-[11px] text-ink-muted font-medium">
              {prescription.patientName} · {prescription.patientAge} years · {prescription.patientGender}
            </p>
          </div>
        </div>

        {/* Prescription Metadata Badges & Action */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/70 px-2.5 py-1 text-[11px] text-ink-muted border border-ink/10">
            <Calendar className="h-3 w-3 text-ink-subtle" />
            <span>{prescription.date}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-white/70 px-2.5 py-1 text-[11px] text-ink-muted border border-ink/10">
            <User className="h-3 w-3 text-ink-subtle" />
            <span>
              {prescription.doctorName} ({prescription.doctorSpecialty})
            </span>
          </div>

          <button
            type="button"
            onClick={openViewPrescriptionModal}
            className="flex items-center gap-1.5 rounded-xl bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink border border-ink/15 shadow-sm hover:bg-white transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
            aria-label="View original digital prescription slip"
          >
            <span>View Prescription</span>
            <ExternalLink className="h-3 w-3 text-ink-muted" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionCardHeader;
