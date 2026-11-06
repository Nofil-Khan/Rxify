import * as React from 'react';
import apothecaryShelfImg from '@/assets/bg/apothecary-shelf.svg';
import botanicalLeavesImg from '@/assets/props/botanical-leaves.svg';
import mortarPestleImg from '@/assets/props/mortar-pestle.svg';
import capsulePillImg from '@/assets/props/capsule-pill.svg';

export const APOTHECARY_BG_PATH = apothecaryShelfImg;

export const SceneBackground: React.FC = () => {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none" aria-hidden="true">
      {/* (a) Base Botanical Dark Green Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-0 via-bg-1 to-bg-2" />

      {/* (b) Blurred Apothecary Shelf & Overlay */}
      <div className="absolute inset-0 opacity-65">
        <img
          src={APOTHECARY_BG_PATH}
          alt=""
          width={1920}
          height={1080}
          loading="lazy"
          className="h-full w-full object-cover blur-sm"
        />
      </div>
      <div className="absolute inset-0 bg-bg-1/30 backdrop-blur-[1px]" />

      {/* (c) Soft Teal / Mint Radial Glows */}
      <div
        className="absolute -top-32 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-85 blur-3xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(110, 231, 183, 0.28) 0%, rgba(16, 185, 129, 0.1) 45%, transparent 75%)',
        }}
      />
      <div
        className="absolute -bottom-40 left-1/2 h-[560px] w-[1100px] -translate-x-1/2 rounded-full opacity-70 blur-3xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(10, 42, 32, 0.15) 50%, transparent 80%)',
        }}
      />

      {/* Curved Glowing Champagne / Mint Light Ribbon Sweep */}
      <svg
        className="absolute inset-0 h-full w-full opacity-90 pointer-events-none"
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ribbonGlow" x1="0%" y1="50%" x2="100%" y2="20%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.05" />
            <stop offset="25%" stopColor="#A7F3D0" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#FEF3C7" stopOpacity="0.85" />
            <stop offset="75%" stopColor="#FBBF24" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
          <filter id="ribbonBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <path
          d="M -50 330 C 350 450, 750 420, 1150 330 S 1650 260, 2000 240"
          stroke="url(#ribbonGlow)"
          strokeWidth="7"
          filter="url(#ribbonBlur)"
        />
        <path
          d="M -30 345 C 370 465, 770 430, 1170 340 S 1670 268, 2020 248"
          stroke="#FFFFFF"
          strokeWidth="1.25"
          opacity="0.5"
        />
      </svg>

      {/* Warm Apothecary Wooden Counter Glow (Top-Right) */}
      <div
        className="apothecary-mortar-prop absolute top-[260px] right-0 w-[500px] h-[90px] pointer-events-none opacity-45 blur-2xl"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(217, 119, 6, 0.4) 35%, rgba(180, 83, 9, 0.25) 100%)',
        }}
      />

      {/* Mortar & Pestle in Top-Right Background */}
      <div className="apothecary-mortar-prop animate-float-slow absolute top-[115px] right-[40px] 2xl:right-[70px] w-[230px] 2xl:w-[250px] opacity-95 drop-shadow-2xl z-0 pointer-events-none">
        <img
          src={mortarPestleImg}
          alt=""
          width={300}
          height={260}
          loading="lazy"
          className="h-auto w-full object-contain"
        />
      </div>

      {/* Floating Capsule 1 (Left of Mortar) */}
      <div className="apothecary-mortar-prop animate-float-capsule absolute top-[236px] right-[270px] 2xl:right-[305px] w-[48px] drop-shadow-xl z-10 pointer-events-none">
        <img
          src={capsulePillImg}
          alt=""
          width={100}
          height={50}
          loading="lazy"
          className="h-auto w-full object-contain -rotate-12"
        />
      </div>

      {/* Floating Capsule 2 (Below Mortar) */}
      <div className="apothecary-mortar-prop animate-float-delayed absolute top-[248px] right-[230px] 2xl:right-[260px] w-[42px] drop-shadow-lg opacity-85 z-10 pointer-events-none">
        <img
          src={capsulePillImg}
          alt=""
          width={100}
          height={50}
          loading="lazy"
          className="h-auto w-full object-contain rotate-45"
        />
      </div>

      {/* Botanical Leaves Bottom-Left */}
      <div className="animate-float-slow absolute -bottom-10 -left-10 w-[300px] opacity-95 z-10 pointer-events-none">
        <img
          src={botanicalLeavesImg}
          alt=""
          width={380}
          height={480}
          loading="lazy"
          className="h-auto w-full object-contain"
        />
      </div>

      {/* Botanical Leaves Bottom-Right */}
      <div className="animate-float-delayed absolute -bottom-14 -right-12 w-[280px] scale-x-[-1] opacity-80 z-10 pointer-events-none">
        <img
          src={botanicalLeavesImg}
          alt=""
          width={380}
          height={480}
          loading="lazy"
          className="h-auto w-full object-contain"
        />
      </div>
    </div>
  );
};

export default SceneBackground;
