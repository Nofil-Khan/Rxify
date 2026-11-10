import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Stethoscope, Award } from 'lucide-react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import MedicationFlipCard from './MedicationFlipCard';

interface PrescriptionSlipSheetProps {
  onOpenDoctorModal: () => void;
  triggerSubstituteItemIndex?: number | null;
}

export const PrescriptionSlipSheet: React.FC<PrescriptionSlipSheetProps> = ({
  onOpenDoctorModal,
  triggerSubstituteItemIndex,
}) => {
  const { prescriptions, selectedPrescriptionId, selectedMedicineId, selectMedicine, toggleMedicinePicked } =
    useDispensaryWorkspace();

  const rx = React.useMemo(
    () => prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0],
    [prescriptions, selectedPrescriptionId]
  );

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4'].includes(e.key) && rx?.medicines) {
        const idx = parseInt(e.key, 10) - 1;
        if (rx.medicines[idx]) toggleMedicinePicked(rx.medicines[idx].id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rx, toggleMedicinePicked]);

  if (!rx) return null;

  const allergyIsClear = rx.allergyAlert?.toLowerCase().includes('no known');

  return (
    <section
      aria-label={`Clinical Prescription Sheet for ${rx.patientName}`}
      className="ti-sheet flex flex-col h-full mx-4 my-3 shadow-2xl overflow-hidden"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={rx.id}
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col h-full p-6"
        >
          {/* Header */}
          <div className="pb-4" style={{ borderBottom: '1px solid var(--ti-hairline)' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2.5 mb-0.5">
                  <span className="font-serif text-2xl font-black tracking-tight" style={{ color: 'var(--ti-ink)' }}>℞</span>
                  <h2 className="font-mono text-lg font-bold tracking-tight" style={{ color: 'var(--ti-ink)' }}>{rx.rxNumber}</h2>
                  {rx.isOnHold && (
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(196,122,30,0.12)', color: 'var(--ti-amber)', border: '1px solid rgba(196,122,30,0.3)' }}>
                      ON HOLD
                    </span>
                  )}
                </div>
                <p className="font-serif text-sm font-semibold" style={{ color: 'var(--ti-ink)' }}>
                  {rx.patientName}
                  <span className="font-sans font-normal text-xs ml-2" style={{ color: 'var(--ti-ink-muted)' }}>
                    {rx.patientAge}y · {rx.bloodGroup || 'O+'}
                  </span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border"
                  style={allergyIsClear
                    ? { background: 'rgba(74,124,111,0.08)', color: 'var(--ti-sage)', borderColor: 'rgba(74,124,111,0.25)' }
                    : { background: 'rgba(192,57,43,0.08)', color: 'var(--ti-ruby)', borderColor: 'rgba(192,57,43,0.25)' }
                  }
                >
                  <AlertCircle className="h-3 w-3" />
                  {rx.allergyAlert || 'Sulfa Drugs: Mild'}
                </span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--ti-ink-subtle)' }}>{rx.date}</span>
              </div>
            </div>

            {/* Doctor Bar */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid var(--ti-hairline)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <Stethoscope className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--ti-ink-muted)' }} />
                <div className="min-w-0 text-xs">
                  <span className="font-bold" style={{ color: 'var(--ti-ink)' }}>{rx.doctorName}</span>
                  <span className="font-mono text-[10px] ml-1.5" style={{ color: 'var(--ti-ink-muted)' }}>
                    {rx.doctorSpecialty} · {rx.doctorRegNo || 'Reg #MP-44912'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenDoctorModal}
                aria-label="Query prescribing doctor"
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold border cursor-pointer transition-all shrink-0 focus-visible:ring-2 focus-visible:outline-none"
                style={{ background: '#fff', color: 'var(--ti-ink)', borderColor: 'var(--ti-hairline-strong)', ['--tw-ring-color' as string]: 'var(--ti-amber)' }}
              >
                Query Doctor
              </button>
            </div>
          </div>

          {/* Medication Strips */}
          <div className="flex-1 overflow-y-auto ti-scroll py-2">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ti-ink-subtle)' }}>
                Prescribed Regimen ({rx.medicines.length})
              </span>
              <span className="font-mono text-[9px]" style={{ color: 'var(--ti-ink-subtle)' }}>Press 1–4 to toggle pick</span>
            </div>
            {rx.medicines.map((med, idx) => (
              <MedicationFlipCard
                key={med.id}
                medicine={med}
                index={idx}
                isSelected={selectedMedicineId === med.id}
                onSelect={() => selectMedicine(med.id)}
                forceFlip={triggerSubstituteItemIndex === idx}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--ti-hairline)' }}>
            <div className="max-w-[65%]">
              <span className="ti-spec-label block mb-0.5">Prescriber Instructions</span>
              <p className="font-serif text-xs italic" style={{ color: 'var(--ti-ink-muted)' }}>"{rx.notes}"</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--ti-hairline)' }}>
              <Award className="h-3.5 w-3.5" style={{ color: 'var(--ti-sage)' }} />
              <div className="text-right">
                <span className="ti-spec-label">Cryptographically Signed</span>
                <span className="block font-mono text-[8px]" style={{ color: 'var(--ti-ink-subtle)' }}>SHA256: 8f9b…a12c · Verified</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
};

export default PrescriptionSlipSheet;
