import React from 'react';
import { RefreshCw, Loader2, Building2 } from 'lucide-react';
import type { NearbyDispensary, PatientDispensaryRequest } from '../../../../lib/patientApi';
import type { StockFilter } from './types';
import { DispensaryCardItem } from './DispensaryCardItem';

interface DispensaryResultListProps {
  dispensaries: NearbyDispensary[];
  filteredDispensaries: NearbyDispensary[];
  selectedDispensaryId: number | null;
  expandedBreakdownId: number | null;
  stockFilter: StockFilter;
  loading: boolean;
  radiusKm: number;
  selectedRxId: number | null;
  activeTicket?: PatientDispensaryRequest;
  onRefresh: () => void;
  onChangeStockFilter: (f: StockFilter) => void;
  onSelectDispensary: (d: NearbyDispensary) => void;
  onToggleBreakdown: (id: number) => void;
  onOpenFulfillModal: (d: NearbyDispensary) => void;
  onExpandRadius: (r: number) => void;
}

export const DispensaryResultList: React.FC<DispensaryResultListProps> = ({
  dispensaries,
  filteredDispensaries,
  selectedDispensaryId,
  expandedBreakdownId,
  stockFilter,
  loading,
  radiusKm,
  selectedRxId,
  activeTicket,
  onRefresh,
  onChangeStockFilter,
  onSelectDispensary,
  onToggleBreakdown,
  onOpenFulfillModal,
  onExpandRadius,
}) => {
  return (
    <div className="flex flex-col gap-3.5 max-h-[720px] overflow-y-auto pr-1">
      {/* Header count & Filter pills */}
      <div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-secondary">
            {loading ? 'Searching nearby dispensaries...' : `${filteredDispensaries.length} Dispensaries Found within ${radiusKm}km`}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh dispensaries list"
            className="flex items-center gap-1.5 text-sky-500 hover:text-sky-400 font-semibold text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          <button
            type="button"
            onClick={() => onChangeStockFilter('ALL')}
            className={`text-xs px-2.5 py-1 rounded cursor-pointer font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none ${
              stockFilter === 'ALL'
                ? 'bg-sky-600 text-white border border-sky-600'
                : 'bg-surface text-secondary border border-border-color hover:text-primary'
            }`}
          >
            All ({dispensaries.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeStockFilter('TOP_3')}
            className={`text-xs px-2.5 py-1 rounded cursor-pointer font-bold transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
              stockFilter === 'TOP_3'
                ? 'bg-amber-500 text-amber-950 border border-amber-500'
                : 'bg-surface text-secondary border border-border-color hover:text-primary'
            }`}
          >
            🏆 Top 3 Ranked
          </button>
          <button
            type="button"
            onClick={() => onChangeStockFilter('FULL_STOCK')}
            className={`text-xs px-2.5 py-1 rounded cursor-pointer font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
              stockFilter === 'FULL_STOCK'
                ? 'bg-emerald-600 text-white border border-emerald-600'
                : 'bg-surface text-secondary border border-border-color hover:text-primary'
            }`}
          >
            Full Stock ({dispensaries.filter((d) => d.availability?.overall_status === 'ALL_AVAILABLE').length})
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center text-secondary">
          <Loader2 size={32} className="animate-spin mx-auto mb-4 text-sky-500" />
          <p className="text-sm">Locating pharmacies and inspecting real-time stock...</p>
        </div>
      )}

      {!loading && dispensaries.length === 0 && (
        <div className="pd-rx-row p-10 text-center text-secondary">
          <Building2 size={40} className="mx-auto mb-4 opacity-50" />
          <h4 className="text-base font-semibold text-primary mb-2">No Active Dispensaries Found Nearby</h4>
          <p className="text-xs mb-4">Try expanding your search radius (e.g. 50 km) or searching for a different area.</p>
          <button
            type="button"
            onClick={() => onExpandRadius(50)}
            className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-semibold text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          >
            Expand Radius to 50 km
          </button>
        </div>
      )}

      {!loading &&
        filteredDispensaries.map((d) => (
          <DispensaryCardItem
            key={d.dispensary_id}
            dispensary={d}
            isSelected={d.dispensary_id === selectedDispensaryId}
            isBreakdownOpen={expandedBreakdownId === d.dispensary_id}
            selectedRxId={selectedRxId}
            activeTicket={activeTicket}
            onSelect={() => onSelectDispensary(d)}
            onToggleBreakdown={() => onToggleBreakdown(d.dispensary_id)}
            onOpenFulfillModal={onOpenFulfillModal}
          />
        ))}
    </div>
  );
};

export default DispensaryResultList;

