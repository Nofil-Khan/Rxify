import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DispensaryProfile, updateDispensaryLocation } from '@/lib/dispensaryApi';
import MapSearchInput from './MapSearchInput';
import InteractiveMap from './InteractiveMap';
import LocationFields from './LocationFields';
import type { SaveState } from './SettingsView';

interface Props {
  profile: DispensaryProfile | null;
}

const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;

/** Complete Leaflet map & GPS location manager for Dispensary settings. */
const LocationSection: React.FC<Props> = ({ profile }) => {
  const queryClient = useQueryClient();
  const [lat, setLat] = React.useState<number>(profile?.latitude ?? DEFAULT_LAT);
  const [lng, setLng] = React.useState<number>(profile?.longitude ?? DEFAULT_LNG);
  const [address, setAddress] = React.useState<string>(profile?.address ?? '');
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [isGpsLoading, setIsGpsLoading] = React.useState(false);
  const [isResolving, setIsResolving] = React.useState(false);

  React.useEffect(() => {
    if (profile?.latitude && profile?.longitude) {
      setLat(profile.latitude);
      setLng(profile.longitude);
      setAddress(profile.address ?? '');
    }
  }, [profile]);

  const reverseGeocode = React.useCallback(async (targetLat: number, targetLng: number) => {
    setIsResolving(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${targetLat}&lon=${targetLng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) setAddress(data.display_name);
      }
    } catch (e) {
      console.warn('[Reverse geocode error]', e);
    } finally {
      setIsResolving(false);
    }
  }, []);

  const handleMapChange = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    reverseGeocode(newLat, newLng);
  };

  const handleSelectSearch = (newLat: number, newLng: number, newAddress: string) => {
    setLat(newLat);
    setLng(newLng);
    setAddress(newAddress);
  };

  const handleGpsLocate = () => {
    if (!navigator.geolocation) return;
    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = parseFloat(pos.coords.latitude.toFixed(6));
        const userLng = parseFloat(pos.coords.longitude.toFixed(6));
        setLat(userLat);
        setLng(userLng);
        reverseGeocode(userLat, userLng);
        setIsGpsLoading(false);
      },
      () => setIsGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await updateDispensaryLocation({
        latitude: lat,
        longitude: lng,
        address: address || null,
      });
      queryClient.invalidateQueries({ queryKey: ['dispensary_profile'] });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (e) {
      console.error('[Save location error]', e);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search & GPS tools */}
      <MapSearchInput
        onSelectLocation={handleSelectSearch}
        onGpsLocate={handleGpsLocate}
        isGpsLoading={isGpsLoading}
      />

      {/* Interactive Leaflet Map with 25km radius circle */}
      <InteractiveMap
        lat={lat}
        lng={lng}
        onChange={handleMapChange}
        dispensaryName={profile?.name}
      />

      {/* Form Fields & Save Trigger */}
      <LocationFields
        lat={String(lat)}
        lng={String(lng)}
        address={address}
        onLatChange={(v) => { const n = parseFloat(v); if (!isNaN(n)) setLat(n); }}
        onLngChange={(v) => { const n = parseFloat(v); if (!isNaN(n)) setLng(n); }}
        onAddressChange={setAddress}
        onRefreshAddress={() => reverseGeocode(lat, lng)}
        onSave={handleSave}
        saveState={saveState}
        isResolvingAddress={isResolving}
      />
    </div>
  );
};

export default LocationSection;
