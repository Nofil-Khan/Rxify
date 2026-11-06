import * as React from 'react';
import { X, Send } from 'lucide-react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const ReconsultationModal: React.FC = () => {
  const { isReconsultModalOpen, closeReconsultModal, reconsultingMedicine, updateMedicineDecision } =
    useDispensaryWorkspace();

  const [reason, setReason] = React.useState('');

  if (!isReconsultModalOpen || !reconsultingMedicine) return null;

  const handleSubmit = () => {
    updateMedicineDecision(
      reconsultingMedicine.id,
      'RECONSULTATION_NEEDED',
      0,
      `Doctor Reconsultation Flagged: ${reason}`
    );
    closeReconsultModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconsult-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-mint-400/30 bg-bg-1 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mint-400/15 pb-3">
          <div>
            <h3 id="reconsult-modal-title" className="font-serif text-base font-bold text-white">
              Flag Reconsultation to Doctor
            </h3>
            <p className="text-xs text-emerald-200/70">{reconsultingMedicine.name}</p>
          </div>
          <button
            type="button"
            onClick={closeReconsultModal}
            className="rounded-full p-1 text-emerald-200/60 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-4 space-y-3">
          <p className="text-xs text-emerald-100/80 leading-relaxed">
            Send a query directly to the prescribing doctor regarding potential dosage ambiguity,
            drug-drug interactions, or out-of-stock alternative formulation approval.
          </p>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="State the clinical clarification needed from the doctor..."
            className="w-full rounded-xl border border-mint-400/25 bg-bg-0/60 p-2.5 text-xs text-white placeholder-emerald-200/40"
          />
        </div>

        <div className="flex justify-end gap-2.5 border-t border-mint-400/15 pt-3">
          <button
            type="button"
            onClick={closeReconsultModal}
            className="rounded-xl px-4 py-2 text-xs font-medium text-emerald-200/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-purple-500"
          >
            <Send className="h-3.5 w-3.5" /> Flag to Doctor
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReconsultationModal;

