import * as React from 'react';
import { Award, Package, TrendingUp } from 'lucide-react';
import { TopOrderedMedicine } from '@/lib/dispensaryApi';

interface Props {
  medicines: TopOrderedMedicine[];
}

export const TopMedicinesLeaderboard: React.FC<Props> = ({ medicines }) => {
  const maxOrders = Math.max(...medicines.map((m) => m.total_orders), 1);

  return (
    <div className="glass-panel p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-mint-400/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-400/15 border border-mint-400/30 text-mint-300">
            <Award size={18} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-cream-from">Most Ordered Medicines</h3>
            <p className="text-xs text-cream-to/60">Ranked by prescription request frequency</p>
          </div>
        </div>
        <span className="glass-chip text-xs text-mint-300 flex items-center gap-1">
          <TrendingUp size={12} /> Live Demand
        </span>
      </div>

      <div className="flex flex-col gap-3.5 mt-4 overflow-y-auto max-h-[380px] pr-1">
        {medicines.map((med, idx) => {
          const pct = Math.round((med.total_orders / maxOrders) * 100);
          const isTop3 = idx < 3;
          const badgeColor =
            idx === 0
              ? 'bg-amber-400 text-bg-0 font-bold'
              : idx === 1
                ? 'bg-slate-300 text-bg-0 font-bold'
                : idx === 2
                  ? 'bg-amber-600/80 text-white font-bold'
                  : 'bg-mint-400/10 text-cream-to/70';

          return (
            <div
              key={med.medicine_id}
              className="group flex flex-col gap-1.5 rounded-xl border border-mint-400/10 bg-bg-0/30 p-3 transition-colors hover:border-mint-400/30 hover:bg-bg-0/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${badgeColor}`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-cream-from truncate">
                        {med.generic_name}
                      </span>
                      {med.brand_name && med.brand_name !== med.generic_name && (
                        <span className="text-xs text-mint-300/80">({med.brand_name})</span>
                      )}
                    </div>
                    <span className="text-xs text-cream-to/60">
                      {med.strength} · {med.form} · {med.category}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-sans text-sm font-bold text-mint-300">
                    {med.total_orders}{' '}
                    <span className="text-xs font-normal text-cream-to/60">orders</span>
                  </span>
                  <div className="flex items-center justify-end gap-1 text-[11px] text-cream-to/50">
                    <Package size={11} />
                    <span>{med.total_dispensed_qty} units dispensed</span>
                  </div>
                </div>
              </div>

              {/* Demand progress meter */}
              <div className="h-1.5 w-full rounded-full bg-bg-0/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isTop3
                      ? 'bg-gradient-to-r from-mint-400 to-emerald-400 shadow-glow-mint'
                      : 'bg-mint-400/50'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {medicines.length === 0 && (
          <div className="py-12 text-center text-xs text-cream-to/50">
            No prescription requests recorded yet. Data will populate in real time as prescriptions are processed.
          </div>
        )}
      </div>
    </div>
  );
};

export default TopMedicinesLeaderboard;

