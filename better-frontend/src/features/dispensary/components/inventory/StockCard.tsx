import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Minus, Plus, Package2 } from 'lucide-react';
import { InventoryItem, updateStockPartial } from '@/lib/dispensaryApi';
import StockFillBar from './StockFillBar';

interface Props {
  item: InventoryItem;
  onAdjust: (item: InventoryItem) => void;
}

/** Warm titanium stock health card — inline +/- stepper with debounced PATCH. */
const StockCard: React.FC<Props> = ({ item, onAdjust }) => {
  const [localQty, setLocalQty] = React.useState(item.available_quantity);
  const [saving, setSaving] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const isOut = localQty <= 0;
  const isLow = !isOut && localQty <= item.reorder_level;
  const statusLabel = isOut ? 'OUT' : isLow ? 'LOW' : 'OK';
  const statusColor = isOut
    ? 'var(--ti-ruby)'
    : isLow
      ? 'var(--ti-amber)'
      : 'var(--ti-sage)';

  const commitQty = React.useCallback((qty: number) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateStockPartial(item.inventory_id, { available_quantity: qty });
      } catch (e) {
        console.warn('[StockCard patch]', e);
      } finally {
        setSaving(false);
      }
    }, 350);
  }, [item.inventory_id]);

  const step = (delta: number) => {
    const next = Math.max(0, localQty + delta);
    setLocalQty(next);
    commitQty(next);
  };

  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="ti-sheet group relative flex flex-col gap-3 p-4 cursor-pointer"
      style={{ borderRadius: 16 }}
      onClick={() => onAdjust(item)}
    >
      {/* Status dot */}
      <span
        className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full"
        style={{ background: statusColor }}
        aria-label={statusLabel}
      />

      {/* Name + form */}
      <div>
        <p className="font-serif text-[15px] font-semibold leading-tight text-ti-ink line-clamp-1">
          {item.generic_name}
        </p>
        {item.brand_name && item.brand_name !== item.generic_name && (
          <p className="text-[11px] text-ti-ink-muted mt-0.5">{item.brand_name}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {item.strength && (
            <span className="ti-spec-label text-[10px]">{item.strength}</span>
          )}
          <span className="ti-spec-label text-[10px]">{item.form}</span>
          {item.category && (
            <span className="ti-spec-label text-[10px]">{item.category}</span>
          )}
        </div>
      </div>

      {/* Fill bar */}
      <StockFillBar
        available={localQty}
        reorderLevel={item.reorder_level}
        maxQty={Math.max(localQty * 1.6, item.reorder_level * 3, 20)}
      />

      {/* Stats row */}
      <div className="flex items-end justify-between">
        <div>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={localQty}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="ti-display-num block"
              style={{
                fontSize: 'clamp(1.4rem, 2.2vw, 1.75rem)',
                color: statusColor,
                lineHeight: 1,
              }}
            >
              {localQty}
            </motion.span>
          </AnimatePresence>
          <span className="text-[10px] text-ti-ink-muted font-mono mt-0.5 block">
            {item.unit ?? 'units'} · reorder @{item.reorder_level}
          </span>
        </div>

        {/* Inline +/- stepper */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Adjust quantity for ${item.generic_name}`}
        >
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={`Decrease ${item.generic_name} quantity`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ti-hairline)] bg-white/60 text-ti-ink-muted transition-colors hover:bg-white hover:text-ti-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
          >
            <Minus size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={`Increase ${item.generic_name} quantity`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ti-hairline)] bg-white/60 text-ti-ink-muted transition-colors hover:bg-white hover:text-ti-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-[16px] overflow-hidden">
          <motion.div
            className="h-full"
            style={{ background: 'var(--ti-sage)' }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {/* Hover overlay package icon */}
      <Package2
        size={48}
        className="absolute bottom-3 right-3 text-ti-ink/[0.03] transition-opacity group-hover:opacity-100 opacity-0 pointer-events-none"
        aria-hidden
      />
    </motion.div>
  );
};

export default StockCard;

