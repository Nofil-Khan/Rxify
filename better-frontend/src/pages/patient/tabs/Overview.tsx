import { useState, useEffect } from 'react';
import {
  FileText, Stethoscope, Clock, TrendingUp,
  Upload, ChevronRight, AlertCircle, CheckCircle, User
} from 'lucide-react';
import { useAuthStore } from '../../../lib/auth';
import {
  fetchPatientStats, fetchMyPrescriptions, fetchMyDoctor,
  type PatientStats, type Prescription, type DoctorInfo
} from '../../../lib/patientApi';

interface Props {
  onUploadClick: () => void;
  onViewAllClick: () => void;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export default function Overview({ onUploadClick, onViewAllClick }: Props) {
  const { username } = useAuthStore();
  const [stats, setStats]           = useState<PatientStats | null>(null);
  const [recent, setRecent]         = useState<Prescription[]>([]);
  const [doctor, setDoctor]         = useState<DoctorInfo | null | undefined>(undefined);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchPatientStats(),
      fetchMyPrescriptions(),
      fetchMyDoctor(),
    ])
      .then(([s, rx, doc]) => {
        if (!alive) return;
        setStats(s);
        setRecent((rx?.prescriptions ?? []).slice(0, 5));
        setDoctor(doc?.doctor);
      })
      .catch((e) => { if (alive) setError(e?.message ?? 'Failed to load dashboard.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (error) return (
    <div className="pd-empty">
      <AlertCircle size={36} />
      <p>{error}</p>
    </div>
  );

  const STAT_CARDS = [
    {
      id: 'stat-prescriptions',
      icon: <FileText size={22} />,
      label: 'Total Prescriptions',
      value: loading ? '…' : (stats?.rx_count ?? 0),
      accent: 'teal',
      note: 'uploaded records',
    },
    {
      id: 'stat-doctor',
      icon: <Stethoscope size={22} />,
      label: 'My Doctor',
      value: loading ? '…' : (doctor ? (doctor.display_name ?? doctor.username) : 'None assigned'),
      accent: doctor ? 'green' : 'amber',
      note: doctor ? (doctor.specialty ?? 'General') : 'Connect a doctor',
    },
    {
      id: 'stat-pending',
      icon: <Clock size={22} />,
      label: 'Pending Requests',
      value: loading ? '…' : (stats?.pending_requests ?? 0),
      accent: 'amber',
      note: 'awaiting response',
    },
    {
      id: 'stat-trend',
      icon: <TrendingUp size={22} />,
      label: 'Active Shares',
      value: loading ? '…' : (stats?.active_shares ?? 0),
      accent: 'blue',
      note: 'share links live',
    },
  ];

  return (
    <div className="pd-overview">

      {/* ── Greeting ───────────────────────────────────────────────────── */}
      <div className="pd-greeting">
        <h1 className="pd-greeting-title">
          {getGreeting()}, <span className="pd-greeting-name">{username ?? 'there'}</span> 👋
        </h1>
        <p className="pd-greeting-sub">Here's your health overview</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <section className="pd-stats-grid" aria-label="Dashboard statistics">
        {STAT_CARDS.map((c) => (
          <div key={c.id} id={c.id} className={`pd-stat-card pd-stat-card--${c.accent}`}>
            <div className="pd-stat-icon" aria-hidden="true">{c.icon}</div>
            <div className="pd-stat-body">
              <span className="pd-stat-label">{c.label}</span>
              <span className="pd-stat-value">{c.value}</span>
              <span className="pd-stat-note">{c.note}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ── Two-column ─────────────────────────────────────────────────── */}
      <div className="pd-two-col">

        {/* Recent prescriptions */}
        <section className="pd-card" aria-label="Recent prescriptions">
          <div className="pd-card-head">
            <h2 className="pd-card-title">
              <FileText size={17} aria-hidden="true" /> Recent Prescriptions
            </h2>
            <button
              id="view-all-rx"
              className="pd-link-btn"
              onClick={onViewAllClick}
              aria-label="View all prescriptions"
            >
              View all <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          {loading ? (
            <div className="pd-empty-inline">
              <p style={{ color: 'var(--pd-text-muted)' }}>Loading recent records…</p>
            </div>
          ) : recent.length === 0 ? (
            <div className="pd-empty-inline">
              <FileText size={28} aria-hidden="true" />
              <p>No prescriptions yet.</p>
              <button id="upload-first" className="pd-btn-sm" onClick={onUploadClick}>
                Upload your first
              </button>
            </div>
          ) : (
            <ul className="pd-rx-list" role="list">
              {recent.map((rx) => (
                <li key={rx.id} className="pd-rx-item" role="listitem">
                  <div className="pd-rx-icon" aria-hidden="true">
                    <FileText size={15} />
                  </div>
                  <div className="pd-rx-body">
                    <span className="pd-rx-name">
                      {rx.diagnosis ?? rx.doctor_name ?? `Prescription #${rx.id}`}
                    </span>
                    <span className="pd-rx-meta">
                      {rx.clinic_name ? `${rx.clinic_name} · ` : ''}{formatDate(rx.issue_date)}
                    </span>
                  </div>
                  {rx.diagnosis && (
                    <span className="pd-badge pd-badge--teal" aria-label={`Diagnosis: ${rx.diagnosis}`}>
                      {(rx.diagnosis ?? '').length > 18 ? (rx.diagnosis ?? '').slice(0, 18) + '…' : (rx.diagnosis ?? '')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Doctor card */}
        <section className="pd-card" aria-label="My doctor">
          <div className="pd-card-head">
            <h2 className="pd-card-title">
              <Stethoscope size={17} aria-hidden="true" /> My Doctor
            </h2>
          </div>

          {loading ? (
            <div className="pd-empty-inline">
              <p style={{ color: 'var(--pd-text-muted)' }}>Checking doctor status…</p>
            </div>
          ) : doctor ? (
            <div className="pd-doctor-card">
              <div className="pd-doctor-avatar" aria-hidden="true">
                {((doctor.display_name ?? doctor.username ?? 'Dr') || 'Dr').slice(0, 2).toUpperCase()}
              </div>
              <div className="pd-doctor-info">
                <span className="pd-doctor-name">{doctor.display_name ?? doctor.username}</span>
                {doctor.specialty && (
                  <span className="pd-badge pd-badge--blue">{doctor.specialty}</span>
                )}
                <span className="pd-connected">
                  <CheckCircle size={13} aria-hidden="true" /> Connected
                </span>
              </div>
            </div>
          ) : (
            <div className="pd-empty-inline">
              <User size={28} aria-hidden="true" />
              <p>No doctor assigned yet.</p>
              <p className="pd-empty-hint">Find and connect with a doctor to share your records.</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Quick Upload strip ──────────────────────────────────────────── */}
      <button
        id="quick-upload-btn"
        className="pd-upload-strip"
        onClick={onUploadClick}
        aria-label="Quick upload a prescription"
      >
        <div className="pd-upload-strip-icon" aria-hidden="true">
          <Upload size={20} />
        </div>
        <div className="pd-upload-strip-text">
          <span className="pd-upload-strip-title">Upload a Prescription</span>
          <span className="pd-upload-strip-sub">Snap a photo or drop a file — AI will extract the details</span>
        </div>
        <ChevronRight size={20} className="pd-upload-strip-arrow" aria-hidden="true" />
      </button>
    </div>
  );
}
