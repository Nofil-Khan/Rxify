import { useState, useEffect } from 'react';
import { Search, FileText, Calendar, Building2, Pill, Eye, Filter } from 'lucide-react';
import { getDoctorPrescriptions, PrescriptionItem } from '../../../lib/doctorApi';
import PrescriptionDetailModal from '../components/PrescriptionDetailModal';

export default function PrescriptionsTab() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [search, setSearch]               = useState('');
  const [filterType, setFilterType]       = useState<string>('all');
  const [loading, setLoading]             = useState(true);
  const [selectedRx, setSelectedRx]       = useState<PrescriptionItem | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadRx() {
      setLoading(true);
      const res = await getDoctorPrescriptions(search);
      if (mounted) {
        setPrescriptions(res.prescriptions);
        setLoading(false);
      }
    }
    const timer = setTimeout(loadRx, 250);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [search]);

  const filtered = prescriptions.filter((p) => {
    if (filterType === 'all') return true;
    if (filterType === 'with_followup') return Boolean(p.follow_up_date);
    if (filterType === 'no_followup') return !p.follow_up_date;
    return true;
  });

  if (loading && prescriptions.length === 0) {
    return (
      <div className="dd-bento-grid">
        <div className="dd-bento-card dd-span-12 dd-skeleton" style={{ height: '60px' }} />
        <div className="dd-bento-card dd-span-6 dd-skeleton" style={{ height: '160px' }} />
        <div className="dd-bento-card dd-span-6 dd-skeleton" style={{ height: '160px' }} />
      </div>
    );
  }

  return (
    <div className="dd-bento-grid">
      {/* Filter Bar (Span 12) */}
      <div className="dd-bento-card dd-span-12" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div className="dd-input-wrap">
            <Search size={16} className="dd-input-icon" />
            <input
              type="text"
              className="dd-input"
              placeholder="Search by patient name, medical diagnosis, or clinic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search prescriptions"
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} style={{ color: 'var(--dd-text-muted)' }} />
          <select
            className="dd-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter prescriptions"
          >
            <option value="all">All Prescriptions</option>
            <option value="with_followup">Has Follow-up Scheduled</option>
            <option value="no_followup">No Follow-up Scheduled</option>
          </select>
        </div>
      </div>

      {/* Prescription Bento Cards */}
      {filtered.length === 0 ? (
        <div className="dd-bento-card dd-span-12" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--dd-text-muted)' }}>
          <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <p>No prescriptions match your search criteria.</p>
        </div>
      ) : (
        filtered.map((rx) => (
          <div key={rx.id} className="dd-bento-card dd-span-6">
            <div className="dd-card-header">
              <div className="dd-item-left">
                <div className="dd-stat-icon dd-stat-icon--teal" style={{ width: '38px', height: '38px' }}>
                  <FileText size={18} />
                </div>
                <div className="dd-item-meta">
                  <h3 className="dd-item-title" style={{ fontSize: '0.98rem' }}>{rx.patient_name}</h3>
                  <span className="dd-item-sub dd-item-mono">
                    <Calendar size={11} /> Issued: {rx.created_at} &bull; Rx #{rx.id}
                  </span>
                </div>
              </div>
              {rx.follow_up_date ? (
                <span
                  className="dd-doctor-badge"
                  style={{
                    background: 'var(--dd-emerald-bg)',
                    color: 'var(--dd-emerald)',
                    borderColor: 'var(--dd-emerald)',
                  }}
                  title={`Follow-up date: ${rx.follow_up_date}`}
                >
                  Follow-up: {rx.follow_up_date}
                </span>
              ) : (
                <span
                  className="dd-doctor-badge"
                  style={{
                    background: 'var(--dd-indigo-bg)',
                    color: 'var(--dd-indigo)',
                    borderColor: 'var(--dd-indigo)',
                  }}
                >
                  Record
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '0.5rem 0 1rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--dd-teal)' }}>
                {rx.diagnosis}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--dd-text-muted)' }}>
                <Building2 size={13} /> {rx.clinic_name}
              </div>

              {rx.medicines && rx.medicines.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--dd-text-sub)' }}>
                  <Pill size={13} style={{ color: 'var(--dd-indigo)' }} />
                  <span className="dd-item-mono">
                    {rx.medicines.map((m) => m.name).join(', ')}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--dd-border)' }}>
              <button
                className="dd-btn-outline"
                style={{ width: '100%' }}
                onClick={() => setSelectedRx(rx)}
              >
                <Eye size={14} />
                <span>Inspect Full OCR & Dosage Protocol</span>
              </button>
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {selectedRx && (
        <PrescriptionDetailModal
          prescription={selectedRx}
          onClose={() => setSelectedRx(null)}
        />
      )}
    </div>
  );
}
