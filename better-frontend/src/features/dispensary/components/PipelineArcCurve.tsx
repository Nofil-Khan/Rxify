import * as React from 'react';
import { motion } from 'motion/react';

export const PipelineArcCurve: React.FC = () => {
  return (
    <svg
      className="pointer-events-none absolute inset-0 hidden lg:block h-full w-full overflow-visible"
      viewBox="0 0 640 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="arcGlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--mint-400)" stopOpacity="0" />
          <stop offset="15%" stopColor="var(--mint-300)" stopOpacity="0.35" />
          <stop offset="50%" stopColor="var(--mint-400)" stopOpacity="0.8" />
          <stop offset="85%" stopColor="var(--mint-300)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--mint-400)" stopOpacity="0" />
        </linearGradient>
        <filter id="arcGlowBlur" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Outer Soft Glow Halo Path */}
      <path
        d="M 50 72 Q 320 28 590 72"
        stroke="url(#arcGlowGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        filter="url(#arcGlowBlur)"
        opacity="0.85"
      />

      {/* Core Animated Glowing Stroke */}
      <motion.path
        d="M 50 72 Q 320 28 590 72"
        stroke="url(#arcGlowGradient)"
        strokeWidth="1.75"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* Pulsing Glowing Dots along the arc between nodes */}
      <circle cx="140" cy="56" r="2" fill="var(--mint-300)" className="animate-pulse opacity-75" />
      <circle cx="320" cy="38" r="2.5" fill="var(--mint-400)" className="animate-pulse opacity-90 shadow-glow-mint" />
      <circle cx="500" cy="56" r="2" fill="var(--mint-300)" className="animate-pulse opacity-75" />
    </svg>
  );
};

export default PipelineArcCurve;
