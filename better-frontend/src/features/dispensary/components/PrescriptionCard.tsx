import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PrescriptionHeaderRow from './PrescriptionHeaderRow';
import DiagnosisNotesRow from './DiagnosisNotesRow';
import MedicineRow from './MedicineRow';
import PrescriptionWorkflowSection from './PrescriptionWorkflowSection';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const PrescriptionCard: React.FC = () => {
  const {
    prescriptions,
    selectedPrescriptionId,
    selectedMedicineId,
    openViewPrescriptionModal,
  } = useDispensaryWorkspace();

  const prescription = React.useMemo(() => {
    return (
      prescriptions.find((p) => p.id === selectedPrescriptionId) ??
      prescriptions[0]
    );
  }, [prescriptions, selectedPrescriptionId]);

  if (!prescription) {
    return (
      <section
        data-testid="slot-prescription-card"
        className="cream-card relative flex h-full flex-col items-center justify-center p-8 rounded-[36px]"
      >
        <p className="text-sm text-ink-muted">No prescription selected</p>
      </section>
    );
  }

  return (
    <section
      data-testid="slot-prescription-card"
      className="cream-card relative flex h-full min-w-0 flex-col p-6 lg:p-7 justify-between overflow-hidden shadow-2xl rounded-[36px]"
      aria-label={`Prescription Details for ${prescription.patientName}`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={prescription.id}
          initial={{ opacity: 0.88, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0.88, y: -6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col gap-3.5 h-full justify-between"
        >
          {/* Top segment: Header, Diagnosis & Notes */}
          <div className="flex flex-col gap-2.5">
            <PrescriptionHeaderRow
              prescription={prescription}
              onViewPrescription={openViewPrescriptionModal}
            />

            <DiagnosisNotesRow prescription={prescription} />

            {/* Section Header: Rx + Prescribed Medicines */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="font-serif text-lg font-bold text-ink select-none leading-none">
                ℞
              </span>
              <h3 className="font-sans text-sm font-bold text-ink tracking-tight">
                Prescribed Medicines ({prescription.medicines.length})
              </h3>
            </div>
          </div>

          {/* Bottom segment: Prescribed Medicines List with Workflow Actions at the bottom */}
          <div
            className="flex flex-col gap-3 overflow-y-auto max-h-[380px] lg:max-h-[420px] pr-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light rounded-2xl"
            tabIndex={0}
            role="region"
            aria-label="Prescribed medicines list and fulfillment actions"
          >
            {prescription.medicines.map((med) => (
              <MedicineRow
                key={med.id}
                medicine={med}
                isSelected={med.id === selectedMedicineId}
              />
            ))}

            {/* Workflow actions at the end of the scrollable medicine list */}
            <PrescriptionWorkflowSection prescription={prescription} />
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
};

export default PrescriptionCard;
