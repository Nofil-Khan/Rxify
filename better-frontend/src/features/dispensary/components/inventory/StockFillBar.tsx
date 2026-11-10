import * as React from 'react';
import { motion } from 'motion/react';

interface Props {
  available: number;
  reorderLevel: number;
  maxQty?: number;
}

/** Animated horizontal liquid-fill bar representing stock health. */
const StockFillBar: React.FC<Props> = ({ available, reorderLevel, maxQty }) => {
  const max = maxQty ?? Math.max(available * 1.5, reorderLevel * 3, 10);
  const pct = Math.min(available / max, 1);
  const reorderPct = Math.min(reorderLevel / max, 1);

  const isOut = available <= 0;
  const isLow = !isOut && available <= reorderLevel;

  const fillColor = isOut
    ? 'var(--ti-ruby)'
    : isLow
      ? 'var(--ti-amber)'
      : 'var(--ti-sage)';

  const fillOpacity = isOut ? 0.65 : isLow ? 0.75 : 0.72;

  return (
    <div
      role="meter"
      aria-valuenow={available}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Stock level: ${available} units`}
      className="relative h-2 w-full rounded-full overflow-hidden"
      style={{ background: 'rgba(24,24,22,0.07)' }}
    >
      {/* Reorder marker */}
      <div
        className="absolute top-0 bottom-0 w-px z-10"
        style={{
          left: `${reorderPct * 100}%`,
          background: 'rgba(196,122,30,0.5)',
        }}
        aria-hidden
      />

      {/* Fill track */}
      <motion.div
        className="absolute left-0 top-0 h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: 'spring', stiffness: 240, damping: 24, delay: 0.05 }}
        style={{
          background: fillColor,
          opacity: fillOpacity,
        }}
      />
    </div>
  );
};

export default StockFillBar;

