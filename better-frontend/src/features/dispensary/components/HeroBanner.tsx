import * as React from 'react';

export const HeroBanner: React.FC = () => {
  return (
    <div className="flex flex-col gap-1.5" data-testid="slot-hero">
      <span className="text-[11px] font-semibold tracking-widest uppercase text-emerald-300/80 font-sans">
        Dispensary Workspace
      </span>
      <h1 className="text-3xl lg:text-4xl font-serif font-bold text-white tracking-tight leading-tight">
        Good Evening, City Care Pharmacy
      </h1>
      <p className="text-xs text-emerald-100/70 font-sans max-w-md">
        Process prescriptions, manage stock, and keep patients cared for.
      </p>
    </div>
  );
};

export default HeroBanner;

