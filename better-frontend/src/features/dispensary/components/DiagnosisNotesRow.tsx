import * as React from 'react';
import { WorkspacePrescription } from '../types';

interface DiagnosisNotesRowProps {
  prescription: WorkspacePrescription;
}

export const DiagnosisNotesRow: React.FC<DiagnosisNotesRowProps> = ({ prescription }) => {
  return (
    <div className="grid grid-cols-[auto_1fr] items-stretch gap-6 py-2.5 border-b border-ink/10">
      {/* Diagnosis */}
      <div className="flex flex-col pr-6 border-r border-ink/10 min-w-[180px]">
        <span className="text-[11px] font-semibold text-ink-subtle">Diagnosis</span>
        <p className="text-[15px] font-bold text-ink mt-0.5 tracking-tight">
          {prescription.diagnosis}
        </p>
      </div>

      {/* Notes */}
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-ink-subtle">Notes</span>
        <p className="text-xs text-ink-muted leading-relaxed mt-0.5">
          {prescription.notes}
        </p>
      </div>
    </div>
  );
};

export default DiagnosisNotesRow;

