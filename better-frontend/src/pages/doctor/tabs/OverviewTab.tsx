import { useState, useEffect } from 'react';
import {
  Users, FileText, UserPlus, Calendar, ArrowRight,
  Check, X, Search, Activity, Stethoscope, Clock
} from 'lucide-react';
import {
  getDoctorStats, getPendingRequests, getDoctorPrescriptions,
  respondToRequest, getInitials, DoctorStats, ConnectionRequest, PrescriptionItem
} from '../../../lib/doctorApi';
import PrescriptionDetailModal from '../components/PrescriptionDetailModal';

interface OverviewTabProps {
  onNavigateTab: (tab: 'patients' | 'prescriptions' | 'requests' | 'profile' | 'appointments') => void;
}

export default function OverviewTab({ onNavigateTab }: OverviewTabProps) {
  const [stats, setStats]               = useState<DoctorStats | null>(null);
  const [requests, setRequests]         = useState<ConnectionRequest[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedRx, setSelectedRx]     = useState<PrescriptionItem | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      const [sData, rData, pData] = await Promise.all([
        getDoctorStats(),
        getPendingRequests(),
        getDoctorPrescriptions(),
      ]);
      if (mounted) {
        setStats(sData);
        setRequests(rData ?? []);
        setPrescriptions(pData.prescriptions ?? []);
        setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  /* Optimistic UI response for connection requests */
  const handleRespond = async (requestId: number, accept: boolean, patientName?: string) => {
    const name = patientName || 'Patient';
    // 1. Optimistic local state filter
    setRequests((prev) => (prev ?? []).filter((r) => r.id !== requestId));
    if (stats) {
      setStats({
        ...stats,
        pending_requests: Math.max(0, stats.pending_requests - 1),
        total_patients: accept ? stats.total_patients + 1 : stats.total_patients,
      });
    }

    // 2. Feedback notice
    setActionNotice(accept ? `Accepted connection request from ${name}` : `Declined request from ${name}`);
    setTimeout(() => setActionNotice(null), 3000);

    // 3. Backend trigger
    await respondToRequest(requestId, accept);
  };

  if (loading) {
    return (
      <div className="dd-bento-grid">
        <div className="dd-bento-card dd-span-3 dd-skeleton-card dd-skeleton" />
        <div className="dd-bento-card dd-span-3 dd-skeleton-card dd-skeleton" />
        <div className="dd-bento-card dd-span-3 dd-skeleton-card dd-skeleton" />
        <div className="dd-bento-card dd-span-3 dd-skeleton-card dd-skeleton" />
        <div className="dd-bento-card dd-span-8 dd-skeleton" style={{ height: '300px' }} />
        <div className="dd-bento-card dd-span-4 dd-skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  return (
    <div className="dd-bento-grid">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div
          className="dd-span-12"
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--dd-emerald-bg)',
            border: '1px solid var(--dd-emerald)',
            color: 'var(--dd-emerald)',
            fontSize: '0.88rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={16} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ── 4 STAT BENTO CARDS ─────────────────────────────────────────── */}
      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--teal">
          <Users size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{stats?.total_patients ?? 0}</span>
          <span className="dd-stat-lbl">Assigned Patients</span>
          <span className="dd-stat-sub">+2 this week</span>
        </div>
      </div>

      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--indigo">
          <FileText size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{stats?.total_prescriptions ?? 0}</span>
          <span className="dd-stat-lbl">Digitized Records</span>
          <span className="dd-stat-sub">100% OCR Scanned</span>
        </div>
      </div>

      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--amber">
          <UserPlus size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{requests?.length ?? 0}</span>
          <span className="dd-stat-lbl">Pending Requests</span>
          <span className="dd-stat-sub" style={{ color: 'var(--dd-amber)' }}>Requires Action</span>
        </div>
      </div>

      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--emerald">
          <Calendar size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{stats?.upcoming_followups ?? 0}</span>
          <span className="dd-stat-lbl">Follow-ups Scheduled</span>
          <span className="dd-stat-sub">Next 7 Days</span>
        </div>
      </div>

      {/* ── RECENT PRESCRIPTIONS BENTO CARD (Span 8) ─────────────────────── */}
      <div className="dd-bento-card dd-span-8">
        <div className="dd-card-header">
          <h3 className="dd-card-title">
            <Activity size={18} className="dd-card-title-icon" />
            Recent Patient Prescriptions
          </h3>
          <button className="dd-btn-outline" onClick={() => onNavigateTab('prescriptions')}>
            <span>View All</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="dd-list">
          {(prescriptions ?? []).slice(0, 4).map((rx) => (
            <div key={rx.id} className="dd-list-item">
              <div className="dd-item-left">
                <div className="dd-item-avatar">
                  {getInitials(rx.patient_name)}
                </div>
                <div className="dd-item-meta">
                  <span className="dd-item-title">{rx.patient_name || 'Patient'}</span>
                  <span className="dd-item-sub">
                    <span>{rx.diagnosis || 'Consultation'}</span> &bull; <span className="dd-item-mono">{rx.created_at || ''}</span>
                  </span>
                </div>
              </div>

              <div className="dd-actions-row">
                <button
                  className="dd-btn-outline"
                  onClick={() => setSelectedRx(rx)}
                  aria-label={`Inspect prescription for ${rx.patient_name || 'Patient'}`}
                >
                  <span>Inspect</span>
                  <Search size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PENDING CONNECTION REQUESTS BENTO CARD (Span 4) ──────────────── */}
      <div className="dd-bento-card dd-span-4">
        <div className="dd-card-header">
          <h3 className="dd-card-title">
            <UserPlus size={18} className="dd-card-title-icon" style={{ color: 'var(--dd-amber)' }} />
            Patient Requests
          </h3>
          {(requests?.length ?? 0) > 0 && (
            <span className="dd-badge-count">{requests.length} Pending</span>
          )}
        </div>

        {(requests?.length ?? 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--dd-text-muted)', fontSize: '0.85rem' }}>
            <Check size={28} style={{ margin: '0 auto 8px', color: 'var(--dd-emerald)' }} />
            <p>All connection requests resolved.</p>
          </div>
        ) : (
          <div className="dd-list">
            {requests.map((req) => (
              <div key={req.id} className="dd-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                <div className="dd-item-left">
                  <div className="dd-item-avatar" style={{ background: 'var(--dd-amber-bg)', color: 'var(--dd-amber)' }}>
                    {getInitials(req.patient_name || req.username)}
                  </div>
                  <div className="dd-item-meta">
                    <span className="dd-item-title">{req.patient_name || req.username || 'Patient'}</span>
                    <span className="dd-item-sub dd-item-mono">@{req.username || 'user'}</span>
                  </div>
                </div>

                {req.note && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--dd-text-sub)', fontStyle: 'italic', background: 'var(--dd-bg-card)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
                    "{req.note}"
                  </p>
                )}

                {/* Optimistic Action Row */}
                <div className="dd-actions-row" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    className="dd-btn-reject"
                    onClick={() => handleRespond(req.id, false, req.patient_name || req.username)}
                  >
                    <X size={14} /> Decline
                  </button>
                  <button
                    className="dd-btn-accept"
                    onClick={() => handleRespond(req.id, true, req.patient_name || req.username)}
                  >
                    <Check size={14} /> Accept Patient
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CLINICAL QUICK ACTIONS BENTO CARD (Span 12) ─────────────────── */}
      <div className="dd-bento-card dd-span-12" style={{ background: 'var(--dd-bg-card-sub)' }}>
        <div className="dd-card-header" style={{ marginBottom: '0.5rem', borderBottom: 'none' }}>
          <h3 className="dd-card-title">
            <Stethoscope size={18} className="dd-card-title-icon" />
            Clinical Hub Shortcuts
          </h3>
        </div>

        <div className="dd-bento-grid">
          <div
            className="dd-bento-card dd-span-3"
            style={{ cursor: 'pointer', alignItems: 'center', gap: '8px', padding: '1rem', textAlign: 'center' }}
            onClick={() => onNavigateTab('patients')}
          >
            <div className="dd-stat-icon dd-stat-icon--teal"><Users size={20} /></div>
            <span className="dd-item-title">Patient Directory</span>
            <span className="dd-stat-lbl">Manage assigned care lists</span>
          </div>

          <div
            className="dd-bento-card dd-span-3"
            style={{ cursor: 'pointer', alignItems: 'center', gap: '8px', padding: '1rem', textAlign: 'center' }}
            onClick={() => onNavigateTab('prescriptions')}
          >
            <div className="dd-stat-icon dd-stat-icon--indigo"><FileText size={20} /></div>
            <span className="dd-item-title">Rx Database</span>
            <span className="dd-stat-lbl">Search OCR prescriptions</span>
          </div>

          <div
            className="dd-bento-card dd-span-3"
            style={{ cursor: 'pointer', alignItems: 'center', gap: '8px', padding: '1rem', textAlign: 'center' }}
            onClick={() => onNavigateTab('requests')}
          >
            <div className="dd-stat-icon dd-stat-icon--amber"><UserPlus size={20} /></div>
            <span className="dd-item-title">Connection Center</span>
            <span className="dd-stat-lbl">Process patient invites</span>
          </div>

          <div
            className="dd-bento-card dd-span-3"
            style={{ cursor: 'pointer', alignItems: 'center', gap: '8px', padding: '1rem', textAlign: 'center' }}
            onClick={() => onNavigateTab('profile')}
          >
            <div className="dd-stat-icon dd-stat-icon--emerald"><Clock size={20} /></div>
            <span className="dd-item-title">Doctor Settings</span>
            <span className="dd-stat-lbl">Update practice specialty</span>
          </div>
        </div>
      </div>

      {/* Modal for inspection */}
      {selectedRx && (
        <PrescriptionDetailModal
          prescription={selectedRx}
          onClose={() => setSelectedRx(null)}
        />
      )}
    </div>
  );
}
