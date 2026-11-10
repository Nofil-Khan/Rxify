import * as React from 'react';
import { Search, Navigation, Loader2, MapPin, X } from 'lucide-react';

export interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  onSelectLocation: (lat: number, lng: number, address: string) => void;
  onGpsLocate: () => void;
  isGpsLoading: boolean;
}

/** Search bar for cities/addresses via OpenStreetMap Nominatim + My GPS button. */
const MapSearchInput: React.FC<Props> = ({ onSelectLocation, onGpsLocate, isGpsLoading }) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<NominatimPlace[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPlaces = React.useCallback(async (text: string) => {
    if (!text.trim() || text.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (res.ok) {
        const data: NominatimPlace[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      }
    } catch (e) {
      console.warn('[Nominatim search]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchPlaces(val), 350);
  };

  const handleSelect = (place: NominatimPlace) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    onSelectLocation(lat, lng, place.display_name);
    setQuery(place.display_name.split(',')[0] || place.display_name);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-2 w-full">
      <div className="relative flex-1">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--ti-ink-muted)' }}
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search city, area, or landmark (e.g. AIIMS Delhi, Gwalior)…"
          aria-label="Search map location"
          className="w-full h-10 rounded-xl pl-9 pr-8 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
          style={{
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(24,24,22,0.12)',
            color: 'var(--ti-ink)',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ti-ink-muted hover:text-ti-ink"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onGpsLocate}
        disabled={isGpsLoading}
        aria-label="Detect GPS coordinates"
        className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-medium shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
        style={{
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(24,24,22,0.12)',
          color: 'var(--ti-ink)',
        }}
      >
        {isGpsLoading ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
        <span>My GPS</span>
      </button>

      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-16 mt-1.5 rounded-xl overflow-hidden shadow-lg z-50 py-1"
          style={{ background: 'white', border: '1px solid rgba(24,24,22,0.1)' }}
        >
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => handleSelect(r)}
              className="flex items-start gap-2.5 w-full text-left px-3 py-2 text-xs hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:bg-black/5"
            >
              <MapPin size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--ti-sage)' }} />
              <span className="truncate" style={{ color: 'var(--ti-ink)' }}>{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapSearchInput;

