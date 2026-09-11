import { useState, useEffect, useCallback } from 'react';
import {
  Activity, FileText, Stethoscope, Upload, LogOut,
  Sun, Moon, Menu, X, ChevronRight, TrendingUp,
  AlertCircle, Clock, User, MessageSquare
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth';
import { useNavigate } from '@tanstack/react-router';
import Overview from './tabs/Overview';
import MyPrescriptions from './tabs/MyPrescriptions';
import MyDoctor from './tabs/MyDoctor';
import PatientMessagesTab from './tabs/MessagesTab';
import UploadTab from './tabs/UploadTab';
import DispensaryTab from './tabs/DispensaryTab';
import { Package } from 'lucide-react';

export type DashTab = 'overview' | 'prescriptions' | 'dispensary' | 'doctor' | 'messages' | 'upload';

const NAV_ITEMS: { id: DashTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'overview',       label: 'Overview',         icon: <TrendingUp size={20} />,  desc: 'Your health snapshot'   },
  { id: 'prescriptions',  label: 'My Prescriptions',  icon: <FileText size={20} />,    desc: 'All your records'       },
  { id: 'dispensary',     label: 'Dispensary Status', icon: <Package size={20} />,     desc: 'Live medicine ETAs'     },
  { id: 'doctor',         label: 'My Doctor',         icon: <Stethoscope size={20} />, desc: 'Doctor connection'      },
  { id: 'messages',       label: 'Messages',         icon: <MessageSquare size={20} />,desc: 'Doctor consultation chat' },
  { id: 'upload',         label: 'Upload',            icon: <Upload size={20} />,      desc: 'Add a new prescription' },
];

import ShareIdModal from '../../components/common/ShareIdModal';
import QrScannerModal from '../../components/common/QrScannerModal';
import { fetchPatientStats } from '../../lib/patientApi';
import { Camera, QrCode as QrIcon, ShieldCheck } from 'lucide-react';

export default function PatientDashboard() {
  const { username, displayName, patientCode, patientId, updateProfileData, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab]         = useState<DashTab>('overview');
  const [dark, setDark]       = useState(() => localStorage.getItem('rxify-theme') === 'dark');
  const [sideOpen, setSideOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  /* ── Sync patient_code and profile from stats ── */
  useEffect(() => {
    fetchPatientStats()
      .then((stats) => {
        if (stats.patient_code || stats.patient_id) {
          updateProfileData({
            patientCode: stats.patient_code ?? null,
            patientId: stats.patient_id ?? null,
            displayName: stats.full_name ?? null,
          });
        }
      })
      .catch(() => {});
  }, [updateProfileData]);

  /* ── Apply theme ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('rxify-theme', dark ? 'dark' : 'light');
  }, [dark]);

  /* ── Close sidebar on wide viewports ─────────────────────────────────────── */
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

  const switchTab = (t: DashTab) => {
    setTab(t);
    setSideOpen(false);
  };

  const initials = (username ?? 'P').slice(0, 2).toUpperCase();

  return (
    <div className="pd-shell" data-theme={dark ? 'dark' : 'light'}>

      {/* ── Sidebar overlay (mobile) ─────────────────────────────────────── */}
      {sideOpen && (
        <div
          className="pd-overlay"
          onClick={() => setSideOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`pd-sidebar ${sideOpen ? 'pd-sidebar--open' : ''}`} aria-label="Main navigation">

        {/* Logo */}
        <div className="pd-logo">
          <div className="pd-logo-icon" aria-hidden="true">
            <Activity size={18} />
          </div>
          <span className="pd-logo-text">Rxify</span>
          <button
            className="pd-close-btn"
            onClick={() => setSideOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="pd-nav" role="navigation">
          <p className="pd-nav-label">Navigation</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`pd-nav-item ${tab === item.id ? 'pd-nav-item--active' : ''}`}
              onClick={() => switchTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <span className="pd-nav-indicator" aria-hidden="true" />
              <span className="pd-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="pd-nav-text">
                <span className="pd-nav-label-text">{item.label}</span>
                <span className="pd-nav-desc">{item.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* Bottom: user + actions */}
        <div className="pd-sidebar-footer">
          <div className="pd-user-row">
            <div className="pd-avatar" aria-hidden="true">{initials}</div>
            <div className="pd-user-info">
              <span className="pd-user-name">{username ?? 'Patient'}</span>
              <span className="pd-user-role">Patient</span>
            </div>
          </div>
          <div className="pd-footer-actions">
            <button
              id="theme-toggle"
              className="pd-icon-btn"
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              id="logout-btn"
              className="pd-logout-btn"
              onClick={logout}
              aria-label="Log out"
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <main className="pd-main" id="main-content">

        {/* Top bar (mobile) */}
        <header className="pd-topbar">
          <button
            id="sidebar-open-btn"
            className="pd-menu-btn"
            onClick={() => setSideOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sideOpen}
            aria-controls="pd-sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="pd-topbar-logo" aria-hidden="true">
            <Activity size={18} />
            <span>Rxify</span>
          </div>
          <button
            className="pd-icon-btn"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        {/* Breadcrumb & Action Bar */}
        <div className="pd-breadcrumb" aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <User size={13} aria-hidden="true" />
            <span>Patient</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="pd-breadcrumb-current">
              {NAV_ITEMS.find((n) => n.id === tab)?.label}
            </span>
          </div>

          <div className="rx-top-action-bar">
            <button
              id="patient-share-id-btn"
              className="rx-id-badge-btn"
              onClick={() => setShowShareModal(true)}
              title="View and share your Patient ID and QR Code"
            >
              <ShieldCheck size={14} />
              <span>ID: {patientCode || 'My QR Code'}</span>
            </button>
            <button
              id="patient-scan-btn"
              className="rx-scan-action-btn"
              onClick={() => setShowScannerModal(true)}
              title="Scan Doctor or Hospital QR Code"
            >
              <Camera size={14} />
              <span>Scan & Connect</span>
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="pd-content" role="region" aria-live="polite">
          {tab === 'overview'      && <Overview      onUploadClick={() => switchTab('upload')} onViewAllClick={() => switchTab('prescriptions')} />}
          {tab === 'prescriptions' && <MyPrescriptions />}
          {tab === 'dispensary'    && <DispensaryTab />}
          {tab === 'doctor'        && <MyDoctor />}
          {tab === 'messages'      && <PatientMessagesTab />}
          {tab === 'upload'        && <UploadTab />}
        </div>
      </main>

      {/* Share ID & QR Modal */}
      <ShareIdModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        role="patient"
        code={patientCode || `RXF-P-${patientId || 'DEMO'}`}
        name={displayName || username || 'Patient'}
        subtitle="Share this public ID or QR code with doctors, hospitals, and dispensaries."
        allowShareToken={true}
        details={[
          { label: 'Patient Code', value: patientCode || 'Assigned' },
          { label: 'User Account', value: username || '' },
          { label: 'Network Access', value: 'Instant Hospital & Clinic Connect' },
        ]}
      />

      {/* Universal QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        role="patient"
        onSuccessAction={(actionType) => {
          if (actionType === 'patient_connected_doctor') {
            switchTab('doctor');
          }
        }}
      />
    </div>
  );
}
