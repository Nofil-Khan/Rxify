import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import {
  fetchNearbyDispensaries,
  submitPrescriptionFulfillment,
  fetchMyPrescriptions,
  type NearbyDispensary,
  type Prescription,
} from '../../../lib/patientApi';
import type {
  FindDispensariesTabProps,
  SearchSuggestion,
  StockFilter,
  ToastAlert,
} from './FindDispensaries/types';
import { DispensarySearchBar } from './FindDispensaries/DispensarySearchBar';
import { DispensaryResultList } from './FindDispensaries/DispensaryResultList';
import { DispensaryMapView } from './FindDispensaries/DispensaryMapView';
import { DispensaryFulfillModal } from './FindDispensaries/DispensaryFulfillModal';

const DEFAULT_LAT = 26.19737;
const DEFAULT_LNG = 78.16116;

export default function FindDispensariesTab({
  initialPrescriptionId,
  activeRequests = [],
  onOrderSuccess,
  onNavigateToDispensaryStatus,
}: FindDispensariesTabProps) {
  const [lat, setLat] = useState<number>(DEFAULT_LAT);
  const [lng, setLng] = useState<number>(DEFAULT_LNG);
  const [locationLabel, setLocationLabel] = useState<string>('Gwalior, Madhya Pradesh');
  const [radiusKm, setRadiusKm] = useState<number>(25);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedRxId, setSelectedRxId] = useState<number | null>(initialPrescriptionId || null);

  const activeTicket = activeRequests.find(
    (r) => r.prescription_id === selectedRxId && r.status !== 'CANCELLED' && r.status !== 'DISPENSED'
  );

  const [dispensaries, setDispensaries] = useState<NearbyDispensary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDispensaryId, setSelectedDispensaryId] = useState<number | null>(null);
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');

  const [fulfillModalDisp, setFulfillModalDisp] = useState<NearbyDispensary | null>(null);
  const [fulfillNotes, setFulfillNotes] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderToast, setOrderToast] = useState<ToastAlert | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchMyPrescriptions().then((res) => {
      if (!mounted) return;
      setPrescriptions(res.prescriptions);
      if (selectedRxId === null && res.prescriptions.length > 0) {
        setSelectedRxId(res.prescriptions[0].id);
      }
    }).catch(console.error);
    return () => { mounted = false; };
  }, [selectedRxId]);

  const loadNearbyDispensaries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNearbyDispensaries({ lat, lng, radiusKm, prescriptionId: selectedRxId });
      setDispensaries(res.dispensaries || []);
      setSelectedDispensaryId(res.dispensaries?.[0]?.dispensary_id ?? null);
    } catch {
      setDispensaries([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusKm, selectedRxId]);

  useEffect(() => { loadNearbyDispensaries(); }, [loadNearbyDispensaries]);

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
      },
      () => {
        setOrderToast({ message: 'Could not access GPS. Please check permissions.', type: 'error' });
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearchQueryChange = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchingPlaces(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`);
        const data = await res.json();
        setSuggestions(data || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingPlaces(false);
      }
    }, 350);
  };

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
        message: `Order confirmed at ${res.dispensary_name}!${codeMsg} Ready in ~${res.eta_minutes} mins.`,
        type: 'success',
      });
      setFulfillModalDisp(null);
      setFulfillNotes('');
      if (onOrderSuccess) onOrderSuccess();
      else if (onNavigateToDispensaryStatus) setTimeout(onNavigateToDispensaryStatus, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit order. Please try again.';
      setOrderToast({ message: msg, type: 'error' });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const filteredDispensaries = dispensaries.filter((d) => {
    if (stockFilter === 'FULL_STOCK') return d.availability?.overall_status === 'ALL_AVAILABLE';
    if (stockFilter === 'TOP_3') return (d.ranking?.rank ?? 999) <= 3;
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      {orderToast && (
        <div className={`p-4 rounded-xl flex justify-between items-center ${
          orderToast.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/15 border border-red-500 text-red-700 dark:text-red-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {orderToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span className="text-sm font-medium">{orderToast.message}</span>
          </div>
          <button type="button" onClick={() => setOrderToast(null)} className="cursor-pointer p-1">
            <X size={16} />
          </button>
        </div>
      )}

      <DispensarySearchBar
        prescriptions={prescriptions}
        selectedRxId={selectedRxId}
        onSelectRxId={setSelectedRxId}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        searchingPlaces={searchingPlaces}
        onPickSuggestion={(s) => {
          setLat(parseFloat(s.lat));
          setLng(parseFloat(s.lon));
          setLocationLabel(s.display_name.split(',').slice(0, 3).join(','));
          setSearchQuery('');
          setShowSuggestions(false);
        }}
        onUseMyLocation={handleUseMyLocation}
        radiusKm={radiusKm}
        onChangeRadius={setRadiusKm}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,460px)_1fr] gap-5 items-stretch min-h-[620px]">
        <DispensaryResultList
          dispensaries={dispensaries}
          filteredDispensaries={filteredDispensaries}
          selectedDispensaryId={selectedDispensaryId}
          expandedBreakdownId={expandedBreakdownId}
          stockFilter={stockFilter}
          loading={loading}
          radiusKm={radiusKm}
          selectedRxId={selectedRxId}
          activeTicket={activeTicket}
          onRefresh={loadNearbyDispensaries}
          onChangeStockFilter={setStockFilter}
          onSelectDispensary={(d) => {
            setSelectedDispensaryId(d.dispensary_id);
          }}
          onToggleBreakdown={(id) => setExpandedBreakdownId((prev) => (prev === id ? null : id))}
          onOpenFulfillModal={setFulfillModalDisp}
          onExpandRadius={setRadiusKm}
        />

        <DispensaryMapView
          lat={lat}
          lng={lng}
          locationLabel={locationLabel}
          dispensaries={dispensaries}
          selectedDispensaryId={selectedDispensaryId}
          onSelectDispensaryId={setSelectedDispensaryId}
          onFulfillFromMap={setFulfillModalDisp}
        />
      </div>

      <DispensaryFulfillModal
        dispensary={fulfillModalDisp}
        selectedRxId={selectedRxId}
        prescriptionDiagnosis={prescriptions.find((r) => r.id === selectedRxId)?.diagnosis}
        activeTicket={activeTicket}
        notes={fulfillNotes}
        onNotesChange={setFulfillNotes}
        isSubmitting={submittingOrder}
        onClose={() => setFulfillModalDisp(null)}
        onConfirm={handleConfirmFulfillment}
      />
    </div>
  );
}
