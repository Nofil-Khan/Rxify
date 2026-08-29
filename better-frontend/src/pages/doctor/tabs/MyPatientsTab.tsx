import { useState, useEffect } from 'react';
import { Search, UserCheck, Calendar, FileText, Activity, Eye, ChevronRight } from 'lucide-react';
import { getMyPatients, getPatientPrescriptions, getInitials, PatientItem, PrescriptionItem } from '../../../lib/doctorApi';
import PrescriptionDetailModal from '../components/PrescriptionDetailModal';

export default function MyPatientsTab() {
  const [patients, setPatients]           = useState<PatientItem[]>([]);
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(true);
  const [activePatient, setActivePatient] = useState<PatientItem | null>(null);
  const [patientHistory, setPatientHistory] = useState<PrescriptionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedRx, setSelectedRx]       = useState<PrescriptionItem | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchPatients() {
      setLoading(true);
      const data = await getMyPatients();
      if (mounted) {
        setPatients(data ?? []);
        setLoading(false);
      }
    }
    fetchPatients();
    return () => { mounted = false; };
  }, []);

  const handleOpenHistory = async (patient: PatientItem) => {
    setActivePatient(patient);
    setLoadingHistory(true);
    const history = await getPatientPrescriptions(patient.id);
    setPatientHistory(history ?? []);
    setLoadingHistory(false);
  };

  const filtered = (patients ?? []).filter((p) => {
    const q = search.toLowerCase();
    const name = p.display_name || p.username || '';
    const user = p.username || '';
    const diag = p.primary_diagnosis || '';
    return (
      name.toLowerCase().includes(q) ||
      user.toLowerCase().includes(q) ||
      diag.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="dd-bento-grid">
        <div className="dd-bento-card dd-span-12 dd-skeleton" style={{ height: '60px' }} />
        <div className="dd-bento-card dd-span-6 dd-skeleton" style={{ height: '180px' }} />
        <div className="dd-bento-card dd-span-6 dd-skeleton" style={{ height: '180px' }} />
      </div>
    );
  }

  return (
    <div className="dd-bento-grid">
      {/* Search Header (Span 12) */}
      <div className="dd-bento-card dd-span-12" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div className="dd-input-wrap">
            <Search size={16} className="dd-input-icon" />
            <input
              type="text"
              className="dd-input"
              placeholder="Filter patients by name, username, or medical diagnosis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter patients"
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--dd-text-muted)' }}>
          <UserCheck size={16} className="dd-card-title-icon" />
          <span>Showing <strong>{filtered.length}</strong> assigned patients</span>
        </div>
      </div>

      {/* Patient Bento Cards */}
      {filtered.length === 0 ? (
        <div className="dd-bento-card dd-span-12" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--dd-text-muted)' }}>
          <UserCheck size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <p>No patients matched your filter criteria.</p>
        </div>
      ) : (
        filtered.map((pt) => (
          <div key={pt.id} className="dd-bento-card dd-span-6">
            <div className="dd-card-header">
              <div className="dd-item-left">
                <div className="dd-avatar">
                  {getInitials(pt.display_name || pt.username)}
                </div>
                <div className="dd-item-meta">
                  <h3 className="dd-item-title" style={{ fontSize: '1rem' }}>
                    {pt.display_name || pt.username || 'Patient'}
                  </h3>
                  <span className="dd-item-sub dd-item-mono">@{pt.username || 'patient'} &bull; ID: {pt.id}</span>
                </div>
              </div>
              <span className="dd-doctor-badge" style={{ background: 'var(--dd-emerald-bg)', color: 'var(--dd-emerald)', borderColor: 'var(--dd-emerald)' }}>
                Active Patient
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0.5rem 0 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--dd-text-sub)' }}>
                <Activity size={14} style={{ color: 'var(--dd-teal)' }} />
                <span>Primary Diagnosis: <strong>{pt.primary_diagnosis ?? 'General Care'}</strong></span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--dd-text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> Assigned: <span className="dd-item-mono">{pt.assigned_at || ''}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileText size={12} /> <strong style={{ color: 'var(--dd-text-main)' }}>{pt.prescription_count ?? 0}</strong> Prescriptions
                </span>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--dd-border)' }}>
              <button
                className="dd-btn-primary"
                style={{ width: '100%' }}
                onClick={() => handleOpenHistory(pt)}
              >
                <span>View Complete Medical Records</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Drawer / History Modal */}
      {activePatient && (
        <div className="dd-modal-backdrop" onClick={() => setActivePatient(null)}>
          <div className="dd-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-header">
              <div className="dd-item-left">
                <div className="dd-avatar">
                  {getInitials(activePatient.display_name || activePatient.username)}
                </div>
                <div>
                  <h3 className="dd-card-title">{activePatient.display_name || activePatient.username || 'Patient'}</h3>
                  <p className="dd-item-sub dd-item-mono">@{activePatient.username || 'patient'} &bull; History & Records</p>
                </div>
              </div>
              <button className="dd-icon-btn" onClick={() => setActivePatient(null)}>✕</button>
            </div>

            <div className="dd-modal-body">
              {loadingHistory ? (
                <div className="dd-skeleton" style={{ height: '150px' }} />
              ) : (patientHistory?.length ?? 0) === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--dd-text-muted)', padding: '2rem' }}>
                  No uploaded prescriptions found for this patient yet.
                </p>
              ) : (
                <div className="dd-list">
                  {patientHistory.map((rx) => (
                    <div key={rx.id} className="dd-list-item">
                      <div className="dd-item-left">
                        <div className="dd-stat-icon dd-stat-icon--teal" style={{ width: '36px', height: '36px' }}>
                          <FileText size={16} />
                        </div>
                        <div className="dd-item-meta">
                          <span className="dd-item-title">{rx.diagnosis || 'Consultation'}</span>
                          <span className="dd-item-sub dd-item-mono">{rx.clinic_name || 'Clinic'} &bull; {rx.created_at || ''}</span>
                        </div>
                      </div>
                      <button className="dd-btn-outline" onClick={() => setSelectedRx(rx)}>
                        <Eye size={13} /> View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dd-modal-footer">
              <button className="dd-btn-outline" onClick={() => setActivePatient(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Detail Modal */}
      {selectedRx && (
        <PrescriptionDetailModal
          prescription={selectedRx}
          onClose={() => setSelectedRx(null)}
        />
      )}
    </div>
  );
}
