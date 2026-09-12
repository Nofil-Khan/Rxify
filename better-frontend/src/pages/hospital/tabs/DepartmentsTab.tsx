import { useState } from 'react';
import {
  Building2, Users, Stethoscope, BedDouble, AlertCircle,
  CheckCircle2, Plus, Phone, Mail, ChevronRight
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  hod: string;
  location: string;
  doctorsCount: number;
  nursingStaff: number;
  totalBeds: number;
  occupiedBeds: number;
  activeCases: number;
  phone: string;
  status: 'FULL_SERVICE' | 'LIMITED_CAPACITY' | 'CRITICAL_LOAD';
}

const DEPARTMENTS: Department[] = [
  { id: 'DEP-EMG', name: 'Emergency & Trauma Center', hod: 'Dr. Marcus Vance, MD', location: 'Ground Floor, Wing A', doctorsCount: 14, nursingStaff: 32, totalBeds: 25, occupiedBeds: 22, activeCases: 48, phone: 'Ext. 101', status: 'CRITICAL_LOAD' },
  { id: 'DEP-CRD', name: 'Cardiology & Catheterization', hod: 'Dr. Sarah Chen, FACC', location: '2nd Floor, Wing B', doctorsCount: 9, nursingStaff: 24, totalBeds: 35, occupiedBeds: 32, activeCases: 39, phone: 'Ext. 204', status: 'LIMITED_CAPACITY' },
  { id: 'DEP-INT', name: 'Internal Medicine', hod: 'Dr. Emily Rodriguez, MD', location: '1st Floor, Main Wing', doctorsCount: 18, nursingStaff: 40, totalBeds: 70, occupiedBeds: 58, activeCases: 76, phone: 'Ext. 108', status: 'FULL_SERVICE' },
  { id: 'DEP-PED', name: 'Pediatrics & Neonatology', hod: 'Dr. Jonathan Hayes, FAAP', location: '3rd Floor, West Wing', doctorsCount: 8, nursingStaff: 20, totalBeds: 30, occupiedBeds: 21, activeCases: 29, phone: 'Ext. 312', status: 'FULL_SERVICE' },
  { id: 'DEP-NEU', name: 'Neurology & Neurosurgery', hod: 'Dr. Priya Patel, MD', location: '4th Floor, Suite 400', doctorsCount: 6, nursingStaff: 16, totalBeds: 20, occupiedBeds: 15, activeCases: 22, phone: 'Ext. 401', status: 'FULL_SERVICE' },
  { id: 'DEP-ORT', name: 'Orthopedics & Sports Rehab', hod: 'Dr. David Kim, FAAOS', location: '1st Floor, Wing C', doctorsCount: 7, nursingStaff: 18, totalBeds: 25, occupiedBeds: 19, activeCases: 31, phone: 'Ext. 192', status: 'FULL_SERVICE' },
  { id: 'DEP-ICU', name: 'Critical Care (ICU / CCU)', hod: 'Dr. Alan Ross, FCCM', location: '2nd Floor, Central Block', doctorsCount: 11, nursingStaff: 36, totalBeds: 35, occupiedBeds: 32, activeCases: 32, phone: 'Ext. 220', status: 'CRITICAL_LOAD' },
  { id: 'DEP-ONC', name: 'Oncology & Infusion Center', hod: 'Dr. Elena Rostova, MD', location: '5th Floor, East Pavilion', doctorsCount: 5, nursingStaff: 14, totalBeds: 20, occupiedBeds: 14, activeCases: 28, phone: 'Ext. 510', status: 'FULL_SERVICE' },
];

export default function DepartmentsTab() {
  const [list] = useState<Department[]>(DEPARTMENTS);

  return (
    <div>
      <div className="hosp-section-head">
        <div>
          <h2 className="hosp-section-title">Clinical Departments & Specialty Wards</h2>
          <p className="hosp-section-subtitle">
            Department Leadership, Staffing Capacity, Inpatient Bed Utilization and Ward Status
          </p>
        </div>

        <button className="hosp-btn-primary">
          <Plus size={15} />
          <span>New Department Unit</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {list.map((dept) => {
          const occupancyPct = ((dept.occupiedBeds / dept.totalBeds) * 100).toFixed(0);
          return (
            <div
              key={dept.id}
              style={{
                background: 'var(--hosp-surface)',
                border: '1px solid var(--hosp-border)',
                borderRadius: 'var(--hosp-radius-md)',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.85rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--hosp-text-main)' }}>
                    {dept.name}
                  </h3>
                  {dept.status === 'CRITICAL_LOAD' && (
                    <span className="hosp-badge hosp-badge--red">Critical Load</span>
                  )}
                  {dept.status === 'LIMITED_CAPACITY' && (
                    <span className="hosp-badge hosp-badge--amber">Near Capacity</span>
                  )}
                  {dept.status === 'FULL_SERVICE' && (
                    <span className="hosp-badge hosp-badge--green">Operational</span>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  HOD: <strong style={{ color: 'var(--hosp-text-main)' }}>{dept.hod}</strong> · {dept.location}
                </div>

                {/* Metric Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'var(--hosp-surface-subtle)', padding: '0.65rem', borderRadius: 'var(--hosp-radius)', border: '1px solid var(--hosp-border)' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Physicians</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--hosp-text-main)' }}>{dept.doctorsCount}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Nurses</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--hosp-text-main)' }}>{dept.nursingStaff}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Active Census</span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f766e' }}>{dept.activeCases}</strong>
                  </div>
                </div>

                {/* Bed occupancy bar */}
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Bed Occupancy</span>
                    <span style={{ fontWeight: 600 }}>{dept.occupiedBeds} / {dept.totalBeds} ({occupancyPct}%)</span>
                  </div>
                  <div className="hosp-progress-bar">
                    <div
                      className="hosp-progress-fill"
                      style={{
                        width: `${occupancyPct}%`,
                        backgroundColor: Number(occupancyPct) > 85 ? '#ef4444' : '#0f766e',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--hosp-border)', paddingTop: '0.6rem', fontSize: '0.72rem', color: '#64748b' }}>
                <span>Contact: {dept.phone}</span>
                <button className="hosp-btn-secondary" style={{ fontSize: '0.72rem' }}>
                  Manage Roster
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
