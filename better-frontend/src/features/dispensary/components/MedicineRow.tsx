import * as React from 'react';
import { WorkspaceMedicine } from '../types';
import { resolveStockStatus } from '../schemas/prescriptionSchema';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import StatusPill from './StatusPill';
import MedicineActionsMenu from './MedicineActionsMenu';
import capGreenWhite from '@/assets/props/capsule-green-white.svg';
import tabRoundWhite from '@/assets/props/tablet-round-white.svg';
import capLavender from '@/assets/props/capsule-lavender.svg';

interface MedicineRowProps {
  medicine: WorkspaceMedicine;
  isSelected: boolean;
}

export const MedicineRow: React.FC<MedicineRowProps> = ({ medicine, isSelected }) => {
  const { selectMedicine } = useDispensaryWorkspace();

  const stockStatus = React.useMemo(() => {
    return resolveStockStatus(medicine.inStockQuantity, medicine.prescribedQuantity);
  }, [medicine.inStockQuantity, medicine.prescribedQuantity]);

  const thumbnailSrc = React.useMemo(() => {
    const name = medicine.name.toLowerCase();
    if (name.includes('para') || medicine.form === 'Tablet') {
      if (name.includes('panto')) return capLavender;
      return tabRoundWhite;
    }
    if (name.includes('panto') || name.includes('radyle')) {
      return capLavender;
    }
    return capGreenWhite;
  }, [medicine]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectMedicine(medicine.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectMedicine(medicine.id);
        }
      }}
      aria-label={`Select ${medicine.name}, ${stockStatus}`}
      className={`cream-row group relative flex items-center justify-between p-3.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        isSelected
          ? 'border-emerald-600/50 ring-2 ring-emerald-500/25 bg-white/95 shadow-md'
          : 'bg-white/75 hover:bg-white/90 border-ink/10'
      }`}
    >
      {/* 64px rounded pill thumbnail + Name & Strength */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/95 border border-ink/8 shadow-inner select-none">
          <img
            src={thumbnailSrc}
            alt={medicine.name}
            width={38}
            height={38}
            loading="lazy"
            className="drop-shadow-xs"
          />
        </div>
        <div className="min-w-0">
          <h4 className="truncate font-sans text-[15px] font-bold text-ink leading-tight">
            {medicine.name}
          </h4>
          <p className="truncate text-xs text-ink-muted mt-0.5">
            {medicine.strength} · {medicine.form}
          </p>
        </div>
      </div>

      {/* Numerical Data and Actions */}
      <div className="flex items-center gap-6 shrink-0">
        <div className="text-center min-w-[48px]">
          <span className="block text-[11px] font-semibold text-ink-subtle">Qty</span>
          <span className="font-sans text-[20px] font-bold text-ink leading-tight">
            {medicine.prescribedQuantity}
          </span>
        </div>

        <div className="text-center min-w-[56px]">
          <span className="block text-[11px] font-semibold text-ink-subtle">In Stock</span>
          <span
            className={`font-sans text-[20px] font-bold leading-tight ${
              stockStatus === 'AVAILABLE'
                ? 'text-emerald-700'
                : stockStatus === 'PARTIAL'
                ? 'text-amber-600'
                : 'text-red-600'
            }`}
          >
            {medicine.inStockQuantity}
          </span>
        </div>

        <div className="min-w-[110px] flex justify-center">
          <StatusPill status={stockStatus} />
        </div>

        <MedicineActionsMenu medicine={medicine} />
      </div>
    </div>
  );
};

export default MedicineRow;
