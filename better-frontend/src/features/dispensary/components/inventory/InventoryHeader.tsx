import * as React from 'react';
import { Search, Plus, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

type Filter = 'all' | 'low' | 'out' | 'expiring';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  activeFilter: Filter;
  onFilterChange: (f: Filter) => void;
  onAddStock: () => void;
  totalSKU: number;
  lowCount: number;
  outCount: number;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'low', label: 'Low Stock' },
  { id: 'out', label: 'Out of Stock' },
];

/** Warm-titanium inventory header with KPI callouts + filter pills. */
const InventoryHeader: React.FC<Props> = ({
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onAddStock,
  totalSKU,
  lowCount,
  outCount,
}) => (
  <div className="flex flex-col gap-5">
    {/* KPI Callouts */}
    <div className="flex items-end gap-10">
      <div>
        <span
          className="ti-display-num block"
          style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', color: 'var(--ti-ink)' }}
        >
          {totalSKU}
        </span>
        <span className="ti-spec-label text-[11px]">TOTAL SKUs</span>
      </div>
      <div>
        <span
          className="ti-display-num block"
          style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', color: 'var(--ti-amber)' }}
        >
          {lowCount}
        </span>
        <span className="ti-spec-label text-[11px]">LOW STOCK</span>
      </div>
      <div>
        <span
          className="ti-display-num block"
          style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', color: 'var(--ti-ruby)' }}
        >
          {outCount}
        </span>
        <span className="ti-spec-label text-[11px]">OUT OF STOCK</span>
      </div>
    </div>

    {/* Alert strip */}
    {lowCount > 0 && (
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px]"
        style={{
          border: '1px solid rgba(196,122,30,0.3)',
          background: 'rgba(196,122,30,0.06)',
          color: 'var(--ti-amber)',
        }}
      >
        <AlertTriangle size={13} />
        <span>
          <strong>{lowCount}</strong> medicine{lowCount > 1 ? 's' : ''} at or below reorder level.
          Review stock health cards below.
        </span>
      </div>
    )}

    {/* Search + filter row */}
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--ti-ink-muted)' }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search medicine, brand, category…"
          aria-label="Search inventory"
          className="w-full h-9 rounded-full pl-9 pr-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 4px 12px rgba(24,24,22,0.05)',
            color: 'var(--ti-ink)',
          }}
        />
      </div>

      {/* Filter pills with layoutId indicator */}
      <div
        className="flex items-center gap-1 p-1 rounded-full"
        style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(24,24,22,0.07)' }}
        role="tablist"
        aria-label="Inventory filter"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={activeFilter === f.id}
            onClick={() => onFilterChange(f.id)}
            className="relative px-3 py-1 rounded-full text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
            style={{
              color: activeFilter === f.id ? 'var(--ti-ink)' : 'var(--ti-ink-muted)',
              zIndex: 1,
            }}
          >
            {activeFilter === f.id && (
              <motion.span
                layoutId="inv-filter-pill"
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'white',
                  boxShadow: '0 2px 8px rgba(24,24,22,0.08)',
                  zIndex: -1,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {/* Add Stock */}
      <button
        type="button"
        onClick={onAddStock}
        aria-label="Add new stock"
        className="ml-auto flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
        style={{
          background: 'var(--ti-sage)',
          color: 'white',
          boxShadow: '0 4px 16px rgba(74,124,111,0.25)',
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
        Add Stock
      </button>
    </div>
  </div>
);

export default InventoryHeader;
