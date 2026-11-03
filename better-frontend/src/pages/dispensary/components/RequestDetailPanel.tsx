/** Request Detail Panel — shown in the right pane of the queue view */
import { useState } from 'react';
import {
  X, UserCheck, FileText, ChevronDown, ChevronUp, Printer,
  ShieldCheck, KeyRound, CheckCircle, AlertTriangle, Stethoscope,
  Clock, ArrowRight, Check, Send
} from 'lucide-react';
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

const RECONSULT_REASONS = [
  { id: 'OUT_OF_STOCK_ALTERNATE_NEEDED', label: 'Medicine Out of Stock — Alternate Prescription Needed from Doctor' },
  { id: 'DOSAGE_CLARIFICATION',          label: 'Dosage, Strength, or Frequency Clarification Required' },
  { id: 'CLINICAL_QUERY',                label: 'Clinical Query / Potential Drug Interaction Concern' },
  { id: 'PATIENT_CLARIFICATION',         label: 'Patient Instructions / Allergy Check Needed' },
  { id: 'OTHER',                         label: 'Other Clinical Advisory' },
];

const PREP_TIME_OPTIONS = [10, 15, 20, 30, 45, 60];

interface Props {
  detail: RequestDetail;
  loading: boolean;
  onClose: () => void;
  onProcess: () => void;
  onApprove: (prepMins: number, notes?: string) => void;
  onReconsult: (reason: string, notes: string, target?: string, itemIds?: number[]) => void;
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

export default function RequestDetailPanel({
  detail, loading, onClose, onProcess, onApprove, onReconsult,
  onMarkReady, onDispense, onCancel, toast
}: Props) {
  const [notes, setNotes] = useState('');
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showMedDetails, setShowMedDetails] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Approval drawer state
  const [showApproveBox, setShowApproveBox] = useState(false);
  const [prepMinutes, setPrepMinutes] = useState(15);
  const [confirmNotes, setConfirmNotes] = useState('');

  // Reconsultation drawer state
  const [showReconsultBox, setShowReconsultBox] = useState(false);
  const [reconsultReason, setReconsultReason] = useState('OUT_OF_STOCK_ALTERNATE_NEEDED');
  const [reconsultNotes, setReconsultNotes] = useState('');
  const [reconsultTarget, setReconsultTarget] = useState<'DOCTOR' | 'PATIENT'>('DOCTOR');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());

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

  const handleExecuteApproval = () => {
    onApprove(prepMinutes, confirmNotes.trim() || undefined);
    setShowApproveBox(false);
  };

  const handleExecuteReconsult = () => {
    if (!reconsultNotes.trim()) {
      toast('Please enter clinical advice notes explaining the reconsultation reasoning.', 'err');
      return;
    }
    const itemIds = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : undefined;
    onReconsult(reconsultReason, reconsultNotes.trim(), reconsultTarget, itemIds);
    setShowReconsultBox(false);
    setReconsultNotes('');
  };

  const toggleItemForReconsult = (itemId: number) => {
    const s = new Set(selectedItemIds);
    if (s.has(itemId)) s.delete(itemId);
    else s.add(itemId);
    setSelectedItemIds(s);
  };

  const openReconsultForItem = (itemId: number) => {
    setSelectedItemIds(new Set([itemId]));
    setShowReconsultBox(true);
    setShowApproveBox(false);
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
        {/* Reconsultation Advisory Banner if Active */}
        {st === 'RECONSULTATION_NEEDED' && (
          <div style={{
            padding: '0.85rem 1rem',
            background: 'rgba(147, 51, 234, 0.08)',
            border: '1.5px solid #a855f7',
            borderRadius: '0.65rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem' }}>
              <Stethoscope size={18} style={{ color: '#9333ea' }} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#7e22ce', textTransform: 'uppercase' }}>
                Doctor Reconsultation Advised ({detail.reconsultation_target ?? 'DOCTOR'})
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              <strong>Reason:</strong> {(detail.reconsultation_reason ?? '').replace(/_/g, ' ') || 'Clinical advisory'}
            </p>
            {detail.pharmacist_notes && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <strong>Clinical Note:</strong> {detail.pharmacist_notes}
              </p>
            )}
            {detail.reconsultation_at && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Flagged on: {fmtTime(detail.reconsultation_at)}
              </div>
            )}
          </div>
        )}

        {/* Order Confirmed Banner if Active */}
        {st === 'CONFIRMED' && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1.5px solid #10b981',
            borderRadius: '0.65rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}>
            <CheckCircle size={20} style={{ color: '#10b981', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#047857' }}>
                Ticket Confirmed & Stock Reserved
              </div>
              {detail.estimated_ready_at && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Est. Collection Time: {fmtTime(detail.estimated_ready_at)}
                </div>
              )}
              {detail.pharmacist_notes && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Pharmacist note: "{detail.pharmacist_notes}"
                </div>
              )}
            </div>
          </div>
        )}

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
              Patient Order Notes
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
                const isItemReconsulted = item.reconsultation_needed || item.availability_status === 'RECONSULTATION_NEEDED';

                return (
                  <div key={item.item_id} className="disp-item-card" style={isItemReconsulted ? { borderLeft: '3px solid #9333ea' } : undefined}>
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

                    {/* Reconsultation note on item */}
                    {isItemReconsulted && item.reconsultation_notes && (
                      <div style={{
                        marginTop: '0.45rem',
                        padding: '0.4rem 0.6rem',
                        background: 'rgba(147, 51, 234, 0.08)',
                        borderRadius: '0.4rem',
                        fontSize: '0.76rem',
                        color: '#7e22ce',
                      }}>
                        <strong>Reconsultation Note:</strong> {item.reconsultation_notes}
                      </div>
                    )}

                    {/* Quick item-level reconsult trigger */}
                    {st !== 'DISPENSED' && st !== 'CANCELLED' && !showReconsultBox && (
                      <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="disp-btn disp-btn--ghost disp-btn--sm"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#7e22ce' }}
                          onClick={() => openReconsultForItem(item.item_id)}
                          title="Flag this specific medicine for doctor reconsultation"
                        >
                          <Stethoscope size={12} /> Flag Reconsultation
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Approval Form Drawer ── */}
        {showApproveBox && (
          <div style={{
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1.5px solid #10b981',
            borderRadius: '0.75rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <CheckCircle size={18} style={{ color: '#10b981' }} />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#047857' }}>
                  Confirm & Approve Prescription Ticket
                </h4>
              </div>
              <button
                type="button"
                className="disp-btn disp-btn--icon"
                onClick={() => setShowApproveBox(false)}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Approving this order reserves stock in your inventory and sends live collection countdown updates to the patient.
            </p>

            {/* Preparation ETA selector */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Estimated Preparation Time:
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {PREP_TIME_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setPrepMinutes(mins)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: prepMinutes === mins ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                    background: prepMinutes === mins ? '#10b981' : 'var(--surface-color)',
                    color: prepMinutes === mins ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  ~{mins} mins
                </button>
              ))}
            </div>

            {/* Pharmacist Confirmation Notes */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Confirmation Message for Patient (optional):
            </label>
            <textarea
              className="disp-textarea"
              placeholder="e.g. All medicines verified and reserved. Ready for pickup at Counter 2."
              value={confirmNotes}
              onChange={(e) => setConfirmNotes(e.target.value)}
              style={{ minHeight: '60px', marginBottom: '0.75rem' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="disp-btn disp-btn--primary"
                style={{ flex: 1, background: '#10b981' }}
                disabled={loading}
                onClick={handleExecuteApproval}
              >
                {loading ? 'Approving…' : 'Confirm Order & Reserve Stock'}
              </button>
              <button
                type="button"
                className="disp-btn disp-btn--ghost"
                onClick={() => setShowApproveBox(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Reconsultation Form Drawer ── */}
        {showReconsultBox && (
          <div style={{
            padding: '1rem',
            background: 'rgba(147, 51, 234, 0.06)',
            border: '1.5px solid #a855f7',
            borderRadius: '0.75rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Stethoscope size={18} style={{ color: '#9333ea' }} />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#7e22ce' }}>
                  Doctor / Patient Reconsultation Advisory
                </h4>
              </div>
              <button
                type="button"
                className="disp-btn disp-btn--icon"
                onClick={() => setShowReconsultBox(false)}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Flag this ticket when a prescribed medicine is out of stock, dosage requires clinical review, or alternate guidance is required. Releases reserved stock and alerts the patient to consult their doctor.
            </p>

            {/* Target selector */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setReconsultTarget('DOCTOR')}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.6rem',
                  borderRadius: '0.45rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: reconsultTarget === 'DOCTOR' ? '1.5px solid #9333ea' : '1px solid var(--border-color)',
                  background: reconsultTarget === 'DOCTOR' ? '#9333ea' : 'var(--surface-color)',
                  color: reconsultTarget === 'DOCTOR' ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Consult Doctor
              </button>
              <button
                type="button"
                onClick={() => setReconsultTarget('PATIENT')}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.6rem',
                  borderRadius: '0.45rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: reconsultTarget === 'PATIENT' ? '1.5px solid #9333ea' : '1px solid var(--border-color)',
                  background: reconsultTarget === 'PATIENT' ? '#9333ea' : 'var(--surface-color)',
                  color: reconsultTarget === 'PATIENT' ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Clarify with Patient
              </button>
            </div>

            {/* Reason selector */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Reconsultation Reason:
            </label>
            <select
              value={reconsultReason}
              onChange={(e) => setReconsultReason(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-color)',
                background: 'var(--surface-color)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                marginBottom: '0.75rem',
              }}
            >
              {RECONSULT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>

            {/* Medicine Checklist */}
            {detail.items && detail.items.length > 1 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Applies to specific medicines:
                </label>
                <div style={{ display: 'grid', gap: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
                  {detail.items.map((it) => (
                    <label
                      key={it.item_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        padding: '0.25rem 0.4rem',
                        borderRadius: '0.35rem',
                        background: selectedItemIds.has(it.item_id) ? 'rgba(147, 51, 234, 0.1)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(it.item_id)}
                        onChange={() => toggleItemForReconsult(it.item_id)}
                      />
                      <span>{it.prescribed_medicine_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Pharmacist Advisory Notes */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Clinical Advice & Proposed Alternatives (required):
            </label>
            <textarea
              className="disp-textarea"
              placeholder="e.g. Augmentin 625mg is out of stock. Recommend patient consult Dr. Sharma to prescribe Cefixime 200mg or an alternative broad-spectrum antibiotic."
              value={reconsultNotes}
              onChange={(e) => setReconsultNotes(e.target.value)}
              style={{ minHeight: '75px', marginBottom: '0.75rem' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="disp-btn disp-btn--primary"
                style={{ flex: 1, background: '#9333ea' }}
                disabled={loading}
                onClick={handleExecuteReconsult}
              >
                {loading ? 'Submitting…' : 'Submit Reconsultation & Alert Patient'}
              </button>
              <button
                type="button"
                className="disp-btn disp-btn--ghost"
                onClick={() => setShowReconsultBox(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="disp-actions">
          {/* Main Workflow Buttons for Pending / Partial / Reconsultation Needed */}
          {(st === 'PENDING' || st === 'PARTIALLY_AVAILABLE' || st === 'UNAVAILABLE' || st === 'RECONSULTATION_NEEDED') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="disp-btn disp-btn--primary"
                style={{ background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                disabled={loading}
                onClick={() => { setShowApproveBox(true); setShowReconsultBox(false); }}
              >
                <CheckCircle size={15} />
                <span>Approve & Confirm</span>
              </button>

              <button
                type="button"
                className="disp-btn disp-btn--primary"
                style={{ background: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                disabled={loading}
                onClick={() => { setShowReconsultBox(true); setShowApproveBox(false); }}
              >
                <Stethoscope size={15} />
                <span>Advise Reconsult</span>
              </button>
            </div>
          )}

          {/* Mark ready button when Confirmed or Processing */}
          {(st === 'CONFIRMED' || st === 'PROCESSING') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <button
                type="button"
                className="disp-btn disp-btn--primary"
                style={{ background: 'var(--disp-ok-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                disabled={loading}
                onClick={onMarkReady}
              >
                <Check size={15} />
                <span>{loading ? 'Marking ready…' : 'Mark Ready for Collection'}</span>
              </button>

              <button
                type="button"
                className="disp-btn disp-btn--ghost disp-btn--sm"
                style={{ color: '#9333ea', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                disabled={loading}
                onClick={() => { setShowReconsultBox(!showReconsultBox); setShowApproveBox(false); }}
                title="Flag for doctor reconsultation"
              >
                <Stethoscope size={14} />
                <span>Reconsult</span>
              </button>
            </div>
          )}

          {/* Verification Code & Dispensing Handover */}
          {(st === 'CONFIRMED' || st === 'PROCESSING' || st === 'READY') && (
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
                {loading ? 'Dispensing…' : 'Verify Code & Dispense Order'}
              </button>
            </>
          )}

          {st !== 'DISPENSED' && st !== 'CANCELLED' && (
            <div style={{ marginTop: '0.5rem' }}>
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
            </div>
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
