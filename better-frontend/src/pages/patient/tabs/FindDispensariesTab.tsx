import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Navigation, Search, Filter, Building2, Clock, Phone,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle, Package, ArrowRight,
  ChevronDown, ChevronUp, Loader2, Sparkles, RefreshCw, X, ShieldCheck
} from 'lucide-react';
import {
  fetchNearbyDispensaries,
  submitPrescriptionFulfillment,
  fetchMyPrescriptions,
  type NearbyDispensary,
  type Prescription,
  type DispensaryAvailabilityStatus,
  type MedicineStockStatus,
  type PatientDispensaryRequest,
} from '../../../lib/patientApi';

// Default coordinates: Gwalior (center of demo dispensaries)
const DEFAULT_LAT = 26.19737;
const DEFAULT_LNG = 78.16116;

interface FindDispensariesTabProps {
  initialPrescriptionId?: number | null;
  activeRequests?: PatientDispensaryRequest[];
  onOrderSuccess?: () => void;
  onNavigateToDispensaryStatus?: () => void;
}

interface SearchSuggestion {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
}

// ─── Custom Leaflet SVG Markers ──────────────────────────────────────────────

function createDispensaryMarker(status?: DispensaryAvailabilityStatus, isSelected: boolean = false): L.DivIcon {
  let fillColor = '#0284c7'; // default blue
  let strokeColor = '#0369a1';

  if (status === 'ALL_AVAILABLE') {
    fillColor = '#10b981'; // emerald green
    strokeColor = '#047857';
  } else if (status === 'PARTIALLY_AVAILABLE') {
    fillColor = '#f59e0b'; // amber
    strokeColor = '#b45309';
  } else if (status === 'NONE_AVAILABLE') {
    fillColor = '#ef4444'; // rose/red
    strokeColor = '#b91c1c';
  } else if (status === 'AVAILABILITY_UNKNOWN') {
    fillColor = '#8b5cf6'; // purple
    strokeColor = '#6d28d9';
  }

  const scale = isSelected ? 1.25 : 1.0;
  const filter = isSelected
    ? 'drop-shadow(0 0 10px rgba(14, 165, 233, 0.8))'
    : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))';

  return L.divIcon({
    className: 'rx-leaflet-marker',
    iconSize: [36 * scale, 44 * scale],
    iconAnchor: [18 * scale, 44 * scale],
    popupAnchor: [0, -42 * scale],
    html: `
      <div style="
        position: relative;
        width: ${36 * scale}px;
        height: ${44 * scale}px;
        filter: ${filter};
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <svg width="${36 * scale}" height="${44 * scale}" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.47715 2 2 6.47715 2 12C2 18.5 12 27 12 27C12 27 22 18.5 22 12C22 6.47715 17.5228 2 12 2Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
          <circle cx="12" cy="11" r="5" fill="#ffffff"/>
          <path d="M12 8.5V13.5M9.5 11H14.5" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `,
  });
}

function createUserLocationMarker(): L.DivIcon {
  return L.divIcon({
    className: 'rx-user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.35);
          animation: rx-pulse 2s infinite ease-out;
        "></div>
        <div style="
          position: relative;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #0284c7;
          border: 2.5px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FindDispensariesTab({
  initialPrescriptionId,
  activeRequests = [],
  onOrderSuccess,
  onNavigateToDispensaryStatus,
}: FindDispensariesTabProps) {
  // Location state
  const [lat, setLat] = useState<number>(DEFAULT_LAT);
  const [lng, setLng] = useState<number>(DEFAULT_LNG);
  const [locationLabel, setLocationLabel] = useState<string>('Gwalior, Madhya Pradesh');
  const [radiusKm, setRadiusKm] = useState<number>(25);

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prescription selection state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedRxId, setSelectedRxId] = useState<number | null>(initialPrescriptionId || null);

  // Active fulfillment ticket for the selected prescription
  const activeTicket = activeRequests.find(
    (r) => r.prescription_id === selectedRxId && r.status !== 'CANCELLED' && r.status !== 'DISPENSED'
  );

  // Dispensaries result state
  const [dispensaries, setDispensaries] = useState<NearbyDispensary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDispensaryId, setSelectedDispensaryId] = useState<number | null>(null);
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'ALL' | 'TOP_3' | 'FULL_STOCK'>('ALL');

  const filteredDispensaries = dispensaries.filter((d) => {
    if (stockFilter === 'FULL_STOCK') {
      return d.availability?.overall_status === 'ALL_AVAILABLE';
    }
    if (stockFilter === 'TOP_3') {
      return (d.ranking?.rank ?? 999) <= 3;
    }
    return true;
  });

  // Fulfillment confirmation modal state
  const [fulfillModalDisp, setFulfillModalDisp] = useState<NearbyDispensary | null>(null);
  const [fulfillNotes, setFulfillNotes] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderToast, setOrderToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // ─── 1. Load Prescriptions ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    fetchMyPrescriptions()
      .then((res) => {
        if (!mounted) return;
        setPrescriptions(res.prescriptions);
        // If no prescription initially selected, but prescriptions exist, pick the most recent one
        if (selectedRxId === null && res.prescriptions.length > 0) {
          setSelectedRxId(res.prescriptions[0].id);
        }
      })
      .catch((err) => console.error('Failed to load prescriptions:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // ─── 2. Fetch Nearby Dispensaries ───────────────────────────────────────────
  const loadNearbyDispensaries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNearbyDispensaries({
        lat,
        lng,
        radiusKm,
        prescriptionId: selectedRxId,
      });
      setDispensaries(res.dispensaries || []);
      if (res.dispensaries && res.dispensaries.length > 0) {
        // Auto-select first dispensary if none selected or old selection out of view
        setSelectedDispensaryId(res.dispensaries[0].dispensary_id);
      } else {
        setSelectedDispensaryId(null);
      }
    } catch (err) {
      console.error('Failed to fetch nearby dispensaries:', err);
      setDispensaries([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusKm, selectedRxId]);

  useEffect(() => {
    loadNearbyDispensaries();
  }, [loadNearbyDispensaries]);

  // ─── 3. Initialize Leaflet Map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: false,
    });

    // Custom positioned zoom control (bottom right)
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Invalidate size once rendered into layout
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ─── 4. Update Map Markers on Data / Selection Change ────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // User Location Pin
    const userMarker = L.marker([lat, lng], {
      icon: createUserLocationMarker(),
      zIndexOffset: 1000,
    }).addTo(markersGroup);
    userMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 0.85rem; padding: 2px;">
        <strong>Your Search Location</strong><br/>
        <span style="color: #64748b; font-size: 0.78rem;">${locationLabel}</span>
      </div>
    `);
    userMarkerRef.current = userMarker;

    const bounds = L.latLngBounds([L.latLng(lat, lng)]);

    // Dispensary Pins
    dispensaries.forEach((d) => {
      if (d.latitude == null || d.longitude == null) return;

      const isSelected = d.dispensary_id === selectedDispensaryId;
      const marker = L.marker([d.latitude, d.longitude], {
        icon: createDispensaryMarker(d.availability?.overall_status, isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      }).addTo(markersGroup);

      const statusBadgeHtml = d.availability
        ? getAvailabilityBadgeHtml(d.availability.overall_status, d.availability.available_count, d.availability.total_count)
        : '';

      const rankHtml = d.ranking
        ? `<div style="display: inline-block; padding: 2px 7px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; background: ${
            d.ranking.rank === 1 ? '#fef3c7; color: #b45309; border: 1px solid #fcd34d;' : '#f1f5f9; color: #0284c7; border: 1px solid #cbd5e1;'
          } margin-bottom: 6px;">
            ${d.ranking.rank === 1 ? '🏆 #1 Top Pick' : `#${d.ranking.rank} Ranked Match`} • ${d.ranking.rank_score}% Score
          </div>`
        : '';

      const popupHtml = `
        <div style="font-family: inherit; font-size: 0.85rem; min-width: 190px;">
          ${rankHtml}
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${d.name}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">${d.address}</div>
          <div style="display: flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 600; color: #0284c7; margin-bottom: 6px;">
            <span>📍 ${d.distance_km != null ? `${d.distance_km} km away` : 'Nearby'}</span>
          </div>
          ${statusBadgeHtml}
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                flex: 1;
                text-align: center;
                background: #f1f5f9;
                color: #0284c7;
                text-decoration: none;
                padding: 6px 8px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 0.75rem;
                display: inline-block;
              "
            >
              Directions
            </a>
            <button
              id="rx-fulfill-btn-${d.dispensary_id}"
              style="
                flex: 2;
                background: #0284c7;
                color: #ffffff;
                border: none;
                padding: 6px 10px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 0.75rem;
                cursor: pointer;
              "
            >
              Fulfill Here
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      // Handle marker click
      marker.on('click', () => {
        setSelectedDispensaryId(d.dispensary_id);
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`rx-fulfill-btn-${d.dispensary_id}`);
        if (btn) {
          btn.onclick = () => {
            setFulfillModalDisp(d);
          };
        }
      });

      if (isSelected) {
        marker.openPopup();
      }

      bounds.extend([d.latitude, d.longitude]);
    });

    // Auto fit map bounds if multiple points exist
    if (dispensaries.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([lat, lng], 13);
    }
  }, [dispensaries, selectedDispensaryId, lat, lng, locationLabel]);

  // ─── 5. Pan Map when a card is selected in the list ─────────────────────────
  const handleSelectDispensaryCard = (d: NearbyDispensary) => {
    setSelectedDispensaryId(d.dispensary_id);
    if (d.latitude != null && d.longitude != null && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([d.latitude, d.longitude], { animate: true, duration: 0.6 });
    }
  };

  // ─── 6. Use Browser GPS ─────────────────────────────────────────────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setOrderToast({ message: 'Geolocation is not supported by your browser.', type: 'error' });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setLat(userLat);
        setLng(userLng);
        setLocationLabel('My GPS Location');
        setOrderToast({ message: 'Location updated to your GPS coordinates!', type: 'success' });
        // reverse geocode label
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`)
          .then((r) => r.json())
          .then((data) => {
            if (data?.display_name) {
              const parts = data.display_name.split(',');
              setLocationLabel(parts.slice(0, 3).join(','));
            }
          })
          .catch(() => {});
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setOrderToast({
          message: 'Could not access GPS. Please check permissions or enter address manually.',
          type: 'error',
        });
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // ─── 7. Nominatim Area Search ───────────────────────────────────────────────
  const handleSearchQueryChange = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (q.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearchingPlaces(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            q
          )}&addressdetails=1&limit=5`
        );
        const data: SearchSuggestion[] = await res.json();
        setSuggestions(data || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Nominatim search failed:', err);
      } finally {
        setSearchingPlaces(false);
      }
    }, 350);
  };

  const handlePickSuggestion = (s: SearchSuggestion) => {
    const newLat = parseFloat(s.lat);
    const newLng = parseFloat(s.lon);
    setLat(newLat);
    setLng(newLng);
    setLocationLabel(s.display_name.split(',').slice(0, 3).join(','));
    setSearchQuery('');
    setShowSuggestions(false);
  };

  // ─── 8. Fulfillment Submission ──────────────────────────────────────────────
  const handleConfirmFulfillment = async () => {
    if (!fulfillModalDisp || !selectedRxId) return;

    setSubmittingOrder(true);
    try {
      const res = await submitPrescriptionFulfillment({
        prescriptionId: selectedRxId,
        dispensaryId: fulfillModalDisp.dispensary_id,
        notes: fulfillNotes.trim() || undefined,
      });

      const codeMsg = res.pickup_code ? ` (Pickup Code: ${res.pickup_code})` : '';
      setOrderToast({
        message: `Order confirmed at ${res.dispensary_name}!${codeMsg} Estimated ready in ~${res.eta_minutes} mins.`,
        type: 'success',
      });
      setFulfillModalDisp(null);
      setFulfillNotes('');

      // Notify parent to refresh active orders without unmounting the map explorer
      if (onOrderSuccess) {
        onOrderSuccess();
      } else if (onNavigateToDispensaryStatus) {
        setTimeout(() => {
          onNavigateToDispensaryStatus();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Fulfillment order submission error:', err);
      setOrderToast({
        message: err?.message || 'Failed to submit prescription fulfillment. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  // ─── Helper Badge Functions ─────────────────────────────────────────────────
  function getAvailabilityBadge(status?: DispensaryAvailabilityStatus, availableCount: number = 0, totalCount: number = 0) {
    switch (status) {
      case 'ALL_AVAILABLE':
        return (
          <span className="pd-badge pd-badge--emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={13} />
            ALL IN STOCK ({availableCount}/{totalCount})
          </span>
        );
      case 'PARTIALLY_AVAILABLE':
        return (
          <span className="pd-badge pd-badge--amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertTriangle size={13} />
            PARTIAL STOCK ({availableCount}/{totalCount})
          </span>
        );
      case 'NONE_AVAILABLE':
        return (
          <span className="pd-badge pd-badge--rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <XCircle size={13} />
            OUT OF STOCK (0/{totalCount})
          </span>
        );
      case 'AVAILABILITY_UNKNOWN':
        return (
          <span className="pd-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <HelpCircle size={13} />
            CLARIFICATION NEEDED
          </span>
        );
      default:
        return (
          <span className="pd-badge pd-badge--slate">ACTIVE DISPENSARY</span>
        );
    }
  }

  function getItemStockBadge(status: MedicineStockStatus, qty: number, unit?: string | null) {
    if (status === 'AVAILABLE') {
      return (
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <CheckCircle2 size={14} />
          In Stock ({qty} {unit || 'units'})
        </span>
      );
    }
    if (status === 'UNAVAILABLE') {
      return (
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <XCircle size={14} />
          Out of Stock
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <HelpCircle size={14} />
        Unresolved Drug
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Toast Alert ──────────────────────────────────────────────────────── */}
      {orderToast && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: orderToast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${orderToast.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: orderToast.type === 'success' ? '#047857' : '#b91c1c',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {orderToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{orderToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrderToast(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Top Discovery Control Bar ────────────────────────────────────────── */}
      <div
        className="pd-rx-row"
        style={{
          padding: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          alignItems: 'end',
        }}
      >
        {/* Prescription Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Evaluate Stock for Prescription:
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedRxId ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedRxId(val);
              }}
              className="dd-input"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.6rem',
                border: '1px solid var(--border-color)',
                background: 'var(--surface-color)',
                color: 'var(--text-primary)',
                fontWeight: 500,
                fontSize: '0.9rem',
              }}
            >
              <option value="">Browse All Dispensaries (No Prescription)</option>
              {prescriptions.map((rx) => (
                <option key={rx.id} value={rx.id}>
                  Rx #{rx.id} — {rx.diagnosis || 'Prescription'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location Search & GPS */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Search Area or Street:
          </label>
          <div style={{ position: 'relative', display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="e.g. Gwalior, Lashkar, Naya Bazaar..."
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.3rem',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
              {searchingPlaces && (
                <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#0ea5e9' }} />
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.6rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 2000,
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {suggestions.map((s) => (
                    <div
                      key={s.place_id}
                      onClick={() => handlePickSuggestion(s)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <MapPin size={13} style={{ display: 'inline', marginRight: '6px', color: '#0ea5e9' }} />
                      {s.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleUseMyLocation}
              title="Use current GPS location"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1rem',
                borderRadius: '0.6rem',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Navigation size={15} />
              GPS
            </button>
          </div>
        </div>

        {/* Radius Filter */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Distance Radius:
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[5, 10, 25, 50].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusKm(r)}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: '0.5rem',
                  border: radiusKm === r ? '1px solid #0284c7' : '1px solid var(--border-color)',
                  background: radiusKm === r ? 'rgba(2, 132, 199, 0.15)' : 'var(--surface-color)',
                  color: radiusKm === r ? '#0284c7' : 'var(--text-secondary)',
                  fontWeight: radiusKm === r ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Split View (Dispensary Cards & Leaflet Map) ──────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 460px) 1fr',
          gap: '1.25rem',
          alignItems: 'stretch',
          minHeight: '620px',
        }}
      >
        {/* Left Side: Dispensary Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '720px', overflowY: 'auto', paddingRight: '4px' }}>
          {/* Header count & Filter pills */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {loading ? 'Searching nearby dispensaries...' : `${filteredDispensaries.length} Dispensaries Found within ${radiusKm}km`}
              </span>
              <button
                type="button"
                onClick={loadNearbyDispensaries}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Quick Filter Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStockFilter('ALL')}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  border: stockFilter === 'ALL' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                  background: stockFilter === 'ALL' ? '#0284c7' : 'var(--surface-color)',
                  color: stockFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                All ({dispensaries.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('TOP_3')}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  border: stockFilter === 'TOP_3' ? '1px solid #eab308' : '1px solid var(--border-color)',
                  background: stockFilter === 'TOP_3' ? '#eab308' : 'var(--surface-color)',
                  color: stockFilter === 'TOP_3' ? '#78350f' : 'var(--text-secondary)',
                  fontWeight: 700,
                }}
              >
                🏆 Top 3 Ranked
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('FULL_STOCK')}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  border: stockFilter === 'FULL_STOCK' ? '1px solid #10b981' : '1px solid var(--border-color)',
                  background: stockFilter === 'FULL_STOCK' ? '#10b981' : 'var(--surface-color)',
                  color: stockFilter === 'FULL_STOCK' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                Full Stock Only ({dispensaries.filter((d) => d.availability?.overall_status === 'ALL_AVAILABLE').length})
              </button>
            </div>
          </div>

          {loading && (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#0ea5e9' }} />
              <p style={{ fontSize: '0.9rem' }}>Locating pharmacies and inspecting real-time stock...</p>
            </div>
          )}

          {!loading && dispensaries.length === 0 && (
            <div
              className="pd-rx-row"
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <Building2 size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                No Active Dispensaries Found Nearby
              </h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                Try expanding your search radius (e.g. 50 km) or searching for a different area.
              </p>
              <button
                type="button"
                onClick={() => setRadiusKm(50)}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Expand Radius to 50 km
              </button>
            </div>
          )}

          {!loading &&
            filteredDispensaries.map((d) => {
              const isSelected = d.dispensary_id === selectedDispensaryId;
              const isBreakdownOpen = expandedBreakdownId === d.dispensary_id;
              const avail = d.availability;

              return (
                <div
                  key={d.dispensary_id}
                  onClick={() => handleSelectDispensaryCard(d)}
                  className="pd-rx-row"
                  style={{
                    padding: '1.15rem',
                    borderRadius: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected
                      ? '2px solid #0284c7'
                      : '1px solid var(--border-color)',
                    background: isSelected
                      ? 'var(--surface-hover)'
                      : 'var(--surface-color)',
                  }}
                >
                  {/* Ranking Badge if present */}
                  {d.ranking && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.22rem 0.6rem',
                      borderRadius: '1rem',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      background: d.ranking.rank === 1
                        ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.22), rgba(245, 158, 11, 0.28))'
                        : d.ranking.rank === 2
                        ? 'linear-gradient(135deg, rgba(148, 163, 184, 0.22), rgba(203, 213, 225, 0.28))'
                        : d.ranking.rank === 3
                        ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.18), rgba(180, 83, 9, 0.24))'
                        : 'rgba(100, 116, 139, 0.12)',
                      color: d.ranking.rank === 1
                        ? '#b45309'
                        : d.ranking.rank === 2
                        ? '#475569'
                        : d.ranking.rank === 3
                        ? '#9a3412'
                        : 'var(--text-secondary)',
                      border: d.ranking.rank === 1
                        ? '1px solid rgba(234, 179, 8, 0.6)'
                        : '1px solid var(--border-color)',
                      marginBottom: '0.45rem',
                    }}>
                      <span>{d.ranking.rank === 1 ? '🏆' : d.ranking.rank === 2 ? '🥈' : d.ranking.rank === 3 ? '🥉' : `#${d.ranking.rank}`}</span>
                      <span>{d.ranking.rank_badge || `Rank #${d.ranking.rank}`}</span>
                      <span style={{ opacity: 0.6 }}>•</span>
                      <span>{d.ranking.rank_score}% Match Score</span>
                    </div>
                  )}

                  {/* Top line: Name & Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Building2 size={17} style={{ color: '#0284c7', flexShrink: 0 }} />
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {d.name}
                        </h4>
                      </div>
                      {d.hospital_name && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1.45rem' }}>
                          Affiliated with {d.hospital_name}
                        </span>
                      )}
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {avail ? (
                        getAvailabilityBadge(avail.overall_status, avail.available_count, avail.total_count)
                      ) : (
                        <span className="pd-badge pd-badge--slate">ACTIVE</span>
                      )}
                    </div>
                  </div>

                  {/* Multi-criteria Score Bar */}
                  {d.ranking && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.35rem 0.65rem',
                      background: 'rgba(2, 132, 199, 0.05)',
                      borderRadius: '0.45rem',
                      fontSize: '0.73rem',
                      margin: '0.2rem 0 0.5rem',
                      flexWrap: 'wrap',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Stock Availability: </span>
                        <span style={{ color: d.ranking.score_breakdown.availability_score >= 80 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                          {d.ranking.score_breakdown.availability_score}%
                        </span>
                      </div>
                      <span style={{ color: 'var(--border-color)' }}>•</span>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Proximity: </span>
                        <span style={{ color: '#0284c7', fontWeight: 700 }}>
                          {d.ranking.score_breakdown.distance_score}%
                        </span>
                      </div>
                      {d.ranking.score_breakdown.bonus_points > 0 && (
                        <>
                          <span style={{ color: 'var(--border-color)' }}>•</span>
                          <span style={{ color: '#8b5cf6', fontWeight: 600 }}>
                            +{d.ranking.score_breakdown.bonus_points} pts 24/7 Fast
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Distance & Address */}
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.4rem 0 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#0284c7' }}>
                      <Navigation size={13} />
                      <span>{d.distance_km != null ? `${d.distance_km} km away` : 'Distance unknown'}</span>
                      <span style={{ color: 'var(--border-color)' }}>•</span>
                      <Clock size={13} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{d.operating_hours}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.address}
                      </span>
                    </div>

                    {d.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={13} style={{ flexShrink: 0 }} />
                        <span>{d.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Medicine stock preview / toggle */}
                  {avail && (
                    <div
                      style={{
                        marginTop: '0.65rem',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.6rem',
                        background: 'var(--surface-color)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedBreakdownId(isBreakdownOpen ? null : d.dispensary_id);
                        }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span>
                          Medicine Stock ({avail.available_count}/{avail.total_count} in stock)
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#0284c7' }}>
                          <span>{isBreakdownOpen ? 'Hide' : 'Details'}</span>
                          {isBreakdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {/* Expandable itemized stock list */}
                      {isBreakdownOpen && (
                        <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                          {avail.items.map((item) => (
                            <div
                              key={item.prescription_medicine_id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem',
                                padding: '0.35rem 0',
                                borderBottom: '1px dashed var(--border-color)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                <div>
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {item.prescribed_name}
                                  </span>
                                  {item.dosage && (
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.35rem' }}>
                                      ({item.dosage})
                                    </span>
                                  )}
                                </div>
                                <div>{getItemStockBadge(item.status, item.available_quantity, item.unit)}</div>
                              </div>

                              {/* Generic bioequivalent recommendation if available */}
                              {item.substitute && (
                                <div
                                  style={{
                                    fontSize: '0.74rem',
                                    color: '#0369a1',
                                    background: 'rgba(2, 132, 199, 0.08)',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.35rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <Sparkles size={12} style={{ color: '#0284c7', flexShrink: 0 }} />
                                  <span>
                                    Generic bioequivalent in stock:{' '}
                                    <strong>{item.substitute.name}</strong> ({item.substitute.available_quantity}{' '}
                                    {item.substitute.unit || 'units'})
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions: Directions + Fulfill */}
                  <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {d.latitude != null && d.longitude != null ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          color: '#0284c7',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        <Navigation size={13} />
                        <span>Get Directions</span>
                      </a>
                    ) : <div />}

                    {selectedRxId && (
                      activeTicket ? (
                        activeTicket.dispensary_id === d.dispensary_id ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              border: '1px solid #10b981',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '0.55rem',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span>Active Order #{activeTicket.request_id}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(
                                `Active order #${activeTicket.request_id} is already in progress with ${activeTicket.dispensary_name} for Rx #${selectedRxId}.\n\nTo prevent duplicate orders, you cannot raise two tickets simultaneously. Please cancel your existing ticket above if you wish to fulfill from ${d.name}.`
                              );
                            }}
                            title={`Active ticket exists at ${activeTicket.dispensary_name}. Cancel it first to switch.`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              background: 'var(--surface-hover)',
                              color: 'var(--text-secondary)',
                              border: '1px dashed var(--border-color)',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '0.55rem',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                            }}
                          >
                            <span>Ticket Active Elsewise</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFulfillModalDisp(d);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.5rem 0.95rem',
                            borderRadius: '0.55rem',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                          }}
                        >
                          <span>Fulfill & Order Pickup</span>
                          <ArrowRight size={14} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Side: Interactive Leaflet Map */}
        <div
          style={{
            position: 'relative',
            borderRadius: '1rem',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            minHeight: '500px',
          }}
        >
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '580px' }} />

          {/* Map Overlay Badge: Current Center Label */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <MapPin size={13} style={{ color: '#38bdf8' }} />
            <span>Center: {locationLabel}</span>
          </div>

          {/* Map Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(8px)',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.6rem',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '0.72rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              color: '#1e293b',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '2px', color: '#0f172a' }}>Stock Legend:</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
              <span>All Medicines In Stock</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
              <span>Partially In Stock</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
              <span>Out of Stock</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fulfillment Confirmation Modal ────────────────────────────────────── */}
      {fulfillModalDisp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--surface-color)',
              borderRadius: '1rem',
              border: '1px solid var(--border-color)',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} style={{ color: '#0284c7' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Confirm Dispensary Pickup Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFulfillModalDisp(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Your prescription will be routed to this dispensary. The pharmacist will prepare your medications and notify you when ready for counter pickup.
            </p>

            {/* Target Dispensary Card */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                background: 'var(--surface-hover)',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                {fulfillModalDisp.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                {fulfillModalDisp.address}
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#0284c7', fontWeight: 600 }}>
                <span>📍 {fulfillModalDisp.distance_km != null ? `${fulfillModalDisp.distance_km} km away` : 'Nearby'}</span>
                <span>⏱ Prep Time: ~{fulfillModalDisp.avg_prep_minutes} mins</span>
              </div>
            </div>

            {/* Selected Prescription Details */}
            {selectedRxId && (
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Prescription: </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Rx #{selectedRxId} —{' '}
                  {prescriptions.find((r) => r.id === selectedRxId)?.diagnosis || 'Prescription Order'}
                </span>
              </div>
            )}

            {/* Active ticket conflict warning */}
            {activeTicket && activeTicket.dispensary_id !== fulfillModalDisp.dispensary_id && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.6rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  color: '#b91c1c',
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                }}
              >
                <strong>⚠️ Active Ticket In Progress:</strong> You already have ticket <strong>#{activeTicket.request_id}</strong> active with <strong>{activeTicket.dispensary_name}</strong> for Rx #{selectedRxId}. To prevent double-booking, you must cancel that ticket above before routing to this dispensary.
              </div>
            )}

            {/* Notes to Pharmacist */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Optional Instructions for Pharmacist:
              </label>
              <textarea
                rows={2}
                placeholder="e.g. I will pick up around 5:30 PM, please keep generic equivalent if preferred..."
                value={fulfillNotes}
                onChange={(e) => setFulfillNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setFulfillModalDisp(null)}
                disabled={submittingOrder}
                className="pd-btn-sm"
                style={{ background: 'var(--surface-hover)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFulfillment}
                disabled={submittingOrder || Boolean(activeTicket && activeTicket.dispensary_id !== fulfillModalDisp.dispensary_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: (activeTicket && activeTicket.dispensary_id !== fulfillModalDisp.dispensary_id) ? '#94a3b8' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '0.6rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: (submittingOrder || (activeTicket && activeTicket.dispensary_id !== fulfillModalDisp.dispensary_id)) ? 'not-allowed' : 'pointer',
                }}
              >
                {submittingOrder ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <span>Confirm Order & Route</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper for Leaflet popup HTML ───────────────────────────────────────────
function getAvailabilityBadgeHtml(status?: DispensaryAvailabilityStatus, availCount: number = 0, totalCount: number = 0): string {
  if (status === 'ALL_AVAILABLE') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #047857;">ALL IN STOCK (${availCount}/${totalCount})</div>`;
  }
  if (status === 'PARTIALLY_AVAILABLE') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #b45309;">PARTIAL STOCK (${availCount}/${totalCount})</div>`;
  }
  if (status === 'NONE_AVAILABLE') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(239, 68, 68, 0.15); color: #b91c1c;">OUT OF STOCK (0/${totalCount})</div>`;
  }
  if (status === 'AVAILABILITY_UNKNOWN') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(139, 92, 246, 0.15); color: #6d28d9;">CLARIFICATION NEEDED</div>`;
  }
  return '';
}
