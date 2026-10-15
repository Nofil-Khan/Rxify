import { useState, useEffect, useMemo } from 'react';
import {
  GitBranch, Clock, Calendar, CheckCircle2, AlertCircle,
  XCircle, Pill, RefreshCw, FileText, Sparkles, Filter,
  ArrowRight, Info, Check, ShieldAlert, ChevronRight, Activity
} from 'lucide-react';
import {
  fetchMedicationTimeline, updateMedicationStatus,
  type MedicationTimelineResponse, type TimelineMilestone,
  type TimelineMedicationItem, type FlowchartLink, type MedicationTransition
} from '../../../lib/patientApi';

interface StatusModalState {
  isOpen: boolean;
  item: TimelineMedicationItem | null;
  newStatus: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';
  endDate: string;
  notes: string;
  submitting: boolean;
  error: string;
}

export default function MedicationTimelineTab() {
  const [data, setData] = useState<MedicationTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMedName, setSelectedMedName] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'discontinued'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Status adjustment modal state
  const [statusModal, setStatusModal] = useState<StatusModalState>({
    isOpen: false,
    item: null,
    newStatus: 'DISCONTINUED',
    endDate: new Date().toISOString().split('T')[0],
    notes: '',
    submitting: false,
    error: '',
  });

  const loadTimeline = () => {
    setLoading(true);
    setError('');
    fetchMedicationTimeline()
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load medication timeline.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTimeline();
  }, []);

  const openStatusModal = (item: TimelineMedicationItem, defaultStatus: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED' = 'DISCONTINUED') => {
    setStatusModal({
      isOpen: true,
      item,
      newStatus: defaultStatus,
      endDate: item.end_date || new Date().toISOString().split('T')[0],
      notes: item.notes || '',
      submitting: false,
      error: '',
    });
  };

  const closeStatusModal = () => {
    setStatusModal((prev) => ({ ...prev, isOpen: false, item: null }));
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal.item) return;

    setStatusModal((prev) => ({ ...prev, submitting: true, error: '' }));
    try {
      await updateMedicationStatus(
        statusModal.item.current_medication_id,
        statusModal.newStatus,
        statusModal.endDate || undefined,
        statusModal.notes || undefined
      );
      closeStatusModal();
      loadTimeline();
    } catch (err: any) {
      setStatusModal((prev) => ({
        ...prev,
        submitting: false,
        error: err?.message || 'Failed to update medication status.',
      }));
    }
  };

  // Filtered milestones based on query and status
  const filteredMilestones = useMemo(() => {
    if (!data?.milestones) return [];
    return data.milestones.map((m) => {
      const meds = m.medications.filter((item) => {
        const matchesSearch =
          !searchQuery ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.generic_name && item.generic_name.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        if (filterMode === 'active') {
          return item.transition === 'STARTED' || item.transition === 'CONTINUED';
        }
        if (filterMode === 'discontinued') {
          return item.transition === 'DISCONTINUED' || item.transition === 'COMPLETED';
        }
        return true;
      });
      return {
        ...m,
        medications: meds,
      };
    });
  }, [data, searchQuery, filterMode]);

  if (loading) {
    return (
      <div className="pd-loading" style={{ minHeight: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <RefreshCw size={28} className="rx-spin" style={{ color: 'var(--pd-teal)' }} />
        <p style={{ color: 'var(--pd-text-muted)', fontSize: '0.95rem' }}>Mapping medication flowchart & timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pd-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--pd-red)', margin: '0 auto 0.75rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--pd-text-main)', marginBottom: '0.5rem' }}>Could not load medication timeline</h3>
        <p style={{ color: 'var(--pd-text-muted)', marginBottom: '1.25rem' }}>{error}</p>
        <button className="pd-btn pd-btn-primary" onClick={loadTimeline}>
          <RefreshCw size={15} style={{ marginRight: '6px' }} /> Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary || {
    total_prescriptions: 0,
    total_tracked_medications: 0,
    active_now_count: 0,
    discontinued_count: 0,
    completed_count: 0,
    timeline_nodes_count: 0,
  };

  const activeNow = data?.active_now || [];

  return (
    <div className="med-timeline-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ── Header & High-Level Summary ── */}
      <div className="pd-card" style={{ padding: '1.5rem', background: 'var(--pd-bg-card)', border: '1px solid var(--pd-border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div style={{ padding: '6px 10px', background: 'var(--pd-teal-bg)', color: 'var(--pd-teal)', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                <GitBranch size={16} /> Active Regimen Flowchart
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--pd-text-muted)' }}>Auto-synced with prescriptions</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--pd-text-main)', margin: '0 0 0.35rem 0' }}>
              Medication Regimen & Timeline
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--pd-text-muted)', margin: 0, maxWidth: '680px' }}>
              Visual tracking of every medication prescribed, continued, or discontinued across your clinical visits.
              Hover or click any medication to highlight its continuity path across time.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={loadTimeline}
              className="pd-icon-btn"
              title="Refresh timeline"
              style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <RefreshCw size={15} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* ── Summary Counters ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <div className="med-stat-card" style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Right Now</span>
              <Activity size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--pd-text-main)' }}>
              {summary.active_now_count}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--pd-text-muted)' }}>Current daily regimen</span>
          </div>

          <div className="med-stat-card" style={{ padding: '1rem', background: 'rgba(14, 165, 233, 0.08)', borderRadius: '10px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Timeline Milestones</span>
              <Calendar size={18} style={{ color: '#0ea5e9' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--pd-text-main)' }}>
              {summary.timeline_nodes_count}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--pd-text-muted)' }}>Distinct clinical dates</span>
          </div>

          <div className="med-stat-card" style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prescriptions</span>
              <FileText size={18} style={{ color: '#6366f1' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--pd-text-main)' }}>
              {summary.total_prescriptions}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--pd-text-muted)' }}>Linked medical records</span>
          </div>

          <div className="med-stat-card" style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Discontinued / Done</span>
              <CheckCircle2 size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--pd-text-main)' }}>
              {summary.discontinued_count + summary.completed_count}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--pd-text-muted)' }}>Finished or stopped</span>
          </div>
        </div>
      </div>

      {/* ── Active Daily Regimen Bar ── */}
      {activeNow.length > 0 && (
        <div className="pd-card" style={{ padding: '1.25rem', background: 'var(--pd-bg-card-sub)', border: '1px solid var(--pd-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pill size={18} style={{ color: 'var(--pd-teal)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--pd-text-main)' }}>
                Current Medications in Progress ({activeNow.length})
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--pd-text-muted)' }}>
              Click any medication to adjust status or mark as discontinued
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
            {activeNow.map((med) => (
              <div
                key={med.current_medication_id}
                className="active-med-card"
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: 'var(--pd-bg-card)',
                  border: '1px solid var(--pd-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
                onClick={() => openStatusModal(med, 'DISCONTINUED')}
                title="Click to update status or mark discontinued"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--pd-text-main)' }}>
                    {med.name}
                  </span>
                  <span className="pd-badge pd-badge--green" style={{ fontSize: '0.7rem' }}>
                    Active
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--pd-text-muted)' }}>
                  {med.dosage ? `${med.dosage} • ` : ''}
                  {med.frequency || 'Daily schedule'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid var(--pd-border)', fontSize: '0.75rem', color: 'var(--pd-text-muted)' }}>
                  <span>Since {med.start_date || 'Prescribed date'}</span>
                  <span style={{ color: 'var(--pd-teal)', fontWeight: 600 }}>Manage ➔</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Controls: Search & Filter ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Filter by medicine name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pd-input"
              style={{
                paddingLeft: '2rem',
                fontSize: '0.85rem',
                paddingTop: '6px',
                paddingBottom: '6px',
                borderRadius: '8px',
                width: '100%',
              }}
            />
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--pd-text-muted)', pointerEvents: 'none' }}>
              🔍
            </span>
          </div>

          <div style={{ display: 'flex', background: 'var(--pd-bg-card-sub)', padding: '3px', borderRadius: '8px', border: '1px solid var(--pd-border)' }}>
            <button
              onClick={() => setFilterMode('all')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: filterMode === 'all' ? 'var(--pd-teal)' : 'transparent',
                color: filterMode === 'all' ? '#ffffff' : 'var(--pd-text-muted)',
                cursor: 'pointer',
              }}
            >
              All States
            </button>
            <button
              onClick={() => setFilterMode('active')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: filterMode === 'active' ? '#10b981' : 'transparent',
                color: filterMode === 'active' ? '#ffffff' : 'var(--pd-text-muted)',
                cursor: 'pointer',
              }}
            >
              Active / Continued
            </button>
            <button
              onClick={() => setFilterMode('discontinued')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: filterMode === 'discontinued' ? '#f59e0b' : 'transparent',
                color: filterMode === 'discontinued' ? '#ffffff' : 'var(--pd-text-muted)',
                cursor: 'pointer',
              }}
            >
              Discontinued / Ended
            </button>
          </div>
        </div>

        {selectedMedName && (
          <button
            onClick={() => setSelectedMedName(null)}
            className="pd-btn"
            style={{ fontSize: '0.78rem', padding: '4px 10px', background: 'var(--pd-bg-card-sub)' }}
          >
            Clear path highlight: <strong>{selectedMedName}</strong> ✕
          </button>
        )}
      </div>

      {/* ── FLOWCHART TIMELINE VIEW ── */}
      {filteredMilestones.length === 0 ? (
        <div className="pd-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <Pill size={36} style={{ color: 'var(--pd-text-muted)', margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.05rem', color: 'var(--pd-text-main)', marginBottom: '0.35rem' }}>
            No medication history recorded yet
          </h3>
          <p style={{ color: 'var(--pd-text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            When prescriptions are uploaded and processed, medications will automatically populate this timeline with flowchart continuity.
          </p>
        </div>
      ) : (
        <div
          className="timeline-horizontal-scroll"
          style={{
            overflowX: 'auto',
            paddingBottom: '1.5rem',
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
        >
          {filteredMilestones.map((milestone, mIdx) => {
            return (
              <div
                key={milestone.date}
                className="timeline-milestone-column"
                style={{
                  minWidth: '320px',
                  maxWidth: '360px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                {/* Milestone Node Header */}
                <div
                  className="milestone-header"
                  style={{
                    background: 'var(--pd-bg-card)',
                    border: '1px solid var(--pd-border)',
                    borderTop: '3px solid var(--pd-teal)',
                    borderRadius: '12px 12px 0 0',
                    padding: '1rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--pd-teal)',
                        background: 'var(--pd-teal-bg)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      Step #{mIdx + 1}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--pd-text-main)' }}>
                      {milestone.display_date}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--pd-text-main)', margin: '0.2rem 0' }}>
                    {milestone.title}
                  </h4>

                  {milestone.doctors.length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--pd-text-muted)' }}>
                      Dr. {milestone.doctors.join(', ')}
                    </div>
                  )}

                  {milestone.diagnoses.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--pd-blue)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      Diagnosis: {milestone.diagnoses.join(', ')}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--pd-border)', fontSize: '0.76rem', color: 'var(--pd-text-muted)' }}>
                    <span>Active at this date:</span>
                    <strong style={{ color: 'var(--pd-text-main)' }}>{milestone.total_active_meds} meds</strong>
                  </div>
                </div>

                {/* Milestone Medications List / Flowchart Items */}
                <div
                  className="milestone-med-list"
                  style={{
                    background: 'var(--pd-bg-card-sub)',
                    border: '1px solid var(--pd-border)',
                    borderTop: 'none',
                    borderRadius: '0 0 12px 12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    flex: 1,
                  }}
                >
                  {milestone.medications.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--pd-text-muted)', fontSize: '0.82rem' }}>
                      No medications match the current filter.
                    </div>
                  ) : (
                    milestone.medications.map((med) => {
                      const isHighlighted = selectedMedName && med.name.toLowerCase() === selectedMedName.toLowerCase();
                      const isDimmed = selectedMedName && med.name.toLowerCase() !== selectedMedName.toLowerCase();

                      // Status appearance styling
                      let badgeColor = '#10b981';
                      let badgeBg = 'rgba(16, 185, 129, 0.12)';
                      let badgeLabel = '✨ New';
                      let cardBorder = 'var(--pd-border)';

                      if (med.transition === 'CONTINUED') {
                        badgeColor = '#0ea5e9';
                        badgeBg = 'rgba(14, 165, 233, 0.12)';
                        badgeLabel = '➔ Continued';
                      } else if (med.transition === 'DISCONTINUED') {
                        badgeColor = '#ef4444';
                        badgeBg = 'rgba(239, 68, 68, 0.12)';
                        badgeLabel = '✕ Discontinued';
                        cardBorder = 'rgba(239, 68, 68, 0.3)';
                      } else if (med.transition === 'COMPLETED') {
                        badgeColor = '#f59e0b';
                        badgeBg = 'rgba(245, 158, 11, 0.12)';
                        badgeLabel = '✓ Course Ended';
                        cardBorder = 'rgba(245, 158, 11, 0.3)';
                      }

                      if (isHighlighted) {
                        cardBorder = 'var(--pd-teal)';
                      }

                      return (
                        <div
                          key={med.node_item_id}
                          className="flowchart-med-card"
                          style={{
                            background: 'var(--pd-bg-card)',
                            border: `1.5px solid ${cardBorder}`,
                            borderRadius: '10px',
                            padding: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            opacity: isDimmed ? 0.35 : 1,
                            transform: isHighlighted ? 'scale(1.02)' : 'none',
                            transition: 'all 0.18s ease',
                            boxShadow: isHighlighted ? '0 0 12px rgba(13, 148, 136, 0.25)' : 'none',
                          }}
                          onMouseEnter={() => setSelectedMedName(med.name)}
                          onClick={() => openStatusModal(med, med.status === 'ACTIVE' ? 'DISCONTINUED' : 'ACTIVE')}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--pd-text-main)' }}>
                              {med.name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: badgeColor,
                                background: badgeBg,
                                padding: '2px 7px',
                                borderRadius: '999px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {badgeLabel}
                            </span>
                          </div>

                          {med.generic_name && med.generic_name !== med.name && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--pd-text-muted)' }}>
                              {med.generic_name}
                            </span>
                          )}

                          <div style={{ fontSize: '0.78rem', color: 'var(--pd-text-main)', marginTop: '2px' }}>
                            {med.dosage ? <strong>{med.dosage}</strong> : null}
                            {med.dosage && med.frequency ? ' • ' : ''}
                            {med.frequency ? <span>{med.frequency}</span> : null}
                          </div>

                          {med.duration && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--pd-text-muted)' }}>
                              Duration: {med.duration}
                            </div>
                          )}

                          {med.transition === 'CONTINUED' && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                color: '#0ea5e9',
                                background: 'rgba(14, 165, 233, 0.08)',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                marginTop: '4px',
                              }}
                            >
                              <ArrowRight size={12} />
                              <span>Carried over from earlier prescription</span>
                            </div>
                          )}

                          {med.transition === 'DISCONTINUED' && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                color: '#ef4444',
                                background: 'rgba(239, 68, 68, 0.08)',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                marginTop: '4px',
                              }}
                            >
                              <AlertCircle size={12} />
                              <span>Stopped {med.end_date ? `on ${med.end_date}` : ''} {med.notes ? `(${med.notes})` : ''}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--pd-border)', fontSize: '0.72rem', color: 'var(--pd-text-muted)' }}>
                            <span>Status: {med.status}</span>
                            <span style={{ color: 'var(--pd-teal)' }}>Click to edit</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Status Adjustment Modal ── */}
      {statusModal.isOpen && statusModal.item && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={closeStatusModal}
        >
          <div
            className="modal-box"
            style={{
              background: 'var(--pd-bg-card)',
              border: '1px solid var(--pd-border)',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span className="pd-badge pd-badge--teal" style={{ marginBottom: '0.4rem' }}>
                  Manage Regimen
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--pd-text-main)', margin: '0.2rem 0' }}>
                  {statusModal.item.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--pd-text-muted)', margin: 0 }}>
                  Adjust continuity, record discontinuation, or update therapy duration.
                </p>
              </div>
              <button
                onClick={closeStatusModal}
                style={{ background: 'none', border: 'none', color: 'var(--pd-text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {statusModal.error && (
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--pd-red)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {statusModal.error}
              </div>
            )}

            <form onSubmit={handleStatusSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--pd-text-main)', display: 'block', marginBottom: '0.4rem' }}>
                  Medication Regimen State
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setStatusModal((p) => ({ ...p, newStatus: 'ACTIVE' }))}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: statusModal.newStatus === 'ACTIVE' ? '2px solid #10b981' : '1px solid var(--pd-border)',
                      background: statusModal.newStatus === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'var(--pd-bg-card-sub)',
                      color: statusModal.newStatus === 'ACTIVE' ? '#10b981' : 'var(--pd-text-main)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Active / In Use
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusModal((p) => ({ ...p, newStatus: 'DISCONTINUED' }))}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: statusModal.newStatus === 'DISCONTINUED' ? '2px solid #ef4444' : '1px solid var(--pd-border)',
                      background: statusModal.newStatus === 'DISCONTINUED' ? 'rgba(239, 68, 68, 0.1)' : 'var(--pd-bg-card-sub)',
                      color: statusModal.newStatus === 'DISCONTINUED' ? '#ef4444' : 'var(--pd-text-main)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Discontinued
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusModal((p) => ({ ...p, newStatus: 'COMPLETED' }))}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: statusModal.newStatus === 'COMPLETED' ? '2px solid #f59e0b' : '1px solid var(--pd-border)',
                      background: statusModal.newStatus === 'COMPLETED' ? 'rgba(245, 158, 11, 0.1)' : 'var(--pd-bg-card-sub)',
                      color: statusModal.newStatus === 'COMPLETED' ? '#f59e0b' : 'var(--pd-text-main)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Course Finished
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--pd-text-main)', display: 'block', marginBottom: '0.4rem' }}>
                  Effective End Date
                </label>
                <input
                  type="date"
                  value={statusModal.endDate}
                  onChange={(e) => setStatusModal((p) => ({ ...p, endDate: e.target.value }))}
                  className="pd-input"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--pd-text-muted)', marginTop: '3px', display: 'block' }}>
                  Date when taking this medicine ceased or will cease.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--pd-text-main)', display: 'block', marginBottom: '0.4rem' }}>
                  Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advised to stop by doctor; side effects; completed antibiotics course"
                  value={statusModal.notes}
                  onChange={(e) => setStatusModal((p) => ({ ...p, notes: e.target.value }))}
                  className="pd-input"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={closeStatusModal}
                  className="pd-btn"
                  style={{ background: 'var(--pd-bg-card-sub)', border: '1px solid var(--pd-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusModal.submitting}
                  className="pd-btn pd-btn-primary"
                  style={{ minWidth: '110px' }}
                >
                  {statusModal.submitting ? 'Updating...' : 'Save Regimen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
