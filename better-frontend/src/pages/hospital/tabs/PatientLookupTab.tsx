import { useState } from 'react';
import { lookupPatient, getPatientPrescriptions, getPatientMedications } from '../../../lib/hospitalApi';
import type { PatientLookup, Prescription, Medication } from '../../../lib/hospitalApi';
import { Search, User, ChevronRight, FileText, Pill, Droplets, CalendarDays, X } from 'lucide-react';

type View = 'search' | 'profile' | 'prescriptions' | 'medications';

function calcAge(dob: string | null) {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return `${Math.floor(diff / 3.156e10)} yrs`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PatientLookupTab() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState<PatientLookup | null>(null);
  const [view, setView] = useState<View>('search');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(''); setLoading(true); setPatient(null); setView('search');
    try {
      const p = await lookupPatient(query.trim());
      setPatient(p);
      setView('profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Patient not found.');
    } finally { setLoading(false); }
  }

  async function loadPrescriptions() {
    if (!patient) return;
    setSubLoading(true);
    try {
      const r = await getPatientPrescriptions(patient.patient_code);
      setPrescriptions(r.prescriptions);
      setView('prescriptions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescriptions.');
    } finally { setSubLoading(false); }
  }

  async function loadMedications() {
    if (!patient) return;
    setSubLoading(true);
    try {
      const r = await getPatientMedications(patient.patient_code);
      setMedications(r.medications);
      setView('medications');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load medications.');
    } finally { setSubLoading(false); }
  }

  function reset() { setPatient(null); setQuery(''); setView('search'); setError(''); setPrescriptions([]); setMedications([]); }

  return (
    <section className="hosp-tab-section">
      <header className="hosp-tab-header">
        <Search size={16} aria-hidden="true" />
        <h2 className="hosp-tab-title">Patient Lookup</h2>
      </header>

      {/* Search bar */}
      <form className="hosp-lookup-bar" onSubmit={handleSearch} role="search">
        <div className="hosp-lookup-input-wrap">
          <Search size={16} className="hosp-lookup-icon" aria-hidden="true" />
          <input
            id="patient-code-input"
            className="hosp-lookup-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            placeholder="Enter patient code (e.g. RXF-P-XXXXX)"
            aria-label="Patient code"
            maxLength={12}
            spellCheck={false}
          />
          {query && (
            <button type="button" className="hosp-clear-btn" onClick={reset} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <button id="lookup-submit" type="submit" className="hosp-lookup-btn" disabled={loading}>
          {loading ? <span className="hosp-spinner" /> : <><Search size={15} /><span>Lookup</span></>}
        </button>
      </form>

      {error && <div className="hosp-alert hosp-alert--error" role="alert">{error}</div>}

      {/* Patient Profile Card */}
      {view === 'profile' && patient && (
        <article className="hosp-patient-card" aria-label={`Patient record for ${patient.full_name}`}>
          <div className="hosp-patient-avatar" aria-hidden="true">
            <User size={28} />
          </div>
          <div className="hosp-patient-info">
            <h3 className="hosp-patient-name">{patient.full_name}</h3>
            <dl className="hosp-patient-meta">
              <div>
                <dt>Patient Code</dt>
                <dd><code className="hosp-code-badge">{patient.patient_code}</code></dd>
              </div>
              <div>
                <dt><CalendarDays size={12} aria-hidden="true" /> Age</dt>
                <dd>{calcAge(patient.date_of_birth)}</dd>
              </div>
              <div>
                <dt><Droplets size={12} aria-hidden="true" /> Blood Group</dt>
                <dd className="hosp-blood">{patient.blood_group ?? '—'}</dd>
              </div>
              <div>
                <dt>Date of Birth</dt>
                <dd>{formatDate(patient.date_of_birth)}</dd>
              </div>
            </dl>
          </div>
          <div className="hosp-patient-actions">
            <button id="view-prescriptions-btn" className="hosp-action-btn" onClick={loadPrescriptions} disabled={subLoading}>
              <FileText size={15} />
              <span>Prescriptions</span>
              <ChevronRight size={14} />
            </button>
            <button id="view-medications-btn" className="hosp-action-btn" onClick={loadMedications} disabled={subLoading}>
              <Pill size={15} />
              <span>Medications</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </article>
      )}

      {subLoading && <div className="hosp-loading"><span className="hosp-spinner" />Fetching records…</div>}

      {/* Prescriptions List */}
      {view === 'prescriptions' && (
        <div className="hosp-records-section">
          <div className="hosp-records-header">
            <button className="hosp-back-btn" onClick={() => setView('profile')} aria-label="Back to patient profile">← Back</button>
            <h3 className="hosp-records-title">Prescriptions for {patient?.full_name}</h3>
          </div>
          {prescriptions.length === 0 ? (
            <p className="hosp-empty">No prescriptions on record.</p>
          ) : (
            <ol className="hosp-rx-list">
              {prescriptions.map(rx => (
                <li key={rx.id} className="hosp-rx-card">
                  <div className="hosp-rx-top">
                    <span className="hosp-rx-diagnosis">{rx.diagnosis ?? 'Unspecified diagnosis'}</span>
                    <time className="hosp-rx-date">{formatDate(rx.issue_date)}</time>
                  </div>
                  <dl className="hosp-rx-meta">
                    {rx.clinic_name && <div><dt>Clinic</dt><dd>{rx.clinic_name}</dd></div>}
                    {rx.doctor_name && <div><dt>Physician</dt><dd>{rx.doctor_name}{rx.doctor_specialty ? ` · ${rx.doctor_specialty}` : ''}</dd></div>}
                    {rx.follow_up_date && <div><dt>Follow-up</dt><dd>{formatDate(rx.follow_up_date)}</dd></div>}
                    {rx.notes && <div><dt>Notes</dt><dd className="hosp-rx-notes">{rx.notes}</dd></div>}
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Medications List */}
      {view === 'medications' && (
        <div className="hosp-records-section">
          <div className="hosp-records-header">
            <button className="hosp-back-btn" onClick={() => setView('profile')} aria-label="Back to patient profile">← Back</button>
            <h3 className="hosp-records-title">Medications for {patient?.full_name}</h3>
          </div>
          {medications.length === 0 ? (
            <p className="hosp-empty">No medications on record.</p>
          ) : (
            <ol className="hosp-med-list">
              {medications.map(m => (
                <li key={m.id} className="hosp-med-card">
                  <div className="hosp-med-name">{m.medicine_name}</div>
                  <dl className="hosp-med-meta">
                    {m.dosage && <div><dt>Dosage</dt><dd>{m.dosage}</dd></div>}
                    {m.frequency && <div><dt>Frequency</dt><dd>{m.frequency}</dd></div>}
                    {m.duration && <div><dt>Duration</dt><dd>{m.duration}</dd></div>}
                    {m.instructions && <div><dt>Instructions</dt><dd>{m.instructions}</dd></div>}
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
