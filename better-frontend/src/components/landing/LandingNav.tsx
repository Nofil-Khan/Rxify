import * as React from 'react';
import { Activity, LogIn, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../lib/auth';

export const LandingNav: React.FC = () => {
  const { isAuthenticated, role, displayName, username } = useAuthStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 md:px-12 backdrop-blur-md bg-black/40 border-b border-white/10 transition-all select-none">
      {/* Brand */}
      <a
        href="/"
        className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
        aria-label="Rxify Home"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
          <Activity size={20} className="text-emerald-400" />
        </div>
        <span className="font-serif text-2xl font-bold tracking-tight text-white">
          Rxify
        </span>
      </a>

      {/* Navigation Links */}
      <nav className="flex items-center gap-3 text-xs md:text-sm" aria-label="Account Access">
        {isAuthenticated ? (
          <a
            href={
              role?.toLowerCase() === 'doctor'
                ? '/doctor'
                : role?.toLowerCase() === 'dispensary'
                  ? '/dispensary'
                  : '/patient'
            }
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:brightness-110 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Sparkles size={15} />
            <span>
              Dashboard ({displayName || username || role || 'User'})
            </span>
          </a>
        ) : (
          <a
            href="/login"
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:brightness-110 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </a>
        )}
      </nav>
    </header>
  );
};

export default LandingNav;

