/** Request Detail Panel — shown in the right pane of the queue view */
import { useState } from 'react';
import { X, UserCheck, FileText, ChevronDown, ChevronUp, Printer, ShieldCheck, KeyRound } from 'lucide-react';
import type { RequestDetail } from '../../../lib/dispensaryApi';
import { RequestStatusBadge, MatchStatusBadge, AvailStatusBadge } from './StatusBadge';
import type { ToastVariant } from './useToast';
import DosageLabelsModal from './DosageLabelsModal';

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
  onDispense: (notes: string, pickupCode?: string) => void;
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

export default function RequestDetailPanel({ detail, loading, onClose, onProcess, onMarkReady, onDispense, onCancel, toast }: Props) {
  const [notes, setNotes] = useState('');
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showMedDetails, setShowMedDetails] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const st = detail.status;
  const initials = detail.patient_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const unresolvedCount = detail.items?.filter(
    (i) => i.availability_status === 'AMBIGUOUS' || i.availability_status === 'UNRESOLVED' || i.availability_status === 'NOT_A_MEDICINE'
  ).length ?? 0;

  const unavailCount = detail.items?.filter(
    (i) => i.availability_status === 'UNAVAILABLE'
  ).length ?? 0;

  const handleConfirmDispense = () => {
    const entered = pickupCodeInput.trim();
    if (detail.pickup_code && entered.length !== 6) {
      toast('Please enter the 6-digit pickup verification code provided by the patient.', 'err');
      return;
    }
    onDispense(notes, entered);
    setNotes('');
    setPickupCodeInput('');
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            type="button"
            className="disp-btn disp-btn--ghost disp-btn--sm"
            onClick={() => setShowPrintModal(true)}
            title="Print Dosage Labels & Handover Receipt"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7', padding: '0.3rem 0.55rem' }}
          >
            <Printer size={15} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Print</span>
          </button>
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
          {detail.estimated_ready_at && (
            <div>
              <div className="disp-meta-label">Est. Ready</div>
              <div className="disp-meta-value">{fmtTime(detail.estimated_ready_at)}</div>
            </div>
          )}
        </div>

        {/* Diagnosis & prescription notes */}
        {(detail.diagnosis || detail.prescription_notes) && (
          <div className="disp-rx-notes">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 4 }}>
              <FileText size={13} /> Clinical Info
            </div>
            {detail.diagnosis && <div><strong>Dx:</strong> {detail.diagnosis}</div>}
            {detail.prescription_notes && <div style={{ marginTop: 2 }}><strong>Rx Notes:</strong> {detail.prescription_notes}</div>}
          </div>
        )}

        {/* Patient fulfillment notes */}
        {detail.notes && (
          <div style={{
            background: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: '0.45rem',
            padding: '0.55rem 0.75rem',
            marginBottom: '0.75rem',
            fontSize: '0.82rem',
            color: 'var(--text-primary)',
          }}>
            <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Patient Fulfillment Notes
            </div>
            <div>{detail.notes}</div>
          </div>
        )}

        {/* Unresolved / Out-of-Stock warnings */}
        {(unresolvedCount > 0 || unavailCount > 0) && (
          <div className="disp-alert-banner">
            {unresolvedCount > 0 && (
              <div>⚠️ {unresolvedCount} medicine{unresolvedCount > 1 ? 's require' : ' requires'} clarification or manual check.</div>
            )}
            {unavailCount > 0 && (
              <div>❌ {unavailCount} medicine{unavailCount > 1 ? 's are' : ' is'} out of stock.</div>
            )}
          </div>
        )}

        {/* Medicine items */}
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="disp-section-toggle"
            onClick={() => setShowMedDetails(!showMedDetails)}
          >
            <span>Medicines ({detail.items?.length ?? 0})</span>
            {showMedDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showMedDetails && (
            <div className="disp-items-list">
              {detail.items?.map((item) => {
                const warn = MATCH_REASON[item.availability_status];
                return (
                  <div key={item.item_id} className="disp-item-card">
                    <div className="disp-item-header">
                      <div>
                        <span className="disp-item-name">{item.prescribed_medicine_name}</span>
                        {item.generic_name && (
                          <div className="disp-item-generic">{item.generic_name}</div>
                        )}
                        {item.brand_name && item.brand_name !== item.prescribed_medicine_name && (
                          <div className="disp-item-brand">Brand: {item.brand_name}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <AvailStatusBadge status={item.availability_status as any} />
                        <span className="disp-item-qty">
                          {item.dispensed_quantity != null ? `${item.dispensed_quantity}/` : ''}{item.required_quantity} {item.form ? item.form.toLowerCase() : 'unit'}s
                        </span>
                      </div>
                    </div>

                    {/* Dosage & frequency */}
                    {(item.dosage || item.frequency || item.duration) && (
                      <div className="disp-item-instructions">
                        {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                        {item.instructions ? ` — ${item.instructions}` : ''}
                      </div>
                    )}

                    {/* Warning pill if ambiguous / unresolved */}
                    {warn && (
                      <div className={`disp-medicine-warning ${warn.cls}`}>
                        {warn.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions bar */}
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
              {/* 6-Digit Counter Pickup Code Verification Input */}
              <div style={{
                padding: '0.85rem',
                background: 'rgba(2, 132, 199, 0.06)',
                borderRadius: '0.65rem',
                border: '1.5px solid rgba(2, 132, 199, 0.3)',
                marginBottom: '0.65rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <KeyRound size={16} style={{ color: '#0284c7' }} />
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Patient 6-Digit Pickup Verification Code:
                  </label>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 482915"
                  value={pickupCodeInput}
                  onChange={(e) => setPickupCodeInput(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    letterSpacing: '0.3em',
                    fontFamily: 'monospace',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    textAlign: 'center',
                    padding: '0.45rem',
                    borderRadius: '0.45rem',
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface-color)',
                    color: '#0284c7',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.3rem', textAlign: 'center' }}>
                  Ask the patient for the 6-digit verification code on their ticket.
                </span>
              </div>

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
                onClick={handleConfirmDispense}
              >
                {loading ? 'Dispensing…' : 'Verify & Dispense'}
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
              {st === 'DISPENSED' && (
                <button
                  type="button"
                  className="disp-btn disp-btn--ghost disp-btn--sm"
                  onClick={() => setShowPrintModal(true)}
                  style={{ marginTop: '0.5rem', color: '#0284c7' }}
                >
                  <Printer size={13} /> Reprint Dosage Labels & Receipt
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Printable Dosage Labels & Receipt Modal */}
      {showPrintModal && (
        <DosageLabelsModal detail={detail} onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
}
