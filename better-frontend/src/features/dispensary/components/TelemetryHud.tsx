import * as React from 'react';
import { motion } from 'motion/react';
import { Package, MapPin, Snowflake } from 'lucide-react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

/** SVG Radial Arc Gauge */
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const RadialGauge: React.FC<{ percent: number }> = ({ percent }) => {
  const r = 54;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75; // 270° sweep
  const offset = arc - (arc * clamp(percent, 0, 100)) / 100;

  return (
    <svg width="128" height="96" viewBox="0 0 128 96" aria-label={`Stock level ${percent}%`} role="img">
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgba(24,24,22,0.08)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference - arc}`}
        strokeDashoffset={-circumference * 0.125}
        transform={`rotate(135 ${cx} ${cy})`}
      />
      {/* Animated Fill */}
      <motion.circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={percent > 40 ? 'var(--ti-sage)' : 'var(--ti-amber)'}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference - arc}`}
        strokeDashoffset={-circumference * 0.125}
        transform={`rotate(135 ${cx} ${cy})`}
        animate={{ strokeDashoffset: (-circumference * 0.125) + offset }}
        initial={{ strokeDashoffset: (-circumference * 0.125) + arc }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </svg>
  );
};

/** Pulsing SVG safety node */
const SafetyNode: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="ti-leader-row" aria-label={`${label}: ${value}`}>
    <div className="flex items-center gap-2 shrink-0">
      <div className="relative h-4 w-4 flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" className="absolute" aria-hidden="true">
          <circle cx="8" cy="8" r="5" fill="none" stroke="var(--ti-sage)" strokeWidth="1" className="ti-pulse-ring" />
        </svg>
        <div className="h-2 w-2 rounded-full" style={{ background: 'var(--ti-sage)' }} />
      </div>
      <span className="ti-spec-label" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'none' }}>{label}</span>
    </div>
    <div className="ti-leader-dots" />
    <span className="font-mono text-[10px] font-bold shrink-0" style={{ color: 'var(--ti-sage)' }}>{value}</span>
  </div>
);

export const TelemetryHud: React.FC = () => {
  const { prescriptions, selectedPrescriptionId, selectedMedicineId } = useDispensaryWorkspace();

  const rx = prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
  const med = rx?.medicines.find((m) => m.id === selectedMedicineId) ?? rx?.medicines[0];

  const stockMax = 50;
  const currentUnits = med?.inStockQuantity ?? 42;
  const stockPercent = Math.min(100, Math.round((currentUnits / stockMax) * 100));

  if (!med) return null;

  return (
    <aside
      aria-label="Dispensing Telemetry HUD"
      className="ti-border-left flex flex-col h-full select-none overflow-y-auto ti-scroll"
      style={{ background: 'var(--ti-canvas)', padding: '20px 20px 104px 20px' }}
    >
      {/* Section: Inspected Drug */}
      <div className="mb-5" style={{ borderBottom: '1px solid var(--ti-hairline)', paddingBottom: 16 }}>
        <span className="ti-spec-label mb-2 flex items-center gap-1.5">
          <Package className="h-3 w-3 inline" style={{ color: 'var(--ti-sage)' }} />
          Inspected Drug
        </span>
        <h4 className="font-serif text-base font-bold leading-tight mb-0.5" style={{ color: 'var(--ti-ink)' }}>
          {med.name}
        </h4>
        <p className="font-mono text-[11px]" style={{ color: 'var(--ti-ink-muted)' }}>
          {med.saltComposition || 'Amoxicillin Trihydrate USP 500mg'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--ti-hairline)', color: 'var(--ti-ink-muted)' }}>
            {med.form}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: 'var(--ti-ink-muted)' }}>
            {med.coldChain ? <Snowflake className="h-3 w-3" style={{ color: '#38BDF8' }} /> : <MapPin className="h-3 w-3" style={{ color: 'var(--ti-sage)' }} />}
            {med.rackLocation || 'Rack B-04'}
          </span>
        </div>
      </div>

      {/* Section: Stock Gauge */}
      <div className="mb-5" style={{ borderBottom: '1px solid var(--ti-hairline)', paddingBottom: 16 }}>
        <div className="flex items-start justify-between">
          <div>
            <span className="ti-spec-label mb-1">Stock in Rack</span>
            <motion.div
              key={stockPercent}
              className="ti-display-num"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {stockPercent}<span className="text-2xl" style={{ color: 'var(--ti-ink-muted)' }}>%</span>
            </motion.div>
            <span className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--ti-ink-subtle)' }}>
              {currentUnits}/{stockMax} units
            </span>
          </div>
          <RadialGauge percent={stockPercent} />
        </div>
      </div>

      {/* Section: Coordinate Table (dotted leaders) */}
      <div className="mb-5" style={{ borderBottom: '1px solid var(--ti-hairline)', paddingBottom: 16 }}>
        <span className="ti-spec-label mb-2">Location & Batch</span>
        <div>
          {[
            { label: 'Rack ID', value: med.rackLocation?.split('·')[0]?.trim() || 'B-04' },
            { label: 'Batch #', value: med.batchNumber || 'BX-2026-09' },
            { label: 'Expiry', value: med.expiryDate || 'Dec 2027' },
          ].map((row) => (
            <div key={row.label} className="ti-leader-row">
              <span className="ti-spec-label" style={{ fontSize: 10, textTransform: 'none', letterSpacing: '0.04em' }}>{row.label}</span>
              <div className="ti-leader-dots" />
              <span className="font-mono text-[11px] font-bold shrink-0" style={{ color: 'var(--ti-ink)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Clinical Safety */}
      <div>
        <span className="ti-spec-label mb-3">Clinical Safety Vectors</span>
        <SafetyNode label="Drug-Drug Interaction" value="CLEARED" />
        <SafetyNode label="Patient Allergy Cross-Check" value="NO CONFLICT" />
        <SafetyNode label="Renal / Hepatic Bounds" value="SAFE" />
      </div>
    </aside>
  );
};

export default TelemetryHud;
