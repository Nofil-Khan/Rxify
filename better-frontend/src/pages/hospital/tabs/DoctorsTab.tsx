import React, { useEffect, useState } from 'react';
import {
  Users, Stethoscope, Plus, Trash2, CheckCircle2, AlertCircle,
  RefreshCw, Search, ShieldCheck, Camera
} from 'lucide-react';
import {
  fetchHospitalDoctors,
  affiliateDoctorToHospital,
  removeDoctorAffiliation,
  type HospitalDoctor
} from '../../../lib/hospitalApi';

interface DoctorsTabProps {
  onScanDoctorClick?: () => void;
}

export default function DoctorsTab({ onScanDoctorClick }: DoctorsTabProps) {
  const [doctors, setDoctors] = useState<HospitalDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Add affiliation modal */
  const [showAddModal, setShowAddModal] = useState(false);
  const [doctorIdentifier, setDoctorIdentifier] = useState('');
  const [department, setDepartment] = useState('General Medicine');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHospitalDoctors();
      setDoctors(res.doctors || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load affiliated doctors roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorIdentifier.trim()) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await affiliateDoctorToHospital(doctorIdentifier.trim(), department);
      setActionSuccess('Doctor successfully affiliated with hospital!');
      setDoctorIdentifier('');
      loadDoctors();
      setTimeout(() => {
        setShowAddModal(false);
        setActionSuccess(null);
      }, 1500);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to affiliate doctor.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (doctorId: number, name: string) => {
    if (!window.confirm(`Remove affiliation for Dr. ${name}?`)) return;
    try {
      await removeDoctorAffiliation(doctorId);
      loadDoctors();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove doctor.');
    }
  };

  return (
    <div className="hd-doctors-container">
      {/* Header Bar */}
      <div className="hd-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Affiliated Doctors Roster</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
            Physicians accredited to practice and consult under this hospital.
          </p>
        </div>

        <div className="hosp-action-row">
          {onScanDoctorClick && (
            <button
              className="rx-scan-action-btn"
              onClick={onScanDoctorClick}
              title="Scan Doctor QR Code"
            >
              <Camera size={15} />
              <span>Scan Doctor QR</span>
            </button>
          )}
          <button
            className="rx-btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ borderRadius: '9999px', padding: '0.4rem 1rem' }}
          >
            <Plus size={16} />
            <span>Affiliate Doctor</span>
          </button>
        </div>
      </div>

      {/* Loading & Error */}
      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
          <p>Loading clinical roster...</p>
        </div>
      )}

      {error && (
        <div className="rx-action-alert rx-action-alert--error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Roster Grid */}
      {!loading && doctors.length === 0 && !error && (
        <div style={{ padding: '4rem 1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Stethoscope size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
          <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 600 }}>No Affiliated Doctors Yet</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Accredit doctors by their Doctor Code (RXF-D-X) or scan their Doctor QR code.
          </p>
          <button className="rx-btn-primary" onClick={() => setShowAddModal(true)}>
            Affiliate First Doctor
          </button>
        </div>
      )}

      {!loading && doctors.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {doctors.map((doc) => (
            <div
              key={doc.doctor_id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Stethoscope size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Dr. {doc.full_name}</h4>
                      <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>{doc.specialization || 'General'}</span>
                    </div>
                  </div>
                  <span className="rx-role-pill" style={{ margin: 0, fontSize: '0.65rem' }}>
                    {doc.doctor_code || `RXF-D-${doc.doctor_id}`}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.3rem', margin: '0.75rem 0' }}>
                  <div><strong>Department:</strong> {doc.department || 'General Practice'}</div>
                  <div><strong>Contact:</strong> {doc.email}</div>
                  <div><strong>Active Patients:</strong> {doc.active_patients_count || 0}</div>
                  <div><strong>Accredited Since:</strong> {doc.joined_at ? new Date(doc.joined_at).toLocaleDateString() : 'Active'}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  onClick={() => handleRemove(doc.doctor_id, doc.full_name)}
                >
                  <Trash2 size={13} />
                  <span>Remove Affiliation</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Affiliate Doctor Modal */}
      {showAddModal && (
        <div className="rx-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="rx-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rx-modal-header">
              <div>
                <h3 className="rx-modal-title">Affiliate Doctor to Hospital</h3>
                <p className="rx-modal-subtitle">Add a physician to your clinical roster and schedule slots.</p>
              </div>
              <button className="rx-modal-close" onClick={() => setShowAddModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleAffiliate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label className="rx-form-label">Doctor Code or Numeric ID</label>
                <input
                  type="text"
                  className="rx-form-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. RXF-D-1 or 1"
                  value={doctorIdentifier}
                  onChange={(e) => setDoctorIdentifier(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="rx-form-label">Department / Wing</label>
                <select
                  className="rx-form-input"
                  style={{ width: '100%', background: '#0f172a' }}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="General Medicine">General Medicine</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Emergency & Trauma">Emergency & Trauma</option>
                </select>
              </div>

              {actionError && (
                <div className="rx-action-alert rx-action-alert--error">
                  <AlertCircle size={15} />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="rx-action-alert rx-action-alert--success">
                  <CheckCircle2 size={15} />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="rx-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rx-btn-primary"
                  style={{ flex: 1 }}
                  disabled={actionLoading || Boolean(actionSuccess)}
                >
                  {actionLoading ? 'Accrediting...' : 'Confirm Affiliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
