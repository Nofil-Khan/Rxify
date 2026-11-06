import * as React from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const ManageStockModal: React.FC = () => {
  const { isManageStockModalOpen, closeManageStockModal, prescriptions, selectedPrescriptionId, selectedMedicineId } =
    useDispensaryWorkspace();

  const med = React.useMemo(() => {
    const rx = prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
    return rx?.medicines.find((m) => m.id === selectedMedicineId) ?? rx?.medicines[0];
  }, [prescriptions, selectedPrescriptionId, selectedMedicineId]);

  const [stock, setStock] = React.useState<number>(0);
  const [reorder, setReorder] = React.useState<number>(10);

  React.useEffect(() => {
    if (med) {
      setStock(med.inStockQuantity);
      setReorder(med.reorderLevel ?? 10);
    }
  }, [med]);

  if (!isManageStockModalOpen || !med) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-stock-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-mint-400/30 bg-bg-1 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mint-400/15 pb-3">
          <div>
            <h3 id="manage-stock-title" className="font-serif text-base font-bold text-white">
              Manage Inventory Stock
            </h3>
            <p className="text-xs text-emerald-200/70">{med.name} · {med.strength}</p>
          </div>
          <button
            type="button"
            onClick={closeManageStockModal}
            className="rounded-full p-1 text-emerald-200/60 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-emerald-200/80 mb-2">
              Available Units in Dispensary Shelf
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStock((s) => Math.max(0, s - 5))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-0 border border-mint-400/20 text-white hover:bg-bg-2"
                aria-label="Decrease stock by 5"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="flex-1 rounded-xl border border-mint-400/25 bg-bg-0/60 px-3 py-2 text-center text-sm font-bold text-white"
              />
              <button
                type="button"
                onClick={() => setStock((s) => s + 5)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-0 border border-mint-400/20 text-white hover:bg-bg-2"
                aria-label="Increase stock by 5"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-200/80 mb-1">
              Low Stock Reorder Threshold
            </label>
            <input
              type="number"
              value={reorder}
              onChange={(e) => setReorder(Number(e.target.value))}
              className="w-full rounded-xl border border-mint-400/25 bg-bg-0/60 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-mint-400/15 pt-3">
          <button
            type="button"
            onClick={closeManageStockModal}
            className="rounded-xl px-4 py-2 text-xs font-medium text-emerald-200/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              med.inStockQuantity = stock;
              med.reorderLevel = reorder;
              closeManageStockModal();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-bg-0 shadow-glow-mint hover:bg-emerald-400"
          >
            <Check className="h-3.5 w-3.5" /> Update Stock
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageStockModal;

