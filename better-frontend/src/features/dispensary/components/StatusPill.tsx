import * as React from 'react';
import { Check, TrendingDown, X, Clock, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { FulfillmentStatus, RequestStatus } from '../types';

interface StatusPillProps {
  status: FulfillmentStatus | RequestStatus | 'NEW';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  if (status === 'NEW' || status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 border border-emerald-600/25 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <Sparkles className="h-3 w-3 text-emerald-700" />
        <span>New</span>
      </span>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
        <Loader2 className="h-3 w-3 animate-spin text-teal-700" />
        <span>Preparing</span>
      </span>
    );
  }

  if (status === 'READY') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/20 border border-emerald-600/40 px-2.5 py-0.5 text-xs font-bold text-emerald-900 shadow-xs">
        <Check className="h-3.5 w-3.5 text-emerald-800 stroke-[2.5]" />
        <span>Ready for Pickup</span>
      </span>
    );
  }

  if (status === 'DISPENSED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 border border-slate-500/30 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        <Clock className="h-3 w-3 text-slate-600" />
        <span>Dispensed</span>
      </span>
    );
  }

  if (status === 'RECONSULTATION_NEEDED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
        <AlertCircle className="h-3 w-3 text-purple-700" />
        <span>Reconsultation</span>
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
