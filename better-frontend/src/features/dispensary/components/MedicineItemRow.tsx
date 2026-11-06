import * as React from 'react';
import { MoreHorizontal, Settings2, Stethoscope, Check, AlertTriangle, X } from 'lucide-react';
import { WorkspaceMedicine } from '../types';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import capGreenWhite from '@/assets/props/capsule-green-white.svg';
import tabRoundWhite from '@/assets/props/tablet-round-white.svg';
import capLavender from '@/assets/props/capsule-lavender.svg';

interface MedicineItemRowProps {
  medicine: WorkspaceMedicine;
  isSelected: boolean;
}

export const MedicineItemRow: React.FC<MedicineItemRowProps> = ({ medicine, isSelected }) => {
  const { selectMedicine, openAdjustModal, openReconsultModal } = useDispensaryWorkspace();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const iconSrc = React.useMemo(() => {
    if (medicine.name.toLowerCase().includes('para') || medicine.form === 'Tablet') {
      if (medicine.name.toLowerCase().includes('panto')) return capLavender;
      return tabRoundWhite;
    }
    if (medicine.name.toLowerCase().includes('panto') || medicine.name.toLowerCase().includes('radyle')) {
      return capLavender;
    }
    return capGreenWhite;
  }, [medicine]);

  return (
    <div
      onClick={() => selectMedicine(medicine.id)}
      className={`cream-row group relative flex items-center justify-between p-3.5 cursor-pointer ${
        isSelected ? 'border-emerald-600/50 ring-2 ring-emerald-500/20 bg-white/95' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <img
          src={iconSrc}
          alt={medicine.name}
          width={36}
          height={36}
          loading="lazy"
          className="shrink-0 drop-shadow-sm select-none"
        />
        <div className="min-w-0">
          <h4 className="truncate font-sans text-xs font-bold text-ink">{medicine.name}</h4>
          <p className="truncate text-[11px] text-ink-muted">
            {medicine.strength} · {medicine.form}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-center">
          <span className="block text-[10px] font-semibold text-ink-subtle">Qty</span>
          <span className="font-sans text-xs font-bold text-ink">{medicine.prescribedQuantity}</span>
        </div>

        <div className="text-center min-w-[48px]">
          <span className="block text-[10px] font-semibold text-ink-subtle">In Stock</span>
          <span
            className={`font-sans text-xs font-bold ${
              medicine.inStockQuantity === 0
                ? 'text-red-600'
                : medicine.inStockQuantity < medicine.prescribedQuantity
                ? 'text-amber-600'
                : 'text-emerald-700'
            }`}
          >
            {medicine.inStockQuantity}
          </span>
        </div>

        <div className="min-w-[104px]">
          {medicine.status === 'AVAILABLE' && (
            <span className="flex items-center justify-center gap-1 rounded-full bg-emerald-600/15 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
              <Check className="h-3 w-3" /> Available
            </span>
          )}
          {medicine.status === 'PARTIAL' && (
            <span className="flex items-center justify-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-800">
              <AlertTriangle className="h-3 w-3" /> Partial
            </span>
          )}
          {medicine.status === 'UNAVAILABLE' && (
            <span className="flex items-center justify-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-800">
              <X className="h-3 w-3" /> Unavailable
            </span>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
            aria-label={`Actions for ${medicine.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-ink/10 bg-white p-1.5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openAdjustModal(medicine);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Adjust Fulfillment</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openReconsultModal(medicine);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-purple-50 hover:text-purple-800 transition-colors"
              >
                <Stethoscope className="h-3.5 w-3.5 text-purple-600" />
                <span>Flag Reconsultation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicineItemRow;

