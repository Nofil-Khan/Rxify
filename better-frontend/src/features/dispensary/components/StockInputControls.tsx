import * as React from 'react';
import { Plus, Minus } from 'lucide-react';

interface StockInputControlsProps {
  stock: number;
  reorder: number;
  onStockChange: (val: number) => void;
  onReorderChange: (val: number) => void;
}

export const StockInputControls: React.FC<StockInputControlsProps> = ({
  stock,
  reorder,
  onStockChange,
  onReorderChange,
}) => {
  return (
    <div className="my-5 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-emerald-200/80 mb-2">
          Available Units in Dispensary Shelf
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStockChange(Math.max(0, stock - 5))}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-0 border border-mint-400/20 text-white hover:bg-bg-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
            aria-label="Decrease stock by 5"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => onStockChange(Math.max(0, Number(e.target.value)))}
            className="flex-1 rounded-xl border border-mint-400/25 bg-bg-0/60 px-3 py-2 text-center text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
            aria-label="Current stock units"
          />
          <button
            type="button"
            onClick={() => onStockChange(stock + 5)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-0 border border-mint-400/20 text-white hover:bg-bg-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
            aria-label="Increase stock by 5"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-emerald-200/80 mb-1">
          Low Stock Reorder Threshold
        </label>
        <input
          type="number"
          min={0}
          value={reorder}
          onChange={(e) => onReorderChange(Math.max(0, Number(e.target.value)))}
          className="w-full rounded-xl border border-mint-400/25 bg-bg-0/60 px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
          aria-label="Reorder threshold"
        />
      </div>
    </div>
  );
};

