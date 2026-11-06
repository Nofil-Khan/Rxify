import * as React from 'react';
import { X, Check } from 'lucide-react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import { FulfillmentStatus } from '../types';

export const AdjustFulfillmentModal: React.FC = () => {
  const { isAdjustModalOpen, closeAdjustModal, editingMedicine, updateMedicineDecision } =
    useDispensaryWorkspace();

  const [status, setStatus] = React.useState<FulfillmentStatus>('AVAILABLE');
  const [dispensedQty, setDispensedQty] = React.useState<number>(0);
  const [notes, setNotes] = React.useState<string>('');

  React.useEffect(() => {
    if (editingMedicine) {
      setStatus(editingMedicine.status);
      setDispensedQty(editingMedicine.dispensedQuantity ?? editingMedicine.prescribedQuantity);
      setNotes(editingMedicine.reconsultationNotes ?? '');
    }
  }, [editingMedicine]);

  if (!isAdjustModalOpen || !editingMedicine) return null;

  const handleSave = () => {
    updateMedicineDecision(editingMedicine.id, status, dispensedQty, notes);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-mint-400/30 bg-bg-1 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mint-400/15 pb-3">
          <div>
            <h3 id="adjust-modal-title" className="font-serif text-base font-bold text-white">
              Adjust Medicine Fulfillment
            </h3>
            <p className="text-xs text-emerald-200/70">
              {editingMedicine.name} ({editingMedicine.strength})
            </p>
          </div>
          <button
            type="button"
            onClick={closeAdjustModal}
            className="rounded-full p-1 text-emerald-200/60 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-emerald-200/80 mb-1.5">
              Fulfillment Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['AVAILABLE', 'PARTIAL', 'UNAVAILABLE'] as FulfillmentStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`rounded-xl py-2 text-xs font-semibold border transition-all ${
                    status === st
                      ? 'border-mint-400 bg-emerald-500/30 text-white shadow-glow-mint'
                      : 'border-mint-400/20 bg-bg-0/40 text-emerald-200/70 hover:border-mint-400/40'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-200/80 mb-1">
              Dispensed Quantity (Prescribed: {editingMedicine.prescribedQuantity})
            </label>
            <input
              type="number"
              min={0}
              max={editingMedicine.prescribedQuantity}
              value={dispensedQty}
              onChange={(e) => setDispensedQty(Number(e.target.value))}
              className="w-full rounded-xl border border-mint-400/25 bg-bg-0/60 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-200/80 mb-1">
              Clinical Pharmacist Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dispensed 5 tablets; balance ordered for tomorrow."
              className="w-full rounded-xl border border-mint-400/25 bg-bg-0/60 p-2.5 text-xs text-white placeholder-emerald-200/40"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-mint-400/15 pt-3">
          <button
            type="button"
            onClick={closeAdjustModal}
            className="rounded-xl px-4 py-2 text-xs font-medium text-emerald-200/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-bg-0 shadow-glow-mint hover:bg-emerald-400"
          >
            <Check className="h-3.5 w-3.5" /> Save Decision
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdjustFulfillmentModal;

