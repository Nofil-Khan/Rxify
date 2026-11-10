import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { fetchInventory, InventoryItem } from '@/lib/dispensaryApi';
import { useDispensaryWorkspace } from '../../hooks/useDispensaryWorkspace';
import InventoryHeader from './InventoryHeader';
import StockCard from './StockCard';

type Filter = 'all' | 'low' | 'out' | 'expiring';

/** Groups items by category, returns sorted map. */
function groupByCategory(items: InventoryItem[]): Map<string, InventoryItem[]> {
  const map = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const cat = item.category ?? 'General';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  // Sort categories alphabetically
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring' as const, stiffness: 320, damping: 26 } },
};

export const InventoryView: React.FC = () => {
  const { openManageStockModal, openAddMedicineModal } = useDispensaryWorkspace();
  const [search, setSearch] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<Filter>('all');

  const { data: items = [], isLoading, isError } = useQuery<InventoryItem[]>({
    queryKey: ['dispensary_inventory'],
    queryFn: fetchInventory,
    staleTime: 20_000,
  });

  const filteredItems = React.useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        item.generic_name.toLowerCase().includes(q) ||
        (item.brand_name ?? '').toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q);
      const freeStock = item.free_stock ?? (item.available_quantity - item.reserved_quantity);
      const isLow = freeStock <= item.reorder_level && freeStock > 0;
      const isOut = freeStock <= 0;
      const matchFilter =
        activeFilter === 'all' ||
        (activeFilter === 'low' && isLow) ||
        (activeFilter === 'out' && isOut);
      return matchSearch && matchFilter;
    });
  }, [items, search, activeFilter]);

  const kpi = React.useMemo(() => {
    const lowCount = items.filter((i) => {
      const f = i.free_stock ?? (i.available_quantity - i.reserved_quantity);
      return f <= i.reorder_level && f > 0;
    }).length;
    const outCount = items.filter((i) => {
      const f = i.free_stock ?? (i.available_quantity - i.reserved_quantity);
      return f <= 0;
    }).length;
    return { lowCount, outCount };
  }, [items]);

  const grouped = React.useMemo(() => groupByCategory(filteredItems), [filteredItems]);

  const handleAdjust = React.useCallback((item: InventoryItem) => {
    openManageStockModal({
      inventoryId: item.inventory_id,
      medicineId: item.medicine_id,
      name: item.generic_name,
      strength: item.brand_name ?? item.strength ?? '',
      form: item.form ?? undefined,
      availableQuantity: item.available_quantity,
      reorderLevel: item.reorder_level,
      unit: item.unit ?? 'units',
    });
  }, [openManageStockModal]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3" style={{ color: 'var(--ti-ink-muted)' }}>
        <div
          className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--ti-sage)', borderTopColor: 'transparent' }}
        />
        <span className="font-mono text-sm">Loading inventory…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--ti-ruby)' }}>
        Failed to load inventory. Check your connection.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1440px] mx-auto pb-16">
      {/* Page title */}
      <div>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--ti-ink-subtle)' }}>
          DISPENSARY PHARMACY
        </span>
        <h1 className="font-serif text-3xl font-semibold mt-1 leading-tight" style={{ color: 'var(--ti-ink)', letterSpacing: '-0.02em' }}>
          Stock Health
        </h1>
      </div>

      {/* Header: KPIs + filters + add */}
      <InventoryHeader
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onAddStock={openAddMedicineModal}
        totalSKU={items.length}
        lowCount={kpi.lowCount}
        outCount={kpi.outCount}
      />

      {/* Hairline separator */}
      <div style={{ height: 1, background: 'var(--ti-hairline)' }} />

      {/* Category groups */}
      <AnimatePresence mode="wait">
        {filteredItems.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-2 py-20 text-center"
            style={{ color: 'var(--ti-ink-subtle)' }}
          >
            <span className="text-5xl" role="img" aria-label="medicine">💊</span>
            <p className="font-mono text-sm">No medicines match your filter.</p>
          </motion.div>
        ) : (
          <motion.div key="grid" initial="hidden" animate="show" variants={container} className="flex flex-col gap-10">
            {[...grouped.entries()].map(([category, categoryItems]) => (
              <div key={category}>
                {/* Category label */}
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em]"
                    style={{ color: 'var(--ti-ink-muted)' }}
                  >
                    {category}
                  </span>
                  <div className="flex-1" style={{ height: 1, background: 'var(--ti-hairline)' }} />
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: 'var(--ti-ink-subtle)' }}
                  >
                    {categoryItems.length}
                  </span>
                </div>

                {/* Card grid */}
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {categoryItems.map((item) => (
                    <motion.div key={item.inventory_id} variants={cardAnim}>
                      <StockCard item={item} onAdjust={handleAdjust} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryView;
