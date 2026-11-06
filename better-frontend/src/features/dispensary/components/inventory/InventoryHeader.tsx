import * as React from 'react';
import { Search, Plus, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  lowStockOnly: boolean;
  onLowStockToggle: () => void;
  onAddStockClick: () => void;
  totalItems: number;
  lowStockCount: number;
}

export const InventoryHeader: React.FC<Props> = ({
  search,
  onSearchChange,
  lowStockOnly,
  onLowStockToggle,
  onAddStockClick,
  totalItems,
  lowStockCount,
}) => {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-4 border-b border-mint-400/15">
      <div className="flex items-center gap-3">
        {/* Search bar */}
        <div className="relative flex-1 md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-to/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search medicine by name or brand..."
            className="w-full rounded-full border border-mint-400/20 bg-bg-0/60 pl-10 pr-4 py-2 text-xs text-cream-from placeholder:text-cream-to/40 focus:border-mint-400 focus:outline-none focus:ring-1 focus:ring-mint-400 transition-all"
            aria-label="Search inventory"
          />
        </div>

        {/* Low Stock Toggle Chip */}
        <button
          type="button"
          onClick={onLowStockToggle}
          className={`glass-chip text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
            lowStockOnly
              ? 'border-amber-400/80 bg-amber-500/20 text-amber-200'
              : 'text-cream-to/70 hover:text-cream-from hover:border-mint-400/40'
          }`}
          aria-pressed={lowStockOnly}
        >
          <AlertTriangle size={13} className={lowStockOnly ? 'text-amber-400' : 'text-cream-to/50'} />
          <span>Low Stock ({lowStockCount})</span>
        </button>
      </div>

      <div className="flex items-center gap-3 justify-end">
        <span className="glass-chip text-xs text-cream-to/60 hidden sm:flex items-center gap-1">
          <Layers size={13} /> {totalItems} Medicines Tracked
        </span>

        {/* Add Stock Action */}
        <button
          type="button"
          onClick={onAddStockClick}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-bg-0 bg-gradient-to-r from-mint-300 via-mint-400 to-emerald-400 shadow-glow-mint hover:brightness-110 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
        >
          <Plus size={16} strokeWidth={2.2} />
          <span>Add Stock</span>
        </button>
      </div>
    </div>
  );
};

export default InventoryHeader;

