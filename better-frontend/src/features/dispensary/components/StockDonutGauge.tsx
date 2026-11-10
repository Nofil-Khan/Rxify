import * as React from 'react';

interface StockDonutGaugeProps {
  inStock: number;
  totalCapacity?: number;
}

export const StockDonutGauge: React.FC<StockDonutGaugeProps> = ({
  inStock,
  totalCapacity = 50,
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(Math.max(inStock / totalCapacity, 0), 1);
  const strokeDashoffset = circumference - ratio * circumference;

  return (
    <div className="relative flex items-center justify-center py-2" aria-label={`Stock level: ${inStock}`}>
      <svg width="108" height="108" viewBox="0 0 108 108" className="rotate-[-90deg]">
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="rgba(16, 185, 129, 0.12)"
          strokeWidth="8"
        />
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="var(--mint-400, #6EE7B7)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ filter: 'drop-shadow(0 0 8px rgba(110, 231, 183, 0.5))' }}
        />
      </svg>

      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-sans text-2xl font-bold tracking-tight text-white leading-none">
          {inStock}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200/60">
          In Stock
        </span>
      </div>
    </div>
  );
};

export default StockDonutGauge;

