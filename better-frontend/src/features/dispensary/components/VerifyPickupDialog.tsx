import * as React from 'react';
import QRCode from 'react-qr-code';
import { ShieldCheck, QrCode as QrIcon, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WorkspacePrescription } from '../types';

interface VerifyPickupDialogProps {
  open: boolean;
  prescription: WorkspacePrescription;
  expectedOtp: string;
  errorMessage: string | null;
  onClose: () => void;
  onVerify: (otp: string) => void;
}

export const VerifyPickupDialog: React.FC<VerifyPickupDialogProps> = ({
  open,
  prescription,
  expectedOtp,
  errorMessage,
  onClose,
  onVerify,
}) => {
  const [inputOtp, setInputOtp] = React.useState(expectedOtp);

  React.useEffect(() => {
    if (open) setInputOtp(expectedOtp);
  }, [open, expectedOtp]);

  const qrPayload = `${prescription.rxNumber}:${expectedOtp}:${prescription.patientName}`;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md bg-bg-1 border border-mint-400/30 text-white p-6 rounded-3xl shadow-2xl">
        <DialogHeader className="border-b border-mint-400/15 pb-3 text-left">
          <div className="flex items-center gap-2">
            <QrIcon className="h-5 w-5 text-mint-300" />
            <DialogTitle className="font-serif text-lg font-bold text-white">
              Verify Patient Pickup
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 my-2 text-center">
          <div className="rounded-2xl bg-white p-3.5 shadow-lg border border-mint-400/20">
            <QRCode value={qrPayload} size={132} level="M" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-100">
              Scan patient handover badge or enter 6-digit OTP
            </p>
            <p className="text-[11px] text-emerald-200/60">
              Patient: <strong className="text-white">{prescription.patientName}</strong> · {prescription.rxNumber}
            </p>
          </div>

          <div className="w-full space-y-2">
            <input
              type="text"
              maxLength={6}
              value={inputOtp}
              onChange={(e) => setInputOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              className="w-full tracking-widest text-center text-lg font-mono font-bold py-2.5 rounded-xl border border-mint-400/30 bg-bg-0 text-mint-300 focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none"
              aria-label="6-digit verification OTP"
            />

            {errorMessage && (
              <p className="text-xs text-red-400 font-medium">{errorMessage}</p>
            )}

            <p className="text-[10px] text-emerald-200/40">
              Demo Test Handover OTP Code: <span className="font-mono text-mint-300 font-bold">{expectedOtp}</span>
            </p>
          </div>

          <div className="flex w-full items-center justify-between border-t border-mint-400/15 pt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>Identity Verified</span>
            </div>

            <button
              type="button"
              onClick={() => onVerify(inputOtp)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-mint-400 px-5 py-2 text-xs font-bold text-bg-0 shadow-glow-mint hover:opacity-95 focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Confirm Handover</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VerifyPickupDialog;

