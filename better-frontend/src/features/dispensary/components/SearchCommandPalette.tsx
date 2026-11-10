import * as React from 'react';
import { Search, User, FileText, CheckCircle2, ShieldCheck, ArrowLeftRight, Stethoscope } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Command } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import KeyCap from './KeyCap';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

interface SearchCommandPaletteProps {
  onOpenDoctorModal?: () => void;
  onTriggerVerify?: () => void;
  onTriggerSubstitute?: () => void;
}

export const SearchCommandPalette: React.FC<SearchCommandPaletteProps> = ({
  onOpenDoctorModal,
  onTriggerVerify,
  onTriggerSubstitute,
}) => {
  const {
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    prescriptions,
    selectedPrescriptionId,
    selectPrescription,
    markReady,
  } = useDispensaryWorkspace();

  useHotkeys(['ctrl+k', 'meta+k'], (e) => {
    e.preventDefault();
    if (isCommandPaletteOpen) closeCommandPalette();
    else openCommandPalette();
  });

  const handleRunCommand = (action: () => void) => {
    action();
    closeCommandPalette();
  };

  return (
    <>
      <button
        type="button"
        onClick={openCommandPalette}
        style={{
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.9)',
          borderRadius: 999,
          boxShadow: '0 2px 12px rgba(24,24,22,0.06)',
        }}
        className="group relative flex h-9 w-[380px] items-center justify-between px-4 text-left transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 shadow-sm"
        aria-label="Apple Spotlight Command Bar (⌘K / Ctrl+K)"
      >
        <div className="flex items-center gap-2.5 text-xs truncate" style={{ color: 'var(--ti-ink-subtle)' }}>
          <Search size={14} strokeWidth={2} style={{ color: 'var(--ti-ink-muted)' }} className="shrink-0" />
          <span className="truncate">Search prescriptions, patient, or type '&gt;'...</span>
        </div>
        <KeyCap>⌘K</KeyCap>
      </button>

      <Dialog open={isCommandPaletteOpen} onOpenChange={(v) => (v ? openCommandPalette() : closeCommandPalette())}>
        <DialogContent className="max-w-xl border border-white/10 bg-canvas-spruce/95 p-0 backdrop-blur-3xl shadow-2xl overflow-hidden rounded-3xl">
          <DialogTitle className="sr-only">Spotlight Command Palette</DialogTitle>
          <Command className="flex flex-col bg-transparent text-emerald-50">
            <div className="flex items-center border-b border-white/10 px-4 py-3">
              <Search size={18} strokeWidth={2} className="mr-3 text-accent-mint-primary" />
              <Command.Input
                placeholder="Type a command (> ready, > verify, > sub, > doctor) or search..."
                className="w-full bg-transparent text-sm text-white placeholder-emerald-200/40 focus:outline-none"
              />
            </div>

            <Command.List className="max-h-[360px] overflow-y-auto p-2">
              <Command.Empty className="p-4 text-center text-xs text-emerald-200/50">
                No matching records or commands.
              </Command.Empty>

              <Command.Group heading="Direct Workflow Commands" className="text-[11px] font-semibold text-mint-glow px-2 py-1.5 uppercase tracking-wider">
                <Command.Item
                  onSelect={() => handleRunCommand(() => markReady(selectedPrescriptionId))}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs text-white hover:bg-white/10 aria-selected:bg-mint-400/20"
                >
                  <span className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-accent-mint-primary" />
                    <span>&gt; ready · Mark Active Rx Ready for Pickup</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-300/60">⌘Enter</span>
                </Command.Item>

                <Command.Item
                  onSelect={() => handleRunCommand(() => onTriggerVerify?.())}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs text-white hover:bg-white/10 aria-selected:bg-mint-400/20"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck size={16} className="text-mint-glow" />
                    <span>&gt; verify · Open 6-Digit OTP Handover Verification</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-300/60">Dynamic Island</span>
                </Command.Item>

                <Command.Item
                  onSelect={() => handleRunCommand(() => onTriggerSubstitute?.())}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs text-white hover:bg-white/10 aria-selected:bg-mint-400/20"
                >
                  <span className="flex items-center gap-2.5">
                    <ArrowLeftRight size={16} className="text-teal-300" />
                    <span>&gt; sub · 3D Equivalent Medication Substitution Flip</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-300/60">Card Flip</span>
                </Command.Item>

                <Command.Item
                  onSelect={() => handleRunCommand(() => onOpenDoctorModal?.())}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs text-white hover:bg-white/10 aria-selected:bg-mint-400/20"
                >
                  <span className="flex items-center gap-2.5">
                    <Stethoscope size={16} className="text-amber-warn" />
                    <span>&gt; doctor · Physician Reconsultation Hold Modal</span>
                  </span>
                  <span className="font-mono text-[10px] text-amber-warn/80">[ON HOLD]</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Prescriptions & Patients" className="text-[11px] font-semibold text-mint-glow px-2 py-1.5 uppercase tracking-wider">
                {prescriptions.map((rx) => (
                  <Command.Item
                    key={rx.id}
                    onSelect={() => handleRunCommand(() => selectPrescription(rx.id))}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs text-white hover:bg-white/10 aria-selected:bg-mint-400/20"
                  >
                    <span className="flex items-center gap-2.5">
                      <User size={16} className="text-emerald-300" />
                      <span className="font-semibold">{rx.patientName}</span>
                      <span className="text-emerald-200/50">({rx.patientAge}y · {rx.bloodGroup || 'Blood O+'})</span>
                    </span>
                    <span className="font-mono text-[11px] text-accent-mint-primary">{rx.rxNumber}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SearchCommandPalette;
