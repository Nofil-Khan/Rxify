/**
 * ProfileTab.tsx
 *
 * Dispensary profile view with integrated location management.
 * Shows current profile information and provides access to the
 * LocationPickerModal for setting/editing the dispensary's GPS location.
 *
 * Sits alongside the existing Queue, Inventory, and Dashboard tabs.
 */

import { useState } from 'react';
import {
  Building2, Phone, Clock, Timer, MapPin,
  CheckCircle2, Edit3, Loader2,
} from 'lucide-react';
import { type DispensaryProfile, updateDispensaryLocation } from '../../../lib/dispensaryApi';
import LocationPickerModal from './LocationPickerModal';

interface ProfileTabProps {
  profile: DispensaryProfile | null;
  onProfileUpdate: (updated: DispensaryProfile) => void;
  toast: (msg: string, variant?: 'ok' | 'err' | 'info') => void;
}

export default function ProfileTab({ profile, onProfileUpdate, toast }: ProfileTabProps) {
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasLocation = profile?.latitude != null && profile?.longitude != null;

  const handleLocationConfirm = async (lat: number, lng: number, address: string | null) => {
    setSaving(true);
    try {
      const res = await updateDispensaryLocation({ latitude: lat, longitude: lng, address });
      onProfileUpdate(res.dispensary);
      setShowLocationPicker(false);
      toast('Dispensary location saved successfully.', 'ok');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save location.';
      toast(msg, 'err');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="disp-section">
        <div className="lpm-profile-section">
          <div className="disp-skeleton" style={{ height: 160, borderRadius: 10 }} />
        </div>
      </div>
    );
  }

  const mapsLink = hasLocation
    ? `https://www.openstreetmap.org/?mlat=${profile.latitude}&mlon=${profile.longitude}#map=16/${profile.latitude}/${profile.longitude}`
    : null;

  return (
    <div className="disp-section">
      <div className="lpm-profile-section">

        {/* ── Dispensary Info Card ── */}
        <div className="lpm-profile-card">
          <div className="lpm-profile-card-title">Dispensary Information</div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">
              <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />Name
            </span>
            <span className="lpm-profile-value">{profile.name}</span>
          </div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">Email</span>
            <span className="lpm-profile-value">{profile.email}</span>
          </div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">
              <Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Phone
            </span>
            <span className={profile.phone ? 'lpm-profile-value' : 'lpm-profile-value lpm-profile-value--muted'}>
              {profile.phone ?? 'Not set'}
            </span>
          </div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">
              <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Hours
            </span>
            <span className={profile.operating_hours ? 'lpm-profile-value' : 'lpm-profile-value lpm-profile-value--muted'}>
              {profile.operating_hours ?? 'Not set'}
            </span>
          </div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">
              <Timer size={12} style={{ display: 'inline', marginRight: 4 }} />Prep Time
            </span>
            <span className="lpm-profile-value">{profile.avg_prep_minutes} minutes</span>
          </div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">Floor / Wing</span>
            <span className={profile.location ? 'lpm-profile-value' : 'lpm-profile-value lpm-profile-value--muted'}>
              {profile.location ?? 'Not set'}
            </span>
          </div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">Status</span>
            <span className="lpm-profile-value">{profile.status}</span>
          </div>

          <div className="lpm-profile-field">
            <span className="lpm-profile-label">Dispensary ID</span>
            <span className="lpm-profile-value" style={{ fontFamily: 'monospace', fontSize: '0.83rem' }}>
              {profile.dispensary_code ?? `RXF-DISP-${profile.dispensary_id}`}
            </span>
          </div>
        </div>

        {/* ── Location Card ── */}
        <div className="lpm-profile-card">
          <div className="lpm-profile-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={13} /> GPS Location
          </div>

          {hasLocation && (
            <div className="lpm-location-saved">
              <CheckCircle2 size={14} />
              Location set
            </div>
          )}

          {hasLocation && (
            <>
              <div className="lpm-profile-field">
                <span className="lpm-profile-label">Latitude</span>
                <span className="lpm-profile-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {profile.latitude!.toFixed(6)}
                </span>
              </div>

              <div className="lpm-profile-field">
                <span className="lpm-profile-label">Longitude</span>
                <span className="lpm-profile-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {profile.longitude!.toFixed(6)}
                </span>
              </div>

              <div className="lpm-profile-field">
                <span className="lpm-profile-label">Address</span>
                <span className={profile.address ? 'lpm-profile-value' : 'lpm-profile-value lpm-profile-value--muted'}>
                  {profile.address ?? 'No address on file'}
                </span>
              </div>

              {mapsLink && (
                <div className="lpm-profile-field">
                  <span className="lpm-profile-label">View</span>
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lpm-profile-value"
                    style={{ color: 'var(--disp-accent)', textDecoration: 'underline', fontSize: '0.82rem' }}
                  >
                    Open in OpenStreetMap ↗
                  </a>
                </div>
              )}
            </>
          )}

          {!hasLocation && (
            <p style={{ fontSize: '0.83rem', color: 'var(--disp-text-muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
              No location set. Add your dispensary's GPS coordinates so patients can find you.
            </p>
          )}

          <div className="lpm-location-btn">
            <button
              id="btn-set-dispensary-location"
              className="disp-btn disp-btn--primary"
              onClick={() => setShowLocationPicker(true)}
              disabled={saving}
            >
              {saving
                ? <><Loader2 size={14} className="disp-spin" /> Saving…</>
                : hasLocation
                  ? <><Edit3 size={14} /> Edit Location</>
                  : <><MapPin size={14} /> Set Location</>
              }
            </button>
          </div>
        </div>
      </div>

      {showLocationPicker && (
        <LocationPickerModal
          isOpen={showLocationPicker}
          initialLat={profile.latitude}
          initialLng={profile.longitude}
          initialAddress={profile.address}
          onConfirm={handleLocationConfirm}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  );
}
