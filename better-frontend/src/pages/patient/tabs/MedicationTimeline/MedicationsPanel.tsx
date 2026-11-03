import { useState } from 'react';
import {
  Pill, ClipboardList, User, ChevronRight, Calendar, Info, Clock, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import type { TimelinePrescriptionItem, TimelinePrescriptionMedication } from '../../../../lib/patientApi';

interface Props {
  prescription: TimelinePrescriptionItem;
  onSelectMedicine?: (med: TimelinePrescriptionMedication) => void;
  onOpenDetail?: (prescriptionId: number) => void;
}

/* ── Status badge visual config matching reference design ────────────────── */
const STATUS_CONFIG: Record<
  'Taking' | 'Completed' | 'Needs confirmation' | 'Paused' | 'Not recorded',
  { bg: string; color: string; border: string }
> = {
  'Taking':              { bg: '#E6F9F2', color: '#059669', border: '#A7F3D0' },
  'Completed':           { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' },
  'Needs confirmation':  { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  'Paused':              { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' },
  'Not recorded':        { bg: '#F8FAFC', color: '#94A3B8', border: '#E2E8F0' },
};

/* ── Pill accent colors palette ─────────────────────────────────────────── */
const ACCENT_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1'];

/* ── Tab definitions ──────────────────────────────────────────────────────── */
const TABS = [
  { id: 'medications' as const, label: 'Medications',           Icon: Pill           },
  { id: 'details'     as const, label: 'Prescription Details',  Icon: ClipboardList  },
  { id: 'doctor'      as const, label: 'Doctor & Visit',        Icon: User           },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Lower floating window — frosted glass tray with sidebar pill tabs
 * and prominent white medication list card.
 * Connected to live database medication line items.
 */
export default function MedicationsPanel({ prescription, onSelectMedicine, onOpenDetail }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('medications');

  const medications = prescription.medications || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Frosted glass tray containing sidebar + medication panel ───────── */}
      <div className="mt-glass-tray">

        {/* ── Left sidebar tabs on frosted glass tray ──────────────────────── */}
        <div
          style={{
            width: 152,
            flexShrink: 0,
            padding: '0.6rem 0.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                id={`mt-tab-${id}`}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0.65rem 0.85rem',
                  borderRadius: 14,
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#2563EB' : '#475569',
                  background: active ? '#FFFFFF' : 'transparent',
                  boxShadow: active ? '0 2px 10px rgba(15, 35, 75, 0.08)' : 'none',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                  border: active ? '1px solid rgba(255, 255, 255, 0.95)' : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon
                  size={16}
                  style={{
                    color: active ? '#2563EB' : '#64748B',
                    flexShrink: 0,
                  }}
                />
                <span style={{ lineHeight: 1.2 }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Right elevated white card ────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: '#FFFFFF',
            borderRadius: 22,
            padding: '1.35rem 1.7rem 1.25rem',
            boxShadow: '0 4px 20px rgba(15, 35, 75, 0.05)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: '1.15rem' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center rounded-2xl flex-shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  background: '#EFF6FF',
                  color: '#2563EB',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                }}
              >
                {activeTab === 'medications' && <Pill size={19} />}
                {activeTab === 'details'     && <ClipboardList size={19} />}
                {activeTab === 'doctor'      && <User size={19} />}
              </div>
              <div>
                <h2
                  style={{
                    fontSize: '1.08rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    lineHeight: 1.15,
                  }}
                >
                  {activeTab === 'medications' && 'Prescribed Medications'}
                  {activeTab === 'details'     && 'Prescription Information'}
                  {activeTab === 'doctor'      && 'Healthcare Provider & Clinic'}
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                  {activeTab === 'medications' && `${medications.length} ${medications.length === 1 ? 'medicine' : 'medicines'} in this prescription`}
                  {activeTab === 'details'     && `Prescription #${prescription.prescription_code} · ${prescription.display_date}`}
                  {activeTab === 'doctor'      && `${prescription.doctor_name} · ${prescription.clinic_name}`}
                </p>
              </div>
            </div>

            {/* View Full Details Button */}
            <button
              onClick={() => onOpenDetail?.(prescription.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.45rem 1rem',
                borderRadius: 999,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#2563EB',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#DBEAFE')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#EFF6FF')}
            >
              <FileText size={13} />
              <span>Full Details</span>
            </button>
          </div>

          {/* ── TAB 1: Medications List ──────────────────────────────────── */}
          {activeTab === 'medications' && (
            <div>
              {medications.length === 0 ? (
                <div
                  style={{
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                    background: '#F8FAFC',
                    borderRadius: 16,
                    border: '1px dashed #CBD5E1',
                  }}
                >
                  <AlertCircle size={28} style={{ color: '#94A3B8', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                    No medications recorded in this prescription.
                  </p>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 4 }}>
                    This entry may be an empty draft or general consultation note.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {medications.map((med, idx) => {
                    const st = STATUS_CONFIG[med.status_display] || STATUS_CONFIG['Not recorded'];
                    const accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];

                    return (
                      <div
                        key={med.id}
                        id={`mt-med-${med.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectMedicine?.(med)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectMedicine?.(med);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.1rem',
                          padding: '0.72rem 0.75rem',
                          borderTop: idx > 0 ? '1px solid #F8FAFC' : 'none',
                          borderRadius: 14,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease, transform 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Pill icon */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            flexShrink: 0,
                            background: `${accent}18`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Pill size={17} style={{ color: accent }} />
                        </div>

                        {/* Medicine Name + strength */}
                        <div style={{ width: 150, flexShrink: 0, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 700,
                              color: '#0F172A',
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={med.name}
                          >
                            {med.name}
                          </p>
                          <p
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748B',
                              marginTop: 2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {med.strength} · {med.form}
                          </p>
                        </div>

                        {/* Dosage + Frequency with Calendar icon */}
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                          }}
                        >
                          <Calendar
                            size={15}
                            style={{
                              color: '#94A3B8',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p
                              style={{
                                fontSize: '0.86rem',
                                fontWeight: 600,
                                color: '#1E293B',
                                lineHeight: 1.25,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {med.dosage} · {med.frequency}
                            </p>
                            <p
                              style={{
                                fontSize: '0.74rem',
                                color: '#64748B',
                                marginTop: 2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {med.duration}
                              {med.instructions ? ` · ${med.instructions}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '4px 13px',
                            borderRadius: 999,
                            background: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {med.status_display}
                        </span>

                        {/* Chevron right */}
                        <ChevronRight
                          size={16}
                          style={{ color: '#CBD5E1', flexShrink: 0 }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: Prescription Details ──────────────────────────────── */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 12 }}>
                  <p style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                    Recorded Diagnosis
                  </p>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                    {prescription.diagnosis || 'Not recorded by doctor'}
                  </p>
                </div>

                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 12 }}>
                  <p style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                    Issue Date
                  </p>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                    {prescription.display_date}
                  </p>
                </div>

                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 12 }}>
                  <p style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                    Follow-up Date
                  </p>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                    {prescription.follow_up_date || 'No follow-up specified'}
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: '#F0F6FF',
                  border: '1px solid #DBEAFE',
                  borderRadius: 14,
                  padding: '12px 16px',
                }}
              >
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', marginBottom: 4 }}>
                  Doctor's Clinical Notes
                </p>
                <p style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {prescription.doctor_notes || 'No extra instructions recorded.'}
                </p>
              </div>
            </div>
          )}

          {/* ── TAB 3: Doctor & Visit ────────────────────────────────────── */}
          {activeTab === 'doctor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                  }}
                >
                  <User size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                    {prescription.doctor_name}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {prescription.doctor_specialty || 'General Practitioner'}
                  </p>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: 14, border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Facility / Clinic
                </p>
                <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', marginTop: 2 }}>
                  {prescription.clinic_name}
                </p>
                {prescription.clinic_city && (
                  <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                    {prescription.clinic_city}
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
