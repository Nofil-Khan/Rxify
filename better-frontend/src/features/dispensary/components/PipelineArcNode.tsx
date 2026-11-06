import * as React from 'react';
import { motion } from 'motion/react';

export interface PipelineStageConfig {
  id: string;
  label: string;
  statusFilter: string;
  icon: React.ElementType;
  count: number;
}

interface PipelineArcNodeProps {
  stage: PipelineStageConfig;
  isActive: boolean;
  onSelect: (stage: PipelineStageConfig) => void;
}

export const PipelineArcNode: React.FC<PipelineArcNodeProps> = ({
  stage,
  isActive,
  onSelect,
}) => {
  const Icon = stage.icon;

  if (isActive) {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={true}
        tabIndex={0}
        onClick={() => onSelect(stage)}
        className="group relative z-20 flex h-[150px] w-[100px] flex-col items-center justify-between rounded-[48px] p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
        aria-label={`${stage.label} Prescriptions: ${stage.count}`}
      >
        <motion.div
          layoutId="activePipelinePill"
          className="absolute inset-0 rounded-[48px] border border-mint-300/60 bg-gradient-to-b from-mint-400/25 via-emerald-500/15 to-bg-1/90 backdrop-blur-xl ring-1 ring-mint-400/80 shadow-glow-mint"
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        />

        <div className="relative z-10 flex h-full w-full flex-col items-center justify-between py-1.5">
          {/* Top Circular Icon Badge */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-mint-400/40 bg-mint-400/20 text-mint-300 shadow-sm">
            <Icon size={18} strokeWidth={1.75} />
          </div>

          {/* Center Count (36px semibold) */}
          <span className="font-sans text-[36px] font-semibold tracking-tight text-white leading-none">
            {stage.count}
          </span>

          {/* Bottom Label */}
          <span className="text-xs font-semibold text-mint-300 tracking-wide capitalize">
            {stage.label}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={false}
      tabIndex={-1}
      onClick={() => onSelect(stage)}
      className="group relative z-10 flex flex-col items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400 rounded-full"
      aria-label={`${stage.label} Prescriptions: ${stage.count}`}
    >
      {/* 56px Circular Glass Button */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-mint-400/20 bg-bg-1/50 backdrop-blur-md text-emerald-200/70 shadow-glass transition-all duration-200 group-hover:scale-105 group-hover:border-mint-400/50 group-hover:bg-bg-1/80 group-hover:text-white group-hover:shadow-glow-mint">
        <Icon size={18} strokeWidth={1.75} />
      </div>

      {/* Count & Label Underneath */}
      <div className="flex flex-col items-center text-center leading-tight">
        <span className="font-sans text-xs font-bold text-white transition-colors group-hover:text-mint-300">
          {stage.count}
        </span>
        <span className="text-[11px] font-medium text-emerald-200/60 transition-colors group-hover:text-emerald-100">
          {stage.label}
        </span>
      </div>
    </button>
  );
};

export default PipelineArcNode;
