import * as React from 'react';
import { LucideIcon, Check, Loader2 } from 'lucide-react';

interface WorkflowStepButtonProps {
  stepNumber: number;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  status: 'done' | 'active' | 'upcoming';
  onClick: () => void;
  isPending?: boolean;
}

export const WorkflowStepButton: React.FC<WorkflowStepButtonProps> = ({
  stepNumber,
  label,
  sublabel,
  icon: Icon,
  status,
  onClick,
  isPending = false,
}) => {
  if (status === 'done') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative flex items-center gap-2.5 rounded-full border border-mint-400/30 bg-mint-400/10 px-4 py-2 text-xs font-semibold text-mint-200 transition-all hover:bg-mint-400/15 hover:border-mint-400/40 focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer shadow-xs"
        aria-label={`Step ${stepNumber}: ${label} completed. Click to inspect.`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 text-mint-300">
          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
        </span>
        <div className="flex flex-col text-left">
          <span className="text-emerald-100/90 font-bold">{label}</span>
          {sublabel && (
            <span className="text-[10px] text-mint-300/70 font-normal">{sublabel}</span>
          )}
        </div>
      </button>
    );
  }

  if (status === 'active') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-mint-300 to-emerald-300 px-5 py-2.5 text-xs font-bold text-bg-0 shadow-glow-mint border border-mint-200 transition-all hover:brightness-105 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer disabled:opacity-75"
        aria-label={`Current Step ${stepNumber}: ${label}. Click to execute.`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-0/15 text-bg-0">
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Icon className="h-3.5 w-3.5 stroke-[2.4]" />
          )}
        </span>
        <div className="flex flex-col text-left">
          <span className="tracking-tight text-bg-0 font-extrabold">{label}</span>
          {sublabel && (
            <span className="text-[10px] text-bg-0/80 font-medium">{sublabel}</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-mint-400/15 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-emerald-200/50 hover:text-emerald-200/80 hover:border-mint-400/30 hover:bg-white/[0.05] transition-all focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
      aria-label={`Upcoming Step ${stepNumber}: ${label}`}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-200/20 text-[10px] text-emerald-200/50">
        {stepNumber}
      </span>
      <span>{label}</span>
    </button>
  );
};

export default WorkflowStepButton;
