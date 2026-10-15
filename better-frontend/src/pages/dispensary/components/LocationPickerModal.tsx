/**
 * LocationPickerModal.tsx
 *
 * Interactive Leaflet & OpenStreetMap location picker for dispensary administrators.
 * Replaces Google Maps with 100% open-source Leaflet and OpenStreetMap tiles.
 *
 * Features:
 *   1. Leaflet interactive map with OpenStreetMap tiles (no API keys, no billing).
 *   2. Area & city search (e.g. "Gwalior") with live suggestions via OpenStreetMap Nominatim.
 *   3. Click anywhere on the map to drop a draggable location marker.
 *   4. Marker drag & drop with precise coordinate positioning.
 *   5. Browser Geolocation API ("My GPS") with high accuracy.
 *   6. Explicit confirmation prompt:
 *      "Do you want to select this location as your dispensary location?"
 *   7. Reverse geocoding to resolve street address from clicked coordinates.
 *   8. Upon clicking "Yes", saves coordinates and address to the backend.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Navigation, Search, X, CheckCircle2,
  Loader2, AlertTriangle, Crosshair,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LocationPickerModalProps {
  isOpen: boolean;
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string | null;
  onConfirm: (lat: number, lng: number, address: string | null) => Promise<void> | void;
  onClose: () => void;
}

interface PickedLocation {
  lat: number;
  lng: number;
  address: string | null;
  addressLoading?: boolean;
}

interface SearchSuggestion {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
}

// ─── Custom SVG Marker Icon ───────────────────────────────────────────────────

function createDispensaryMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'rx-leaflet-marker',
    html: `
      <div style="
        position: relative;
        width: 36px;
        height: 42px;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
        cursor: pointer;
        transform: translate(-18px, -42px);
      ">
        <svg width="36" height="42" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.47715 2 2 6.47715 2 12C2 18.5 12 27 12 27C12 27 22 18.5 22 12C22 6.47715 17.5228 2 12 2Z" fill="#10b981" stroke="#065f46" stroke-width="1.5"/>
          <circle cx="12" cy="11" r="5" fill="#ffffff"/>
          <path d="M12 8.5V13.5M9.5 11H14.5" stroke="#059669" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// Default center: Gwalior, Madhya Pradesh (lat: 26.2183, lng: 78.1828)
const DEFAULT_CENTER: [number, number] = [26.2183, 78.1828];
const DEFAULT_ZOOM = 13;
const SELECTED_ZOOM = 16;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LocationPickerModal({
  isOpen,
  initialLat,
  initialLng,
  initialAddress,
  onConfirm,
  onClose,
}: LocationPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Selected point and confirmation dialog
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Reverse Geocoding with Nominatim ───────────────────────────────────────

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'Rxify-Healthcare-Platform/1.0 (dispensary-location-picker)',
          },
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data?.display_name) {
          return data.display_name;
        }
      }
    } catch {
      // network failure or offline
    }
    return null;
  }, []);

  // ─── Place Marker & Show Confirmation ──────────────────────────────────────

  const handleLocationPicked = useCallback(async (lat: number, lng: number, knownAddress?: string | null) => {
    const map = leafletMapRef.current;
    if (!map) return;

    const latLng: L.LatLngExpression = [lat, lng];

    // Place or move marker
    if (!markerRef.current) {
      const marker = L.marker(latLng, {
        draggable: true,
        icon: createDispensaryMarkerIcon(),
      }).addTo(map);

      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await handleLocationPicked(pos.lat, pos.lng);
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(latLng);
    }

    map.panTo(latLng);

    // Initial state with pending address
    setPickedLocation({
      lat,
      lng,
      address: knownAddress ?? null,
      addressLoading: !knownAddress,
    });
    setShowConfirmDialog(true);

    // Resolve human-readable address if not already provided
    if (!knownAddress) {
      const resolvedAddress = await reverseGeocode(lat, lng);
      setPickedLocation((prev) => {
        if (!prev || prev.lat !== lat || prev.lng !== lng) return prev;
        return {
          ...prev,
          address: resolvedAddress,
          addressLoading: false,
        };
      });
    }
  }, [reverseGeocode]);

  // ─── Initialize Leaflet Map ─────────────────────────────────────────────────

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    const hasInitial = initialLat != null && initialLng != null;
    const center: [number, number] = hasInitial
      ? [initialLat, initialLng]
      : DEFAULT_CENTER;
    const zoom = hasInitial ? SELECTED_ZOOM : DEFAULT_ZOOM;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    // Add OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    leafletMapRef.current = map;

    // Place initial marker if coordinates exist
    if (hasInitial) {
      const marker = L.marker(center, {
        draggable: true,
        icon: createDispensaryMarkerIcon(),
      }).addTo(map);

      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await handleLocationPicked(pos.lat, pos.lng);
      });

      markerRef.current = marker;

      setPickedLocation({
        lat: initialLat,
        lng: initialLng,
        address: initialAddress ?? null,
        addressLoading: false,
      });
    }

    // CLICK LISTENER: User clicks anywhere on the map to drop a pin
    map.on('click', async (e: L.LeafletMouseEvent) => {
      setShowSuggestions(false);
      await handleLocationPicked(e.latlng.lat, e.latlng.lng);
    });

    // Invalidate size to ensure Leaflet renders full tiles inside modal
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [initialLat, initialLng, initialAddress, handleLocationPicked]);

  // ─── Live Search Suggestions (Debounced) ───────────────────────────────────

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'Rxify-Healthcare-Platform/1.0 (dispensary-location-picker)',
            },
          }
        );
        if (resp.ok) {
          const data: SearchSuggestion[] = await resp.json();
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      } catch {
        // network issue
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectSuggestion = (item: SearchSuggestion) => {
    setShowSuggestions(false);
    const shortName = item.display_name.split(',')[0] || item.display_name;
    setSearchQuery(shortName);

    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const map = leafletMapRef.current;

    if (map) {
      if (item.boundingbox && item.boundingbox.length === 4) {
        const [south, north, west, east] = item.boundingbox.map(Number);
        map.fitBounds([
          [south, west],
          [north, east],
        ]);
      } else {
        map.setView([lat, lng], 14);
      }
    }

    setSearchNotice(`Viewing "${shortName}". Click on the map to select your exact dispensary location.`);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setShowSuggestions(false);
    setSearching(true);
    setSearchNotice('');

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'Rxify-Healthcare-Platform/1.0 (dispensary-location-picker)',
          },
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          await selectSuggestion(data[0]);
        } else {
          setSearchNotice(`No locations found for "${trimmed}". Please try another name or landmark.`);
        }
      }
    } catch {
      setSearchNotice(`Search service unavailable. Please click directly on the map to set your location.`);
    } finally {
      setSearching(false);
    }
  };

  // ─── High-Accuracy Geolocation ("My GPS") ───────────────────────────────────

  const handleUseMyLocation = useCallback(() => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([lat, lng], SELECTED_ZOOM);
        }
        await handleLocationPicked(lat, lng);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied. Search your area or click directly on the map.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError('GPS position unavailable right now. Search your area or click on the map.');
        } else {
          setGeoError('Could not retrieve GPS coordinates. Search your area or click on the map.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [handleLocationPicked]);

  // ─── Save Confirmation ───────────────────────────────────────────────────────

  const handleConfirmAndSave = async () => {
    if (!pickedLocation) return;
    setIsSaving(true);
    try {
      await onConfirm(pickedLocation.lat, pickedLocation.lng, pickedLocation.address);
      setShowConfirmDialog(false);
    } catch {
      // handled by parent toast
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Mount & Unmount Effects ────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    setShowConfirmDialog(false);
    setSearchNotice('');
    setGeoError('');
    setSuggestions([]);

    const timer = setTimeout(() => {
      initMap();
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, initMap]);

  // Cleanup map instance on close
  useEffect(() => {
    if (isOpen) return;
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }
    markerRef.current = null;
    setPickedLocation(null);
    setShowConfirmDialog(false);
    setSearchQuery('');
    setSuggestions([]);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="lpm-backdrop" onClick={onClose}>
      <div
        className="lpm-modal"
        onClick={(e) => {
          e.stopPropagation();
          setShowSuggestions(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Location Selector"
      >
        {/* Modal Header */}
        <div className="lpm-header">
          <div className="lpm-header-left">
            <MapPin size={20} className="lpm-header-icon" />
            <div>
              <div className="lpm-title">Select Dispensary Location</div>
              <div className="lpm-subtitle">
                Search area, click on the map, or use GPS to set your location (OpenStreetMap)
              </div>
            </div>
          </div>
          <button className="lpm-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Search & Location Bar */}
        <div className="lpm-search-row">
          <form className="lpm-search-form" onSubmit={handleSearchSubmit}>
            <div className="lpm-search-wrap" onClick={(e) => e.stopPropagation()}>
              <Search size={15} className="lpm-search-icon" />
              <input
                ref={searchInputRef}
                id="lpm-address-search"
                type="text"
                className="lpm-search-input"
                placeholder="Search area, city or landmark (e.g. Gwalior)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                autoComplete="off"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="lpm-suggestions-dropdown">
                  {suggestions.map((item) => (
                    <div
                      key={item.place_id}
                      className="lpm-suggestion-item"
                      onClick={() => selectSuggestion(item)}
                    >
                      <MapPin size={13} className="lpm-suggestion-icon" />
                      <span className="lpm-suggestion-text">{item.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="disp-btn disp-btn--primary lpm-search-btn"
              disabled={!searchQuery.trim() || searching}
            >
              {searching ? (
                <Loader2 size={14} className="disp-spin" />
              ) : (
                <Search size={14} />
              )}
              {searching ? 'Finding…' : 'Search'}
            </button>
          </form>

          <button
            type="button"
            className="disp-btn disp-btn--ghost lpm-geo-btn"
            onClick={handleUseMyLocation}
            disabled={geoLoading}
            title="Use high accuracy device GPS location"
          >
            {geoLoading ? (
              <Loader2 size={14} className="disp-spin" />
            ) : (
              <Navigation size={14} />
            )}
            <span className="lpm-geo-label">My GPS</span>
          </button>
        </div>

        {/* Helper Tip Bar */}
        <div className="lpm-tip-bar">
          <span>
            👉 <strong>Tip:</strong> Click anywhere on the map or drag the pin to set your exact dispensary location.
          </span>
          {searchNotice && (
            <span style={{ color: 'var(--disp-accent)', fontWeight: 500 }}>
              {searchNotice}
            </span>
          )}
        </div>

        {/* Geo Errors */}
        {geoError && (
          <div className="lpm-alert lpm-alert--warn">
            <AlertTriangle size={14} />
            {geoError}
          </div>
        )}

        {/* Leaflet Map Container */}
        <div className="lpm-map-wrap">
          <div
            ref={mapContainerRef}
            className="lpm-map"
            style={{ width: '100%', height: '100%', minHeight: 420 }}
          />

          {/* Explicit Confirmation Dialog Overlay When User Clicks on the Map */}
          {showConfirmDialog && pickedLocation && (
            <div className="lpm-confirm-dialog-backdrop">
              <div className="lpm-confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="lpm-confirm-dialog-icon">
                  <MapPin size={26} />
                </div>

                <div className="lpm-confirm-dialog-title">
                  Confirm Dispensary Location
                </div>

                <div className="lpm-confirm-dialog-question">
                  Do you want to select this location as your dispensary location?
                </div>

                <div className="lpm-confirm-dialog-details">
                  <div className="lpm-confirm-dialog-coords">
                    <span><strong>Lat:</strong> {pickedLocation.lat.toFixed(6)}</span>
                    <span><strong>Lng:</strong> {pickedLocation.lng.toFixed(6)}</span>
                  </div>

                  <div className="lpm-confirm-dialog-address">
                    {pickedLocation.addressLoading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Loader2 size={12} className="disp-spin" /> Resolving address…
                      </span>
                    ) : pickedLocation.address ? (
                      <span>📍 {pickedLocation.address}</span>
                    ) : (
                      <span>GPS location selected (Address unavailable)</span>
                    )}
                  </div>
                </div>

                <div className="lpm-confirm-dialog-actions">
                  <button
                    type="button"
                    className="disp-btn disp-btn--ghost"
                    onClick={() => setShowConfirmDialog(false)}
                    disabled={isSaving}
                  >
                    No, Pick Another
                  </button>

                  <button
                    type="button"
                    className="disp-btn disp-btn--primary"
                    onClick={handleConfirmAndSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={15} className="disp-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} /> Yes, Select This Location
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="lpm-footer">
          <button className="disp-btn disp-btn--ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          {pickedLocation && !showConfirmDialog && (
            <button
              className="disp-btn disp-btn--primary"
              onClick={() => setShowConfirmDialog(true)}
              disabled={isSaving}
            >
              <CheckCircle2 size={14} /> Review Selected Location
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
