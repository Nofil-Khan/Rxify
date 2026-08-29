import { useState, useEffect } from 'react';
import { UserPlus, Check, X, Clock, MessageSquare } from 'lucide-react';
import { getPendingRequests, respondToRequest, getInitials, ConnectionRequest } from '../../../lib/doctorApi';

export default function RequestsTab() {
  const [requests, setRequests]         = useState<ConnectionRequest[]>([]);
  const [loading, setLoading]           = useState(true);
  const [notice, setNotice]             = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadRequests() {
      setLoading(true);
      const data = await getPendingRequests();
      if (mounted) {
        setRequests(data ?? []);
        setLoading(false);
      }
    }
    loadRequests();
    return () => { mounted = false; };
  }, []);

  const handleRespond = async (reqId: number, accept: boolean, patientName?: string) => {
    const name = patientName || 'Patient';
    setProcessingId(reqId);

    // Optimistic UI Removal
    setRequests((prev) => (prev ?? []).filter((r) => r.id !== reqId));

    setNotice(
      accept
        ? `Successfully accepted ${name}. They are now added to your assigned patients list.`
        : `Declined connection request from ${name}.`
    );

    setTimeout(() => setNotice(null), 4000);

    await respondToRequest(reqId, accept);
    setProcessingId(null);
  };

  if (loading) {
    return (
      <div className="dd-bento-grid">
        <div className="dd-bento-card dd-span-6 dd-skeleton" style={{ height: '180px' }} />
        <div className="dd-bento-card dd-span-6 dd-skeleton" style={{ height: '180px' }} />
      </div>
    );
  }

  return (
    <div className="dd-bento-grid">
      {/* Toast Notice */}
      {notice && (
        <div
          className="dd-span-12"
          style={{
            padding: '12px 16px',
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
          <Check size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Connection Header */}
      <div className="dd-bento-card dd-span-12" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 className="dd-card-title">
            <UserPlus size={20} className="dd-card-title-icon" style={{ color: 'var(--dd-amber)' }} />
            Patient Connection Requests
          </h3>
          <p className="dd-item-sub" style={{ marginTop: '2px' }}>
            Accepting a request authorizes you to view the patient's digitized medical prescriptions.
          </p>
        </div>
        <span className="dd-badge-count" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
          {requests?.length ?? 0} Pending
        </span>
      </div>

      {/* Requests List */}
      {(requests?.length ?? 0) === 0 ? (
        <div className="dd-bento-card dd-span-12" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--dd-text-muted)' }}>
          <Check size={36} style={{ margin: '0 auto 12px', color: 'var(--dd-emerald)' }} />
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--dd-text-main)', marginBottom: '4px' }}>
            No Pending Requests
          </h4>
          <p style={{ fontSize: '0.85rem' }}>All patient connection invitations have been processed.</p>
        </div>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="dd-bento-card dd-span-6">
            <div className="dd-card-header">
              <div className="dd-item-left">
                <div className="dd-avatar" style={{ background: 'var(--dd-amber-bg)', color: 'var(--dd-amber)' }}>
                  {getInitials(req.patient_name || req.username)}
                </div>
                <div className="dd-item-meta">
                  <h4 className="dd-item-title" style={{ fontSize: '1rem' }}>{req.patient_name || req.username || 'Patient'}</h4>
                  <span className="dd-item-sub dd-item-mono">@{req.username || 'patient'}</span>
                </div>
              </div>
              <span className="dd-item-sub dd-item-mono" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {req.requested_at || ''}
              </span>
            </div>

            {req.note && (
              <div style={{ background: 'var(--dd-bg-card-sub)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--dd-border)', margin: '0.5rem 0 1rem' }}>
                <span className="dd-stat-lbl" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <MessageSquare size={12} /> Patient Note / Referral Context
                </span>
                <p style={{ fontSize: '0.82rem', color: 'var(--dd-text-sub)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{req.note}"
                </p>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--dd-border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="dd-btn-reject"
                disabled={processingId === req.id}
                onClick={() => handleRespond(req.id, false, req.patient_name || req.username)}
              >
                <X size={15} /> Decline
              </button>
              <button
                className="dd-btn-accept"
                disabled={processingId === req.id}
                onClick={() => handleRespond(req.id, true, req.patient_name || req.username)}
              >
                <Check size={15} /> Accept Patient Connection
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
