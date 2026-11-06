import * as React from 'react';
import { PieChart, Layers } from 'lucide-react';
import { CategoryDistribution } from '@/lib/dispensaryApi';

interface Props {
  categories: CategoryDistribution[];
}

const CATEGORY_COLORS = [
  'from-mint-400 to-emerald-500',
  'from-teal-400 to-cyan-500',
  'from-emerald-300 to-teal-400',
  'from-green-400 to-emerald-600',
  'from-mint-300 to-green-500',
  'from-teal-300 to-emerald-400',
];

export const CategoryDistributionCard: React.FC<Props> = ({ categories }) => {
  const totalItems = categories.reduce((sum, c) => sum + c.item_count, 0) || 1;

  return (
    <div className="glass-panel p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-mint-400/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-400/15 border border-mint-400/30 text-mint-300">
            <PieChart size={18} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-cream-from">Therapeutic Classes</h3>
            <p className="text-xs text-cream-to/60">Prescription volume by category</p>
          </div>
        </div>
        <span className="glass-chip text-xs text-cream-to/70 flex items-center gap-1">
          <Layers size={12} /> {categories.length} Classes
        </span>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        {categories.map((cat, idx) => {
          const pct = Math.round((cat.item_count / totalItems) * 100);
          const gradient = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

          return (
            <div key={cat.category} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-cream-from">{cat.category}</span>
                <span className="text-cream-to/70 font-mono">
                  {cat.item_count} items ({pct}%)
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-bg-0/60 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="py-8 text-center text-xs text-cream-to/50">
            No category distribution data available yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryDistributionCard;

