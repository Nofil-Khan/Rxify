import * as React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { motion } from 'motion/react';
import {
  LayoutGrid,
  ClipboardList,
  FileText,
  TrendingUp,
  Settings2,
} from 'lucide-react';
import SearchCommandPalette from './SearchCommandPalette';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

interface TopNavProps {
  onOpenDoctorModal?: () => void;
  onTriggerVerify?: () => void;
  onTriggerSubstitute?: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Workspace', to: '/workspace', icon: LayoutGrid },
  { label: 'Inventory', to: '/inventory', icon: ClipboardList },
  { label: 'Orders', to: '/orders', icon: FileText },
  { label: 'Analytics', to: '/analytics', icon: TrendingUp },
];

export const TopNav: React.FC<TopNavProps> = ({
  onOpenDoctorModal,
  onTriggerVerify,
  onTriggerSubstitute,
}) => {
  const { prescriptions } = useDispensaryWorkspace();
  const location = useLocation();
  const [elapsedSeconds, setElapsedSeconds] = React.useState(16338);

  React.useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatShiftTimer = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const activeQueueCount = prescriptions.filter((p) => p.status !== 'DISPENSED').length;

  const isWorkspace =
    location.pathname === '/dispensary' || location.pathname === '/workspace';

  return (
    <header
      className="sticky top-0 z-40 flex flex-col shrink-0 select-none"
      style={{ background: 'var(--ti-canvas)', borderBottom: '1px solid var(--ti-hairline-strong)' }}
      data-testid="slot-top-nav"
      aria-label="Dispensary Navigation"
    >
      {/* Top row: Brand · Spotlight · Telemetry */}
      <div className="flex h-14 w-full items-center justify-between px-6">
        {/* Left: Brand Monogram */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'var(--ti-sage)', animation: 'ti-pulse-ring 2s cubic-bezier(.4,0,.6,1) infinite' }}
              aria-hidden="true"
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--ti-sage)' }} />
          </span>
          <span
            className="font-mono text-[11px] tracking-[0.18em] select-none"
            style={{ color: 'var(--ti-ink)' }}
          >
            RXIFY // DISPENSARY OS
          </span>
        </div>

        {/* Center: Spotlight pill (only on workspace view) */}
        <div className="flex-1 flex justify-center max-w-lg mx-6">
          {isWorkspace ? (
            <SearchCommandPalette
              onOpenDoctorModal={onOpenDoctorModal}
              onTriggerVerify={onTriggerVerify}
              onTriggerSubstitute={onTriggerSubstitute}
            />
          ) : (
            <Link
              to="/workspace"
              className="flex items-center gap-2 h-8 px-4 rounded-full text-[12px] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
              style={{
                background: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 4px 12px rgba(24,24,22,0.05)',
                color: 'var(--ti-ink-muted)',
              }}
              aria-label="Return to dispensary workspace"
            >
              <LayoutGrid size={13} />
              ← Back to Workspace
            </Link>
          )}
        </div>

        {/* Right: Telemetry + Settings */}
        <div className="flex items-center gap-4">
          <div
            className="font-mono text-[11px] tabular-nums tracking-wide shrink-0"
            style={{ color: 'var(--ti-ink-muted)' }}
            aria-label="Workspace telemetry"
          >
            LATENCY 12MS · QUEUE {activeQueueCount || 0} · SHIFT {formatShiftTimer(elapsedSeconds)}
          </div>
          <Link
            to="/settings"
            aria-label="Dispensary settings"
            className="flex items-center justify-center h-8 w-8 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
            style={{
              background: location.pathname === '/settings'
                ? 'var(--ti-sage)'
                : 'rgba(255,255,255,0.65)',
              color: location.pathname === '/settings' ? 'white' : 'var(--ti-ink-muted)',
              border: '1px solid rgba(24,24,22,0.09)',
            }}
          >
            <Settings2 size={15} strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      {/* Bottom row: Nav tabs */}
      <nav
        className="flex items-center gap-1 px-6 pb-2"
        aria-label="Dispensary section navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            (item.to === '/workspace' && (location.pathname === '/workspace' || location.pathname === '/dispensary')) ||
            location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={`${item.label} section`}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
              style={{ color: isActive ? 'var(--ti-ink)' : 'var(--ti-ink-muted)' }}
            >
              {isActive && (
                <motion.span
                  layoutId="activeDispensaryTab"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'white',
                    boxShadow: '0 2px 10px rgba(24,24,22,0.09)',
                    zIndex: -1,
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  aria-hidden="true"
                />
              )}
              <Icon size={13} strokeWidth={1.75} />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
};

export default TopNav;
