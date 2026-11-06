import * as React from 'react';
import { Package, AlertCircle, Edit3 } from 'lucide-react';
import { InventoryItem } from '@/lib/dispensaryApi';

interface Props {
  items: InventoryItem[];
  onAdjustStock: (item: InventoryItem) => void;
}

export const InventoryTable: React.FC<Props> = ({ items, onAdjustStock }) => {
  if (items.length === 0) {
    return (
      <div className="glass-panel p-12 text-center flex flex-col items-center justify-center gap-3">
        <Package size={32} className="text-cream-to/40" />
        <p className="text-sm text-cream-to/70 font-medium">No inventory items matched your criteria.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" aria-label="Dispensary Inventory Table">
          <thead>
            <tr className="border-b border-mint-400/15 bg-bg-0/40 text-cream-to/60 uppercase tracking-wider text-[11px]">
              <th scope="col" className="py-3.5 px-4 font-semibold">Medicine</th>
              <th scope="col" className="py-3.5 px-3 font-semibold">Category</th>
              <th scope="col" className="py-3.5 px-3 font-semibold text-right">Available</th>
              <th scope="col" className="py-3.5 px-3 font-semibold text-right">Reserved</th>
              <th scope="col" className="py-3.5 px-3 font-semibold text-right">Reorder Level</th>
              <th scope="col" className="py-3.5 px-3 font-semibold text-center">Status</th>
              <th scope="col" className="py-3.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-400/10">
            {items.map((item) => {
              const freeStock = item.available_quantity - (item.reserved_quantity || 0);
              const isLow = freeStock <= item.reorder_level;
              const isOut = freeStock <= 0;

              return (
                <tr
                  key={item.inventory_id}
                  className="transition-colors hover:bg-mint-400/5 group"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-cream-from">{item.generic_name}</div>
                    {item.brand_name && item.brand_name !== item.generic_name && (
                      <div className="text-[11px] text-cream-to/50">({item.brand_name})</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-cream-to/70">
                    <span className="glass-chip text-[11px] py-0.5 px-2">{item.category || 'General'}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                    <span className={isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-mint-300'}>
                      {item.available_quantity} {item.unit || 'units'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-cream-to/60">
                    {item.reserved_quantity || 0}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-cream-to/50">
                    {item.reorder_level}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                        <AlertCircle size={10} /> Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        <AlertCircle size={10} /> Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint-400/15 border border-mint-400/30 px-2 py-0.5 text-[10px] font-semibold text-mint-300">
                        Healthy
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onAdjustStock(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-mint-400/20 bg-bg-0/40 px-2.5 py-1 text-xs text-cream-from hover:border-mint-400/50 hover:bg-mint-400/15 transition-all"
                      aria-label={`Adjust stock for ${item.generic_name}`}
                    >
                      <Edit3 size={12} className="text-mint-300" />
                      <span>Adjust</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryTable;

