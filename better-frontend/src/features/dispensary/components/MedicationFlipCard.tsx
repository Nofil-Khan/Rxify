import * as React from 'react';
import { motion } from 'motion/react';
import { Check, ArrowLeftRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { WorkspaceMedicine } from '../types';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

interface MedicationFlipCardProps {
  medicine: WorkspaceMedicine;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  forceFlip?: boolean;
}

export const MedicationFlipCard: React.FC<MedicationFlipCardProps> = ({
  medicine,
  isSelected,
  onSelect,
  forceFlip,
}) => {
  const { toggleMedicinePicked, substituteMedicine } = useDispensaryWorkspace();
  const [isFlipped, setIsFlipped] = React.useState(false);

  React.useEffect(() => {
    if (forceFlip !== undefined) setIsFlipped(forceFlip ?? false);
  }, [forceFlip]);

  const sub = medicine.substituteAlternative || {
    name: 'Augmentin 625mg',
    form: 'Tablet',
    rack: 'Rack B-06',
    inStock: 35,
    salt: 'Co-Amoxiclav 625mg',
  };

  const handleConfirmSub = (e: React.MouseEvent) => {
    e.stopPropagation();
    substituteMedicine(medicine.id, sub);
    setIsFlipped(false);
  };

  return (
    <div className="relative w-full" style={{ minHeight: 80, perspective: '1200px' }}>
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative w-full h-full"
      >
        {/* FRONT */}
        <div
          style={{ backfaceVisibility: 'hidden' }}
          onClick={onSelect}
          className="w-full cursor-pointer ti-med-strip flex items-center justify-between gap-3 px-1"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleMedicinePicked(medicine.id); }}
              aria-label={`Toggle pick status for ${medicine.name}`}
              className="h-7 w-7 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:outline-none"
              style={medicine.picked
                ? { background: 'var(--ti-sage)', borderColor: 'var(--ti-sage)', color: '#fff' }
                : { borderColor: 'var(--ti-hairline-strong)', background: 'transparent' }
              }
            >
              {medicine.picked && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </motion.div>
              )}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="font-semibold text-[13px] truncate"
                  style={{ color: medicine.picked ? 'var(--ti-ink-muted)' : 'var(--ti-ink)', textDecoration: medicine.picked ? 'line-through' : 'none' }}
                >
                  {medicine.name}
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--ti-hairline)', color: 'var(--ti-ink-muted)' }}>
                  {medicine.form}
                </span>
                {medicine.isSubstituted && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--ti-sage-light)', color: 'var(--ti-sage)' }}>
                    Substituted
                  </span>
                )}
                {isSelected && !isFlipped && (
                  <motion.span
                    layoutId="selectedMedPip"
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--ti-sage)' }}
                  />
                )}
              </div>
              <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--ti-ink-subtle)' }}>
                {medicine.dosageInstructions || '1-0-1 × 5 Days · After Food'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="ti-spec-label">Qty</span>
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--ti-ink)' }}>
                {medicine.prescribedQuantity}{medicine.form === 'Capsule' ? 'C' : 'T'}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              aria-label={`Substitute ${medicine.name}`}
              className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold cursor-pointer transition-all focus-visible:ring-2 focus-visible:outline-none"
              style={{ borderColor: 'var(--ti-hairline-strong)', background: 'rgba(255,255,255,0.6)', color: 'var(--ti-ink-muted)' }}
            >
              <ArrowLeftRight className="h-3 w-3" style={{ color: 'var(--ti-sage)' }} />
              <span>Sub</span>
            </button>
          </div>
        </div>

        {/* BACK (Substitution View) */}
        <div
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', top: 0, left: 0, right: 0 }}
          className="absolute rounded-xl p-3 flex items-center justify-between gap-3"
          aria-hidden={!isFlipped}
        >
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5" style={{ color: 'var(--ti-sage)' }}>
              <CheckCircle2 className="h-3 w-3" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider">Bio-Equivalent Match</span>
            </div>
            <h5 className="font-bold text-xs truncate mt-0.5" style={{ color: 'var(--ti-ink)' }}>{sub.name}</h5>
            <p className="font-mono text-[10px]" style={{ color: 'var(--ti-ink-muted)' }}>
              {sub.rack} · Stock: <strong style={{ color: 'var(--ti-sage)' }}>{sub.inStock} units</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
              aria-label="Cancel substitution"
              className="p-1.5 rounded-lg border cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
              style={{ borderColor: 'var(--ti-hairline-strong)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" style={{ color: 'var(--ti-ink-muted)' }} />
            </button>
            <button
              type="button"
              onClick={handleConfirmSub}
              aria-label="Confirm substitution and reserve stock"
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-white cursor-pointer transition-all focus-visible:ring-2 focus-visible:outline-none"
              style={{ background: 'var(--ti-sage)' }}
            >
              Confirm & Reserve
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MedicationFlipCard;
