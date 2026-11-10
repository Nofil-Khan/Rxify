import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import type { DispensaryAvailabilityStatus, MedicineStockStatus } from '../../../../lib/patientApi';

export const AvailabilityBadge: React.FC<{
  status?: DispensaryAvailabilityStatus;
  availableCount?: number;
  totalCount?: number;
}> = ({ status, availableCount = 0, totalCount = 0 }) => {
  switch (status) {
    case 'ALL_AVAILABLE':
      return (
        <span className="pd-badge pd-badge--emerald inline-flex items-center gap-1">
          <CheckCircle2 size={13} />
          ALL IN STOCK ({availableCount}/{totalCount})
        </span>
      );
    case 'PARTIALLY_AVAILABLE':
      return (
        <span className="pd-badge pd-badge--amber inline-flex items-center gap-1">
          <AlertTriangle size={13} />
          PARTIAL STOCK ({availableCount}/{totalCount})
        </span>
      );
    case 'NONE_AVAILABLE':
      return (
        <span className="pd-badge pd-badge--rose inline-flex items-center gap-1">
          <XCircle size={13} />
          OUT OF STOCK (0/{totalCount})
        </span>
      );
    case 'AVAILABILITY_UNKNOWN':
      return (
        <span className="pd-badge inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 border border-purple-500/30">
          <HelpCircle size={13} />
          CLARIFICATION NEEDED
        </span>
      );
    default:
      return <span className="pd-badge pd-badge--slate">ACTIVE DISPENSARY</span>;
  }
};

export const ItemStockBadge: React.FC<{
  status: MedicineStockStatus;
  qty: number;
  unit?: string | null;
}> = ({ status, qty, unit }) => {
  if (status === 'AVAILABLE') {
    return (
      <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
        <CheckCircle2 size={14} />
        In Stock ({qty} {unit || 'units'})
      </span>
    );
  }
  if (status === 'UNAVAILABLE') {
    return (
      <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
        <XCircle size={14} />
        Out of Stock
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-purple-500 flex items-center gap-1">
      <HelpCircle size={14} />
      Unresolved Drug
    </span>
  );
};

