import { useState } from 'react';
import {
  Calendar, Clock, Search, Filter, Plus, CheckCircle2,
  AlertCircle, ChevronRight, User, Phone, MapPin, Check
} from 'lucide-react';

interface Appointment {
  id: string;
  time: string;
  patient: string;
  mrn: string;
  doctor: string;
  department: string;
  room: string;
  type: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED';
  phone: string;
  notes: string;
}

const INITIAL_APPOINTMENTS: Appointment[] = [
  { id: 'APT-2001', time: '09:00 AM', patient: 'Eleanor Vance', mrn: 'RXF-P-8821', doctor: 'Dr. Sarah Chen', department: 'Cardiology', room: 'Suite 204', type: 'Post-Op Review', status: 'IN_CONSULTATION', phone: '+1 (555) 301-4491', notes: 'Review echocardiogram and titration of beta blockers' },
  { id: 'APT-2002', time: '09:15 AM', patient: 'Liam O’Connor', mrn: 'RXF-P-3319', doctor: 'Dr. Marcus Vance', department: 'Emergency Medicine', room: 'Bay 3', type: 'Urgent Triage', status: 'IN_CONSULTATION', phone: '+1 (555) 902-1823', notes: 'Closed radius fracture evaluation' },
  { id: 'APT-2003', time: '09:30 AM', patient: 'Sofia Reyes', mrn: 'RXF-P-9022', doctor: 'Dr. Emily Rodriguez', department: 'Internal Medicine', room: 'Room 108', type: 'Routine Follow-up', status: 'CHECKED_IN', phone: '+1 (555) 441-2091', notes: 'HbA1c quarterly monitoring and fasting blood sugar' },
  { id: 'APT-2004', time: '10:00 AM', patient: 'Arthur Pendelton', mrn: 'RXF-P-4451', doctor: 'Dr. Jonathan Hayes', department: 'Pediatrics', room: 'Wing C-12', type: 'Allergy Evaluation', status: 'CHECKED_IN', phone: '+1 (555) 671-8890', notes: 'Peanut exposure allergy skin prick follow-up' },
  { id: 'APT-2005', time: '10:15 AM', patient: 'Devin Brooks', mrn: 'RXF-P-1104', doctor: 'Dr. Priya Patel', department: 'Neurology', room: 'Suite 310', type: 'Migraine Consult', status: 'SCHEDULED', phone: '+1 (555) 819-2041', notes: 'Refractory aura migraine treatment trial' },
  { id: 'APT-2006', time: '10:45 AM', patient: 'Grace Mitchell', mrn: 'RXF-P-7819', doctor: 'Dr. David Kim', department: 'Orthopedics', room: 'Room 102', type: 'Cast Removal', status: 'SCHEDULED', phone: '+1 (555) 991-7722', notes: 'Week 6 distal tibia radiograph evaluation' },
  { id: 'APT-2007', time: '11:15 AM', patient: 'Henry Zhao', mrn: 'RXF-P-6623', doctor: 'Dr. Sarah Chen', department: 'Cardiology', room: 'Suite 204', type: 'Holter Monitoring', status: 'SCHEDULED', phone: '+1 (555) 123-9901', notes: '24-hr continuous ECG device hookup' },
  { id: 'APT-2008', time: '11:45 AM', patient: 'Claire Dunphy', mrn: 'RXF-P-5501', doctor: 'Dr. Emily Rodriguez', department: 'Internal Medicine', room: 'Room 108', type: 'Thyroid Ultrasound', status: 'SCHEDULED', phone: '+1 (555) 882-3310', notes: 'Thyroid nodule biopsy result consultation' },
];

export default function AppointmentsTab() {
  const [list, setList] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = list.filter((a) => {
    const matchSearch =
      a.patient.toLowerCase().includes(search.toLowerCase()) ||
      a.mrn.toLowerCase().includes(search.toLowerCase()) ||
      a.doctor.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'ALL' || a.department === deptFilter;
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const checkIn = (id: string) => {
    setList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'CHECKED_IN' as const } : item
      )
    );
  };

  const completeAppt = (id: string) => {
    setList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'COMPLETED' as const } : item
      )
    );
  };

  return (
    <div>
      <div className="hosp-section-head">
        <div>
          <h2 className="hosp-section-title">Master Appointment Schedule</h2>
          <p className="hosp-section-subtitle">
            Live Central Reception & Department Scheduling · Patient Check-in and Clinic Queue
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="hosp-btn-primary">
            <Plus size={15} />
            <span>Book New Appointment</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="hosp-panel" style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
          <input
            type="text"
            className="hosp-text-input"
            placeholder="Search patient, MRN, doctor or appt ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="hosp-text-input"
          style={{ width: 'auto', paddingLeft: '10px', cursor: 'pointer' }}
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="ALL">All Departments</option>
          <option value="Cardiology">Cardiology</option>
          <option value="Emergency Medicine">Emergency</option>
          <option value="Internal Medicine">Internal Medicine</option>
          <option value="Pediatrics">Pediatrics</option>
          <option value="Neurology">Neurology</option>
          <option value="Orthopedics">Orthopedics</option>
        </select>

        <select
          className="hosp-text-input"
          style={{ width: 'auto', paddingLeft: '10px', cursor: 'pointer' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="IN_CONSULTATION">In Consultation</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {/* Appointments Table */}
      <div className="hosp-panel">
        <div className="hosp-table-wrap">
          <table className="hosp-table">
            <thead>
              <tr>
                <th>Appt ID & Time</th>
                <th>Patient Details</th>
                <th>Physician & Dept</th>
                <th>Location</th>
                <th>Type & Clinical Notes</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No appointments match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontFamily: 'var(--font-hosp-mono)', fontWeight: 600, color: 'var(--hosp-text-main)' }}>
                        {a.time}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'var(--font-hosp-mono)' }}>
                        {a.id}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)' }}>{a.patient}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{a.mrn} · {a.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.doctor}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{a.department}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{a.room}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.78rem' }}>{a.type}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', maxWidth: '240px' }} title={a.notes}>
                        {a.notes}
                      </div>
                    </td>
                    <td>
                      {a.status === 'IN_CONSULTATION' && (
                        <span className="hosp-badge hosp-badge--amber">In Consultation</span>
                      )}
                      {a.status === 'CHECKED_IN' && (
                        <span className="hosp-badge hosp-badge--green">Checked In</span>
                      )}
                      {a.status === 'SCHEDULED' && (
                        <span className="hosp-badge hosp-badge--blue">Scheduled</span>
                      )}
                      {a.status === 'COMPLETED' && (
                        <span className="hosp-badge hosp-badge--slate">Completed</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {a.status === 'SCHEDULED' && (
                        <button
                          className="hosp-btn-secondary"
                          onClick={() => checkIn(a.id)}
                          title="Patient has arrived at clinic"
                        >
                          <Check size={12} />
                          <span>Check In</span>
                        </button>
                      )}
                      {a.status === 'IN_CONSULTATION' && (
                        <button
                          className="hosp-btn-secondary"
                          onClick={() => completeAppt(a.id)}
                        >
                          <CheckCircle2 size={12} />
                          <span>Complete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
