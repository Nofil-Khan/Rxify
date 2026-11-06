import * as React from 'react';
import { Search } from 'lucide-react';

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  counts: Record<string, number>;
}

const TABS = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'PENDING', label: 'New / Pending' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'READY', label: 'Ready for Pickup' },
  { id: 'DISPENSED', label: 'Dispensed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export const OrdersFilterBar: React.FC<Props> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  counts,
}) => {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-4 border-b border-mint-400/15">
      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {TABS.map((t) => {
          const isActive = statusFilter === t.id;
          const count = counts[t.id] ?? 0;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onStatusChange(t.id)}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-mint-400/30 to-emerald-500/20 text-white border border-mint-400/60 shadow-glow-mint'
                  : 'text-cream-to/70 hover:text-cream-from border border-mint-400/10 hover:border-mint-400/30 bg-bg-0/30'
              }`}
            >
              <span>{t.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-mint-400/30 text-white' : 'bg-bg-0/60 text-cream-to/50'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative md:w-72">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-to/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by patient, Rx, code..."
          className="w-full rounded-full border border-mint-400/20 bg-bg-0/60 pl-10 pr-4 py-1.5 text-xs text-cream-from placeholder:text-cream-to/40 focus:border-mint-400 focus:outline-none focus:ring-1 focus:ring-mint-400 transition-all"
          aria-label="Filter orders list"
        />
      </div>
    </div>
  );
};

export default OrdersFilterBar;

