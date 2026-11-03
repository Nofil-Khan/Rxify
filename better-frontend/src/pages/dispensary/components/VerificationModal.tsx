import React, { useState } from 'react';
import { X, ShieldCheck, CheckSquare, Square, FileText } from 'lucide-react';

interface Props {
  requestId: number;
  prescriptionId: number;
  patientName: string;
  doctorName?: string | null;
  pharmacistName?: string;
  onClose: () => void;
  onVerify: (checklist: {
    patientIdentityChecked: boolean;
    dosageValidityChecked: boolean;
    interactionsCleared: boolean;
    notes?: string;
  }) => Promise<void>;
}

export default function VerificationModal({
  requestId,
  prescriptionId,
  patientName,
  doctorName,
  pharmacistName,
  onClose,
  onVerify,
}: Props) {
  const [patientIdentityChecked, setPatientIdentityChecked] = useState(true);
  const [dosageValidityChecked, setDosageValidityChecked] = useState(true);
  const [interactionsCleared, setInteractionsCleared] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = patientIdentityChecked && dosageValidityChecked && interactionsCleared;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onVerify({
        patientIdentityChecked,
        dosageValidityChecked,
        interactionsCleared,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="disp-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="disp-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '92%',
          background: 'var(--surface-color)',
          borderRadius: '0.85rem',
          padding: '1.25rem',
          boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '0.4rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Prescription Clinical Sign-Off
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Request #{requestId} · Rx #{prescriptionId} · Patient: {patientName}
              </p>
            </div>
          </div>
          <button type="button" className="disp-btn disp-btn--icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              As the registered pharmacist, verify and certify this prescription under statutory clinical dispensing protocols. A tamper-evident digital verification signature will be sealed into the audit log.
            </p>
          </div>

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Clinical Safety & Accuracy Checklist:
          </label>

          <div style={{ display: 'grid', gap: '0.65rem', marginBottom: '1.2rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                cursor: 'pointer',
                padding: '0.55rem 0.65rem',
                borderRadius: '0.45rem',
                background: patientIdentityChecked ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-sub)',
                border: patientIdentityChecked ? '1px solid #10b981' : '1px solid var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={patientIdentityChecked}
                onChange={(e) => setPatientIdentityChecked(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Patient Identity & Authenticity Verified
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                  Confirmed matching patient demographics and prescribing physician {doctorName ? `(Dr. ${doctorName})` : ''}.
                </span>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                cursor: 'pointer',
                padding: '0.55rem 0.65rem',
                borderRadius: '0.45rem',
                background: dosageValidityChecked ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-sub)',
                border: dosageValidityChecked ? '1px solid #10b981' : '1px solid var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={dosageValidityChecked}
                onChange={(e) => setDosageValidityChecked(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Dosage Strengths, Regimens & Duration Validated
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                  Quantities, daily dosing frequencies, and course lengths are medically coherent and appropriate.
                </span>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                cursor: 'pointer',
                padding: '0.55rem 0.65rem',
                borderRadius: '0.45rem',
                background: interactionsCleared ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-sub)',
                border: interactionsCleared ? '1px solid #10b981' : '1px solid var(--border-color)',
              }}
            >
              <input
                type="checkbox"
                checked={interactionsCleared}
                onChange={(e) => setInteractionsCleared(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Drug Interactions & Contraindications Cleared
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                  Screened for concurrent pharmacological conflicts, duplications, and known patient allergies.
                </span>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Pharmacist Clinical Verification Notes (optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Prescribing regimen verified against renal function history. Patient informed of bedtime administration."
              className="disp-textarea"
              style={{ minHeight: '60px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Signee: <strong>{pharmacistName || 'Registered Pharmacist'}</strong>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="disp-btn disp-btn--ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="disp-btn disp-btn--primary"
                style={{ background: '#10b981' }}
                disabled={submitting || !canSubmit}
              >
                {submitting ? 'Signing…' : 'Sign & Certify Prescription'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

