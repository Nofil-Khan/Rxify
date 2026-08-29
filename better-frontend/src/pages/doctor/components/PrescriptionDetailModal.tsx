import React, { useState } from 'react';
import { X, FileText, Pill, Calendar, Building2, User, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { PrescriptionItem } from '../../../lib/doctorApi';

interface ModalProps {
  prescription: PrescriptionItem | null;
  onClose: () => void;
}

export default function PrescriptionDetailModal({ prescription, onClose }: ModalProps) {
  const [showOcr, setShowOcr] = useState(false);
  const [copied, setCopied]   = useState(false);

  if (!prescription) return null;

  const copyOcr = () => {
    if (prescription.raw_text) {
      navigator.clipboard.writeText(prescription.raw_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="dd-modal-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      <div className="dd-modal-content" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="dd-modal-header">
          <div className="dd-item-left">
            <div className="dd-stat-icon dd-stat-icon--teal">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="dd-card-title">Prescription #{prescription.id}</h3>
              <p className="dd-item-sub">
                <Calendar size={12} /> {prescription.created_at}
              </p>
            </div>
          </div>
          <button className="dd-icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="dd-modal-body">
          {/* Metadata Grid */}
          <div className="dd-bento-grid">
            <div className="dd-bento-card dd-span-6" style={{ padding: '0.85rem 1rem' }}>
              <span className="dd-stat-lbl" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={13} /> Patient Name
              </span>
              <span className="dd-item-title" style={{ fontSize: '0.95rem', marginTop: '2px' }}>
                {prescription.patient_name}
              </span>
            </div>

            <div className="dd-bento-card dd-span-6" style={{ padding: '0.85rem 1rem' }}>
              <span className="dd-stat-lbl" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Building2 size={13} /> Clinic / Hospital
              </span>
              <span className="dd-item-title" style={{ fontSize: '0.95rem', marginTop: '2px' }}>
                {prescription.clinic_name}
              </span>
            </div>
          </div>

          {/* Primary Diagnosis */}
          <div className="dd-bento-card" style={{ padding: '1rem', background: 'var(--dd-teal-bg)', borderColor: 'var(--dd-teal-border)' }}>
            <span className="dd-stat-lbl" style={{ color: 'var(--dd-teal)', fontWeight: 600 }}>Primary Diagnosis</span>
            <p className="dd-item-title" style={{ fontSize: '1rem', color: 'var(--dd-teal)', marginTop: '4px' }}>
              {prescription.diagnosis}
            </p>
          </div>

          {/* Prescribed Medications */}
          <div>
            <h4 className="dd-stat-lbl" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Prescribed Medications ({prescription.medicines?.length ?? prescription.medicines_count ?? 0})
            </h4>
            <div className="dd-list">
              {prescription.medicines && prescription.medicines.length > 0 ? (
                prescription.medicines.map((med, idx) => (
                  <div key={idx} className="dd-list-item">
                    <div className="dd-item-left">
                      <div className="dd-item-avatar" style={{ background: 'var(--dd-indigo-bg)', color: 'var(--dd-indigo)' }}>
                        <Pill size={16} />
                      </div>
                      <div className="dd-item-meta">
                        <span className="dd-item-title">{med.name}</span>
                        <span className="dd-item-sub dd-item-mono">
                          {med.dosage} &bull; {med.frequency} &bull; {med.duration}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dd-list-item">
                  <span className="dd-item-title">General Medical Prescription</span>
                </div>
              )}
            </div>
          </div>

          {/* Progressive Disclosure: Raw OCR Text Drawer */}
          {prescription.raw_text && (
            <div style={{ borderTop: '1px solid var(--dd-border)', paddingTop: '1rem' }}>
              <button
                className="dd-btn-outline"
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => setShowOcr((v) => !v)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={15} /> Progressive Inspection: Raw OCR Extraction
                </span>
                {showOcr ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showOcr && (
                <div style={{ marginTop: '0.75rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <button className="dd-btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={copyOcr}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied' : 'Copy OCR'}</span>
                    </button>
                  </div>
                  <pre className="dd-mono-box">{prescription.raw_text}</pre>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="dd-modal-footer">
          <button className="dd-btn-outline" onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
