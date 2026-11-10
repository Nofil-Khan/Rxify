import * as React from 'react';
import { Link } from '@tanstack/react-router';

export const BrandLogo: React.FC = () => {
  return (
    <Link
      to="/workspace"
      className="group flex items-center gap-3 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400 rounded-xl"
      aria-label="Rxify Home Workspace"
    >
      {/* Botanical Leaf + Capsule SVG Mark */}
      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-mint-400/25 to-emerald-500/10 p-2 border border-mint-400/30 shadow-glow-mint">
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 group-hover:scale-105"
          aria-hidden="true"
        >
          {/* Leaf outline and spine */}
          <path
            d="M3 21C3 21 5.5 13 13 11C20.5 9 21 3 21 3C21 3 15 3.5 13 11C11 18.5 3 21 3 21Z"
            stroke="var(--mint-400)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="var(--mint-300)"
            fillOpacity="0.2"
          />
          <path
            d="M13 11L7 17"
            stroke="var(--mint-400)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Intertwined Pill Capsule */}
          <rect
            x="10.5"
            y="4.5"
            width="8"
            height="14"
            rx="4"
            transform="rotate(45 10.5 4.5)"
            stroke="var(--mint-300)"
            strokeWidth="1.75"
            fill="var(--bg-1)"
          />
          <line
            x1="8"
            y1="13.5"
            x2="14"
            y2="7.5"
            stroke="var(--mint-400)"
            strokeWidth="1.2"
          />
        </svg>
      </div>

      {/* Brand Wordmark in Fraunces 32px */}
      <span className="font-serif text-[32px] font-bold tracking-tight text-cream-from leading-none">
        Rxify
      </span>
    </Link>
  );
};

export default BrandLogo;

