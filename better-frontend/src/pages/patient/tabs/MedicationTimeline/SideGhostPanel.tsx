import { Calendar, ChevronRight } from 'lucide-react';
import type { TimelinePrescriptionItem } from '../../../../lib/patientApi';

interface Props {
  prescription: TimelinePrescriptionItem;
  side: 'left' | 'right';
  variant: 'near' | 'far';
  onClick?: () => void;
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
 * Partially-visible ghost prescription card — positioned along the cylindrical arc.
 * Shows older or newer prescriptions curving back in 3D perspective.
 * Fully interactive: clicking switches the stage focus to this prescription.
 */
export default function SideGhostPanel({ prescription, side, variant, onClick }: Props) {
  const cls = `mt-ghost mt-ghost--${variant}-${side}`;
  const conditionDisplay = prescription.diagnosis || 'Diagnosis: Not recorded';

  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`View prescription from ${prescription.display_date}`}
      style={{ userSelect: 'none' }}
    >
      <div
        className="mt-float-card group"
        style={{
          width: 218,
          padding: '1.05rem 1.15rem 0.95rem',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 20,
          position: 'relative',
        }}
      >
        {/* Date row */}
        <div className="flex items-center gap-2" style={{ marginBottom: '0.55rem' }}>
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              background: '#EFF6FF',
              color: '#2563EB',
            }}
          >
            <Calendar size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.1 }}>
              {prescription.display_date}
            </span>
            <p style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 1 }}>
              {prescription.visit_type}
            </p>
          </div>
        </div>

        {/* Doctor row */}
        <div
          className="flex items-center gap-2"
          style={{
            marginBottom: '0.55rem',
            paddingBottom: '0.55rem',
            borderBottom: '1px solid #F1F5F9',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 26,
              height: 26,
              background: '#E2E8F0',
              color: '#475569',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            {doctorInitials(prescription.doctor_name)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#1E293B',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {prescription.doctor_name}
            </p>
            <p
              style={{
                fontSize: '0.67rem',
                color: '#94A3B8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {prescription.doctor_specialty || 'General Practice'}
            </p>
          </div>
        </div>

        {/* Condition snippet */}
        <p
          style={{
            fontSize: '0.71rem',
            color: '#64748B',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: '0.65rem',
          }}
        >
          {conditionDisplay}
        </p>

        {/* Footer info & interactive affordance */}
        <div
          className="flex items-center justify-between"
          style={{
            paddingTop: '0.5rem',
            borderTop: '1px solid #F1F5F9',
          }}
        >
          <div>
            <p style={{ fontSize: '0.62rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Condition
            </p>
            <p
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#334155',
                marginTop: 1,
                maxWidth: 105,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {prescription.diagnosis ? prescription.diagnosis : 'Not recorded'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.62rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Meds
            </p>
            <p style={{ fontSize: '0.74rem', fontWeight: 600, color: '#2563EB', marginTop: 1 }}>
              {prescription.medications.length} items
            </p>
          </div>
        </div>

        {/* Subtle focus cue indicator pill */}
        <div
          style={{
            marginTop: '0.55rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            fontSize: '0.65rem',
            fontWeight: 600,
            color: '#2563EB',
            background: 'rgba(239, 246, 255, 0.75)',
            borderRadius: 7,
            padding: '2.5px 6px',
          }}
        >
          <span>Focus</span>
          <ChevronRight size={11} />
        </div>
      </div>
    </div>
  );
}
