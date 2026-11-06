import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInventory, InventoryItem } from '@/lib/dispensaryApi';
import InventoryHeader from './InventoryHeader';
import InventoryTable from './InventoryTable';
import { useDispensaryWorkspace } from '../../hooks/useDispensaryWorkspace';

export const InventoryView: React.FC = () => {
  const { openManageStockModal } = useDispensaryWorkspace();
  const [search, setSearch] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('ALL');
  const [lowStockOnly, setLowStockOnly] = React.useState(false);

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['dispensary_inventory'],
    queryFn: fetchInventory,
    staleTime: 15000,
  });

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        item.generic_name.toLowerCase().includes(q) ||
        (item.brand_name && item.brand_name.toLowerCase().includes(q));
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const isLow = (item.available_quantity - (item.reserved_quantity || 0)) <= item.reorder_level;
      const matchStock = !lowStockOnly || isLow;
      return matchSearch && matchCat && matchStock;
    });
  }, [items, search, selectedCategory, lowStockOnly]);

  const lowStockCount = React.useMemo(() => {
    return items.filter((i) => (i.available_quantity - (i.reserved_quantity || 0)) <= i.reorder_level).length;
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <div className="flex items-center gap-3 text-mint-300 font-sans text-sm animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-mint-400 border-t-transparent animate-spin" />
          <span>Loading dispensary inventory stock...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto pb-10">
      {/* Title & Overview */}
      <div className="flex flex-col gap-1">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.35em] text-cream-to/50">
          DISPENSARY PHARMACY LEDGER
        </span>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-cream-from">
          Inventory & Stock Management
        </h1>
        <p className="text-xs text-cream-to/60 max-w-xl">
          Track medicine stock levels, manage lot reserves, and handle automatic reorder triggers.
        </p>
      </div>

      {/* Header with Search and Actions */}
      <InventoryHeader
        search={search}
        onSearchChange={setSearch}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        lowStockOnly={lowStockOnly}
        onLowStockToggle={() => setLowStockOnly((p) => !p)}
        onAddStockClick={openManageStockModal}
        totalItems={items.length}
        lowStockCount={lowStockCount}
      />

      {/* Table */}
      <InventoryTable
        items={filteredItems}
        onAdjustStock={() => openManageStockModal()}
      />
    </div>
  );
};

export default InventoryView;

