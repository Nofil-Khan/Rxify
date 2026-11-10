import * as React from 'react';
import { Check, ShoppingBag, QrCode, CheckCircle2, Loader2 } from 'lucide-react';

interface WorkflowActionButtonsProps {
  isPending: boolean;
  isReady: boolean;
  isVerified: boolean;
  isPendingOrProcessing: boolean;
  onMarkDone: () => void;
  onOpenVerify: () => void;
  onComplete: () => void;
}

export const WorkflowActionButtons: React.FC<WorkflowActionButtonsProps> = ({
  isPending,
  isReady,
  isVerified,
  isPendingOrProcessing,
  onMarkDone,
  onOpenVerify,
  onComplete,
}) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Step 1: Mark Done */}
      <button
        type="button"
        disabled={isPending || isReady}
        onClick={onMarkDone}
        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none ${
          isReady
            ? 'border-mint-400/40 bg-mint-950/15 text-mint-400 cursor-default'
            : isPendingOrProcessing
            ? 'border-forest-dark bg-forest text-white shadow-md hover:bg-forest-light'
            : 'border-ink/10 bg-bg-1/40 text-ink-muted/50 cursor-not-allowed'
        }`}
        aria-label="Mark prescription ready"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {isPending && isPendingOrProcessing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isReady ? (
            <Check className="h-3.5 w-3.5 text-mint-400" />
          ) : (
            <ShoppingBag className="h-3.5 w-3.5" />
          )}
          <span>Mark Done</span>
        </div>
        <span className="text-[10px] font-normal opacity-80">{isReady ? 'Ready' : 'Prepare Order'}</span>
      </button>

      {/* Step 2: Verify Pickup */}
      <button
        type="button"
        disabled={isPending}
        onClick={onOpenVerify}
        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none ${
          isVerified
            ? 'border-mint-400/40 bg-mint-950/15 text-mint-400 cursor-default'
            : isReady
            ? 'border-forest-dark bg-forest text-white shadow-md hover:bg-forest-light animate-pulse'
            : 'border-ink/15 bg-bg-1/20 text-ink-muted hover:bg-bg-1/40'
        }`}
        aria-label="Verify patient pickup OTP"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {isVerified ? <Check className="h-3.5 w-3.5 text-mint-400" /> : <QrCode className="h-3.5 w-3.5" />}
          <span>Verify</span>
        </div>
        <span className="text-[10px] font-normal opacity-80">{isVerified ? 'Verified' : 'OTP Code'}</span>
      </button>

      {/* Step 3: Complete */}
      <button
        type="button"
        disabled={isPending || (!isReady && !isVerified)}
        onClick={onComplete}
        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none ${
          isReady || isVerified
            ? 'border-mint-400 bg-gradient-to-r from-emerald-600 to-mint-500 text-white shadow-glow-mint hover:opacity-95'
            : 'border-ink/10 bg-bg-1/40 text-ink-muted/50 cursor-not-allowed'
        }`}
        aria-label="Complete dispense"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {isPending && (isReady || isVerified) ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          <span>Complete</span>
        </div>
        <span className="text-[10px] font-normal opacity-80">Deduct Stock</span>
      </button>
    </div>
  );
};

