import * as React from 'react';
import { Package, ChevronRight, User, Calendar, Clock } from 'lucide-react';
import { QueueItemSummary } from '@/lib/dispensaryApi';

interface Props {
  orders: QueueItemSummary[];
  onSelectOrder: (order: QueueItemSummary) => void;
}

function getStatusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === 'PENDING') {
    return <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">New / Pending</span>;
  }
  if (s === 'PROCESSING' || s === 'CONFIRMED') {
    return <span className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">Processing</span>;
  }
  if (s === 'READY') {
    return <span className="rounded-full bg-mint-400/25 border border-mint-400/50 px-2.5 py-0.5 text-[10px] font-semibold text-mint-300">Ready for Pickup</span>;
  }
  if (s === 'DISPENSED') {
    return <span className="rounded-full bg-slate-500/20 border border-slate-400/30 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300">Dispensed</span>;
  }
  return <span className="rounded-full bg-red-500/20 border border-red-400/30 px-2.5 py-0.5 text-[10px] font-semibold text-red-300">{status}</span>;
}

export const OrdersList: React.FC<Props> = ({ orders, onSelectOrder }) => {
  if (orders.length === 0) {
    return (
      <div className="glass-panel p-12 text-center flex flex-col items-center justify-center gap-3">
        <Package size={32} className="text-cream-to/40" />
        <p className="text-sm text-cream-to/70 font-medium">No prescription orders found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((ord) => {
        const initials = (ord.patient_name || 'Patient')
          .split(' ')
          .filter(Boolean)
          .map((w) => w[0]?.toUpperCase())
          .slice(0, 2)
          .join('') || 'PT';

        const rxNum = ord.prescription_id ? `RX-2026-${ord.prescription_id}` : `REQ-${ord.request_id}`;
        const dateStr = new Date(ord.created_at || Date.now()).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div
            key={ord.request_id}
            onClick={() => onSelectOrder(ord)}
            className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-mint-400/40 hover:bg-bg-1/70 transition-all group"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectOrder(ord);
            }}
            aria-label={`Open order ${rxNum} for ${ord.patient_name}`}
          >
            {/* Left: Patient Avatar & Rx Info */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream-from font-sans text-xs font-bold text-ink shadow-md">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-cream-from truncate">
                    {ord.patient_name}
                  </span>
                  {ord.patient_code && (
                    <span className="glass-chip text-[10px] py-0 px-1.5 text-mint-300">
                      {ord.patient_code}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-cream-to/60 mt-0.5">
                  <span className="font-serif font-medium text-cream-from/90">{rxNum}</span>
                  <span>·</span>
                  <span>{ord.total_items} {ord.total_items === 1 ? 'medicine' : 'medicines'}</span>
                </div>
              </div>
            </div>

            {/* Right: Status badge & timestamp & chevron */}
            <div className="flex items-center gap-4 justify-between sm:justify-end">
              <div className="flex flex-col items-start sm:items-end gap-1">
                {getStatusBadge(ord.status)}
                <div className="flex items-center gap-1 text-[11px] text-cream-to/50">
                  <Clock size={11} />
                  <span>{dateStr}</span>
                </div>
              </div>

              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-400/10 text-mint-300 group-hover:bg-mint-400 group-hover:text-bg-0 transition-colors">
                <ChevronRight size={16} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrdersList;

