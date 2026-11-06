import * as React from 'react';
import { Printer, ShieldCheck, FileText, User, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const ViewPrescriptionDialog: React.FC = () => {
  const {
    isViewPrescriptionModalOpen,
    closeViewPrescriptionModal,
    prescriptions,
    selectedPrescriptionId,
  } = useDispensaryWorkspace();

  const rx = React.useMemo(() => {
    return prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
  }, [prescriptions, selectedPrescriptionId]);

  if (!rx) return null;

  return (
    <Dialog
      open={isViewPrescriptionModalOpen}
      onOpenChange={(open) => {
        if (!open) closeViewPrescriptionModal();
      }}
    >
      <DialogContent className="max-w-xl bg-cream-from text-ink border border-ink/15 p-6 rounded-3xl shadow-2xl">
        <DialogHeader className="border-b border-ink/10 pb-3 text-left pr-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold tracking-tight text-ink">Rxify</span>
              <span className="rounded-lg bg-ink/10 px-2 py-0.5 font-mono text-xs font-semibold text-ink">
                {rx.rxNumber}
              </span>
            </div>
            <span className="text-xs text-ink-muted">Official Medical Record</span>
          </div>
          <DialogTitle className="sr-only">Original Prescription Slip {rx.rxNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2 text-xs">
          {/* Patient & Doctor metadata */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/80 p-3.5 border border-ink/10 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                Patient Details
              </span>
              <p className="font-bold text-ink text-sm">{rx.patientName}</p>
              <p className="text-ink-muted">
                {rx.patientAge} years · {rx.patientGender}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                Prescribing Doctor
              </span>
              <p className="font-bold text-ink text-sm">{rx.doctorName}</p>
              <p className="text-ink-muted">
                {rx.doctorSpecialty} · {rx.date}
              </p>
            </div>
          </div>

          {/* Clinical diagnosis */}
          <div className="rounded-2xl bg-white/80 p-3.5 border border-ink/10 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              Diagnosis & Clinical Notes
            </span>
            <p className="font-bold text-ink text-xs mt-1">{rx.diagnosis}</p>
            <p className="text-ink-muted mt-0.5">{rx.notes}</p>
          </div>

          {/* Prescribed medicines list */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block">
              Rx Medications ({rx.medicines.length})
            </span>
            {rx.medicines.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-ink/10"
              >
                <div>
                  <p className="font-bold text-ink">
                    {m.name} <span className="font-normal text-ink-muted">({m.strength})</span>
                  </p>
                  <p className="text-[11px] text-ink-muted">{m.dosageInstructions ?? m.form}</p>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-ink">Qty: {m.prescribedQuantity}</span>
                  <span className="text-[10px] text-ink-subtle">Form: {m.form}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dialog footer with signature verification and print */}
        <div className="flex items-center justify-between border-t border-ink/10 pt-4">
          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Digitally Signed & Verified Rx</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-white hover:bg-ink/90 transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Slip</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewPrescriptionDialog;
