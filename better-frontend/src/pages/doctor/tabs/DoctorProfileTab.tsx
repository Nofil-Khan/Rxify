import { useState, useEffect } from 'react';
import { User, Stethoscope, Shield, Check, Save, AlertCircle, Building2 } from 'lucide-react';
import { getDoctorProfile, updateDoctorProfile, DoctorProfile } from '../../../lib/doctorApi';

export default function DoctorProfileTab() {
  const [profile, setProfile]         = useState<DoctorProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [specialty, setSpecialty]     = useState('');
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadProf() {
      setLoading(true);
      const data = await getDoctorProfile();
      if (mounted) {
        setProfile(data);
        setDisplayName(data.display_name ?? '');
        setSpecialty(data.specialty ?? '');
        setLoading(false);
      }
    }
    loadProf();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Display Name cannot be empty.' });
      return;
    }
    setSaving(true);
    setMessage(null);

    const success = await updateDoctorProfile(displayName, specialty);
    setSaving(false);

    if (success) {
      setMessage({ type: 'success', text: 'Doctor Profile updated successfully!' });
      if (profile) {
        setProfile({ ...profile, display_name: displayName, specialty });
      }
    } else {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    }
  };

  if (loading) {
    return (
      <div className="dd-bento-grid">
        <div className="dd-bento-card dd-span-8 dd-skeleton" style={{ height: '300px' }} />
        <div className="dd-bento-card dd-span-4 dd-skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  return (
    <div className="dd-bento-grid">
      {/* Profile Form (Span 8) */}
      <div className="dd-bento-card dd-span-8">
        <div className="dd-card-header">
          <h3 className="dd-card-title">
            <Stethoscope size={20} className="dd-card-title-icon" />
            Doctor Profile & Medical Practice Settings
          </h3>
        </div>

        {message && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: message.type === 'success' ? 'var(--dd-emerald-bg)' : 'var(--dd-rose-bg)',
              border: `1px solid ${message.type === 'success' ? 'var(--dd-emerald)' : 'var(--dd-rose)'}`,
              color: message.type === 'success' ? 'var(--dd-emerald)' : 'var(--dd-rose)',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1rem',
            }}
          >
            {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="dd-stat-lbl" htmlFor="doctor-username" style={{ display: 'block', marginBottom: '6px' }}>
              Username (Immutable Account Identifier)
            </label>
            <input
              id="doctor-username"
              type="text"
              className="dd-input dd-item-mono"
              value={profile?.username ?? ''}
              disabled
              style={{ opacity: 0.75, cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label className="dd-stat-lbl" htmlFor="doctor-display-name" style={{ display: 'block', marginBottom: '6px' }}>
              Display Name (e.g. Dr. Sarah Jenkins, MD)
            </label>
            <input
              id="doctor-display-name"
              type="text"
              className="dd-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Dr. Full Name, Title"
              required
            />
          </div>

          <div>
            <label className="dd-stat-lbl" htmlFor="doctor-specialty" style={{ display: 'block', marginBottom: '6px' }}>
              Clinical Specialty & Sub-specialty
            </label>
            <input
              id="doctor-specialty"
              type="text"
              className="dd-input"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Cardiology, Internal Medicine, General Practice..."
            />
          </div>

          <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--dd-border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="dd-btn-primary" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Account Info Side Bento (Span 4) */}
      <div className="dd-bento-card dd-span-4" style={{ background: 'var(--dd-bg-card-sub)' }}>
        <div className="dd-card-header">
          <h3 className="dd-card-title">
            <Shield size={18} className="dd-card-title-icon" style={{ color: 'var(--dd-indigo)' }} />
            Medical Account Info
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="dd-avatar" style={{ width: '48px', height: '48px', fontSize: '1.1rem' }}>
              {(displayName || profile?.username || 'D').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="dd-item-title" style={{ fontSize: '1rem' }}>{displayName || 'Doctor'}</h4>
              <span className="dd-doctor-badge" style={{ marginTop: '4px', display: 'inline-block' }}>
                Licensed Doctor
              </span>
            </div>
          </div>

          <div className="dd-mono-box" style={{ fontSize: '0.75rem' }}>
            <strong>Account Role:</strong> Doctor<br />
            <strong>Specialty:</strong> {specialty || 'General Care'}<br />
            <strong>Access Level:</strong> Scoped Patient Record Privacy<br />
            <strong>Rxify Engine:</strong> OCR Vision Enabled
          </div>
        </div>
      </div>
    </div>
  );
}
