import * as React from 'react';

export const Hero: React.FC = () => {
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  }, []);

  return (
    <div className="flex flex-col gap-1 select-none" data-testid="slot-hero">
      {/* Eyebrow */}
      <span className="font-sans text-[11px] font-semibold uppercase tracking-[.35em] text-cream-to/70">
        DISPENSARY WORKSPACE
      </span>

      {/* Greeting & Pharmacy Name */}
      <div className="flex flex-col">
        <h1 className="font-serif text-4xl lg:text-[56px] font-bold text-cream-from tracking-tight leading-[1.08]">
          Good {greeting},
        </h1>
        <h2 className="font-serif text-3xl lg:text-[44px] font-bold text-mint-300 tracking-tight leading-[1.12]">
          City Care Pharmacy
        </h2>
      </div>

      {/* Subtitle */}
      <p className="mt-1 max-w-[420px] font-sans text-[15px] text-cream-to/75 leading-relaxed">
        Process prescriptions, manage stock, and keep patients cared for.
      </p>
    </div>
  );
};

export default Hero;

