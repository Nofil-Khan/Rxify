import * as React from 'react';

interface StockLegendProps {
  available: number;
  reserved: number;
  reorderLevel: number;
}

export const StockLegend: React.FC<StockLegendProps> = ({
  available,
  reserved,
  reorderLevel,
}) => {
  return (
    <div
      className="flex flex-col justify-center gap-3.5 flex-1 min-w-[120px] font-sans text-xs"
      aria-label="Stock distribution breakdown"
    >
      {/* Available Units - Fix mockup typo: 'Available' */}
      <div className="flex items-center justify-between text-emerald-100/90">
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
            aria-hidden="true"
          />
          <span className="font-medium text-emerald-100/80">Available</span>
        </span>
        <span className="tabular-nums font-semibold text-white text-sm">
          {available}
        </span>
      </div>

      {/* Reserved Units */}
      <div className="flex items-center justify-between text-emerald-100/90">
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-teal-300 shadow-[0_0_6px_rgba(45,212,191,0.6)]"
            aria-hidden="true"
          />
          <span className="font-medium text-emerald-100/80">Reserved</span>
        </span>
        <span className="tabular-nums font-semibold text-white text-sm">
          {reserved}
        </span>
      </div>

      {/* Reorder Level Threshold */}
      <div className="flex items-center justify-between text-emerald-200/60">
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-200/40"
            aria-hidden="true"
          />
          <span className="font-medium text-emerald-200/60">Reorder Level</span>
        </span>
        <span className="tabular-nums font-semibold text-emerald-200/80 text-sm">
          {reorderLevel}
        </span>
      </div>
    </div>
  );
};

export default StockLegend;

