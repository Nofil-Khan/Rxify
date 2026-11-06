import * as React from 'react';
import { LucideIcon, Check } from 'lucide-react';

interface WorkflowStepButtonProps {
  label: string;
  icon: LucideIcon;
  status: 'done' | 'active' | 'upcoming';
  onClick: () => void;
}

export const WorkflowStepButton: React.FC<WorkflowStepButtonProps> = ({
  label,
  icon: Icon,
  status,
  onClick,
}) => {
  if (status === 'done') {
    return (
      <div
        className="flex items-center gap-2 rounded-full border border-mint-400/25 bg-mint-400/10 px-4 py-2 text-xs font-semibold text-mint-300 select-none shadow-xs"
        aria-label={`${label} completed`}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-mint-300">
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
        <span className="text-emerald-100/75">{label}</span>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-mint-300 to-emerald-300 px-5 py-2.5 text-xs font-bold text-bg-0 shadow-glow-mint border border-mint-200 transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer select-none"
        aria-label={`Current active step: ${label}. Press to execute.`}
      >
        <Icon className="h-4 w-4 text-bg-0 fill-bg-0/20 stroke-[2.2]" />
        <span className="tracking-tight text-bg-0 font-extrabold">{label}</span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-mint-400/10 bg-white/[0.02] px-4 py-2 text-xs font-medium text-emerald-200/40 select-none"
      aria-label={`${label} upcoming`}
    >
      <Icon className="h-3.5 w-3.5 text-emerald-200/30" />
      <span>{label}</span>
    </div>
  );
};

export default WorkflowStepButton;

