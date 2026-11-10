import * as React from 'react';
import { AlertTriangle, ArrowLeftRight, PackageCheck, Stethoscope } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WorkspacePrescription } from '../types';

interface ReserveGuardDialogProps {
  open: boolean;
  prescription: WorkspacePrescription;
  onClose: () => void;
  onPartialReserve: () => void;
  onSubstitute: (medId: string, subName: string) => void;
  onNotifyDoctor: () => void;
}

export const ReserveGuardDialog: React.FC<ReserveGuardDialogProps> = ({
  open,
  prescription,
  onClose,
  onPartialReserve,
  onSubstitute,
  onNotifyDoctor,
}) => {
  const [substituteName, setSubstituteName] = React.useState('');
  const unavailableMeds = (prescription?.medicines || []).filter(
    (m) => m.inStockQuantity === 0 || m.status === 'UNAVAILABLE'
  );
  const target = unavailableMeds[0];

  const handleSubstitute = () => {
    if (!target) return;
    const name = substituteName.trim() || `${target.name} (Equivalent)`;
    onSubstitute(target.id, name);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md bg-bg-1 border border-amber-500/40 text-white p-6 rounded-3xl shadow-2xl">
        <DialogHeader className="border-b border-white/10 pb-3 text-left">
          <div className="flex items-center gap-2.5 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle className="font-serif text-lg font-bold text-white">
              Inventory Reservation Blocked
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 text-xs">
          <p className="text-emerald-200/80 leading-relaxed">
            The following prescribed items currently have <strong>0 in-stock units</strong> in the dispensary:
          </p>

          <div className="space-y-2">
            {unavailableMeds.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-bg-0/60 p-3 border border-red-500/30"
              >
                <div>
                  <span className="font-bold text-white">{m.name}</span>
                  <span className="block text-[11px] text-red-300">Prescribed: {m.prescribedQuantity} · Stock: 0</span>
                </div>
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-bold text-[10px] text-red-300">
                  Unavailable
                </span>
              </div>
            ))}
          </div>

          <p className="text-emerald-200/60 text-[11px]">
            Choose a clinical resolution to proceed with workflow fulfillment:
          </p>

          {/* Action Resolution Buttons */}
          <div className="space-y-2 pt-1">
            <div className="rounded-xl bg-bg-0/80 p-3 border border-mint-400/20 space-y-2">
              <div className="flex items-center gap-2 text-mint-300">
                <ArrowLeftRight className="h-4 w-4 shrink-0" />
                <span className="font-bold text-white text-xs">Substitute Equivalent</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={substituteName}
                  onChange={(e) => setSubstituteName(e.target.value)}
                  placeholder={`Alternative for ${target?.name || 'item'}...`}
                  className="flex-1 rounded-lg border border-mint-400/30 bg-bg-1 px-2.5 py-1.5 text-xs text-white placeholder-emerald-200/40 focus-visible:ring-1 focus-visible:ring-mint-400 focus-visible:outline-none"
                  aria-label="Substitute medication name"
                />
                <button
                  type="button"
                  onClick={handleSubstitute}
                  className="rounded-lg bg-mint-400 px-3 py-1.5 text-xs font-bold text-bg-0 hover:bg-mint-300 focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
                >
                  Swap
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onPartialReserve}
              className="w-full flex items-center gap-3 rounded-xl bg-bg-0/80 p-3 border border-amber-500/30 hover:border-amber-400/60 hover:bg-bg-0 text-left transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
            >
              <PackageCheck className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">Partial Reserve</span>
                <span className="text-[11px] text-emerald-200/60">Reserve available stock & dispense partial packet</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNotifyDoctor();
              }}
              className="w-full flex items-center gap-3 rounded-xl bg-bg-0/80 p-3 border border-purple-500/30 hover:border-purple-400/60 hover:bg-bg-0 text-left transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
            >
              <Stethoscope className="h-4 w-4 text-purple-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">Notify Prescribing Physician</span>
                <span className="text-[11px] text-emerald-200/60">Flag reconsultation request to {prescription.doctorName}</span>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReserveGuardDialog;

