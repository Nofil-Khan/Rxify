import { useState, useEffect } from 'react';
import {
  Building2, Clock, CheckCircle2, XCircle, AlertTriangle, Package, RefreshCw, QrCode, Sparkles, ShieldCheck, MapPin
} from 'lucide-react';
import {
  fetchMyDispensaryRequests, cancelDispensaryRequest, type PatientDispensaryRequest
} from '../../../lib/patientApi';
import FindDispensariesTab from './FindDispensariesTab';

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

interface RequestCardProps {
  req: PatientDispensaryRequest;
  onCancel?: (id: number) => void;
  cancellingId?: number | null;
}

function RequestCard({ req, onCancel, cancellingId }: RequestCardProps) {
  const [showQR, setShowQR] = useState(false);

  const availableCount = req.items?.filter(i => i.availability_status === 'AVAILABLE' || i.availability_status === 'DISPENSED').length ?? 0;
  const totalCount = req.items?.length ?? 0;
  const isCancellable = req.status !== 'DISPENSED' && req.status !== 'CANCELLED';

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
            {req.dispensary_location ?? 'Main Dispensary Counter'} · Rx #{req.prescription_id} · Ticket #{req.request_id}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {getStatusBadge(req.status)}
          {isCancellable && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(req.request_id)}
              disabled={cancellingId === req.request_id}
              title="Cancel this pickup ticket"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #ef4444',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: cancellingId === req.request_id ? 'not-allowed' : 'pointer',
              }}
            >
              <XCircle size={14} />
              <span>{cancellingId === req.request_id ? 'Cancelling...' : 'Cancel Ticket'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ETA Banner */}
      {isCancellable && (
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

      {/* 6-Digit Counter Pickup Code Box */}
      {isCancellable && req.pickup_code && (
        <div style={{
          marginTop: '0.85rem',
          padding: '0.85rem 1.15rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(99, 102, 241, 0.08))',
          border: '1.5px dashed rgba(14, 165, 233, 0.45)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <ShieldCheck size={16} style={{ color: '#0284c7' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Counter Pickup Verification Code
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Provide this 6-digit verification code to the pharmacist at the dispensary counter to collect your medicines.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              letterSpacing: '0.2em',
              fontFamily: 'monospace',
              color: '#0284c7',
              background: 'var(--surface-color)',
              padding: '0.3rem 0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              {req.pickup_code.slice(0, 3)} {req.pickup_code.slice(3)}
            </div>
          </div>
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
            {req.pickup_code ? `${req.pickup_code.slice(0, 3)} ${req.pickup_code.slice(3)}` : (req.patient_code ?? `PT-RX-${req.patient_id}`)}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Present this 6-Digit Pickup Code (or Patient ID: {req.patient_code ?? `PT-RX-${req.patient_id}`}) to the pharmacist at the counter.
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
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

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
    const timer = setInterval(() => loadData(), 15000); // Auto refresh every 15s
    return () => clearInterval(timer);
  }, []);

  const handleCancelRequest = async (requestId: number) => {
    if (!window.confirm('Are you sure you want to cancel this prescription fulfillment ticket?')) {
      return;
    }
    setCancellingId(requestId);
    try {
      await cancelDispensaryRequest(requestId, 'Cancelled by patient');
      setCancelNotice('Pickup ticket cancelled successfully. You are now free to select another dispensary.');
      setTimeout(() => setCancelNotice(null), 5000);
      await loadData(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const activeRequests = requests.filter(r => r.status !== 'CANCELLED' && r.status !== 'DISPENSED');

  return (
    <div className="pd-tab-page">
      {/* Active Orders Section */}
      {activeRequests.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <span>Active Prescription Pickup Tickets</span>
                <Sparkles size={18} style={{ color: '#0ea5e9' }} />
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                Your order is currently being processed. Show the 6-digit verification code at the pharmacy counter.
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
              <span>Refresh Status</span>
            </button>
          </div>

          {cancelNotice && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              color: '#059669',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}>
              ✓ {cancelNotice}
            </div>
          )}

          {activeRequests.map((req) => (
            <RequestCard
              key={req.request_id}
              req={req}
              onCancel={handleCancelRequest}
              cancellingId={cancellingId}
            />
          ))}
        </div>
      )}

      {/* If ticket was just cancelled and no active requests remain */}
      {activeRequests.length === 0 && cancelNotice && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          color: '#059669',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1.5rem',
        }}>
          ✓ {cancelNotice}
        </div>
      )}

      {/* Interactive Map & Nearby Dispensaries Explorer */}
      <div>
        <FindDispensariesTab
          activeRequests={requests}
          onOrderSuccess={() => loadData(true)}
        />
      </div>
    </div>
  );
}
