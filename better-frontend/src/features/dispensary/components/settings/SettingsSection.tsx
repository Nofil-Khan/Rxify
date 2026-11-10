import * as React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  description: string;
  children: React.ReactNode;
}

/** Warm titanium settings section card with hairline border. */
const SettingsSection: React.FC<Props> = ({ icon: Icon, label, description, children }) => (
  <div
    className="ti-sheet flex flex-col gap-6 p-7"
    style={{ borderRadius: 20 }}
  >
    {/* Section header */}
    <div className="flex items-start gap-3 pb-5" style={{ borderBottom: '1px solid var(--ti-hairline)' }}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'rgba(74,124,111,0.10)' }}
      >
        <Icon size={18} style={{ color: 'var(--ti-sage)' }} strokeWidth={1.75} />
      </div>
      <div>
        <h2
          className="font-semibold text-[15px] leading-snug"
          style={{ color: 'var(--ti-ink)' }}
        >
          {label}
        </h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--ti-ink-muted)' }}>
          {description}
        </p>
      </div>
    </div>

    {/* Content */}
    <div>{children}</div>
  </div>
);

export default SettingsSection;

