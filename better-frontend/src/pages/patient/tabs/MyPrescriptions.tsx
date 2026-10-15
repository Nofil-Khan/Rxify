import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Pill, ChevronDown, ChevronUp, Search, AlertCircle,
  Calendar, Stethoscope, Building2, CheckCircle2, AlertTriangle,
  ShieldCheck, FileText, ArrowRight, HelpCircle, Clock, Timer,
} from 'lucide-react';
import {
  fetchMyPrescriptions, fetchPrescriptionDetail,
  type Prescription, type PrescriptionDetail, type Medication, type ResolvedMedicine,
} from '../../../lib/patientApi';
import ClarifyMedicineModal from './ClarifyMedicineModal';

/* ─── Utilities ──────────────────────────────────────────────────────────── */
function formatDate(d: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}
function isMatched(m: Medication)         { return m.match_status === 'MATCHED' && m.medicine_id != null; }
function needsClarification(m: Medication){ return m.match_status === 'AMBIGUOUS' || m.match_status === 'UNRESOLVED' || m.match_status === 'NOT_A_MEDICINE'; }

/* ─── Status badge ───────────────────────────────────────────────────────── */
function MedBadge({ m }: { m: Medication }) {
  if (m.patient_resolved)               return <span className="rxd-badge rxd-badge--verified"><ShieldCheck size={11} /> Verified</span>;
  if (isMatched(m))                     return <span className="rxd-badge rxd-badge--matched"><CheckCircle2 size={11} /> Matched</span>;
  if (m.match_status === 'AMBIGUOUS')   return <span className="rxd-badge rxd-badge--review"><AlertTriangle size={11} /> Needs review</span>;
  if (m.match_status === 'NOT_A_MEDICINE') return <span className="rxd-badge rxd-badge--na"><HelpCircle size={11} /> Unknown</span>;
  return <span className="rxd-badge rxd-badge--review"><HelpCircle size={11} /> Needs review</span>;
}

/* ─── Medicine card (timeline item) ─────────────────────────────────────── */
function MedicineCard({
  medicine: m, index, isLast, prescriptionId, expanded, onToggle, onClarify,
}: {
  medicine: Medication; index: number; isLast: boolean;
  prescriptionId: number; expanded: boolean;
  onToggle: () => void; onClarify: (m: Medication) => void;
}) {
  const matched  = isMatched(m);
  const clarify  = needsClarification(m);
  const numMod   = m.patient_resolved ? 'rxd-num--verified'
                 : matched            ? 'rxd-num--matched'
                 : clarify            ? 'rxd-num--review'
                 : 'rxd-num--na';

  const displayName = m.name ?? m.raw_name ?? 'Unknown medicine';
  const infoLine = [
    m.brand_name && m.generic_name ? m.generic_name : null,
    m.strength,
    m.form ? m.form.charAt(0) + m.form.slice(1).toLowerCase() : null,
    m.category,
  ].filter(Boolean).join(' · ');

  const dosageCells = [
    { icon: <Pill size={12} />,    label: 'Dose',         value: m.dosage },
    { icon: <Clock size={12} />,   label: 'Frequency',    value: m.frequency },
    { icon: <Timer size={12} />,   label: 'Duration',     value: m.duration },
    { icon: <FileText size={12} />, label: 'Instructions', value: m.instructions },
  ].filter(c => c.value);

  return (
    <div className="rxd-med-card">
      {/* Timeline */}
      <div className="rxd-med-timeline">
        <div className={`rxd-num ${numMod}`}>{index + 1}</div>
        {!isLast && <div className="rxd-connector" />}
      </div>

      {/* Card body */}
      <div className={`rxd-med-inner ${clarify ? 'rxd-med-inner--review' : ''}`}>
        <button
          className="rxd-med-header"
          onClick={onToggle}
          aria-expanded={expanded}
          id={`rx-med-${m.id}`}
        >
          <div className={`rxd-pill-icon ${clarify ? 'rxd-pill-icon--review' : ''}`} aria-hidden>
            <Pill size={15} />
          </div>
          <div className="rxd-med-label">
            <span className="rxd-med-name">{displayName}</span>
            {infoLine && <span className="rxd-med-sub">{infoLine}</span>}
          </div>
          <MedBadge m={m} />
          <span className="rxd-med-chevron" aria-hidden>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>

        {expanded && (
          <div className="rxd-med-body">
            {matched && m.name && m.name !== m.raw_name && (
              <p className="rxd-written-as">Written as: {m.raw_name}</p>
            )}
            {clarify && (
              <div className="rxd-warn-row">
                <AlertTriangle size={14} className="rxd-warn-tri" aria-hidden />
                <p className="rxd-warn-msg">
                  {m.match_status === 'AMBIGUOUS'
                    ? 'Multiple catalog matches found — select the correct medicine to confirm.'
                    : 'This medicine could not be identified in the catalog.'}
                </p>
                <button
                  id={`clarify-btn-${m.id}`}
                  className="rxd-warn-btn"
                  onClick={() => onClarify(m)}
                >
                  {m.match_status === 'AMBIGUOUS' ? 'Review match' : 'Identify'}
                  <ArrowRight size={12} aria-hidden />
                </button>
              </div>
            )}
            {dosageCells.length > 0 && (
              <div className="rxd-dosage-grid">
                {dosageCells.map(({ icon, label, value }) => (
                  <div key={label} className="rxd-dosage-cell">
                    <span className="rxd-dosage-label">{icon}{label}</span>
                    <span className="rxd-dosage-value">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Prescription list row ──────────────────────────────────────────────── */
function PrescriptionRow({ rx, onSelect }: { rx: Prescription; onSelect: (id: number) => void }) {
  return (
    <button
      id={`rx-row-${rx.id}`}
      className="rxp-row"
      onClick={() => onSelect(rx.id)}
    >
      <div className="rxp-row-accent" />
      <div className="rxp-row-body">
        <div className="rxp-row-top">
          <span className="rxp-row-diagnosis">{rx.diagnosis ?? `Prescription #${rx.id}`}</span>
          {rx.issue_date && <span className="rxp-row-date">{formatDate(rx.issue_date)}</span>}
        </div>
        <div className="rxp-row-meta">
          {rx.doctor_name && <span><Stethoscope size={11} /> Dr. {rx.doctor_name}</span>}
          {rx.clinic_name && <span><Building2 size={11} /> {rx.clinic_name}</span>}
          {rx.follow_up_date && <span className="rxp-row-followup">Follow-up: {formatDate(rx.follow_up_date)}</span>}
        </div>
      </div>
      <ArrowRight size={15} className="rxp-row-arrow" aria-hidden />
    </button>
  );
}

/* ─── Detail cache ───────────────────────────────────────────────────────── */
const detailCache = new Map<number, PrescriptionDetail>();

/* ─── Full detail view ───────────────────────────────────────────────────── */
function PrescriptionDetailView({ rxId, onBack }: { rxId: number; onBack: () => void }) {
  const [detail, setDetail]           = useState<PrescriptionDetail | null>(() => detailCache.get(rxId) ?? null);
  const [loading, setLoading]         = useState(!detailCache.has(rxId));
  const [err, setErr]                 = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [clarifyMed, setClarifyMed]   = useState<Medication | null>(null);

  useEffect(() => {
    if (detailCache.has(rxId)) { setDetail(detailCache.get(rxId)!); return; }
    setLoading(true);
    fetchPrescriptionDetail(rxId)
      .then((d) => { detailCache.set(rxId, d); setDetail(d); })
      .catch((e: any) => setErr(e?.message ?? 'Failed to load prescription.'))
      .finally(() => setLoading(false));
  }, [rxId]);

  const toggleMed = (id: number) => setExpandedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const toggleAll = () => {
    if (!detail) return;
    const next = !allExpanded;
    setAllExpanded(next);
    setExpandedIds(next ? new Set(detail.medications.map(m => m.id)) : new Set());
  };

  const handleResolved = useCallback((r: ResolvedMedicine) => {
    if (!detail) return;
    const updated = {
      ...detail,
      medications: detail.medications.map(m =>
        m.id === r.pm_id
          ? { ...m, medicine_id: r.medicine_id, match_status: 'MATCHED' as const, patient_resolved: true,
              generic_name: r.generic_name, brand_name: r.brand_name, strength: r.strength,
              form: r.form, category: r.category, name: r.brand_name ?? r.generic_name ?? m.raw_name }
          : m
      ),
    };
    detailCache.set(rxId, updated);
    setDetail(updated);
    setClarifyMed(null);
  }, [detail, rxId]);

  const meds     = detail?.medications ?? [];
  const matched  = meds.filter(isMatched).length;
  const review   = meds.filter(needsClarification).length;

  return (
    <>
      <div className="rxd-page">
        <button className="rxd-back" onClick={onBack} id="rx-back-btn">
          <ArrowLeft size={14} aria-hidden /> Back to prescriptions
        </button>

        {loading && !detail && (
          <div className="rxd-layout">
            <div className="rxd-main">
              {[70, 45, 100, 100, 80].map((w, i) => (
                <div key={i} className="rxp-skeleton" style={{ width: `${w}%`, marginBottom: 14, height: i === 0 ? 28 : 14 }} />
              ))}
            </div>
          </div>
        )}
        {err && <div className="rxp-state-block"><AlertCircle size={28} /><p>{err}</p></div>}

        {detail && (
          <div className="rxd-layout">
            {/* ── Main ───────────────────────────────────────────────── */}
            <div className="rxd-main">

              {/* Title */}
              <div className="rxd-heading">
                <div className="rxd-heading-row">
                  <h1 className="rxd-title">{detail.diagnosis ?? `Prescription #${rxId}`}</h1>
                  <span className="rxd-title-badge">Prescription</span>
                </div>
                <div className="rxd-heading-meta">
                  {detail.issue_date && <span className="rxd-meta-chip"><Calendar size={12} />Issued {formatDate(detail.issue_date)}</span>}
                  {detail.doctor_name && <span className="rxd-meta-chip"><Stethoscope size={12} />Dr. {detail.doctor_name}</span>}
                  {detail.clinic_name && <span className="rxd-meta-chip"><Building2 size={12} />{detail.clinic_name}</span>}
                </div>
              </div>

              {/* Stats bar */}
              <div className="rxd-stats">
                <div className="rxd-stat">
                  <div className="rxd-stat-icon rxd-stat-icon--blue"><Pill size={17} /></div>
                  <div className="rxd-stat-text">
                    <span className="rxd-stat-num">{meds.length}</span>
                    <span className="rxd-stat-label">Total medicines</span>
                  </div>
                </div>
                <div className="rxd-stat">
                  <div className="rxd-stat-icon rxd-stat-icon--teal"><CheckCircle2 size={17} /></div>
                  <div className="rxd-stat-text">
                    <span className="rxd-stat-num">{matched}</span>
                    <span className="rxd-stat-label">Matched with catalog</span>
                  </div>
                </div>
                {review > 0 && (
                  <div className="rxd-stat">
                    <div className="rxd-stat-icon rxd-stat-icon--amber"><AlertTriangle size={17} /></div>
                    <div className="rxd-stat-text">
                      <span className="rxd-stat-num">{review}</span>
                      <span className="rxd-stat-label">Needs review</span>
                    </div>
                  </div>
                )}
                {detail.notes && (
                  <div className="rxd-stat">
                    <div className="rxd-stat-icon rxd-stat-icon--gray"><FileText size={17} /></div>
                    <div className="rxd-stat-text">
                      <span className="rxd-stat-num-sm">Doctor notes</span>
                      <span className="rxd-stat-label">Included</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Medicines list */}
              {meds.length > 0 && (
                <div className="rxd-meds">
                  <div className="rxd-meds-head">
                    <div>
                      <h2 className="rxd-meds-title">Medicines</h2>
                      <p className="rxd-meds-sub">Review each medicine, check the matched details, and clarify if needed.</p>
                    </div>
                    <button className="rxd-expand-btn" onClick={toggleAll} id="rx-expand-all-btn">
                      {allExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {allExpanded ? 'Collapse all' : 'Expand all'}
                    </button>
                  </div>
                  <div className="rxd-med-list" role="list">
                    {meds.map((m, i) => (
                      <MedicineCard
                        key={m.id}
                        medicine={m}
                        index={i}
                        isLast={i === meds.length - 1}
                        prescriptionId={rxId}
                        expanded={expandedIds.has(m.id)}
                        onToggle={() => toggleMed(m.id)}
                        onClarify={setClarifyMed}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <aside className="rxd-sidebar">
              <div className="rxd-scard">
                <div className="rxd-scard-head"><FileText size={13} />Prescription Overview</div>
                <div className="rxd-scard-body">
                  {detail.diagnosis     && <div className="rxd-ov-row"><span className="rxd-ov-label">Condition</span><span className="rxd-ov-val">{detail.diagnosis}</span></div>}
                  {detail.issue_date    && <div className="rxd-ov-row"><span className="rxd-ov-label">Issued on</span><span className="rxd-ov-val">{formatDate(detail.issue_date)}</span></div>}
                  {detail.follow_up_date && <div className="rxd-ov-row"><span className="rxd-ov-label">Follow-up</span><span className="rxd-ov-val rxd-ov-val--amber">{formatDate(detail.follow_up_date)}</span></div>}
                  {detail.doctor_name   && <div className="rxd-ov-row"><span className="rxd-ov-label">Prescribed by</span><span className="rxd-ov-val">Dr. {detail.doctor_name}</span></div>}
                  {detail.clinic_name   && <div className="rxd-ov-row"><span className="rxd-ov-label">Facility</span><span className="rxd-ov-val">{detail.clinic_name}</span></div>}
                </div>
              </div>
              {detail.notes && (
                <div className="rxd-scard">
                  <div className="rxd-scard-head"><FileText size={13} />Doctor Notes</div>
                  <div className="rxd-scard-body">
                    <p className="rxd-notes-text">{detail.notes}</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {clarifyMed && (
        <ClarifyMedicineModal
          prescriptionId={rxId}
          medicine={clarifyMed}
          onResolved={handleResolved}
          onClose={() => setClarifyMed(null)}
        />
      )}
    </>
  );
}

/* ─── Page root ──────────────────────────────────────────────────────────── */
export default function MyPrescriptions() {
  const [all, setAll]               = useState<Prescription[]>([]);
  const [query, setQuery]           = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyPrescriptions()
      .then((r) => { if (alive) setAll(r.prescriptions); })
      .catch((e) => { if (alive) setError(e?.message ?? 'Failed to load prescriptions.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (selectedId !== null) {
    return <PrescriptionDetailView rxId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const filtered = all.filter((rx) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return rx.diagnosis?.toLowerCase().includes(q) || rx.doctor_name?.toLowerCase().includes(q) || rx.clinic_name?.toLowerCase().includes(q);
  });

  return (
    <div className="rxp-page">
      <div className="rxp-page-header">
        <div>
          <h1 className="rxp-page-title">My Prescriptions</h1>
          <p className="rxp-page-sub">{loading ? 'Loading…' : `${all.length} prescription${all.length !== 1 ? 's' : ''} on file`}</p>
        </div>
        <div className="rxp-search-wrap" role="search">
          <Search size={14} className="rxp-search-icon" aria-hidden />
          <input id="rx-search" type="search" className="rxp-search-input"
            placeholder="Search diagnosis, doctor, clinic…" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search prescriptions" />
        </div>
      </div>

      {loading && (
        <div className="rxp-page-loading">
          {[1,2,3].map(n => (
            <div key={n} className="rxp-row rxp-row--skeleton">
              <div className="rxp-row-accent" />
              <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
                <div className="rxp-skeleton rxp-skeleton--short" style={{ marginBottom: 10 }} />
                <div className="rxp-skeleton rxp-skeleton--medium" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && error && <div className="rxp-state-block"><AlertCircle size={28} /><p>{error}</p></div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="rxp-state-block"><FileText size={32} /><p>{query ? 'No prescriptions match.' : 'No prescriptions on file yet.'}</p></div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="rxp-list" role="list">
          {filtered.map(rx => <PrescriptionRow key={rx.id} rx={rx} onSelect={setSelectedId} />)}
        </div>
      )}
    </div>
  );
}
