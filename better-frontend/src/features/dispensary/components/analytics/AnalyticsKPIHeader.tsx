import * as React from 'react';
import { ShoppingBag, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { DispensaryAnalyticsData } from '@/lib/dispensaryApi';

interface Props {
  kpis: DispensaryAnalyticsData['kpis'];
}

export const AnalyticsKPIHeader: React.FC<Props> = ({ kpis }) => {
  const cards = [
    {
      label: 'Total Orders',
      value: kpis.total_orders,
      sub: 'Lifetime prescriptions',
      icon: ShoppingBag,
      color: 'text-mint-300',
    },
    {
      label: 'Dispensed Successfully',
      value: kpis.total_dispensed,
      sub: `${kpis.fulfillment_rate}% fulfillment rate`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
    },
    {
      label: 'Avg Preparation Time',
      value: `${kpis.avg_prep_time_minutes} min`,
      sub: 'FIFO queue turnaround',
      icon: TrendingUp,
      color: 'text-cyan-300',
    },
    {
      label: 'Active Monitored Stock',
      value: kpis.total_medicines_tracked,
      sub: 'Catalog medicines in stock',
      icon: AlertTriangle,
      color: 'text-amber-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="glass-panel p-4 flex flex-col justify-between hover:border-mint-400/40 transition-colors"
          >
            <div className="flex items-center justify-between text-cream-to/60">
              <span className="text-xs uppercase tracking-wider font-medium">{c.label}</span>
              <Icon size={16} className={c.color} />
            </div>
            <div className="mt-2">
              <div className="font-serif text-2xl lg:text-3xl font-bold text-cream-from">
                {c.value}
              </div>
              <p className="text-[11px] text-cream-to/50 mt-0.5">{c.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnalyticsKPIHeader;

