import * as React from 'react';
import { Stethoscope, X, AlertTriangle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

interface DoctorQueryModalProps {
  open: boolean;
  onClose: () => void;
}

export const DoctorQueryModal: React.FC<DoctorQueryModalProps> = ({ open, onClose }) => {
  const { prescriptions, selectedPrescriptionId, holdPrescription } = useDispensaryWorkspace();
  const currentRx = prescriptions.find((p) => p.id === selectedPrescriptionId);
  const [reason, setReason] = React.useState('Clinical dosage clarification required for prescribed regimen.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRx) return;
    holdPrescription(currentRx.id, reason);
    onClose();
  };

  if (!currentRx) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        className="max-w-md p-6 rounded-3xl shadow-2xl"
        style={{ background: 'var(--ti-canvas-bloom, #FAF8F5)', border: '1px solid var(--ti-hairline)', color: 'var(--ti-ink)' }}
      >
        <DialogHeader
          className="pb-3 text-left flex flex-row items-center justify-between"
          style={{ borderBottom: '1px solid var(--ti-hairline)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--ti-amber)' }}>
            <Stethoscope className="h-5 w-5" />
            <DialogTitle className="font-serif text-lg font-bold" style={{ color: 'var(--ti-ink)' }}>
              Physician Reconsultation Hold
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-full cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
            style={{ color: 'var(--ti-ink-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          <div className="p-3 rounded-xl space-y-1" style={{ background: 'rgba(196,122,30,0.06)', border: '1px solid rgba(196,122,30,0.2)' }}>
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ti-amber)' }}>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Flagging {currentRx.rxNumber} to Prescriber</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--ti-ink-muted)' }}>
              Doctor: <strong style={{ color: 'var(--ti-ink)' }}>{currentRx.doctorName}</strong> ({currentRx.doctorSpecialty})
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="hold-reason" className="block text-[11px] font-semibold" style={{ color: 'var(--ti-ink-muted)' }}>
              Clinical Clarification Reason
            </label>
            <textarea
              id="hold-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border p-2.5 text-xs focus-visible:ring-2 focus-visible:outline-none resize-none"
              style={{ borderColor: 'var(--ti-hairline-strong)', background: 'rgba(255,255,255,0.7)', color: 'var(--ti-ink)', '--tw-ring-color': 'var(--ti-amber)' } as React.CSSProperties}
              placeholder="Specify allergy conflict, dosage bounds, or out-of-stock substitution..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--ti-hairline)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
              style={{ color: 'var(--ti-ink-muted)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-label="Place prescription on hold and dispatch query to doctor"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white shadow-md cursor-pointer focus-visible:ring-2 focus-visible:outline-none transition-all"
              style={{ background: 'var(--ti-amber)' }}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Place on Hold & Dispatch</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DoctorQueryModal;
