import React from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type {
  DispensaryAvailabilitySummary,
  DispensaryMedicineAvailabilityItem,
} from '../../../../lib/patientApi';
import { ItemStockBadge } from './StockStatusBadges';

interface MedicineStockBreakdownProps {
  availability: DispensaryAvailabilitySummary;
  isOpen: boolean;
  onToggle: () => void;
}

export const MedicineStockBreakdown: React.FC<MedicineStockBreakdownProps> = ({
  availability: avail,
  isOpen,
  onToggle,
}) => {
  return (
    <div className="mt-2.5 p-2 rounded-lg bg-surface border border-border-color">
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex justify-between items-center text-xs font-semibold text-primary cursor-pointer"
      >
        <span>Medicine Stock ({avail.available_count}/{avail.total_count} in stock)</span>
        <div className="flex items-center gap-1 text-sky-500">
          <span>{isOpen ? 'Hide' : 'Details'}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
      {isOpen && (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-border-color pt-2">
          {avail.items.map((item: DispensaryMedicineAvailabilityItem) => (
            <div key={item.prescription_medicine_id} className="py-1 border-b border-dashed border-border-color text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-primary">{item.prescribed_name}</span>
                <ItemStockBadge status={item.status} qty={item.available_quantity} unit={item.unit} />
              </div>
              {item.substitute && (
                <div className="text-[11px] text-sky-600 bg-sky-500/10 px-2 py-1 rounded mt-1 flex items-center gap-1">
                  <Sparkles size={11} className="text-sky-500 flex-shrink-0" />
                  <span>
                    Bioequivalent: <strong>{item.substitute.name}</strong> ({item.substitute.available_quantity}{' '}
                    {item.substitute.unit || 'units'})
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicineStockBreakdown;
