import * as React from 'react';
import { X, Search, Plus, Check, Loader2, Pill } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import { searchMedicineCatalog, addOrUpdateStock, CatalogMedicine } from '@/lib/dispensaryApi';

export const AddMedicineModal: React.FC = () => {
  const { isAddMedicineModalOpen, closeAddMedicineModal } = useDispensaryWorkspace();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [selectedMed, setSelectedMed] = React.useState<CatalogMedicine | null>(null);
  const [quantity, setQuantity] = React.useState<number>(50);
  const [reorderLevel, setReorderLevel] = React.useState<number>(10);

  const { data: catalogResults = [], isLoading: isSearching } = useQuery<CatalogMedicine[]>({
    queryKey: ['catalog_medicines', search],
    queryFn: () => searchMedicineCatalog(search),
    enabled: isAddMedicineModalOpen && search.trim().length >= 1,
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMed) return;
      await addOrUpdateStock({
        medicine_id: selectedMed.medicine_id,
        available_quantity: quantity,
        reorder_level: reorderLevel,
        unit: 'units',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispensary_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setSelectedMed(null);
    setSearch('');
    setQuantity(50);
    setReorderLevel(10);
    closeAddMedicineModal();
  };

  if (!isAddMedicineModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="add-med-title">
      <div className="w-full max-w-md rounded-3xl border border-mint-400/30 bg-bg-1 p-6 text-white shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-mint-400/15 pb-3">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-mint-300" />
            <h3 id="add-med-title" className="font-serif text-base font-bold text-white">Add Medicine to Inventory</h3>
          </div>
          <button type="button" onClick={handleClose} className="rounded-full p-1 text-emerald-200/60 hover:text-white focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-4 space-y-4 overflow-y-auto pr-1">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-200/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (selectedMed) setSelectedMed(null); }}
              placeholder="Search master catalog (e.g. Amoxicillin, Paracetamol)..."
              className="w-full rounded-xl border border-mint-400/25 bg-bg-0/70 pl-10 pr-4 py-2.5 text-xs text-white placeholder-emerald-200/40 focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
              aria-label="Search catalog medicine"
            />
          </div>

          {!selectedMed && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {isSearching && (
                <div className="py-4 text-center text-xs text-mint-300 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching master catalog...
                </div>
              )}
              {!isSearching && search.trim() && catalogResults.length === 0 && (
                <p className="py-3 text-center text-xs text-emerald-200/50">No medicines found for "{search}"</p>
              )}
              {catalogResults.map((med) => (
                <button
                  key={med.medicine_id}
                  type="button"
                  onClick={() => setSelectedMed(med)}
                  className="flex w-full items-center justify-between rounded-xl bg-bg-0/40 p-2.5 text-left border border-mint-400/10 hover:border-mint-400/40 hover:bg-bg-0/80 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-mint-400"
                >
                  <div>
                    <span className="font-semibold text-white text-xs block">{med.generic_name}</span>
                    <span className="text-[11px] text-emerald-200/60">{med.brand_name ? `${med.brand_name} · ` : ''}{med.strength || ''} {med.form}</span>
                  </div>
                  <Plus className="h-4 w-4 text-mint-300 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {selectedMed && (
            <div className="rounded-2xl border border-mint-400/30 bg-bg-0/60 p-4 space-y-3">
              <div className="border-b border-mint-400/15 pb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-mint-300 block">Selected Medicine</span>
                <span className="text-sm font-bold text-white block">{selectedMed.generic_name}</span>
                <span className="text-xs text-emerald-200/70">{selectedMed.brand_name ? `${selectedMed.brand_name} · ` : ''}{selectedMed.strength || ''} {selectedMed.form}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-200/80 mb-1">Initial Stock Units</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="w-full rounded-xl border border-mint-400/25 bg-bg-1 px-3 py-1.5 text-xs text-white font-bold" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-200/80 mb-1">Reorder Level</label>
                  <input type="number" min={0} value={reorderLevel} onChange={(e) => setReorderLevel(Math.max(0, Number(e.target.value)))} className="w-full rounded-xl border border-mint-400/25 bg-bg-1 px-3 py-1.5 text-xs text-white font-bold" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-mint-400/15 pt-3">
          <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2 text-xs font-medium text-emerald-200/70 hover:text-white cursor-pointer">Cancel</button>
          <button
            type="button"
            disabled={!selectedMed || addMutation.isPending}
            onClick={() => addMutation.mutate()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-mint-400 px-5 py-2 text-xs font-bold text-bg-0 shadow-glow-mint hover:opacity-95 disabled:opacity-50 cursor-pointer"
          >
            {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span>Add to Shelf</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMedicineModal;

