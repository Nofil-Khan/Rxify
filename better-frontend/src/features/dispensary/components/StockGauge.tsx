import * as React from 'react';
import { motion } from 'motion/react';

interface StockGaugeProps {
  inStock: number;
  reorderLevel: number;
}

export const StockGauge: React.FC<StockGaugeProps> = ({ inStock, reorderLevel }) => {
  const radius = 46;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius; // ~289.03

  const maxThreshold = Math.max(inStock, (reorderLevel || 20) * 3);
  const fillRatio = Math.min(Math.max(inStock / maxThreshold, 0), 1);
  const strokeDashoffset = circumference * (1 - fillRatio);

  const isLowStock = inStock <= (reorderLevel || 20);

  return (
    <div
      className="relative flex flex-col items-center justify-center shrink-0"
      aria-label={`Stock level: ${inStock} units in stock. ${isLowStock ? 'Low stock alert' : 'Stock level healthy'}`}
    >
      <div className="relative flex items-center justify-center">
        <svg
          width="118"
          height="118"
          viewBox="0 0 120 120"
          className="rotate-[-90deg] select-none"
        >
          <defs>
            <linearGradient id="mintArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A7F3D0" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <linearGradient id="amberArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(16, 185, 129, 0.14)"
            strokeWidth={strokeWidth}
          />

          {/* Animated Value Arc */}
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={isLowStock ? 'url(#amberArcGrad)' : 'url(#mintArcGrad)'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              filter: isLowStock
                ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))'
                : 'drop-shadow(0 0 10px rgba(110, 231, 183, 0.65))',
            }}
          />
        </svg>

        {/* Center Numbers */}
        <div className="absolute flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className="font-sans text-[32px] font-semibold tracking-tight text-white leading-none">
            {inStock}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-emerald-200/60 leading-none">
            In Stock
          </span>
        </div>
      </div>

      {isLowStock && (
        <span className="mt-1.5 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30 animate-pulse">
          Low stock
        </span>
      )}
    </div>
  );
};

export default StockGauge;

