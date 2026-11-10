import * as React from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import SettingsField from './SettingsField';
import SaveButton from './SaveButton';
import type { SaveState } from './SettingsView';

interface Props {
  lat: string;
  lng: string;
  address: string;
  onLatChange: (v: string) => void;
  onLngChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onRefreshAddress: () => void;
  onSave: () => void;
  saveState: SaveState;
  isResolvingAddress: boolean;
}

/** Form inputs for fine-tuning coordinates, address, and triggering backend save. */
const LocationFields: React.FC<Props> = ({
  lat,
  lng,
  address,
  onLatChange,
  onLngChange,
  onAddressChange,
  onRefreshAddress,
  onSave,
  saveState,
  isResolvingAddress,
}) => (
  <div className="flex flex-col gap-4">
    {/* Coverage indicator pill */}
    <div
      className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs"
      style={{ background: 'rgba(74,124,111,0.08)', border: '1px solid rgba(74,124,111,0.15)' }}
    >
      <div className="flex items-center gap-2">
        <Radio size={14} className="animate-pulse" style={{ color: 'var(--ti-sage)' }} />
        <span className="font-medium" style={{ color: 'var(--ti-sage)' }}>
          25 km Patient Radar Active
        </span>
      </div>
      <span className="font-mono text-[11px]" style={{ color: 'var(--ti-ink-muted)' }}>
        Haversine Discovery API
      </span>
    </div>

    {/* Lat / Lng inputs */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <SettingsField
        label="Latitude"
        value={lat}
        onChange={onLatChange}
        placeholder="e.g. 28.613939"
        type="number"
      />
      <SettingsField
        label="Longitude"
        value={lng}
        onChange={onLngChange}
        placeholder="e.g. 77.209023"
        type="number"
      />
    </div>

    {/* Address input with refresh button */}
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="ti-spec-label text-[11px]" style={{ color: 'var(--ti-ink-muted)' }}>
          Resolved Street Address
        </label>
        <button
          type="button"
          onClick={onRefreshAddress}
          disabled={isResolvingAddress}
          aria-label="Refresh reverse geocoded address"
          className="flex items-center gap-1 text-[11px] hover:underline focus-visible:outline-none"
          style={{ color: 'var(--ti-sage)' }}
        >
          <RefreshCw size={11} className={isResolvingAddress ? 'animate-spin' : ''} />
          {isResolvingAddress ? 'Resolving…' : 'Re-resolve from Pin'}
        </button>
      </div>
      <input
        type="text"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Address resolved from map pin or enter manually…"
        aria-label="Dispensary street address"
        className="h-10 w-full rounded-xl px-3.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
        style={{
          background: 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(24,24,22,0.09)',
          color: 'var(--ti-ink)',
        }}
      />
    </div>

    <SaveButton state={saveState} onClick={onSave} label="Save Location & Coverage" />
  </div>
);

export default LocationFields;

