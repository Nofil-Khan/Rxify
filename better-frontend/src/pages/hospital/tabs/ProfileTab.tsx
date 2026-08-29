import { useState, useEffect } from 'react';
import { getHospitalMe } from '../../../lib/hospitalApi';
import type { HospitalProfile } from '../../../lib/hospitalApi';
import { Building2, Mail, Phone, MapPin, Shield, Hash } from 'lucide-react';

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="hosp-profile-row">
      <span className="hosp-profile-row-icon" aria-hidden="true">{icon}</span>
      <div className="hosp-profile-row-body">
        <dt className="hosp-profile-dt">{label}</dt>
        <dd className="hosp-profile-dd">{value || <em className="hosp-not-set">Not set</em>}</dd>
      </div>
    </div>
  );
}

export default function HospProfileTab() {
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getHospitalMe()
      .then(setProfile)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="hosp-loading"><span className="hosp-spinner hosp-spinner--lg" />Loading profile…</div>;
  if (error) return <div className="hosp-alert hosp-alert--error" role="alert">{error}</div>;

  const p = profile!;
  const statusActive = p.status === 'ACTIVE';

  return (
    <section className="hosp-tab-section">
      <header className="hosp-tab-header">
        <Building2 size={16} aria-hidden="true" />
        <h2 className="hosp-tab-title">Institution Profile</h2>
        <span className={`hosp-status-badge ${statusActive ? 'hosp-status--active' : 'hosp-status--inactive'}`}>
          {statusActive ? 'Active' : p.status}
        </span>
      </header>

      <div className="hosp-profile-card">
        {/* Identity plate */}
        <div className="hosp-profile-plate">
          <div className="hosp-profile-emblem" aria-hidden="true">
            <Building2 size={32} />
          </div>
          <div>
            <h3 className="hosp-profile-name">{p.name}</h3>
            <p className="hosp-profile-id">Hospital ID #{p.hospital_id}</p>
          </div>
        </div>

        <hr className="hosp-divider" />

        <dl className="hosp-profile-fields">
          <InfoRow icon={<Mail size={14} />} label="Email Address" value={p.email} />
          <InfoRow icon={<Phone size={14} />} label="Phone Number" value={p.phone} />
          <InfoRow icon={<MapPin size={14} />} label="Address" value={[p.address, p.city, p.state].filter(Boolean).join(', ') || null} />
          <InfoRow icon={<Hash size={14} />} label="Registration Number" value={p.registration_number} />
          <InfoRow icon={<Shield size={14} />} label="Account Status" value={p.status} />
        </dl>
      </div>
    </section>
  );
}
