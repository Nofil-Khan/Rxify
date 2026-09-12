import { useState, useEffect } from 'react';
import { getHospitalDashboard } from '../../../lib/hospitalApi';
import type { DashboardData, AuditEntry } from '../../../lib/hospitalApi';
import {
  Users, Calendar, Activity, BedDouble, DollarSign,
  Clock, Stethoscope, AlertTriangle, CheckCircle2,
  Filter, ArrowUpRight, ShieldCheck, ChevronRight,
  TrendingUp, RefreshCw
} from 'lucide-react';

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    LOOKUP: 'Patient Record EHR Lookup',
    READ_PRESCRIPTIONS: 'Prescriptions History Accessed',
    READ_PRESCRIPTION_DETAIL: 'Prescription Detail Reviewed',
    READ_MEDICATIONS: 'Medication Roster Inspected',
    AFFILIATE_DOCTOR: 'Doctor Affiliated to Hospital',
    DISPENSE_MEDICINE: 'Medication Dispensed to Inpatient',
    DATABASE_SEED: 'Institutional Master Seed',
    GENERAL: 'Administrative Audit Action',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

import { useHospitalAuthStore } from '../../../lib/hospitalAuth';

/* Realistic Clinical Schedule Demo Data */
const DEMO_APPOINTMENTS = [
  { id: 'APT-1091', time: '09:00 AM', patient: 'Eleanor Vance', mrn: 'RXF-P-8821', doctor: 'Dr. Sarah Chen', dept: 'Cardiology', room: 'Suite 204', type: 'Post-Op Review', status: 'IN_CONSULTATION' },
  { id: 'APT-1092', time: '09:15 AM', patient: 'Liam O’Connor', mrn: 'RXF-P-3319', doctor: 'Dr. Marcus Vance', dept: 'Emergency / Trauma', room: 'Bay 3', type: 'Urgent Triage', status: 'IN_CONSULTATION' },
  { id: 'APT-1093', time: '09:30 AM', patient: 'Sofia Reyes', mrn: 'RXF-P-9022', doctor: 'Dr. Emily Rodriguez', dept: 'Internal Medicine', room: 'Room 108', type: 'Routine Follow-up', status: 'CHECKED_IN' },
  { id: 'APT-1094', time: '10:00 AM', patient: 'Arthur Pendelton', mrn: 'RXF-P-4451', doctor: 'Dr. Jonathan Hayes', dept: 'Pediatrics', room: 'Wing C-12', type: 'Allergy Evaluation', status: 'CHECKED_IN' },
  { id: 'APT-1095', time: '10:15 AM', patient: 'Devin Brooks', mrn: 'RXF-P-1104', doctor: 'Dr. Priya Patel', dept: 'Neurology', room: 'Suite 310', type: 'Migraine Consult', status: 'SCHEDULED' },
  { id: 'APT-1096', time: '10:45 AM', patient: 'Grace Mitchell', mrn: 'RXF-P-7819', doctor: 'Dr. David Kim', dept: 'Orthopedics', room: 'Room 102', type: 'Cast Removal', status: 'SCHEDULED' },
];

/* Realistic Inpatient Census Demo Data */
const DEMO_PATIENTS = [
  { mrn: 'RXF-P-8821', name: 'Eleanor Vance', age: '58 F', admitted: 'Sep 10, 2026', ward: 'ICU-04', doctor: 'Dr. Sarah Chen', condition: 'Post-CABG · Critical/Stable', badge: 'red' },
  { mrn: 'RXF-P-3319', name: 'Liam O’Connor', age: '34 M', admitted: 'Sep 12, 2026', ward: 'Trauma Bay 2', doctor: 'Dr. Marcus Vance', condition: 'Fracture Reduction · Under Obs', badge: 'amber' },
  { mrn: 'RXF-P-9022', name: 'Sofia Reyes', age: '45 F', admitted: 'Sep 11, 2026', ward: 'Ward 3B · Bed 12', doctor: 'Dr. Emily Rodriguez', condition: 'Pneumonia · Improving', badge: 'green' },
  { mrn: 'RXF-P-4451', name: 'Arthur Pendelton', age: '8 M', admitted: 'Sep 11, 2026', ward: 'Pediatrics · Bed 06', doctor: 'Dr. Jonathan Hayes', condition: 'Asthmatic Flare · Stable', badge: 'green' },
  { mrn: 'RXF-P-6120', name: 'Martha Jenkins', age: '72 F', admitted: 'Sep 09, 2026', ward: 'Cardiology CCU-02', doctor: 'Dr. Sarah Chen', condition: 'Arrhythmia · Monitored', badge: 'blue' },
];

/* Ward Occupancy Map Demo Data */
const DEMO_WARDS = [
  { name: 'Intensive Care Unit (ICU)', occupied: 18, total: 20, pct: 90, status: 'High Occupancy', color: '#ef4444' },
  { name: 'Cardiac Care Unit (CCU)', occupied: 14, total: 15, pct: 93.3, status: 'Urgent Alert', color: '#ef4444' },
  { name: 'General Inpatient Wing A', occupied: 52, total: 60, pct: 86.7, status: 'Normal Flow', color: '#0f766e' },
  { name: 'Surgical Post-Op Ward', occupied: 27, total: 35, pct: 77.1, status: 'Capacity Available', color: '#0f766e' },
  { name: 'Pediatrics Unit', occupied: 21, total: 30, pct: 70.0, status: 'Capacity Available', color: '#0f766e' },
  { name: 'Maternity & Neonatal', occupied: 18, total: 25, pct: 72.0, status: 'Capacity Available', color: '#0f766e' },
];

/* Doctor Availability Demo Data */
const DEMO_DOCTORS = [
  { name: 'Dr. Sarah Chen', specialty: 'Chief of Cardiology', status: 'In Surgery', room: 'OR-2', badge: 'red' },
  { name: 'Dr. Marcus Vance', specialty: 'Emergency Medicine', status: 'Active Triage', room: 'ER Bay 1-4', badge: 'amber' },
  { name: 'Dr. Emily Rodriguez', specialty: 'Internal Medicine', status: 'Consulting', room: 'Clinic 108', badge: 'green' },
  { name: 'Dr. Jonathan Hayes', specialty: 'Pediatrics Care', status: 'Ward Rounds', room: 'Peds Wing', badge: 'blue' },
  { name: 'Dr. Priya Patel', specialty: 'Neurology', status: 'Available', room: 'Suite 310', badge: 'green' },
  { name: 'Dr. David Kim', specialty: 'Orthopedics', status: 'On Call / Off Duty', room: 'Staff Lounge', badge: 'slate' },
];

/* 7-Day Census Trend Demo Data */
const DEMO_TREND_DAYS = [
  { day: 'Mon', admitted: 42, discharged: 38, pctIn: 75, pctOut: 68 },
  { day: 'Tue', admitted: 48, discharged: 41, pctIn: 85, pctOut: 73 },
  { day: 'Wed', admitted: 51, discharged: 44, pctIn: 91, pctOut: 78 },
  { day: 'Thu', admitted: 45, discharged: 46, pctIn: 80, pctOut: 82 },
  { day: 'Fri', admitted: 56, discharged: 49, pctIn: 98, pctOut: 87 },
  { day: 'Sat', admitted: 38, discharged: 35, pctIn: 68, pctOut: 62 },
  { day: 'Sun', admitted: 44, discharged: 36, pctIn: 78, pctOut: 64 },
];

export default function HospOverviewTab() {
  const { hospitalId } = useHospitalAuthStore();
  const isDemo = hospitalId === 1;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apptFilter, setApptFilter] = useState<'ALL' | 'IN_CONSULTATION' | 'CHECKED_IN' | 'SCHEDULED'>('ALL');

  const loadData = () => {
    setLoading(true);
    setError('');
    getHospitalDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const appointments = isDemo ? DEMO_APPOINTMENTS : [];
  const recentPatients = isDemo ? DEMO_PATIENTS : [];
  const wards = isDemo ? DEMO_WARDS : [];
  const doctors = isDemo ? DEMO_DOCTORS : [];
  const trendDays = isDemo ? DEMO_TREND_DAYS : [];

  const filteredAppts = appointments.filter(a => {
    if (apptFilter === 'ALL') return true;
    return a.status === apptFilter;
  });

  const totalPatients = isDemo
    ? (data ? Math.max(data.unique_patients_accessed * 4 + 1420, 1428) : 1428)
    : (data ? data.unique_patients_accessed : 0);
  const todayApptsCount = isDemo ? 68 : 0;
  const availableBedsText = isDemo ? '42' : '0';
  const totalBedsText = isDemo ? '/ 260 Total' : '/ 0 Total';
  const pendingBillingText = isDemo ? '$48,290' : '$0';

  return (
    <div className="hosp-overview-container">
      {/* Top operational banner */}
      <div className="hosp-section-head">
        <div>
          <h2 className="hosp-section-title">Hospital Operational Overview</h2>
          <p className="hosp-section-subtitle">
            Executive Inpatient & Outpatient Metrics · Live Census · Staffing & Scheduled Procedures
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} />
            <span>Shift: Day Rotation (08:00 - 20:00)</span>
          </span>
          <button
            className="hosp-btn-secondary"
            onClick={loadData}
            title="Refresh clinical metrics"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="hosp-banner hosp-banner--error" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={16} />
          <span>Could not sync live database metrics: {error}. Showing operational cache.</span>
        </div>
      )}

      {/* ── 4 KEY OVERVIEW STATS ── */}
      <div className="hosp-kpi-grid">
        {/* Total Inpatients & Patients */}
        <div className="hosp-stat-card">
          <div className="hosp-stat-header">
            <span className="hosp-stat-label">Total Census / Patients</span>
            <div className="hosp-stat-icon-wrapper">
              <Users size={16} />
            </div>
          </div>
          <div className="hosp-stat-number">{totalPatients.toLocaleString()}</div>
          <div className="hosp-stat-footer">
            {isDemo ? (
              <>
                <span className="hosp-stat-pill-pos">+4.2%</span>
                <span>48 admitted today · 36 discharges</span>
              </>
            ) : (
              <span>Unique patients accessed in EHR</span>
            )}
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="hosp-stat-card">
          <div className="hosp-stat-header">
            <span className="hosp-stat-label">Today's Appointments</span>
            <div className="hosp-stat-icon-wrapper">
              <Calendar size={16} />
            </div>
          </div>
          <div className="hosp-stat-number">{todayApptsCount}</div>
          <div className="hosp-stat-footer">
            {isDemo ? (
              <>
                <span style={{ color: '#0f766e', fontWeight: 600 }}>42 Checked In</span>
                <span>· 18 in consultation · 8 upcoming</span>
              </>
            ) : (
              <span>No scheduled outpatient appointments</span>
            )}
          </div>
        </div>

        {/* Available Beds & Occupancy */}
        <div className="hosp-stat-card">
          <div className="hosp-stat-header">
            <span className="hosp-stat-label">Available Beds</span>
            <div className="hosp-stat-icon-wrapper">
              <BedDouble size={16} />
            </div>
          </div>
          <div className="hosp-stat-number">
            {availableBedsText} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>{totalBedsText}</span>
          </div>
          <div className="hosp-stat-footer">
            {isDemo ? (
              <>
                <span className="hosp-stat-pill-warn">83.8% Occupied</span>
                <span>· 6 beds in sterilization</span>
              </>
            ) : (
              <span>No active inpatient bed assignments</span>
            )}
          </div>
        </div>

        {/* Billing & Pending Claims */}
        <div className="hosp-stat-card">
          <div className="hosp-stat-header">
            <span className="hosp-stat-label">Pending Billing & Claims</span>
            <div className="hosp-stat-icon-wrapper">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="hosp-stat-number">{pendingBillingText}</div>
          <div className="hosp-stat-footer">
            {isDemo ? (
              <span>19 claims in adjudicating · 94% approval</span>
            ) : (
              <span>0 pending insurance claims</span>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 1: SCHEDULE (2fr) + BED OCCUPANCY (1fr) ── */}
      <div className="hosp-layout-2col">
        {/* Appointment Schedule Panel */}
        <div className="hosp-panel">
          <div className="hosp-panel-header">
            <h3 className="hosp-panel-title">
              <Calendar size={16} style={{ color: '#0f766e' }} />
              <span>Today's Master Appointment Schedule</span>
            </h3>

            {/* Filter pills */}
            <div className="hosp-panel-actions">
              <div style={{ display: 'inline-flex', background: 'var(--hosp-surface-subtle)', borderRadius: '4px', padding: '2px', border: '1px solid var(--hosp-border)' }}>
                <button
                  type="button"
                  onClick={() => setApptFilter('ALL')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    background: apptFilter === 'ALL' ? 'var(--hosp-surface)' : 'transparent',
                    color: apptFilter === 'ALL' ? 'var(--hosp-text-main)' : 'var(--hosp-text-muted)',
                    boxShadow: apptFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  All ({appointments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setApptFilter('IN_CONSULTATION')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    background: apptFilter === 'IN_CONSULTATION' ? 'var(--hosp-surface)' : 'transparent',
                    color: apptFilter === 'IN_CONSULTATION' ? 'var(--hosp-text-main)' : 'var(--hosp-text-muted)',
                    boxShadow: apptFilter === 'IN_CONSULTATION' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  In Consult
                </button>
                <button
                  type="button"
                  onClick={() => setApptFilter('CHECKED_IN')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    background: apptFilter === 'CHECKED_IN' ? 'var(--hosp-surface)' : 'transparent',
                    color: apptFilter === 'CHECKED_IN' ? 'var(--hosp-text-main)' : 'var(--hosp-text-muted)',
                    boxShadow: apptFilter === 'CHECKED_IN' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  Checked In
                </button>
                <button
                  type="button"
                  onClick={() => setApptFilter('SCHEDULED')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    background: apptFilter === 'SCHEDULED' ? 'var(--hosp-surface)' : 'transparent',
                    color: apptFilter === 'SCHEDULED' ? 'var(--hosp-text-main)' : 'var(--hosp-text-muted)',
                    boxShadow: apptFilter === 'SCHEDULED' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  Upcoming
                </button>
              </div>
            </div>
          </div>

          <div className="hosp-table-wrap">
            <table className="hosp-table">
              <thead>
                <tr>
                  <th>Slot / Time</th>
                  <th>Patient Name & MRN</th>
                  <th>Attending Physician</th>
                  <th>Department / Room</th>
                  <th>Consult Type</th>
                  <th>Clinical Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                      <Calendar size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                      <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No Scheduled Appointments</div>
                      <div style={{ fontSize: '0.75rem' }}>Outpatient appointments booked for today will appear here in real time.</div>
                    </td>
                  </tr>
                ) : (
                  filteredAppts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'var(--font-hosp-mono)', fontWeight: 600, color: 'var(--hosp-text-main)' }}>
                        {a.time}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)' }}>{a.patient}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-hosp-mono)' }}>{a.mrn}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{a.doctor}</td>
                      <td>
                        <div>{a.dept}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{a.room}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--hosp-text-secondary)' }}>{a.type}</span>
                      </td>
                      <td>
                        {a.status === 'IN_CONSULTATION' && (
                          <span className="hosp-badge hosp-badge--amber">
                            <Activity size={10} className="animate-pulse" />
                            <span>In Consultation</span>
                          </span>
                        )}
                        {a.status === 'CHECKED_IN' && (
                          <span className="hosp-badge hosp-badge--green">
                            <CheckCircle2 size={10} />
                            <span>Checked In</span>
                          </span>
                        )}
                        {a.status === 'SCHEDULED' && (
                          <span className="hosp-badge hosp-badge--blue">
                            <Clock size={10} />
                            <span>Scheduled</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bed & Ward Occupancy Panel */}
        <div className="hosp-panel">
          <div className="hosp-panel-header">
            <h3 className="hosp-panel-title">
              <BedDouble size={16} style={{ color: '#0f766e' }} />
              <span>Ward & Bed Occupancy</span>
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {isDemo ? '218 / 260 Occupied' : '0 / 0 Occupied'}
            </span>
          </div>

          <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {wards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                <BedDouble size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No Active Inpatient Wards</div>
                <div style={{ fontSize: '0.75rem' }}>Ward bed capacities and occupancy will display once configured.</div>
              </div>
            ) : (
              wards.map((w) => (
                <div key={w.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--hosp-text-main)' }}>{w.name}</span>
                    <span style={{ fontFamily: 'var(--font-hosp-mono)', color: 'var(--hosp-text-secondary)' }}>
                      <strong>{w.occupied}</strong> / {w.total} ({w.pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="hosp-progress-bar">
                    <div
                      className="hosp-progress-fill"
                      style={{
                        width: `${w.pct}%`,
                        backgroundColor: w.color,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b' }}>
                    <span>{w.status}</span>
                    <span>{w.total - w.occupied} beds available</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: RECENT INPATIENTS (2fr) + DOCTORS ROSTER (1fr) ── */}
      <div className="hosp-layout-2col">
        {/* Recent Patients Table */}
        <div className="hosp-panel">
          <div className="hosp-panel-header">
            <h3 className="hosp-panel-title">
              <Users size={16} style={{ color: '#0f766e' }} />
              <span>Recent Inpatient Admissions & Triage</span>
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Live EHR Feed</span>
          </div>

          <div className="hosp-table-wrap">
            <table className="hosp-table">
              <thead>
                <tr>
                  <th>Patient MRN & Name</th>
                  <th>Demographics</th>
                  <th>Admitted Date</th>
                  <th>Ward & Bed</th>
                  <th>Primary Doctor</th>
                  <th>Triage / Condition</th>
                </tr>
              </thead>
              <tbody>
                {recentPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                      <Users size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                      <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No Inpatients Admitted</div>
                      <div style={{ fontSize: '0.75rem' }}>Patients currently admitted to wards will be listed here in real time.</div>
                    </td>
                  </tr>
                ) : (
                  recentPatients.map((p) => (
                    <tr key={p.mrn}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-hosp-mono)' }}>{p.mrn}</div>
                      </td>
                      <td>{p.age}</td>
                      <td>{p.admitted}</td>
                      <td style={{ fontWeight: 500 }}>{p.ward}</td>
                      <td>{p.doctor}</td>
                      <td>
                        <span className={`hosp-badge hosp-badge--${p.badge}`}>
                          {p.condition}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Doctor Availability Panel */}
        <div className="hosp-panel">
          <div className="hosp-panel-header">
            <h3 className="hosp-panel-title">
              <Stethoscope size={16} style={{ color: '#0f766e' }} />
              <span>Physician On-Duty Roster</span>
            </h3>
            <span style={{ fontSize: '0.72rem', color: isDemo ? '#059669' : '#64748b', fontWeight: 600 }}>
              {isDemo ? '5 Active On Shift' : '0 Active On Shift'}
            </span>
          </div>

          <div style={{ padding: '0.5rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {doctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <Stethoscope size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No On-Duty Physicians</div>
                <div style={{ fontSize: '0.75rem' }}>Affiliate doctors in the Doctors tab to manage clinical shifts.</div>
              </div>
            ) : (
              doctors.map((doc) => (
                <div
                  key={doc.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--hosp-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--hosp-text-main)' }}>{doc.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{doc.specialty} · {doc.room}</div>
                  </div>
                  <span className={`hosp-badge hosp-badge--${doc.badge}`}>
                    {doc.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 3: MEANINGFUL CLINICAL TRENDS + AUDIT LOG ── */}
      <div className="hosp-layout-2col">
        {/* 7-Day Patient Admissions vs Outflow */}
        <div className="hosp-panel">
          <div className="hosp-panel-header">
            <h3 className="hosp-panel-title">
              <TrendingUp size={16} style={{ color: '#0f766e' }} />
              <span>7-Day Inpatient Inflow & Outflow Trends</span>
            </h3>
            {isDemo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.7rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', background: 'var(--hosp-accent)', borderRadius: '2px' }} />
                  <span>Admissions (324 total)</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }} />
                  <span>Discharges (291 total)</span>
                </span>
              </div>
            )}
          </div>

          <div className="hosp-chart-box">
            {trendDays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                <TrendingUp size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No Census Trend History</div>
                <div style={{ fontSize: '0.75rem' }}>7-day admission and discharge analytics will populate as admissions occur.</div>
              </div>
            ) : (
              trendDays.map((d) => (
                <div key={d.day} className="hosp-bar-row">
                  <span className="hosp-bar-day">{d.day}</span>
                  <div className="hosp-bar-track">
                    <div className="hosp-bar-inflow" style={{ width: `${d.pctIn}%` }} title={`Admitted: ${d.admitted}`} />
                    <div className="hosp-bar-outflow" style={{ width: `${d.pctOut}%` }} title={`Discharged: ${d.discharged}`} />
                  </div>
                  <span className="hosp-bar-count">+{d.admitted} / -{d.discharged}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Clinical Audit Activity Feed */}
        <div className="hosp-panel">
          <div className="hosp-panel-header">
            <h3 className="hosp-panel-title">
              <ShieldCheck size={16} style={{ color: '#0f766e' }} />
              <span>Clinical Audit & Access Trail</span>
            </h3>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>HIPAA Verifiable</span>
          </div>

          <ul className="hosp-feed-timeline">
            {data && data.recent_activity && data.recent_activity.length > 0 ? (
              data.recent_activity.slice(0, 5).map((act, i) => (
                <li key={i} className="hosp-timeline-item">
                  <span
                    className="hosp-timeline-dot"
                    style={{
                      backgroundColor: act.action === 'LOOKUP' ? '#0284c7' : act.action.includes('PRESC') ? '#d97706' : '#059669',
                    }}
                  />
                  <div className="hosp-timeline-content">
                    <span className="hosp-timeline-title">{actionLabel(act.action)}</span>
                    <span className="hosp-timeline-detail">{act.details || 'Access logged to institutional ledger'}</span>
                    <span className="hosp-timeline-time">{formatTime(act.created_at)}</span>
                  </div>
                </li>
              ))
            ) : isDemo ? (
              <>
                <li className="hosp-timeline-item">
                  <span className="hosp-timeline-dot" style={{ backgroundColor: '#0284c7' }} />
                  <div className="hosp-timeline-content">
                    <span className="hosp-timeline-title">EHR Record Queried for RXF-P-8821</span>
                    <span className="hosp-timeline-detail">Reviewed pre-op labs & echocardiogram by Cardiology</span>
                    <span className="hosp-timeline-time">10 mins ago</span>
                  </div>
                </li>
                <li className="hosp-timeline-item">
                  <span className="hosp-timeline-dot" style={{ backgroundColor: '#059669' }} />
                  <div className="hosp-timeline-content">
                    <span className="hosp-timeline-title">Inpatient Admission Authorized</span>
                    <span className="hosp-timeline-detail">Patient assigned to ICU Bed 04 under Dr. Sarah Chen</span>
                    <span className="hosp-timeline-time">24 mins ago</span>
                  </div>
                </li>
                <li className="hosp-timeline-item">
                  <span className="hosp-timeline-dot" style={{ backgroundColor: '#d97706' }} />
                  <div className="hosp-timeline-content">
                    <span className="hosp-timeline-title">Central Pharmacy Order Dispatched</span>
                    <span className="hosp-timeline-detail">IV Antibiotic bundle fulfilled for Surgical Unit</span>
                    <span className="hosp-timeline-time">45 mins ago</span>
                  </div>
                </li>
              </>
            ) : (
              <li style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <ShieldCheck size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No Audit Logs Recorded</div>
                <div style={{ fontSize: '0.75rem' }}>EHR lookups, prescription views, and patient queries will be logged immutably here.</div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
