import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Building2, LayoutDashboard, Search, User2, LogOut, Menu, X, ChevronRight } from 'lucide-react';
import { useHospitalAuthStore } from '../../lib/hospitalAuth';
import HospOverviewTab from './tabs/OverviewTab';
import PatientLookupTab from './tabs/PatientLookupTab';
import HospProfileTab from './tabs/ProfileTab';

export type HospTab = 'overview' | 'lookup' | 'profile';

const NAV: { id: HospTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'overview', label: 'Dashboard',      icon: <LayoutDashboard size={18} />, desc: 'Metrics & audit log'  },
  { id: 'lookup',   label: 'Patient Lookup', icon: <Search size={18} />,          desc: 'QR code & patient ID' },
  { id: 'profile',  label: 'Institution',    icon: <User2 size={18} />,           desc: 'Hospital profile'     },
];

export default function HospitalDashboard() {
  const { name, clearHospitalAuth, isAuthenticated } = useHospitalAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<HospTab>('overview');
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/hospital/login' });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const h = (e: MediaQueryListEvent) => { if (e.matches) setSideOpen(false); };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const logout = useCallback(() => {
    clearHospitalAuth();
    navigate({ to: '/hospital/login' });
  }, [clearHospitalAuth, navigate]);

  const go = (t: HospTab) => { setTab(t); setSideOpen(false); };

  const abbrev = (n: string | null) => n ? n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : 'H';

  return (
    <div className="hd-shell">
      {/* Mobile overlay */}
      {sideOpen && <div className="hd-overlay" onClick={() => setSideOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`hd-sidebar ${sideOpen ? 'hd-sidebar--open' : ''}`} aria-label="Hospital navigation">

        <div className="hd-sidebar-head">
          <div className="hd-brand">
            <div className="hd-brand-mark" aria-hidden="true"><Building2 size={18} /></div>
            <div className="hd-brand-text">
              <span className="hd-brand-name">Rxify</span>
              <span className="hd-brand-role">Hospital Portal</span>
            </div>
          </div>
          <button className="hd-close-btn" onClick={() => setSideOpen(false)} aria-label="Close navigation"><X size={17} /></button>
        </div>

        <nav className="hd-nav" role="navigation" aria-label="Main navigation">
          <p className="hd-nav-group-label">Hospital Console</p>
          {NAV.map(item => (
            <button
              key={item.id}
              id={`hd-nav-${item.id}`}
              className={`hd-nav-item ${tab === item.id ? 'hd-nav-item--active' : ''}`}
              onClick={() => go(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <span className="hd-nav-rail" aria-hidden="true" />
              <span className="hd-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="hd-nav-label">
                <span className="hd-nav-primary">{item.label}</span>
                <span className="hd-nav-secondary">{item.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="hd-sidebar-footer">
          <div className="hd-user-chip">
            <div className="hd-user-avatar" aria-hidden="true">{abbrev(name)}</div>
            <span className="hd-user-name" title={name ?? ''}>{name ?? 'Hospital'}</span>
          </div>
          <button id="hd-logout-btn" className="hd-logout-btn" onClick={logout} aria-label="Log out">
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="hd-main" id="hd-main-content">
        {/* Mobile topbar */}
        <header className="hd-topbar">
          <button id="hd-menu-btn" className="hd-menu-btn" onClick={() => setSideOpen(true)} aria-label="Open navigation" aria-expanded={sideOpen}>
            <Menu size={21} />
          </button>
          <div className="hd-topbar-brand" aria-hidden="true">
            <Building2 size={17} />
            <span>Rxify Hospital</span>
          </div>
        </header>

        {/* Breadcrumb */}
        <nav className="hd-breadcrumb" aria-label="Breadcrumb">
          <Building2 size={13} aria-hidden="true" />
          <span>Hospital</span>
          <ChevronRight size={12} aria-hidden="true" />
          <span className="hd-breadcrumb-current">{NAV.find(n => n.id === tab)?.label}</span>
        </nav>

        {/* Content viewport */}
        <div className="hd-viewport" role="region" aria-live="polite">
          {tab === 'overview' && <HospOverviewTab />}
          {tab === 'lookup'   && <PatientLookupTab />}
          {tab === 'profile'  && <HospProfileTab />}
        </div>
      </main>
    </div>
  );
}
