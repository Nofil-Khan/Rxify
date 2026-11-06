import * as React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { WorkspaceMedicine } from '../types';
import StockGauge from './StockGauge';
import StockLegend from './StockLegend';

interface StockTabsContentProps {
  medicine: WorkspaceMedicine;
}

export const StockTabsContent: React.FC<StockTabsContentProps> = ({ medicine }) => {
  const reorderLevel = medicine.reorderLevel ?? 20;
  const reservedQty = medicine.reservedQuantity ?? 10;

  return (
    <div className="pt-2 flex-1 flex flex-col justify-center">
      {/* Stock Tab */}
      <TabsContent value="stock" className="m-0 focus-visible:outline-none">
        <div className="flex items-center justify-between gap-4 py-1">
          <StockGauge
            inStock={medicine.inStockQuantity}
            reorderLevel={reorderLevel}
          />
          <StockLegend
            available={medicine.inStockQuantity}
            reserved={reservedQty}
            reorderLevel={reorderLevel}
          />
        </div>
      </TabsContent>

      {/* Batch Tab */}
      <TabsContent value="batch" className="m-0 focus-visible:outline-none">
        <div className="flex flex-col gap-2.5 py-1 text-xs font-sans">
          <div className="flex items-center justify-between rounded-xl bg-bg-0/30 p-2.5 border border-mint-400/10">
            <span className="text-emerald-200/60 font-medium">Batch Number</span>
            <span className="font-mono font-bold text-mint-300">
              {medicine.batchNumber ?? 'AMX-2026-B9'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-bg-0/30 p-2.5 border border-mint-400/10">
            <span className="text-emerald-200/60 font-medium">Expiry Date</span>
            <span className="font-bold text-white">
              {medicine.expiryDate ?? '12/2027'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-bg-0/30 p-2.5 border border-mint-400/10">
            <span className="text-emerald-200/60 font-medium">Batch Quantity</span>
            <span className="font-bold text-white">
              {medicine.inStockQuantity} units
            </span>
          </div>
        </div>
      </TabsContent>

      {/* Info Tab */}
      <TabsContent value="info" className="m-0 focus-visible:outline-none">
        <div className="flex flex-col gap-2 py-1 text-xs font-sans">
          <div className="rounded-xl bg-bg-0/30 p-2.5 border border-mint-400/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/50 block">
              Manufacturer / Brand
            </span>
            <p className="font-semibold text-white mt-0.5">
              {medicine.brandName ?? 'Cipla Ltd. / GlaxoSmithKline'}
            </p>
          </div>
          <div className="rounded-xl bg-bg-0/30 p-2.5 border border-mint-400/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/50 block">
              Active Composition
            </span>
            <p className="font-semibold text-mint-300 mt-0.5">
              {medicine.genericName ?? `${medicine.name} IP (${medicine.strength})`}
            </p>
          </div>
          <div className="rounded-xl bg-bg-0/30 p-2.5 border border-mint-400/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/50 block">
              Storage Instructions
            </span>
            <p className="text-emerald-200/70 mt-0.5 leading-relaxed">
              Store below 25°C in a dry place. Protect from moisture & direct sunlight.
            </p>
          </div>
        </div>
      </TabsContent>
    </div>
  );
};

export default StockTabsContent;

