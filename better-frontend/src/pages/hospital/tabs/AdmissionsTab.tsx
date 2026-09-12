import { useState } from 'react';
import {
  BedDouble, Users, AlertCircle, CheckCircle2,
  Clock, Filter, Search, ArrowRight, UserPlus, LogOut
} from 'lucide-react';

interface Bed {
  id: string;
  room: string;
  ward: string;
  status: 'OCCUPIED' | 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE';
  patient?: string;
  mrn?: string;
  admitted?: string;
  doctor?: string;
}

const BEDS_DATA: Bed[] = [
  { id: 'ICU-01', room: 'Room 101', ward: 'Intensive Care Unit (ICU)', status: 'OCCUPIED', patient: 'Eleanor Vance', mrn: 'RXF-P-8821', admitted: 'Sep 10', doctor: 'Dr. Sarah Chen' },
  { id: 'ICU-02', room: 'Room 102', ward: 'Intensive Care Unit (ICU)', status: 'OCCUPIED', patient: 'James Sterling', mrn: 'RXF-P-4402', admitted: 'Sep 09', doctor: 'Dr. Marcus Vance' },
  { id: 'ICU-03', room: 'Room 103', ward: 'Intensive Care Unit (ICU)', status: 'CLEANING' },
  { id: 'ICU-04', room: 'Room 104', ward: 'Intensive Care Unit (ICU)', status: 'AVAILABLE' },
  { id: 'CCU-01', room: 'Suite 201', ward: 'Cardiac Care Unit (CCU)', status: 'OCCUPIED', patient: 'Martha Jenkins', mrn: 'RXF-P-6120', admitted: 'Sep 09', doctor: 'Dr. Sarah Chen' },
  { id: 'CCU-02', room: 'Suite 202', ward: 'Cardiac Care Unit (CCU)', status: 'OCCUPIED', patient: 'Carlos Morales', mrn: 'RXF-P-1920', admitted: 'Sep 11', doctor: 'Dr. Sarah Chen' },
  { id: 'SURG-01', room: 'Wing S-01', ward: 'Surgical Post-Op', status: 'OCCUPIED', patient: 'Devin Brooks', mrn: 'RXF-P-1104', admitted: 'Sep 11', doctor: 'Dr. David Kim' },
  { id: 'SURG-02', room: 'Wing S-02', ward: 'Surgical Post-Op', status: 'AVAILABLE' },
  { id: 'SURG-03', room: 'Wing S-03', ward: 'Surgical Post-Op', status: 'AVAILABLE' },
  { id: 'GEN-101', room: 'Ward 3B', ward: 'General Inpatient', status: 'OCCUPIED', patient: 'Sofia Reyes', mrn: 'RXF-P-9022', admitted: 'Sep 11', doctor: 'Dr. Emily Rodriguez' },
  { id: 'GEN-102', room: 'Ward 3B', ward: 'General Inpatient', status: 'OCCUPIED', patient: 'Robert Blake', mrn: 'RXF-P-5519', admitted: 'Sep 08', doctor: 'Dr. Emily Rodriguez' },
  { id: 'GEN-103', room: 'Ward 3B', ward: 'General Inpatient', status: 'AVAILABLE' },
  { id: 'PEDS-01', room: 'Ward C', ward: 'Pediatrics Unit', status: 'OCCUPIED', patient: 'Arthur Pendelton', mrn: 'RXF-P-4451', admitted: 'Sep 11', doctor: 'Dr. Jonathan Hayes' },
  { id: 'PEDS-02', room: 'Ward C', ward: 'Pediatrics Unit', status: 'AVAILABLE' },
];

export default function AdmissionsTab() {
  const [beds, setBeds] = useState<Bed[]>(BEDS_DATA);
  const [wardFilter, setWardFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filtered = beds.filter((b) => {
    const matchWard = wardFilter === 'ALL' || b.ward === wardFilter;
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      (b.patient && b.patient.toLowerCase().includes(search.toLowerCase())) ||
      (b.mrn && b.mrn.toLowerCase().includes(search.toLowerCase()));
    return matchWard && matchStatus && matchSearch;
  });

  const occupiedCount = beds.filter((b) => b.status === 'OCCUPIED').length;
  const availableCount = beds.filter((b) => b.status === 'AVAILABLE').length;
  const cleaningCount = beds.filter((b) => b.status === 'CLEANING').length;

  return (
    <div>
      <div className="hosp-section-head">
        <div>
          <h2 className="hosp-section-title">Inpatient Admissions & Bed Roster</h2>
          <p className="hosp-section-subtitle">
            Real-Time Bed Occupancy Tracking, Ward Allocation, and Discharge Coordination
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="hosp-btn-primary">
            <UserPlus size={15} />
            <span>Admit Inpatient</span>
          </button>
        </div>
      </div>

      {/* Bed Stats Bar */}
      <div className="hosp-kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Total Occupied Beds</span>
          <div className="hosp-stat-number">{occupiedCount} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>/ {beds.length}</span></div>
          <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>
            {((occupiedCount / beds.length) * 100).toFixed(1)}% Census Rate
          </span>
        </div>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Ready for Admission</span>
          <div className="hosp-stat-number" style={{ color: '#059669' }}>{availableCount}</div>
          <span style={{ fontSize: '0.72rem', color: '#059669' }}>Immediate bed turnover</span>
        </div>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Sterilization & Cleaning</span>
          <div className="hosp-stat-number" style={{ color: '#0284c7' }}>{cleaningCount}</div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Avg turn: 35 mins</span>
        </div>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Pending Discharges Today</span>
          <div className="hosp-stat-number">4</div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Awaiting pharmacy packet</span>
        </div>
      </div>

      {/* Filters */}
      <div className="hosp-panel" style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
          <input
            type="text"
            className="hosp-text-input"
            placeholder="Search bed ID, patient or MRN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="hosp-text-input"
          style={{ width: 'auto', paddingLeft: '10px', cursor: 'pointer' }}
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
        >
          <option value="ALL">All Wards</option>
          <option value="Intensive Care Unit (ICU)">Intensive Care (ICU)</option>
          <option value="Cardiac Care Unit (CCU)">Cardiac Care (CCU)</option>
          <option value="Surgical Post-Op">Surgical Post-Op</option>
          <option value="General Inpatient">General Inpatient</option>
          <option value="Pediatrics Unit">Pediatrics Unit</option>
        </select>

        <select
          className="hosp-text-input"
          style={{ width: 'auto', paddingLeft: '10px', cursor: 'pointer' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="AVAILABLE">Available</option>
          <option value="CLEANING">Cleaning</option>
        </select>
      </div>

      {/* Bed Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
        {filtered.map((b) => (
          <div
            key={b.id}
            style={{
              background: 'var(--hosp-surface)',
              border: '1px solid var(--hosp-border)',
              borderRadius: 'var(--hosp-radius)',
              padding: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.6rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-hosp-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--hosp-text-main)' }}>
                    {b.id}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{b.room} · {b.ward}</div>
                </div>

                {b.status === 'OCCUPIED' && <span className="hosp-badge hosp-badge--amber">Occupied</span>}
                {b.status === 'AVAILABLE' && <span className="hosp-badge hosp-badge--green">Available</span>}
                {b.status === 'CLEANING' && <span className="hosp-badge hosp-badge--blue">Cleaning</span>}
              </div>

              {b.patient ? (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: 'var(--hosp-surface-subtle)', borderRadius: '4px', border: '1px solid var(--hosp-border)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--hosp-text-main)' }}>{b.patient}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>MRN: {b.mrn} · Admitted: {b.admitted}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--hosp-text-secondary)', marginTop: '2px' }}>Attending: {b.doctor}</div>
                </div>
              ) : (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: 'var(--hosp-surface-subtle)', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                  {b.status === 'AVAILABLE' ? 'Ready for triage or admission assignment' : 'Sterilization in progress'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', borderTop: '1px solid var(--hosp-border)', paddingTop: '0.5rem' }}>
              {b.status === 'AVAILABLE' && (
                <button className="hosp-btn-secondary" style={{ fontSize: '0.72rem' }}>
                  Assign Patient
                </button>
              )}
              {b.status === 'OCCUPIED' && (
                <>
                  <button className="hosp-btn-secondary" style={{ fontSize: '0.72rem' }}>
                    Transfer
                  </button>
                  <button className="hosp-btn-secondary" style={{ fontSize: '0.72rem' }}>
                    Discharge
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
