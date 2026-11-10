import * as React from 'react';
import { X, Check, Loader2, PackageCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import { updateStockPartial, addOrUpdateStock } from '@/lib/dispensaryApi';
import { StockInputControls } from './StockInputControls';

export const ManageStockModal: React.FC = () => {
  const {
    isManageStockModalOpen,
    closeManageStockModal,
    managingStockTarget,
    prescriptions,
    selectedPrescriptionId,
    selectedMedicineId,
  } = useDispensaryWorkspace();

  const queryClient = useQueryClient();

  const activeTarget = React.useMemo(() => {
    if (managingStockTarget) return managingStockTarget;
    const rx = prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
    const med = rx?.medicines.find((m) => m.id === selectedMedicineId) ?? rx?.medicines[0];
    if (!med) return null;
    return {
      medicineId: med.medicineId ?? med.id,
      name: med.name,
      strength: med.strength,
      form: med.form,
      availableQuantity: med.inStockQuantity,
      reorderLevel: 10,
      unit: 'units',
      inventoryId: undefined as number | undefined,
    };
  }, [managingStockTarget, prescriptions, selectedPrescriptionId, selectedMedicineId]);

  const [stock, setStock] = React.useState<number>(0);
  const [reorder, setReorder] = React.useState<number>(10);

  React.useEffect(() => {
    if (activeTarget) {
      setStock(activeTarget.availableQuantity);
      setReorder(activeTarget.reorderLevel ?? 10);
    }
  }, [activeTarget]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!activeTarget) return;
      if (activeTarget.inventoryId) {
        await updateStockPartial(activeTarget.inventoryId, {
          available_quantity: stock,
          reorder_level: reorder,
          unit: activeTarget.unit || 'units',
        });
      } else if (activeTarget.medicineId) {
        await addOrUpdateStock({
          medicine_id: Number(activeTarget.medicineId),
          available_quantity: stock,
          reorder_level: reorder,
          unit: activeTarget.unit || 'units',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      closeManageStockModal();
    },
  });

  if (!isManageStockModalOpen || !activeTarget) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-stock-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-mint-400/30 bg-bg-1 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mint-400/15 pb-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-mint-300" />
            <div>
              <h3 id="manage-stock-title" className="font-serif text-base font-bold text-white">
                Adjust Medicine Stock
              </h3>
              <p className="text-xs text-emerald-200/70 truncate max-w-[220px]">
                {activeTarget.name} {activeTarget.strength ? `· ${activeTarget.strength}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeManageStockModal}
            className="rounded-full p-1 text-emerald-200/60 hover:text-white focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <StockInputControls
          stock={stock}
          reorder={reorder}
          onStockChange={setStock}
          onReorderChange={setReorder}
        />

        <div className="flex justify-end gap-2.5 border-t border-mint-400/15 pt-3">
          <button
            type="button"
            onClick={closeManageStockModal}
            className="rounded-xl px-4 py-2 text-xs font-medium text-emerald-200/70 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-bg-0 shadow-glow-mint hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer disabled:opacity-75"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Update Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageStockModal;
