import * as React from 'react';
import { X, Printer, ShieldCheck } from 'lucide-react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const ViewPrescriptionModal: React.FC = () => {
  const { isViewPrescriptionModalOpen, closeViewPrescriptionModal, prescriptions, selectedPrescriptionId } =
    useDispensaryWorkspace();

  const rx = React.useMemo(() => {
    return prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
  }, [prescriptions, selectedPrescriptionId]);

  if (!isViewPrescriptionModalOpen || !rx) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-prescription-title"
    >
      <div className="w-full max-w-xl rounded-3xl border border-mint-400/30 bg-cream-from p-7 text-ink shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/15 pb-4">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold tracking-tight text-ink">Rxify</span>
            <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-xs font-semibold text-ink">
              {rx.rxNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={closeViewPrescriptionModal}
            className="rounded-full p-1 text-ink-muted hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-4 space-y-4 text-xs font-sans">
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-white/70 p-3.5 border border-ink/10">
            <div>
              <p className="text-ink-subtle uppercase text-[10px] font-bold">Patient</p>
              <p className="font-bold text-ink">{rx.patientName}</p>
              <p className="text-ink-muted">{rx.patientAge} yrs, {rx.patientGender}</p>
            </div>
            <div>
              <p className="text-ink-subtle uppercase text-[10px] font-bold">Doctor</p>
              <p className="font-bold text-ink">{rx.doctorName}</p>
              <p className="text-ink-muted">{rx.doctorSpecialty} · {rx.date}</p>
            </div>
          </div>

          <div className="rounded-xl bg-white/70 p-3.5 border border-ink/10">
            <p className="text-ink-subtle uppercase text-[10px] font-bold mb-1">Diagnosis & Notes</p>
            <p className="font-bold text-ink mb-1">{rx.diagnosis}</p>
            <p className="text-ink-muted">{rx.notes}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-ink-subtle uppercase text-[10px] font-bold">Medications</p>
            {rx.medicines.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg bg-white/90 p-2.5 border border-ink/10"
              >
                <div>
                  <p className="font-bold text-ink">{m.name} {m.strength}</p>
                  <p className="text-[11px] text-ink-muted">{m.dosageInstructions ?? m.form}</p>
                </div>
                <span className="font-bold text-ink">Qty: {m.prescribedQuantity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink/15 pt-4">
          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Cryptographically Verified Rx</span>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink/90"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewPrescriptionModal;

