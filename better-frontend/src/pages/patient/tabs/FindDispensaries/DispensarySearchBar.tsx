import React from 'react';
import { Search, Navigation, MapPin, Loader2 } from 'lucide-react';
import type { Prescription } from '../../../../lib/patientApi';
import type { SearchSuggestion } from './types';

interface DispensarySearchBarProps {
  prescriptions: Prescription[];
  selectedRxId: number | null;
  onSelectRxId: (id: number | null) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  suggestions: SearchSuggestion[];
  showSuggestions: boolean;
  searchingPlaces: boolean;
  onPickSuggestion: (s: SearchSuggestion) => void;
  onUseMyLocation: () => void;
  radiusKm: number;
  onChangeRadius: (r: number) => void;
}

export const DispensarySearchBar: React.FC<DispensarySearchBarProps> = ({
  prescriptions,
  selectedRxId,
  onSelectRxId,
  searchQuery,
  onSearchQueryChange,
  suggestions,
  showSuggestions,
  searchingPlaces,
  onPickSuggestion,
  onUseMyLocation,
  radiusKm,
  onChangeRadius,
}) => {
  return (
    <div className="pd-rx-row p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      {/* Prescription Selector */}
      <div>
        <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
          Evaluate Stock for Prescription:
        </label>
        <select
          value={selectedRxId ?? ''}
          onChange={(e) => onSelectRxId(e.target.value ? Number(e.target.value) : null)}
          className="w-full py-2.5 px-3 rounded-lg border border-border-color bg-surface text-primary font-medium text-sm focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
          aria-label="Select prescription to evaluate dispensary stock"
        >
          <option value="">Browse All Dispensaries (No Prescription)</option>
          {prescriptions.map((rx) => (
            <option key={rx.id} value={rx.id}>
              Rx #{rx.id} — {rx.diagnosis || 'Prescription'}
            </option>
          ))}
        </select>
      </div>

      {/* Location Search & GPS */}
      <div>
        <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
          Search Area or Street:
        </label>
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
            <input
              type="text"
              placeholder="e.g. Gwalior, Lashkar, Naya Bazaar..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full py-2.5 pl-9 pr-8 rounded-lg border border-border-color bg-surface text-primary text-sm focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
              aria-label="Search area or address"
            />
            {searchingPlaces && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-500 animate-spin" />
            )}

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface border border-border-color rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto">
                {suggestions.map((s) => (
                  <div
                    key={s.place_id}
                    onClick={() => onPickSuggestion(s)}
                    className="p-2.5 text-xs text-primary cursor-pointer border-b border-border-color hover:bg-surface-hover flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                    <span className="truncate">{s.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onUseMyLocation}
            title="Use current GPS location"
            aria-label="Use current GPS location"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>GPS</span>
          </button>
        </div>
      </div>

      {/* Radius Filter */}
      <div>
        <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
          Distance Radius:
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {[5, 10, 25, 50].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChangeRadius(r)}
              aria-label={`Filter within ${r} kilometers`}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none ${
                radiusKm === r
                  ? 'border border-sky-600 bg-sky-500/15 text-sky-600 dark:text-sky-400'
                  : 'border border-border-color bg-surface text-secondary hover:text-primary'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DispensarySearchBar;

