/** Request Detail Panel — shown in the right pane of the queue view */
import { useState } from 'react';
import { X, UserCheck, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { RequestDetail } from '../../../lib/dispensaryApi';
import { RequestStatusBadge, MatchStatusBadge, AvailStatusBadge } from './StatusBadge';
import type { ToastVariant } from './useToast';

// Match-status human explanations shown to the pharmacist
const MATCH_REASON: Record<string, { text: string; cls: string }> = {
  AMBIGUOUS:      { text: 'Multiple medicines match this name. Manual identification required.', cls: 'disp-medicine-warning--violet' },
  UNRESOLVED:     { text: 'Medicine name could not be matched to the catalog. Manual lookup needed.', cls: '' },
  NOT_A_MEDICINE: { text: 'Identified as non-medicine item (e.g. supplement, device, instruction).', cls: 'disp-medicine-warning--neutral' },
};

interface Props {
  detail: RequestDetail;
  loading: boolean;
  onClose: () => void;
  onProcess: () => void;
  onMarkReady: () => void;
  onDispense: (notes: string) => void;
  onCancel: () => void;
  toast: (msg: string, v?: ToastVariant) => void;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function fmtTime(s: string | null | undefined) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return s; }
}

export default function RequestDetailPanel({ detail, loading, onClose, onProcess, onMarkReady, onDispense, onCancel }: Props) {
  const [notes, setNotes] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showMedDetails, setShowMedDetails] = useState(true);

  const st = detail.status;
  const initials = detail.patient_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const unresolvedCount = detail.items?.filter(
    (i) => i.availability_status === 'AMBIGUOUS' || i.availability_status === 'UNRESOLVED' || i.availability_status === 'NOT_A_MEDICINE'
  ).length ?? 0;

  const unavailCount = detail.items?.filter(
    (i) => i.availability_status === 'UNAVAILABLE'
  ).length ?? 0;

  return (
    <div className="disp-detail">
      {/* Header */}
      <div className="disp-detail-header">
        <div>
          <h3 className="disp-detail-title">Request #{detail.request_id}</h3>
          <div style={{ fontSize: '0.74rem', color: 'var(--disp-text-muted)', marginTop: 2 }}>
            Rx #{detail.prescription_id} · {fmtTime(detail.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RequestStatusBadge status={detail.status} />
          <button className="disp-btn disp-btn--icon" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="disp-detail-body">
        {/* Patient identity */}
        <div className="disp-patient-block">
          <div className="disp-patient-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="disp-patient-name">{detail.patient_name}</div>
            <div className="disp-patient-meta">
              {detail.patient_code ?? `PT-${detail.patient_id}`}
              {detail.patient_phone ? ` · ${detail.patient_phone}` : ''}
              {detail.patient_dob ? ` · DOB: ${fmtDate(detail.patient_dob)}` : ''}
            </div>
          </div>
          <UserCheck size={16} style={{ color: 'var(--disp-accent)', flexShrink: 0 }} />
        </div>

        {/* Prescription metadata */}
        <div className="disp-meta-grid">
          <div>
            <div className="disp-meta-label">Doctor</div>
            <div className="disp-meta-value">{detail.doctor_name ? `Dr. ${detail.doctor_name}` : '—'}</div>
          </div>
          <div>
            <div className="disp-meta-label">Specialty</div>
            <div className="disp-meta-value">{detail.doctor_specialty ?? '—'}</div>
          </div>
          <div>
            <div className="disp-meta-label">Issue Date</div>
            <div className="disp-meta-value">{fmtDate(detail.issue_date)}</div>
          </div>
          <div>
            <div className="disp-meta-label">Diagnosis</div>
            <div className="disp-meta-value">{detail.diagnosis ?? '—'}</div>
          </div>
          {detail.prescription_notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="disp-meta-label">Notes</div>
              <div className="disp-meta-value" style={{ fontSize: '0.8rem' }}>{detail.prescription_notes}</div>
            </div>
          )}
        </div>

        {/* Attention callouts */}
        {unresolvedCount > 0 && (
          <div className="disp-medicine-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
            <FileText size={13} />
            {unresolvedCount} medicine{unresolvedCount > 1 ? 's' : ''} could not be identified — manual pharmacist review required.
          </div>
        )}
        {unavailCount > 0 && (
          <div className="disp-medicine-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', background: 'var(--disp-err-bg)', borderColor: 'var(--disp-err-border)', color: 'var(--disp-err-text)' }}>
            <FileText size={13} />
            {unavailCount} medicine{unavailCount > 1 ? 's' : ''} out of stock at this dispensary.
          </div>
        )}

        {/* Medicines */}
        <div>
          <button
            className="disp-medicines-header"
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setShowMedDetails((v) => !v)}
          >
            <span>Prescribed Medicines ({detail.items?.length ?? 0})</span>
            {showMedDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showMedDetails && (
            <div style={{ marginTop: '0.5rem' }}>
              {(!detail.items || detail.items.length === 0) && loading && (
                <div style={{ padding: '0.5rem 0', display: 'grid', gap: '0.5rem' }}>
                  <div className="disp-skeleton" style={{ height: 42 }} />
                  <div className="disp-skeleton" style={{ height: 42 }} />
                </div>
              )}
              {(!detail.items || detail.items.length === 0) && !loading && (
                <div style={{ padding: '0.75rem', fontSize: '0.82rem', color: 'var(--disp-text-muted)' }}>
                  No medicine items recorded.
                </div>
              )}
              {detail.items?.map((item) => {
                const matchSt = (item as any).match_status as string | undefined;
                const reason = matchSt ? MATCH_REASON[matchSt] : undefined;
                const resolvedName = item.generic_name ?? item.brand_name;

                return (
                  <div key={item.item_id} className="disp-medicine-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="disp-medicine-name">{item.prescribed_medicine_name}</div>
                      {resolvedName && (
                        <div className="disp-medicine-resolved">
                          → {resolvedName}{item.strength ? ` · ${item.strength}` : ''}{item.form ? ` · ${item.form}` : ''}
                        </div>
                      )}
                      <div className="disp-medicine-meta">
                        {item.dosage && <span>Dose: {item.dosage}</span>}
                        {item.frequency && <span>Freq: {item.frequency}</span>}
                        {item.duration && <span>Duration: {item.duration}</span>}
                        <span>Qty: {item.required_quantity}</span>
                        {item.reserved && <span style={{ color: 'var(--disp-ok-text)', fontWeight: 600 }}>Reserved</span>}
                      </div>
                      {reason && (
                        <div className={`disp-medicine-warning ${reason.cls}`} style={{ display: 'inline-block', marginTop: 4 }}>
                          {reason.text}
                        </div>
                      )}
                    </div>
                    <div className="disp-medicine-badges">
                      {matchSt && <MatchStatusBadge status={matchSt as any} />}
                      <AvailStatusBadge status={item.availability_status as any} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workflow actions */}
        <div className="disp-actions">
          {st === 'PENDING' && (
            <button className="disp-btn disp-btn--primary" style={{ width: '100%' }} disabled={loading} onClick={onProcess}>
              {loading ? 'Processing…' : 'Process & Reserve Stock'}
            </button>
          )}
          {st === 'PROCESSING' && (
            <button className="disp-btn disp-btn--primary" style={{ width: '100%', background: 'var(--disp-ok-text)' }} disabled={loading} onClick={onMarkReady}>
              {loading ? 'Marking ready…' : 'Mark Ready for Collection'}
            </button>
          )}
          {(st === 'PROCESSING' || st === 'READY') && (
            <>
              <textarea
                className="disp-textarea"
                placeholder="Pharmacist dispensing notes (optional)…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                className="disp-btn disp-btn--primary"
                style={{ width: '100%', background: 'var(--disp-ok-text)' }}
                disabled={loading}
                onClick={() => { onDispense(notes); setNotes(''); }}
              >
                {loading ? 'Dispensing…' : 'Confirm & Dispense'}
              </button>
            </>
          )}

          {st !== 'DISPENSED' && st !== 'CANCELLED' && (
            <>
              {!showCancel ? (
                <button className="disp-btn disp-btn--danger" style={{ width: '100%' }} onClick={() => setShowCancel(true)}>
                  Cancel Request
                </button>
              ) : (
                <div className="disp-confirm-bar">
                  <span className="disp-confirm-text">Cancel this request?</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="disp-btn disp-btn--ghost disp-btn--sm" onClick={() => setShowCancel(false)}>No</button>
                    <button className="disp-btn disp-btn--danger disp-btn--sm" disabled={loading} onClick={() => { onCancel(); setShowCancel(false); }}>
                      Yes, Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {(st === 'DISPENSED' || st === 'CANCELLED') && (
            <div style={{ fontSize: '0.8rem', color: 'var(--disp-text-muted)', textAlign: 'center' }}>
              {st === 'DISPENSED' ? `Dispensed ${fmtTime(detail.dispensed_at)}` : `Cancelled`}
              {detail.notes && <div style={{ marginTop: 4 }}>Notes: {detail.notes}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
