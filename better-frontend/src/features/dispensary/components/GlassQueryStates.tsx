import * as React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

export const GlassSkeletonList: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 py-2 animate-pulse" aria-label="Loading prescriptions...">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 rounded-2xl bg-white/[0.03] border border-mint-400/10 p-3"
        >
          <div className="h-11 w-11 rounded-full bg-mint-400/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-28 rounded-md bg-mint-400/15" />
            <div className="h-2.5 w-40 rounded-md bg-mint-400/10" />
          </div>
        </div>
      ))}
    </div>
  );
};

interface GlassErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export const GlassErrorState: React.FC<GlassErrorStateProps> = ({
  message = 'Failed to load records from dispensary API',
  onRetry,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-6 text-center rounded-2xl bg-bg-0/60 border border-red-500/20"
      role="alert"
    >
      <AlertCircle className="h-7 w-7 text-red-400" />
      <div className="space-y-1">
        <p className="text-xs font-semibold text-white">Service Error</p>
        <p className="text-[11px] text-emerald-200/60 max-w-xs">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-xl bg-mint-400/20 px-3.5 py-1.5 text-xs font-semibold text-mint-300 border border-mint-400/30 hover:bg-mint-400/30 transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Retry Request</span>
      </button>
    </div>
  );
};

