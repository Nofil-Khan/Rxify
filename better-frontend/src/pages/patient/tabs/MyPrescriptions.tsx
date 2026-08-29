import { useState, useEffect } from 'react';
import {
  FileText, ChevronDown, ChevronUp, Search, AlertCircle, Pill, Calendar, User
} from 'lucide-react';
import {
  fetchMyPrescriptions, fetchPrescriptionDetail,
  type Prescription, type PrescriptionDetail
} from '../../../lib/patientApi';

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function PrescriptionRow({ rx }: { rx: Prescription }) {
  const [open, setOpen]         = useState(false);
  const [detail, setDetail]     = useState<PrescriptionDetail | null>(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  const toggle = async () => {
    if (!open && !detail) {
      setLoading(true);
      setErr('');
      try {
        const d = await fetchPrescriptionDetail(rx.id);
        setDetail(d);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load detail.');
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  };

  return (
    <li className="pd-rx-row">
      <button
        id={`rx-toggle-${rx.id}`}
        className="pd-rx-row-head"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`rx-detail-${rx.id}`}
      >
        <div className="pd-rx-row-icon" aria-hidden="true"><FileText size={17} /></div>
        <div className="pd-rx-row-body">
          <span className="pd-rx-row-title">
            {rx.diagnosis ?? rx.doctor_name ?? `Prescription #${rx.id}`}
          </span>
          <span className="pd-rx-row-meta">
            {rx.clinic_name ? `${rx.clinic_name} · ` : ''}
            {rx.doctor_name ? `Dr. ${rx.doctor_name} · ` : ''}
            {formatDate(rx.issue_date)}
          </span>
        </div>
        <div className="pd-rx-row-right">
          {rx.follow_up_date && (
            <span className="pd-badge pd-badge--amber" aria-label={`Follow-up: ${formatDate(rx.follow_up_date)}`}>
              Follow-up {formatDate(rx.follow_up_date)}
            </span>
          )}
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </div>
      </button>

      {open && (
        <div id={`rx-detail-${rx.id}`} className="pd-rx-detail" role="region">
          {loading && <div className="pd-spinner-sm" aria-label="Loading detail…" />}
          {err && <p className="pd-detail-err">{err}</p>}
          {detail && !loading && (
            <>
              {/* Meta grid */}
              <div className="pd-detail-grid">
                {[
                  { label: 'Patient',    value: detail.patient_name },
                  { label: 'Age',        value: detail.patient_age },
                  { label: 'Gender',     value: detail.patient_gender },
                  { label: 'Doctor',     value: detail.doctor_name ? `Dr. ${detail.doctor_name}` : null },
                  { label: 'Clinic',     value: detail.clinic_name },
                  { label: 'Issue Date', value: formatDate(detail.issue_date) },
                  { label: 'Follow-up',  value: formatDate(detail.follow_up_date) },
                  { label: 'Diagnosis',  value: detail.diagnosis },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label} className="pd-detail-cell">
                      <span className="pd-detail-cell-label">{label}</span>
                      <span className="pd-detail-cell-value">{value}</span>
                    </div>
                  ) : null
                )}
              </div>

              {/* Medications */}
              {detail.medications?.length > 0 && (
                <div className="pd-meds">
                  <h3 className="pd-meds-title"><Pill size={14} aria-hidden="true" /> Medications</h3>
                  <div className="pd-meds-grid">
                    {detail.medications.map((m) => (
                      <div key={m.id} className="pd-med-card">
                        <span className="pd-med-name">{m.name ?? '—'}</span>
                        <div className="pd-med-meta">
                          {m.dosage    && <span>{m.dosage}</span>}
                          {m.frequency && <span>{m.frequency}</span>}
                          {m.duration  && <span>{m.duration}</span>}
                        </div>
                        {m.instructions && (
                          <p className="pd-med-instructions">{m.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detail.notes && (
                <div className="pd-detail-notes">
                  <span className="pd-detail-cell-label">Notes</span>
                  <p>{detail.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function MyPrescriptions() {
  const [all, setAll]       = useState<Prescription[]>([]);
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    let alive = true;
    fetchMyPrescriptions()
      .then((res) => { if (alive) setAll(res.prescriptions); })
      .catch((e) => { if (alive) setError(e?.message ?? 'Failed to load prescriptions.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = all.filter((rx) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      rx.diagnosis?.toLowerCase().includes(q) ||
      rx.doctor_name?.toLowerCase().includes(q) ||
      rx.clinic_name?.toLowerCase().includes(q) ||
      rx.patient_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="pd-tab-page">
      <div className="pd-tab-header">
        <div>
          <h1 className="pd-tab-title">My Prescriptions</h1>
          <p className="pd-tab-sub">All your uploaded prescription records</p>
        </div>
        <span className="pd-tab-count">{all.length} total</span>
      </div>

      {/* Search */}
      <div className="pd-search-wrap" role="search">
        <Search size={16} className="pd-search-icon" aria-hidden="true" />
        <input
          id="rx-search"
          type="search"
          className="pd-search-input"
          placeholder="Search by diagnosis, doctor, or clinic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search prescriptions"
        />
      </div>

      {loading && (
        <div className="pd-loader-wrap" aria-label="Loading prescriptions">
          <div className="pd-spinner" aria-hidden="true" />
        </div>
      )}

      {!loading && error && (
        <div className="pd-empty">
          <AlertCircle size={36} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="pd-empty">
          <FileText size={40} aria-hidden="true" />
          <p>{query ? 'No matching prescriptions.' : 'No prescriptions uploaded yet.'}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="pd-rx-accordion" role="list" aria-label="Prescription list">
          {filtered.map((rx) => <PrescriptionRow key={rx.id} rx={rx} />)}
        </ul>
      )}
    </div>
  );
}
