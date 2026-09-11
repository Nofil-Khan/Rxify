import { useState, useEffect } from 'react';
import {
  Building2, Clock, CheckCircle2, XCircle, AlertTriangle, Package, RefreshCw, QrCode, Sparkles
} from 'lucide-react';
import {
  fetchMyDispensaryRequests, type PatientDispensaryRequest
} from '../../../lib/patientApi';

function formatTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'READY':
      return <span className="pd-badge pd-badge--emerald">READY FOR PICKUP</span>;
    case 'PROCESSING':
      return <span className="pd-badge pd-badge--sky">BEING PREPARED</span>;
    case 'PENDING':
      return <span className="pd-badge pd-badge--amber">RECEIVED / QUEUED</span>;
    case 'PARTIALLY_AVAILABLE':
      return <span className="pd-badge pd-badge--amber">PARTIAL AVAILABILITY</span>;
    case 'UNAVAILABLE':
      return <span className="pd-badge pd-badge--rose">OUT OF STOCK</span>;
    case 'DISPENSED':
      return <span className="pd-badge pd-badge--slate">DISPENSED</span>;
    case 'CANCELLED':
      return <span className="pd-badge pd-badge--slate">CANCELLED</span>;
    default:
      return <span className="pd-badge">{status}</span>;
  }
}

function RequestCard({ req }: { req: PatientDispensaryRequest }) {
  const [showQR, setShowQR] = useState(false);

  const availableCount = req.items?.filter(i => i.availability_status === 'AVAILABLE' || i.availability_status === 'DISPENSED').length ?? 0;
  const totalCount = req.items?.length ?? 0;

  return (
    <div className="pd-rx-row" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Building2 size={18} style={{ color: '#0ea5e9' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {req.dispensary_name}
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {req.dispensary_location ?? 'Main Dispensary Counter'} · Rx #{req.prescription_id}
          </p>
        </div>
        <div>
          {getStatusBadge(req.status)}
        </div>
      </div>

      {/* ETA Banner */}
      {req.status !== 'DISPENSED' && req.status !== 'CANCELLED' && (
        <div style={{
          marginTop: '1rem',
          padding: '0.85rem 1rem',
          borderRadius: '0.75rem',
          background: req.status === 'READY'
            ? 'rgba(16, 185, 129, 0.1)'
            : 'rgba(14, 165, 233, 0.1)',
          border: req.status === 'READY'
            ? '1px solid rgba(16, 185, 129, 0.25)'
            : '1px solid rgba(14, 165, 233, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Clock size={18} style={{ color: req.status === 'READY' ? '#10b981' : '#0ea5e9' }} />
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: req.status === 'READY' ? '#10b981' : '#0ea5e9' }}>
                {req.status === 'READY'
                  ? 'Ready for Collection Now'
                  : req.estimated_ready_at
                    ? `Estimated Collection Time: ~${formatTime(req.estimated_ready_at)}`
                    : 'Estimated Prep Time: ~15 mins'}
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                {req.dispensary_location ? `Collect from: ${req.dispensary_location}` : 'Show Patient Pickup Code at Counter'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="pd-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-hover)' }}
            onClick={() => setShowQR(!showQR)}
          >
            <QrCode size={14} />
            <span>{showQR ? 'Hide Pickup Code' : 'Pickup Verification ID'}</span>
          </button>
        </div>
      )}

      {/* Verification ID Modal / Card */}
      {showQR && (
        <div style={{
          marginTop: '0.75rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'var(--surface-color)',
          border: '1px dashed var(--border-color)',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verification Code
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.15em', color: '#0ea5e9', margin: '0.4rem 0' }}>
            {req.patient_code ?? `PT-RX-${req.patient_id}`}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Present this Patient Code or your Name to the pharmacist at the counter.
          </p>
        </div>
      )}

      {/* Item Availability Checklist */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Prescribed Medicines Availability ({availableCount}/{totalCount})
          </span>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {req.items?.map((item) => {
            const isAvail = item.availability_status === 'AVAILABLE' || item.availability_status === 'DISPENSED';
            const isPartial = item.availability_status === 'PARTIAL';

            return (
              <div
                key={item.item_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.prescribed_medicine_name}
                  </span>
                  {item.dosage && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      ({item.dosage})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>
                  {isAvail ? (
                    <>
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                      <span style={{ color: '#10b981' }}>
                        {item.availability_status === 'DISPENSED' ? 'DISPENSED' : 'AVAILABLE'}
                      </span>
                    </>
                  ) : isPartial ? (
                    <>
                      <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                      <span style={{ color: '#f59e0b' }}>PARTIALLY AVAILABLE</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} style={{ color: '#ef4444' }} />
                      <span style={{ color: '#ef4444' }}>UNAVAILABLE</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DispensaryTab() {
  const [requests, setRequests] = useState<PatientDispensaryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetchMyDispensaryRequests();
      setRequests(res.requests || []);
      setError('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load dispensary requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => loadData(), 20000); // Auto refresh every 20s
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="pd-tab-page">
      {/* Header */}
      <div className="pd-tab-header">
        <div>
          <h1 className="pd-tab-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Live Dispensary Status</span>
            <Sparkles size={18} style={{ color: '#0ea5e9' }} />
          </h1>
          <p className="pd-tab-sub">
            Real-time medicine availability & collection ETAs from hospital dispensaries
          </p>
        </div>

        <button
          type="button"
          className="pd-btn-sm"
          onClick={() => loadData(true)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={14} className={refreshing ? 'pd-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && (
        <div className="pd-loader-wrap">
          <div className="pd-spinner" />
        </div>
      )}

      {!loading && error && (
        <div className="pd-empty">
          <AlertTriangle size={36} />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="pd-empty" style={{ padding: '3rem 1.5rem' }}>
          <Package size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            No Active Dispensary Orders
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
            When a doctor prescribes medication or you upload a prescription, availability checks and collection ETAs will appear here automatically.
          </p>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <div>
          {requests.map((req) => (
            <RequestCard key={req.request_id} req={req} />
          ))}
        </div>
      )}
    </div>
  );
}
