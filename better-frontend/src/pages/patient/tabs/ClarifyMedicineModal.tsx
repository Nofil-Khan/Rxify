import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, CheckCircle, AlertTriangle, HelpCircle, ChevronRight, Loader2 } from 'lucide-react';
import {
  fetchMedicineCandidates,
  resolvePrescriptionMedicine,
  searchMedicineCatalog,
  type Medication,
  type MedicineCandidate,
  type ResolvedMedicine,
} from '../../../lib/patientApi';

interface Props {
  prescriptionId: number;
  medicine: Medication;
  onResolved: (resolved: ResolvedMedicine) => void;
  onClose: () => void;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'var(--teal)' : pct >= 45 ? 'var(--blue)' : 'var(--text-muted)';
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}
      title={`Match confidence: ${pct}%`}
    >
      <div style={{ flex: 1, height: '4px', borderRadius: '4px', background: 'var(--bg-deep)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: color, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ whiteSpace: 'nowrap', minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

function CandidateCard({ candidate, onSelect, selecting }: { candidate: MedicineCandidate; onSelect: (c: MedicineCandidate) => void; selecting: boolean }) {
  const displayName = candidate.brand_name ?? candidate.generic_name ?? '(unnamed)';
  const subtitle = candidate.brand_name && candidate.generic_name ? candidate.generic_name : null;
  return (
    <button
      id={`candidate-${candidate.medicine_id}`}
      className="clarify-candidate-card"
      onClick={() => onSelect(candidate)}
      disabled={selecting}
      aria-label={`Select ${displayName}`}
    >
      <div className="clarify-candidate-main">
        <span className="clarify-candidate-name">{displayName}</span>
        {subtitle && <span className="clarify-candidate-generic">{subtitle}</span>}
        <div className="clarify-candidate-chips">
          {candidate.strength && <span className="clarify-chip clarify-chip--strength">{candidate.strength}</span>}
          {candidate.form    && <span className="clarify-chip clarify-chip--form">{candidate.form}</span>}
          {candidate.category && <span className="clarify-chip clarify-chip--cat">{candidate.category}</span>}
        </div>
        <ConfidenceBar value={candidate.match_confidence} />
      </div>
      <ChevronRight size={16} className="clarify-candidate-arrow" aria-hidden />
    </button>
  );
}

export default function ClarifyMedicineModal({ prescriptionId, medicine, onResolved, onClose }: Props) {
  const [candidates, setCandidates]       = useState<MedicineCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<MedicineCandidate[]>([]);
  const [searching, setSearching]         = useState(false);
  const [selecting, setSelecting]         = useState(false);
  const [error, setError]                 = useState('');
  const [successName, setSuccessName]     = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoadingCandidates(true);
    fetchMedicineCandidates(prescriptionId, medicine.id)
      .then((res) => setCandidates(res.candidates))
      .catch(() => setCandidates([]))
      .finally(() => setLoadingCandidates(false));
  }, [prescriptionId, medicine.id]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim() || q.trim().length < 2) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(() => {
      setSearching(true);
      searchMedicineCatalog(q.trim(), 8)
        .then((res) => setSearchResults(res))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
  }, []);

  const handleSelect = useCallback(async (candidate: MedicineCandidate) => {
    setSelecting(true);
    setError('');
    try {
      const res = await resolvePrescriptionMedicine(prescriptionId, medicine.id, candidate.medicine_id);
      setSuccessName(candidate.brand_name ?? candidate.generic_name ?? 'Medicine');
      setTimeout(() => { onResolved(res.medicine); onClose(); }, 900);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Please try again.');
      setSelecting(false);
    }
  }, [prescriptionId, medicine.id, onResolved, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    searchInputRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isAmbiguous = medicine.match_status === 'AMBIGUOUS';
  const displayCandidates = searchQuery.trim().length >= 2 ? searchResults : candidates;

  return (
    <div
      className="clarify-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Identify medicine"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="clarify-modal">
        <div className="clarify-header">
          <div className="clarify-header-icon" aria-hidden>
            {isAmbiguous ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
          </div>
          <div className="clarify-header-text">
            <h2 className="clarify-title">Identify Medicine</h2>
            <p className="clarify-subtitle">
              {isAmbiguous
                ? 'Multiple matches found. Which one was prescribed?'
                : "We couldn't identify this medicine. Please select or search."}
            </p>
          </div>
          <button id="clarify-close-btn" className="clarify-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="clarify-raw-name-row">
          <span className="clarify-label">From prescription:</span>
          <span className="clarify-raw-pill">{medicine.raw_name}</span>
        </div>

        <div className="clarify-search-wrap">
          <Search size={15} className="clarify-search-icon" aria-hidden />
          <input
            id="clarify-search-input"
            ref={searchInputRef}
            type="search"
            className="clarify-search-input"
            placeholder="Search medicine catalog…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search medicine catalog"
          />
          {searching && <Loader2 size={15} className="clarify-search-spinner" aria-hidden />}
        </div>

        {successName && (
          <div className="clarify-success-banner" role="status" aria-live="polite">
            <CheckCircle size={20} aria-hidden />
            <span>Saved as <strong>{successName}</strong></span>
          </div>
        )}
        {error && <p className="clarify-error" role="alert">{error}</p>}

        <div className="clarify-candidates-wrap" role="list" aria-label="Medicine candidates">
          {loadingCandidates ? (
            <div className="clarify-loading">
              <Loader2 size={20} className="spin" aria-hidden />
              <span>Finding matches…</span>
            </div>
          ) : displayCandidates.length === 0 ? (
            <div className="clarify-empty">
              {searchQuery.trim().length >= 2
                ? 'No medicines found. Try a different spelling.'
                : 'No suggestions available. Use the search box above.'}
            </div>
          ) : (
            displayCandidates.map((c) => (
              <CandidateCard key={c.medicine_id} candidate={c} onSelect={handleSelect} selecting={selecting} />
            ))
          )}
        </div>

        <p className="clarify-footer-hint">Can't find it? Contact your doctor or pharmacist.</p>
      </div>
    </div>
  );
}
