import {
  Calendar, Building2, FileText, Pill, ArrowUpRight,
} from 'lucide-react';
import type { TimelinePrescriptionItem } from '../../../../lib/patientApi';

interface Props {
  prescription: TimelinePrescriptionItem;
  onOpenDetail?: (prescriptionId: number) => void;
}

/** Derive clean initials from doctor name */
function doctorInitials(name: string): string {
  if (!name) return 'DR';
  const clean = name.replace(/^Dr\.\s*/i, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'DR';
}

/**
 * Upper floating window — prescription context, doctor, condition, and instructions.
 * Connected to live database records.
 * The entire window is clickable to open the complete prescription detail view.
 */
export default function PrescriptionCard({ prescription, onOpenDetail }: Props) {
  const initials = doctorInitials(prescription.doctor_name);

  const handleClick = () => {
    onOpenDetail?.(prescription.id);
  };

  return (
    <div
      className="mt-float-card group"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Open complete details for prescription ${prescription.prescription_code} from ${prescription.display_date}`}
      style={{
        padding: '1.4rem 1.6rem 1.3rem',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* ── Header row: Date, badge, condition, and quick action ───────── */}
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ marginBottom: '1.1rem' }}
      >
        <div className="flex items-center gap-3">
          {/* Calendar icon box */}
          <div
            className="flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{
              width: 44,
              height: 44,
              background: '#EFF6FF',
              color: '#2563EB',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
            }}
          >
            <Calendar size={20} />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#0F172A',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                }}
              >
                {prescription.display_date}
              </span>

              {prescription.is_latest && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                    textTransform: 'uppercase',
                  }}
                >
                  Latest
                </span>
              )}

              {prescription.follow_up_date && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: '#F0FDF4',
                    color: '#15803D',
                    border: '1px solid #BBF7D0',
                  }}
                >
                  Follow-up: {prescription.follow_up_date}
                </span>
              )}
            </div>

            <div
              className="flex items-center gap-2 flex-wrap"
              style={{ marginTop: 3 }}
            >
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Prescription · {prescription.visit_type}
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              {prescription.diagnosis ? (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: '#2563EB',
                    background: '#EFF6FF',
                    padding: '1px 8px',
                    borderRadius: 6,
                    border: '1px solid #DBEAFE',
                  }}
                >
                  {prescription.diagnosis}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    color: '#64748B',
                    background: '#F1F5F9',
                    padding: '1px 8px',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  Diagnosis: Not recorded
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="flex items-center gap-1.5 transition-all"
            style={{
              fontSize: '0.77rem',
              fontWeight: 600,
              color: '#2563EB',
              padding: '6px 14px',
              borderRadius: 999,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
            }}
          >
            <FileText size={13} style={{ color: '#2563EB' }} />
            <span>View original details</span>
            <ArrowUpRight size={13} style={{ color: '#2563EB' }} />
          </div>
        </div>
      </div>

      {/* ── Doctor & Hospital row ────────────────────────────────────────── */}
      <div
        className="flex items-center flex-wrap"
        style={{
          gap: '2rem',
          marginBottom: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        {/* Doctor */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 38,
              height: 38,
              background: 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {initials}
          </div>
          <div>
            <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
              {prescription.doctor_name}
            </p>
            <p style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 1 }}>
              {prescription.doctor_specialty || 'General Practice'}
            </p>
          </div>
        </div>

        {/* Subtle vertical divider */}
        <div style={{ width: 1, height: 32, background: '#E2E8F0', flexShrink: 0 }} />

        {/* Hospital */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              background: '#F1F5F9',
              color: '#64748B',
            }}
          >
            <Building2 size={16} />
          </div>
          <div>
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>
              {prescription.clinic_name}
            </p>
            <p style={{ fontSize: '0.73rem', color: '#64748B', marginTop: 1 }}>
              {prescription.clinic_city || 'Verified Clinical Center'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Doctor's Instructions Inset Card ─────────────────────────────── */}
      <div
        style={{
          background: '#F0F6FF',
          border: '1px solid #E0EDFD',
          borderRadius: 16,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: '1rem',
        }}
      >
        <div
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            background: '#FFFFFF',
            color: '#2563EB',
            boxShadow: '0 1px 4px rgba(37, 99, 235, 0.12)',
            marginTop: 2,
          }}
        >
          <FileText size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#1E3A8A',
              letterSpacing: '0.02em',
              marginBottom: 3,
            }}
          >
            Doctor's Instructions & Notes
          </p>
          <p
            style={{
              fontSize: '0.84rem',
              color: '#334155',
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
            }}
          >
            {prescription.doctor_notes || 'No extra clinical notes recorded.'}
          </p>
        </div>
      </div>

      {/* ── Footer metadata row ──────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-wrap gap-4"
        style={{
          paddingTop: '0.85rem',
          borderTop: '1px solid #F1F5F9',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '0.67rem',
              fontWeight: 600,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Visit Type
          </p>
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B', marginTop: 2 }}>
            {prescription.visit_type}
          </p>
        </div>

        <div>
          <p
            style={{
              fontSize: '0.67rem',
              fontWeight: 600,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Date
          </p>
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B', marginTop: 2 }}>
            {prescription.display_date}
          </p>
        </div>

        <div>
          <p
            style={{
              fontSize: '0.67rem',
              fontWeight: 600,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Medicines
          </p>
          <p
            style={{
              fontSize: '0.88rem',
              fontWeight: 600,
              color: '#1E293B',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Pill size={13} style={{ color: '#3B82F6' }} />
            {prescription.medications.length} items
          </p>
        </div>

        <div>
          <p
            style={{
              fontSize: '0.67rem',
              fontWeight: 600,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Prescription ID
          </p>
          <p
            style={{
              fontSize: '0.86rem',
              fontWeight: 600,
              color: '#2563EB',
              marginTop: 2,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {prescription.prescription_code}
          </p>
        </div>
      </div>
    </div>
  );
}
