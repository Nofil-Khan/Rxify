import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Upload, FileText } from 'lucide-react';
import {
  fetchTimelinePrescriptions,
  type TimelinePrescriptionItem,
  type TimelinePrescriptionMedication,
  type Medication,
  type ResolvedMedicine,
} from '../../../../lib/patientApi';
import PrescriptionCard from './PrescriptionCard';
import MedicationsPanel from './MedicationsPanel';
import SideGhostPanel from './SideGhostPanel';
import { PrescriptionDetailView } from '../MyPrescriptions';
import ClarifyMedicineModal from '../ClarifyMedicineModal';

const EASE = [0.22, 1, 0.36, 1] as const;

function convertToMedication(med: TimelinePrescriptionMedication): Medication {
  return {
    id: med.prescription_medicine_id || Number(med.id) || 0,
    raw_name: med.raw_name || med.name,
    match_status: med.match_status ?? null,
    patient_resolved: Boolean(med.patient_resolved),
    medicine_id: med.medicine_id ?? null,
    name: med.name,
    generic_name: med.generic_name ?? null,
    brand_name: med.brand_name ?? null,
    strength: med.strength ?? null,
    form: med.form ?? null,
    category: med.category ?? null,
    dosage: med.dosage ?? null,
    frequency: med.frequency ?? null,
    duration: med.duration ?? null,
    instructions: med.instructions ?? null,
    date: null,
  };
}

/**
 * MedicationTimeline — Spatial floating-window interface.
 *
 * Displays the active prescription in two connected floating windows
 * (upper: prescription header & clinical context; lower: medications list with tabs)
 * surrounded by curved side panels for older/newer prescriptions, creating a cylindrical
 * spatial depth.
 *
 * Connected directly to live backend and database records.
 */
export default function MedicationTimeline() {
  const prefersReduced = useReducedMotion();
  const [prescriptions, setPrescriptions] = useState<TimelinePrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Modal / detail view state
  const [activeDetailRxId, setActiveDetailRxId] = useState<number | null>(null);
  const [clarifyModal, setClarifyModal] = useState<{
    prescriptionId: number;
    medicine: Medication;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTimelinePrescriptions();
      setPrescriptions(data);

      if (data.length > 0) {
        // Find latest prescription with medications, or default to the last item
        let defaultIdx = data.length - 1;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i].medications && data[i].medications.length > 0) {
            defaultIdx = i;
            break;
          }
        }
        setActiveIndex(defaultIdx);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load prescription timeline from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClarifyResolved = (resolved: ResolvedMedicine) => {
    setPrescriptions((prev) =>
      prev.map((rx) => {
        if (rx.id !== resolved.prescription_id) return rx;
        return {
          ...rx,
          medications: rx.medications.map((m) =>
            m.prescription_medicine_id === resolved.pm_id
              ? {
                  ...m,
                  medicine_id: resolved.medicine_id,
                  match_status: 'MATCHED' as const,
                  patient_resolved: true,
                  name: resolved.brand_name || resolved.generic_name || m.name,
                  generic_name: resolved.generic_name,
                  brand_name: resolved.brand_name,
                  strength: resolved.strength || m.strength,
                  form: (resolved.form || m.form || 'Medicine'),
                  category: resolved.category || m.category,
                }
              : m
          ),
        };
      })
    );
    setClarifyModal(null);
  };

  /* Shared Motion props — respects prefers-reduced-motion */
  const cardTransition = {
    duration: prefersReduced ? 0.2 : 0.45,
    ease: EASE,
  };

  // If detailed view is active, render PrescriptionDetailView seamlessly
  if (activeDetailRxId !== null) {
    return (
      <div style={{ padding: '1rem', minHeight: '80vh' }}>
        <PrescriptionDetailView
          rxId={activeDetailRxId}
          onBack={() => setActiveDetailRxId(null)}
        />
      </div>
    );
  }

  // Loading skeleton state
  if (loading) {
    return (
      <div className="mt-scene">
        <div className="mt-stage" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="mt-center" style={{ opacity: 0.85 }}>
            <div
              className="mt-float-card"
              style={{
                height: 220,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                borderRadius: 24,
              }}
            >
              <RefreshCw className="animate-spin" size={28} style={{ color: '#2563EB' }} />
              <p style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>
                Loading spatial prescription timeline...
              </p>
            </div>
            <div
              className="mt-glass-tray"
              style={{ height: 260, borderRadius: 24, opacity: 0.6 }}
            />
          </div>
          <div className="mt-floor-dais" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-scene">
        <div className="mt-stage" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="mt-float-card"
            style={{
              maxWidth: 520,
              padding: '2.5rem 2rem',
              textAlign: 'center',
              borderRadius: 24,
            }}
          >
            <AlertCircle size={36} style={{ color: '#EF4444', margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A' }}>
              Unable to load timeline
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: 6, lineHeight: 1.5 }}>
              {error}
            </p>
            <button
              onClick={loadData}
              style={{
                marginTop: '1.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '0.6rem 1.4rem',
                borderRadius: 999,
                background: '#2563EB',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.84rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} />
              <span>Retry</span>
            </button>
          </div>
          <div className="mt-floor-dais" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // Empty state
  if (prescriptions.length === 0) {
    return (
      <div className="mt-scene">
        <div className="mt-stage" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="mt-float-card"
            style={{
              maxWidth: 540,
              padding: '3rem 2.5rem',
              textAlign: 'center',
              borderRadius: 24,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 20,
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <FileText size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
              No Prescriptions Found
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748B', marginTop: 8, lineHeight: 1.5 }}>
              You don't have any prescriptions recorded yet. Upload your first prescription scan to explore your timeline in this spatial 3D interface.
            </p>
          </div>
          <div className="mt-floor-dais" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const current   = prescriptions[activeIndex] || prescriptions[0];
  const nearLeft  = activeIndex > 0 ? prescriptions[activeIndex - 1] : null;
  const farLeft   = activeIndex > 1 ? prescriptions[activeIndex - 2] : null;
  const nearRight = activeIndex < prescriptions.length - 1 ? prescriptions[activeIndex + 1] : null;
  const farRight  = activeIndex < prescriptions.length - 2 ? prescriptions[activeIndex + 2] : null;

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < prescriptions.length - 1;

  const handlePrev = () => {
    if (canGoPrev) setActiveIndex((i) => i - 1);
  };

  const handleNext = () => {
    if (canGoNext) setActiveIndex((i) => i + 1);
  };

  return (
    <div className="mt-scene">

      {/* ── mt-stage: preserve-3d shell — all windows share the scene frustum ── */}
      <div className="mt-stage">

        {/* ── Side Ghost Panels (curved cylindrical perspective) ──────── */}
        {farLeft && (
          <SideGhostPanel
            prescription={farLeft}
            side="left"
            variant="far"
            onClick={() => setActiveIndex(activeIndex - 2)}
          />
        )}
        {nearLeft && (
          <SideGhostPanel
            prescription={nearLeft}
            side="left"
            variant="near"
            onClick={() => setActiveIndex(activeIndex - 1)}
          />
        )}
        {nearRight && (
          <SideGhostPanel
            prescription={nearRight}
            side="right"
            variant="near"
            onClick={() => setActiveIndex(activeIndex + 1)}
          />
        )}
        {farRight && (
          <SideGhostPanel
            prescription={farRight}
            side="right"
            variant="far"
            onClick={() => setActiveIndex(activeIndex + 2)}
          />
        )}

        {/* ── Floating Circular Navigation Controls ─────────────────────── */}
        <button
          type="button"
          className="mt-nav-btn mt-nav-btn--left"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Previous prescription in timeline"
        >
          <ChevronLeft size={22} />
        </button>

        <button
          type="button"
          className="mt-nav-btn mt-nav-btn--right"
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Next prescription in timeline"
        >
          <ChevronRight size={22} />
        </button>

        {/* ── Centre Column — Two connected floating windows ──────────── */}
        <div className="mt-center">

          {/* Upper window — prescription header, clinical context & instructions.
              Anchored at the bottom, tilts slightly away from the viewer at
              the top (5.5°) to share the virtual ground plane with the lower window. */}
          <div className="mt-window--upper">
            <AnimatePresence mode="wait">
              <motion.div
                key={`rx-upper-${current.id}`}
                initial={{ opacity: 0, y: prefersReduced ? 0 : 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: prefersReduced ? 0 : -10, scale: 0.98 }}
                transition={cardTransition}
              >
                <PrescriptionCard
                  prescription={current}
                  onOpenDetail={(rxId) => setActiveDetailRxId(rxId)}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Spatial connection seam between upper & lower surfaces ── */}
          <div className="mt-spatial-bridge" aria-hidden="true">
            <div className="mt-bridge-line" />
            <div className="mt-bridge-pill">
              <span className="mt-bridge-dot" />
              <span>Prescription Regimen Console</span>
            </div>
            <div className="mt-bridge-line mt-bridge-line--rev" />
          </div>

          {/* Lower window — medication list with glass tray & sidebar tabs.
              Anchored at the top, tilts the opposite way (-5°), meeting the upper
              window at their shared hinge edge for coherent vertical curvature. */}
          <div className="mt-window--lower">
            <AnimatePresence mode="wait">
              <motion.div
                key={`rx-lower-${current.id}`}
                initial={{ opacity: 0, y: prefersReduced ? 0 : 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: prefersReduced ? 0 : -12, scale: 0.98 }}
                transition={{ ...cardTransition, delay: 0.05 }}
              >
                <MedicationsPanel
                  prescription={current}
                  onOpenDetail={(rxId) => setActiveDetailRxId(rxId)}
                  onSelectMedicine={(med) =>
                    setClarifyModal({
                      prescriptionId: current.id,
                      medicine: convertToMedication(med),
                    })
                  }
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Timeline Track (interactive milestone pills) ─────────────── */}
        <nav
          className="mt-timeline-track"
          role="tablist"
          aria-label="Prescription timeline milestones"
        >
          {prescriptions.map((rx, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={rx.id}
                type="button"
                className={`mt-track-pill ${isActive ? 'mt-track-pill--active' : ''}`}
                onClick={() => setActiveIndex(idx)}
                aria-selected={isActive}
                role="tab"
              >
                <span className="mt-track-dot" />
                <span>{rx.display_date}</span>
                {rx.is_latest && (
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      color: isActive ? '#2563EB' : '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Latest
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── 3D Glowing Circular Platform Dais (spatial stage pedestal) ─ */}
        <div className="mt-floor-dais" aria-hidden="true" />

      </div>{/* /mt-stage */}

      {/* ── Clarify / Resolve Medicine Modal ── */}
      {clarifyModal && (
        <ClarifyMedicineModal
          prescriptionId={clarifyModal.prescriptionId}
          medicine={clarifyModal.medicine}
          onResolved={handleClarifyResolved}
          onClose={() => setClarifyModal(null)}
        />
      )}
    </div>
  );
}
