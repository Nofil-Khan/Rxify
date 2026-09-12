import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Building2, LayoutDashboard, Search, User2, LogOut, Menu, X,
  ChevronRight, Stethoscope, Package, Camera, ShieldCheck,
  Calendar, BedDouble, Users, DollarSign, FileText, Bell,
  Clock, CheckCircle2, AlertTriangle, ExternalLink
} from 'lucide-react';
import { useHospitalAuthStore } from '../../lib/hospitalAuth';
import HospOverviewTab from './tabs/OverviewTab';
import PatientLookupTab from './tabs/PatientLookupTab';
import HospProfileTab from './tabs/ProfileTab';
import DoctorsTab from './tabs/DoctorsTab';
import DispensaryTab from './tabs/DispensaryTab';
import AppointmentsTab from './tabs/AppointmentsTab';
import AdmissionsTab from './tabs/AdmissionsTab';
import DepartmentsTab from './tabs/DepartmentsTab';
import BillingTab from './tabs/BillingTab';
import ReportsTab from './tabs/ReportsTab';
import ShareIdModal from '../../components/common/ShareIdModal';
import QrScannerModal from '../../components/common/QrScannerModal';

export type HospTab =
  | 'overview'
  | 'patients'
  | 'doctors'
  | 'appointments'
  | 'admissions'
  | 'departments'
  | 'dispensary'
  | 'billing'
  | 'reports'
  | 'profile';

export default function HospitalDashboard() {
  const { name, hospitalId, hospitalCode, clearHospitalAuth, isAuthenticated } = useHospitalAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<HospTab>('overview');
  const [sideOpen, setSideOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const isDemo = hospitalId === 1;

  const navItems: { id: HospTab; label: string; icon: React.ReactNode; desc: string; badge?: string }[] = [
    { id: 'overview',     label: 'Dashboard',         icon: <LayoutDashboard size={17} />, desc: 'Executive overview' },
    { id: 'patients',     label: 'Patients',          icon: <Users size={17} />,           desc: 'EHR directory & lookup' },
    { id: 'doctors',      label: 'Doctors',           icon: <Stethoscope size={17} />,     desc: 'Physician roster' },
    { id: 'appointments', label: 'Appointments',      icon: <Calendar size={17} />,        desc: 'Central schedule', badge: isDemo ? '68' : undefined },
    { id: 'admissions',   label: 'Admissions & Beds', icon: <BedDouble size={17} />,       desc: 'Ward occupancy map', badge: isDemo ? '84%' : undefined },
    { id: 'departments',  label: 'Departments',       icon: <Building2 size={17} />,       desc: 'Clinical specialties' },
    { id: 'dispensary',   label: 'Pharmacy',          icon: <Package size={17} />,         desc: 'Stock & dispensing' },
    { id: 'billing',      label: 'Billing & Claims',  icon: <DollarSign size={17} />,      desc: 'Revenue & insurance' },
    { id: 'reports',      label: 'Reports & Audit',   icon: <FileText size={17} />,        desc: 'HIPAA access log' },
    { id: 'profile',      label: 'Institution',       icon: <User2 size={17} />,           desc: 'Facility credentials' },
  ];

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/hospital/login' });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const h = (e: MediaQueryListEvent) => { if (e.matches) setSideOpen(false); };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const logout = useCallback(() => {
    clearHospitalAuth();
    navigate({ to: '/hospital/login' });
  }, [clearHospitalAuth, navigate]);

  const go = (t: HospTab) => {
    setTab(t);
    setSideOpen(false);
  };

  const abbrev = (n: string | null) =>
    n ? n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : 'H';

  const hCode = hospitalCode || (hospitalId ? `RXF-H-${hospitalId}` : 'RXF-H-1');

  const notifications = isDemo ? [
    { title: 'Critical Lab Alert · Room 304', detail: 'Serum Potassium 6.2 mEq/L for patient RXF-P-8821', time: '12m ago', urgent: true },
    { title: 'Emergency Trauma Triage', detail: 'Inbound code red trauma team paged to Bay 2', time: '28m ago', urgent: true },
    { title: 'Pharmacy Stock Reorder Level', detail: 'Amoxicillin 500mg capsules stock fallen below 25 units', time: '1h ago', urgent: false },
    { title: 'Insurance Claim Approved', detail: 'Claim #INV-88912 ($4,200) verified by UnitedHealthcare', time: '2h ago', urgent: false },
  ] : [];

  return (
    <div className="hd-shell">
      {/* Mobile overlay */}
      {sideOpen && <div className="hd-overlay" onClick={() => setSideOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`hd-sidebar ${sideOpen ? 'hd-sidebar--open' : ''}`} aria-label="Hospital Navigation">
        <div className="hd-sidebar-head">
          <div className="hd-brand">
            <div className="hd-brand-mark" aria-hidden="true">
              <Building2 size={18} />
            </div>
            <div className="hd-brand-text">
              <span className="hd-brand-name">Rxify Health</span>
              <span className="hd-brand-role">Medical System</span>
            </div>
          </div>
          <button className="hd-close-btn" onClick={() => setSideOpen(false)} aria-label="Close navigation">
            <X size={17} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="hd-nav" role="navigation">
          <p className="hd-nav-group-label">Hospital Administration</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              id={`hd-nav-${item.id}`}
              className={`hd-nav-item ${tab === item.id ? 'hd-nav-item--active' : ''}`}
              onClick={() => go(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <span className="hd-nav-icon">{item.icon}</span>
              <span className="hd-nav-label">
                <span className="hd-nav-primary">{item.label}</span>
                <span className="hd-nav-secondary">{item.desc}</span>
              </span>
              {item.badge && <span className="hd-nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="hd-sidebar-footer">
          <div className="hd-user-chip">
            <div className="hd-user-avatar" aria-hidden="true">
              {abbrev(name)}
            </div>
            <div className="hd-user-info">
              <span className="hd-user-name" title={name ?? ''}>
                {name ?? 'Medical Center'}
              </span>
              <span className="hd-user-code">{hCode}</span>
            </div>
          </div>
          <button id="hd-logout-btn" className="hd-logout-btn" onClick={logout} aria-label="Sign Out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main App Container */}
      <main className="hd-main" id="hd-main-content">
        {/* Top bar */}
        <header className="hd-topbar">
          <div className="hd-topbar-left">
            <button
              id="hd-menu-btn"
              className="hd-menu-btn"
              onClick={() => setSideOpen(true)}
              aria-label="Open Navigation"
            >
              <Menu size={20} />
            </button>

            <div className="hd-search-box">
              <Search size={15} className="hd-search-icon" />
              <input
                type="text"
                className="hd-search-input"
                placeholder="Search patient MRN, doctor, appointment or ward..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="hd-topbar-right">
            {/* Operational Status */}
            <span className="hd-status-chip" title="Level 1 General Hospital Accreditation Active">
              <span className="hd-status-dot" />
              <span>LEVEL 1 ACTIVE</span>
            </span>

            {/* Accreditation Badge */}
            <button
              id="hospital-share-id-btn"
              className="hd-action-btn"
              onClick={() => setShowShareModal(true)}
              title="View institutional accreditation ID & QR Code"
            >
              <ShieldCheck size={14} style={{ color: '#0f766e' }} />
              <span style={{ fontFamily: 'var(--font-hosp-mono)', fontWeight: 600 }}>{hCode}</span>
            </button>

            {/* Quick QR Scanner */}
            <button
              id="hospital-scan-btn"
              className="hd-action-btn hd-action-btn--primary"
              onClick={() => setShowScannerModal(true)}
              title="Scan Patient or Doctor QR Code"
            >
              <Camera size={14} />
              <span>Scan QR</span>
            </button>

            {/* Clinical Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                className="hd-notif-btn"
                onClick={() => setShowNotifs((v) => !v)}
                title="Clinical Notifications & Alerts"
                aria-label="Notifications"
              >
                <Bell size={16} />
                {notifications.length > 0 && <span className="hd-notif-badge" />}
              </button>

              {showNotifs && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '320px',
                    background: 'var(--hosp-surface)',
                    border: '1px solid var(--hosp-border)',
                    borderRadius: 'var(--hosp-radius-md)',
                    boxShadow: 'var(--hosp-shadow-md)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--hosp-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Clinical Alerts</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {notifications.length > 0 ? `${notifications.length} unread` : 'All clear'}
                    </span>
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                        <Bell size={24} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                        <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No Active Alerts</div>
                        <div>All facility units are operating within normal parameters.</div>
                      </div>
                    ) : (
                      notifications.map((n, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid var(--hosp-border)',
                            background: n.urgent ? 'var(--hosp-critical-bg)' : 'transparent',
                          }}
                        >
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: n.urgent ? '#991b1b' : 'var(--hosp-text-main)' }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{n.detail}</div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>{n.time}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Viewport content */}
        <div className="hd-viewport" role="region" aria-live="polite">
          {tab === 'overview'     && <HospOverviewTab />}
          {tab === 'patients'     && <PatientLookupTab onScanClick={() => setShowScannerModal(true)} />}
          {tab === 'doctors'      && <DoctorsTab onScanDoctorClick={() => setShowScannerModal(true)} />}
          {tab === 'appointments' && <AppointmentsTab />}
          {tab === 'admissions'   && <AdmissionsTab />}
          {tab === 'departments'  && <DepartmentsTab />}
          {tab === 'dispensary'   && <DispensaryTab onScanClick={() => setShowScannerModal(true)} />}
          {tab === 'billing'      && <BillingTab />}
          {tab === 'reports'      && <ReportsTab />}
          {tab === 'profile'      && <HospProfileTab />}
        </div>
      </main>

      {/* Share Hospital ID & QR Modal */}
      <ShareIdModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        role="hospital"
        code={hCode}
        name={name || 'Hospital Administration'}
        subtitle="Physicians, ambulances and patients can scan this institutional accreditation code to route EHR and admission records."
        details={[
          { label: 'Hospital Code', value: hCode },
          { label: 'Facility ID', value: String(hospitalId || 1) },
          { label: 'Accreditation', value: 'Level 1 Trauma & Academic Medical Center' },
          { label: 'Network', value: 'Rxify Interoperable Healthcare Registry' },
        ]}
      />

      {/* Universal QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        role="hospital"
        onSuccessAction={(actionType: string) => {
          if (actionType === 'LOOKUP_PATIENT' || actionType === 'VIEW_PATIENT') {
            setTab('patients');
          } else if (actionType === 'AFFILIATE_DOCTOR' || actionType === 'VIEW_DOCTOR') {
            setTab('doctors');
          }
        }}
      />
    </div>
  );
}
