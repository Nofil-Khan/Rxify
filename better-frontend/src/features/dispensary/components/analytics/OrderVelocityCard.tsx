import * as React from 'react';
import { BarChart3, CheckCircle2, Clock } from 'lucide-react';
import { OrderTrendItem } from '@/lib/dispensaryApi';

interface Props {
  trend: OrderTrendItem[];
  avgPrepMinutes: number;
  fulfillmentRate: number;
}

export const OrderVelocityCard: React.FC<Props> = ({ trend, avgPrepMinutes, fulfillmentRate }) => {
  const maxDayOrders = Math.max(...trend.map((t) => t.total_orders), 1);

  return (
    <div className="glass-panel p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-mint-400/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-400/15 border border-mint-400/30 text-mint-300">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-cream-from">Fulfillment Velocity</h3>
            <p className="text-xs text-cream-to/60">Daily demand & completion rates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="glass-chip text-xs text-mint-300 flex items-center gap-1">
            <CheckCircle2 size={12} /> {fulfillmentRate}% Fulfilled
          </span>
          <span className="glass-chip text-xs text-cream-to/70 flex items-center gap-1">
            <Clock size={12} /> ~{avgPrepMinutes}m Prep
          </span>
        </div>
      </div>

      {/* 7-Day Velocity Bars */}
      <div className="flex items-end justify-between gap-2.5 mt-5 h-36 pt-4 px-2">
        {trend.map((item) => {
          const heightPct = Math.round((item.total_orders / maxDayOrders) * 100);
          const dateLabel = new Date(item.day).toLocaleDateString('en-US', { weekday: 'short' });

          return (
            <div key={item.day} className="flex-1 flex flex-col items-center gap-2 group">
              <span className="text-[10px] font-mono text-cream-to/50 group-hover:text-mint-300 transition-colors">
                {item.total_orders}
              </span>
              <div className="w-full max-w-[28px] h-24 bg-bg-0/60 rounded-t-lg overflow-hidden flex flex-col justify-end p-0.5">
                <div
                  className="w-full bg-gradient-to-t from-mint-400/70 to-emerald-300 rounded-t-md transition-all duration-500 group-hover:from-mint-400 group-hover:to-teal-200"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-cream-to/60 group-hover:text-cream-from">
                {dateLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderVelocityCard;

