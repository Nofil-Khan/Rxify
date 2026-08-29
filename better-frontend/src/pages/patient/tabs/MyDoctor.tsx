import { useState, useEffect } from 'react';
import {
  Stethoscope, Search, Send, CheckCircle, Clock, XCircle,
  AlertCircle, User, Hash
} from 'lucide-react';
import {
  fetchMyDoctor, fetchMyRequests, lookupDoctor, requestDoctor,
  type DoctorInfo, type DoctorRequest
} from '../../../lib/patientApi';
import { ApiError } from '../../../lib/api';

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

const STATUS_META: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  pending:  { icon: <Clock size={13} />,        cls: 'pd-badge--amber', label: 'Pending'  },
  accepted: { icon: <CheckCircle size={13} />,   cls: 'pd-badge--green', label: 'Accepted' },
  rejected: { icon: <XCircle size={13} />,       cls: 'pd-badge--red',   label: 'Rejected' },
};

export default function MyDoctor() {
  const [doctor, setDoctor]       = useState<DoctorInfo | null | undefined>(undefined);
  const [requests, setRequests]   = useState<DoctorRequest[]>([]);
  const [loading, setLoading]     = useState(true);

  // lookup state
  const [doctorIdInput, setDoctorIdInput] = useState('');
  const [preview, setPreview]             = useState<DoctorInfo | null>(null);
  const [lookupErr, setLookupErr]         = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  // request state
  const [reqMsg, setReqMsg]     = useState('');
  const [reqErr, setReqErr]     = useState('');
  const [reqLoading, setReqLoading] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([fetchMyDoctor(), fetchMyRequests()])
      .then(([doc, reqs]) => {
        setDoctor(doc.doctor);
        setRequests(reqs.requests);
      })
      .catch(() => setDoctor(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const handleLookup = async () => {
    const id = parseInt(doctorIdInput.trim(), 10);
    if (isNaN(id)) { setLookupErr('Please enter a valid Doctor ID.'); return; }
    setLookupErr(''); setPreview(null); setLookupLoading(true);
    try {
      const doc = await lookupDoctor(id);
      setPreview(doc);
    } catch (e) {
      setLookupErr(e instanceof ApiError ? e.message : 'Doctor not found.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!preview) return;
    setReqErr(''); setReqMsg(''); setReqLoading(true);
    try {
      const res = await requestDoctor(preview.id);
      setReqMsg(res.message);
      setPreview(null);
      setDoctorIdInput('');
      reload();
    } catch (e) {
      setReqErr(e instanceof ApiError ? e.message : 'Failed to send request.');
    } finally {
      setReqLoading(false);
    }
  };

  return (
    <div className="pd-tab-page">
      <div className="pd-tab-header">
        <div>
          <h1 className="pd-tab-title">My Doctor</h1>
          <p className="pd-tab-sub">Manage your doctor connection</p>
        </div>
      </div>

      {loading && (
        <div className="pd-loader-wrap" aria-label="Loading doctor info">
          <div className="pd-spinner" aria-hidden="true" />
        </div>
      )}

      {!loading && (
        <div className="pd-doctor-layout">

          {/* ── Current doctor ─────────────────────────────────────────── */}
          <section className="pd-card" aria-label="Current assigned doctor">
            <div className="pd-card-head">
              <h2 className="pd-card-title">
                <Stethoscope size={17} aria-hidden="true" /> Assigned Doctor
              </h2>
            </div>

            {doctor ? (
              <div className="pd-doctor-profile">
                <div className="pd-doctor-avatar-lg" aria-hidden="true">
                  {((doctor.display_name ?? doctor.username ?? 'Dr') || 'Dr').slice(0, 2).toUpperCase()}
                </div>
                <div className="pd-doctor-details">
                  <h3 className="pd-doctor-name-lg">{doctor.display_name ?? doctor.username}</h3>
                  <p className="pd-doctor-username">@{doctor.username}</p>
                  {doctor.specialty && (
                    <span className="pd-badge pd-badge--blue">{doctor.specialty}</span>
                  )}
                  <span className="pd-connected pd-connected--lg">
                    <CheckCircle size={14} aria-hidden="true" /> Connected
                    {doctor.assigned_at && ` since ${formatDate(doctor.assigned_at)}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pd-empty-inline">
                <User size={36} aria-hidden="true" />
                <p>No doctor assigned yet.</p>
                <p className="pd-empty-hint">Use the form below to find and connect with a doctor.</p>
              </div>
            )}
          </section>

          {/* ── Find a doctor ──────────────────────────────────────────── */}
          <section className="pd-card" aria-label="Find a doctor by ID">
            <div className="pd-card-head">
              <h2 className="pd-card-title">
                <Search size={17} aria-hidden="true" /> Find a Doctor
              </h2>
            </div>
            <p className="pd-card-hint">
              Ask your doctor for their Rxify user ID to connect with them.
            </p>

            <div className="pd-lookup-form" role="form" aria-label="Doctor lookup form">
              <div className="pd-input-row">
                <div className="pd-input-wrap">
                  <Hash size={15} className="pd-input-icon" aria-hidden="true" />
                  <input
                    id="doctor-id-input"
                    type="number"
                    min="1"
                    className="pd-input"
                    placeholder="Enter Doctor ID (e.g. 42)"
                    value={doctorIdInput}
                    onChange={(e) => {
                      setDoctorIdInput(e.target.value);
                      setPreview(null);
                      setLookupErr('');
                      setReqMsg('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    aria-label="Doctor user ID"
                  />
                </div>
                <button
                  id="lookup-doctor-btn"
                  className="pd-btn-primary"
                  onClick={handleLookup}
                  disabled={lookupLoading || !doctorIdInput.trim()}
                  aria-label="Look up doctor"
                >
                  {lookupLoading ? <span className="pd-spinner-xs" aria-hidden="true" /> : <Search size={16} />}
                  Look up
                </button>
              </div>

              {lookupErr && (
                <div className="pd-alert pd-alert--error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" /> {lookupErr}
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div className="pd-preview-card" role="region" aria-label="Doctor preview">
                  <div className="pd-preview-avatar" aria-hidden="true">
                    {((preview.display_name ?? preview.username ?? 'Dr') || 'Dr').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="pd-preview-info">
                    <span className="pd-preview-name">{preview.display_name ?? preview.username}</span>
                    <span className="pd-preview-meta">ID #{preview.id} · @{preview.username}</span>
                    {preview.specialty && (
                      <span className="pd-badge pd-badge--blue">{preview.specialty}</span>
                    )}
                  </div>
                  <button
                    id="send-request-btn"
                    className="pd-btn-primary"
                    onClick={handleRequest}
                    disabled={reqLoading}
                    aria-label={`Send connection request to ${preview.display_name ?? preview.username}`}
                  >
                    {reqLoading
                      ? <span className="pd-spinner-xs" aria-hidden="true" />
                      : <Send size={15} />
                    }
                    Send Request
                  </button>
                </div>
              )}

              {reqMsg && (
                <div className="pd-alert pd-alert--success" role="status">
                  <CheckCircle size={14} aria-hidden="true" /> {reqMsg}
                </div>
              )}
              {reqErr && (
                <div className="pd-alert pd-alert--error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" /> {reqErr}
                </div>
              )}
            </div>
          </section>

          {/* ── Request history ────────────────────────────────────────── */}
          {requests.length > 0 && (
            <section className="pd-card pd-card--full" aria-label="Request history">
              <div className="pd-card-head">
                <h2 className="pd-card-title">
                  <Clock size={17} aria-hidden="true" /> Request History
                </h2>
              </div>
              <ul className="pd-req-list" role="list">
                {requests.map((req) => {
                  const meta = STATUS_META[req.status] ?? STATUS_META['pending'];
                  return (
                    <li key={req.id} className="pd-req-item" role="listitem">
                      <div className="pd-req-avatar" aria-hidden="true">
                        {((req.doctor_display_name ?? req.doctor_username ?? 'Dr') || 'Dr').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="pd-req-body">
                        <span className="pd-req-name">
                          {req.doctor_display_name ?? req.doctor_username}
                        </span>
                        <span className="pd-req-meta">
                          {req.doctor_specialty ? `${req.doctor_specialty} · ` : ''}
                          Requested {formatDate(req.requested_at)}
                        </span>
                      </div>
                      <span className={`pd-badge ${meta.cls}`} aria-label={`Status: ${meta.label}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
