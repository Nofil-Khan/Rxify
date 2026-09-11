import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Users, FileText, UserPlus, Stethoscope, LogOut,
  Sun, Moon, Menu, X, ChevronRight, TrendingUp, Shield, MessageSquare, Calendar
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth';
import { useNavigate } from '@tanstack/react-router';
import { getInitials } from '../../lib/doctorApi';
import OverviewTab from './tabs/OverviewTab';
import MyPatientsTab from './tabs/MyPatientsTab';
import PrescriptionsTab from './tabs/PrescriptionsTab';
import RequestsTab from './tabs/RequestsTab';
import DoctorMessagesTab from './tabs/MessagesTab';
import DoctorProfileTab from './tabs/DoctorProfileTab';
import AppointmentsTab from './tabs/AppointmentsTab';
import ShareIdModal from '../../components/common/ShareIdModal';
import QrScannerModal from '../../components/common/QrScannerModal';
import { Camera, ShieldCheck, Stethoscope as StethIcon } from 'lucide-react';
import { getDoctorProfile, type DoctorProfile } from '../../lib/doctorApi';

export type DoctorTab = 'overview' | 'patients' | 'appointments' | 'messages' | 'prescriptions' | 'requests' | 'profile';

const NAV_ITEMS: { id: DoctorTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'overview',      label: 'Overview',            icon: <TrendingUp size={20} />,  desc: 'Clinical metrics & alerts' },
  { id: 'patients',      label: 'My Patients',         icon: <Users size={20} />,       desc: 'Assigned care directory'   },
  { id: 'appointments',  label: 'Appointments',        icon: <Calendar size={20} />,    desc: 'Consults & slot scheduling' },
  { id: 'messages',      label: 'Direct Messages',     icon: <MessageSquare size={20} />,desc: 'Patient chat consultation' },
  { id: 'prescriptions', label: 'Rx Database',         icon: <FileText size={20} />,    desc: 'OCR scanned records'       },
  { id: 'requests',      label: 'Patient Requests',    icon: <UserPlus size={20} />,    desc: 'Connection invitations'    },
  { id: 'profile',       label: 'Practice Profile',    icon: <Stethoscope size={20} />, desc: 'Doctor specialty settings' },
];

export default function DoctorDashboard() {
  const { username, displayName, doctorId, doctorCode, updateProfileData, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab]         = useState<DoctorTab>('overview');
  const [dark, setDark]       = useState(() => localStorage.getItem('rxify-theme') === 'dark');
  const [sideOpen, setSideOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  /* ── Sync Doctor Profile ── */
  useEffect(() => {
    getDoctorProfile()
      .then((p: DoctorProfile) => {
        if (p && p.id) {
          updateProfileData({
            doctorId: p.id,
            doctorCode: p.doctor_code || `RXF-D-${p.id}`,
            displayName: p.display_name || p.username,
          });
        }
      })
      .catch(() => {});
  }, [updateProfileData]);

  /* Sync Theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('rxify-theme', dark ? 'dark' : 'light');
  }, [dark]);

  /* Responsive sidebar auto-close */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSideOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    navigate({ to: '/login' });
  }, [clearAuth, navigate]);

  const switchTab = (t: DoctorTab) => {
    setTab(t);
    setSideOpen(false);
  };

  const initials = getInitials(username || 'Doctor');

  return (
    <div className="dd-shell" data-theme={dark ? 'dark' : 'light'}>

      {/* Mobile Overlay */}
      {sideOpen && (
        <div
          className="dd-overlay"
          onClick={() => setSideOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Responsive Sidebar */}
      <aside className={`dd-sidebar ${sideOpen ? 'dd-sidebar--open' : ''}`} aria-label="Doctor navigation">

        {/* Brand Logo */}
        <div className="dd-logo">
          <div className="dd-logo-icon" aria-hidden="true">
            <Activity size={20} />
          </div>
          <span className="dd-logo-text">Rxify</span>
          <span className="dd-doctor-badge">Doctor</span>
          <button
            className="dd-close-btn"
            onClick={() => setSideOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="dd-nav" role="navigation">
          <p className="dd-nav-label">Clinical Console</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`dd-nav-${item.id}`}
              className={`dd-nav-item ${tab === item.id ? 'dd-nav-item--active' : ''}`}
              onClick={() => switchTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <span className="dd-nav-indicator" aria-hidden="true" />
              <span className="dd-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="dd-nav-text">
                <span className="dd-nav-label-text">{item.label}</span>
                <span className="dd-nav-desc">{item.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="dd-sidebar-footer">
          <div className="dd-user-row">
            <div className="dd-avatar" aria-hidden="true">{initials}</div>
            <div className="dd-user-info">
              <span className="dd-user-name">{username ?? 'Dr. Practitioner'}</span>
              <span className="dd-user-role">Licensed Doctor</span>
            </div>
          </div>

          <div className="dd-footer-actions">
            <button
              id="dd-theme-toggle"
              className="dd-icon-btn"
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              id="dd-logout-btn"
              className="dd-logout-btn"
              onClick={logout}
              aria-label="Log out of doctor dashboard"
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dd-main" id="main-content">

        {/* Mobile Topbar */}
        <header className="dd-topbar">
          <button
            id="dd-sidebar-open-btn"
            className="dd-menu-btn"
            onClick={() => setSideOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={sideOpen}
          >
            <Menu size={22} />
          </button>

          <div className="dd-topbar-logo" aria-hidden="true">
            <Activity size={18} />
            <span>Rxify Doctor</span>
          </div>

          <button
            className="dd-icon-btn"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        {/* Breadcrumb Trail & Action Bar */}
        <div className="dd-breadcrumb" aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Shield size={14} aria-hidden="true" />
            <span>Doctor Workspace</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="dd-breadcrumb-current">
              {NAV_ITEMS.find((n) => n.id === tab)?.label}
            </span>
          </div>

          <div className="rx-top-action-bar">
            <button
              id="doctor-share-id-btn"
              className="rx-id-badge-btn"
              onClick={() => setShowShareModal(true)}
              title="View and share your Doctor ID and QR Code"
            >
              <ShieldCheck size={14} />
              <span>ID: {doctorCode || (doctorId ? `RXF-D-${doctorId}` : 'Doctor ID')}</span>
            </button>
            <button
              id="doctor-scan-btn"
              className="rx-scan-action-btn"
              onClick={() => setShowScannerModal(true)}
              title="Scan Patient QR Code to Add to Care Directory"
            >
              <Camera size={14} />
              <span>Scan Patient QR</span>
            </button>
          </div>
        </div>

        {/* Tab Viewport */}
        <div className="dd-content" role="region" aria-live="polite">
          {tab === 'overview'      && <OverviewTab onNavigateTab={(t) => setTab(t as DoctorTab)} />}
          {tab === 'patients'      && <MyPatientsTab />}
          {tab === 'appointments'  && <AppointmentsTab />}
          {tab === 'messages'      && <DoctorMessagesTab />}
          {tab === 'prescriptions' && <PrescriptionsTab />}
          {tab === 'requests'      && <RequestsTab />}
          {tab === 'profile'       && <DoctorProfileTab />}
        </div>
      </main>

      {/* Share Doctor ID & QR Modal */}
      <ShareIdModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        role="doctor"
        code={doctorCode || (doctorId ? `RXF-D-${doctorId}` : 'RXF-D-1')}
        name={displayName ? `Dr. ${displayName}` : (username ? `Dr. ${username}` : 'Doctor')}
        subtitle="Patients and hospitals can scan this code to connect with your clinical practice."
        details={[
          { label: 'Physician Code', value: doctorCode || `RXF-D-${doctorId || 1}` },
          { label: 'Doctor ID', value: String(doctorId || 1) },
          { label: 'Account', value: username || '' },
          { label: 'Verification', value: 'Active Medical License' },
        ]}
      />

      {/* Universal QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        role="doctor"
        onSuccessAction={(actionType) => {
          if (actionType === 'doctor_connected_patient') {
            setTab('patients');
          }
        }}
      />
    </div>
  );
}
