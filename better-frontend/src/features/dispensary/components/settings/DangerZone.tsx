import * as React from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

/** Danger zone: sign out action. */
const DangerZone: React.FC = () => {
  const navigate = useNavigate();
  const [confirm, setConfirm] = React.useState(false);

  const handleSignOut = () => {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 4000);
      return;
    }
    localStorage.removeItem('rxify_token');
    localStorage.removeItem('rxify_hospital_token');
    navigate({ to: '/dispensary/login' });
  };

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-2xl"
      style={{
        border: '1px solid rgba(192,57,43,0.18)',
        background: 'rgba(192,57,43,0.03)',
      }}
    >
      <div className="flex items-center gap-2" style={{ color: 'var(--ti-ruby)' }}>
        <AlertTriangle size={15} strokeWidth={1.75} />
        <span className="font-semibold text-sm">Danger Zone</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--ti-ink)' }}>
            Sign out of this dispensary
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--ti-ink-muted)' }}>
            You will be redirected to the login page. Active WebSocket session will be closed.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label={confirm ? 'Confirm sign out' : 'Sign out of dispensary'}
          className="flex items-center gap-2 h-9 px-4 rounded-full text-sm font-semibold shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-ruby"
          style={{
            background: confirm ? 'var(--ti-ruby)' : 'rgba(192,57,43,0.08)',
            color: confirm ? 'white' : 'var(--ti-ruby)',
            border: '1px solid rgba(192,57,43,0.25)',
          }}
        >
          <LogOut size={14} strokeWidth={1.75} />
          {confirm ? 'Tap again to confirm' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
};

export default DangerZone;

