import * as React from 'react';
import { WorkspacePrescription } from '../types';

interface DiagnosisNotesSectionProps {
  prescription: WorkspacePrescription;
}

export const DiagnosisNotesSection: React.FC<DiagnosisNotesSectionProps> = ({
  prescription,
}) => {
  return (
    <div className="grid grid-cols-2 gap-6 py-4 border-b border-ink/10">
      {/* Diagnosis */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
          Diagnosis
        </span>
        <p className="text-sm font-bold text-ink">
          {prescription.diagnosis}
        </p>
      </div>

      {/* Doctor Clinical Notes */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
          Notes
        </span>
        <p className="text-xs text-ink-muted leading-relaxed">
          {prescription.notes}
        </p>
      </div>
    </div>
  );
};

export default DiagnosisNotesSection;

