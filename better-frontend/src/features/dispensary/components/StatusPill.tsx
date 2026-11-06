import * as React from 'react';
import { Check, TrendingDown, X } from 'lucide-react';
import { FulfillmentStatus } from '../types';

interface StatusPillProps {
  status: FulfillmentStatus | 'NEW';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  if (status === 'NEW') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-600/15 border border-emerald-600/25 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        New
      </span>
    );
  }

  if (status === 'AVAILABLE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/15 border border-emerald-600/25 px-3 py-1 text-xs font-semibold text-emerald-800">
        <Check size={14} strokeWidth={2} />
        <span>Available</span>
      </span>
    );
  }

  if (status === 'PARTIAL') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-800">
        <TrendingDown size={14} strokeWidth={2} />
        <span>Partial</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-800">
      <X size={14} strokeWidth={2} />
      <span>Unavailable</span>
    </span>
  );
};

export default StatusPill;

