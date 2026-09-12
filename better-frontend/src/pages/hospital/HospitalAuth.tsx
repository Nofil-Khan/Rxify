import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Eye, EyeOff, Lock, ArrowRight, Building2, Mail, Phone,
  MapPin, ShieldCheck, CheckCircle2, FileText, Activity
} from 'lucide-react';
import { hospitalLogin, registerHospital } from '../../lib/hospitalApi';
import { useHospitalAuthStore } from '../../lib/hospitalAuth';
import { PortalSwitcher } from '../../components/common/PortalSwitcher';

type Tab = 'login' | 'register';

export default function HospitalAuth() {
  const navigate = useNavigate();
  const { setHospitalAuth, isAuthenticated } = useHospitalAuthStore();

  useEffect(() => {
    if (isAuthenticated) navigate({ to: '/hospital' });
  }, [isAuthenticated, navigate]);

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tab') === 'register' || window.location.pathname.includes('/register')) {
        return 'register';
      }
    }
    return 'login';
  });

  const [showPass, setShowPass] = useState(false);

  /* Login state */
  const [lEmail, setLEmail] = useState('');
  const [lPass, setLPass] = useState('');
  const [lError, setLError] = useState('');
  const [lLoading, setLLoading] = useState(false);

  /* Register state */
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPass, setRPass] = useState('');
  const [rConfirmPass, setRConfirmPass] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rReg, setRReg] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rCity, setRCity] = useState('');
  const [rState, setRState] = useState('');
  const [rError, setRError] = useState('');
  const [rSuccess, setRSuccess] = useState('');
  const [rLoading, setRLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!lEmail.trim() || !lPass) return;
    setLError('');
    setLLoading(true);
    try {
      const res = await hospitalLogin(lEmail.trim(), lPass);
      setHospitalAuth(res.access_token, res.hospital_id, res.name, res.hospital_code);
      navigate({ to: '/hospital' });
    } catch (err: any) {
      setLError(err?.message ?? 'Incorrect email or password.');
    } finally {
      setLLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRError('');
    setRSuccess('');

    if (!rName.trim()) {
      setRError('Hospital organization name is required.');
      return;
    }
    if (!rEmail.trim()) {
      setRError('Administrator email is required.');
      return;
    }
    if (!rPass || rPass.length < 6) {
      setRError('Password must be at least 6 characters.');
      return;
    }
    if (rPass !== rConfirmPass) {
      setRError('Passwords do not match.');
      return;
    }

    setRLoading(true);
    try {
      await registerHospital({
        name: rName.trim(),
        email: rEmail.trim(),
        password: rPass,
        phone: rPhone.trim() || undefined,
        registration_number: rReg.trim() || undefined,
        address: rAddress.trim() || undefined,
        city: rCity.trim() || undefined,
        state: rState.trim() || undefined,
      });
      setRSuccess('Hospital registered successfully! Redirecting to sign in...');
      setLEmail(rEmail.trim());
      setLPass('');
      setTimeout(() => {
        setTab('login');
        setRSuccess('');
      }, 1800);
    } catch (err: any) {
      setRError(err?.message ?? 'Registration failed. Check if email or registration number is already in use.');
    } finally {
      setRLoading(false);
    }
  }

  const fillDemo = () => {
    setLEmail('admin@citygeneral.com');
    setLPass('password123');
    setLError('');
  };

  return (
    <div className="hosp-auth-wrapper">
      {/* Top portal navigation */}
      <PortalSwitcher current="hospital" />

      <div className="hosp-auth-container" style={{ maxWidth: tab === 'register' ? '640px' : '460px' }}>
        {/* Institutional Header */}
        <div className="hosp-auth-header-card">
          <div className="hosp-auth-badge-row">
            <span className="hosp-auth-status-pill">
              <Activity size={12} className="hosp-pulse-dot" />
              <span>ACCREDITED HEALTHCARE NETWORK</span>
            </span>
            <span className="hosp-auth-sec-pill">
              <ShieldCheck size={12} />
              <span>TLS 1.3 SECURE</span>
            </span>
          </div>

          <div className="hosp-auth-brand-block">
            <div className="hosp-auth-emblem-box">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="hosp-auth-title">Hospital Administration</h1>
              <p className="hosp-auth-desc">Institutional Gateway · Inpatient & Outpatient Management</p>
            </div>
          </div>
        </div>

        {/* Tab Segment Control */}
        <div className="hosp-segmented-tabs" role="tablist">
          <button
            role="tab"
            id="hosp-tab-signin"
            aria-selected={tab === 'login'}
            className={`hosp-seg-btn ${tab === 'login' ? 'hosp-seg-btn--active' : ''}`}
            onClick={() => { setTab('login'); setLError(''); }}
          >
            Sign In to Console
          </button>
          <button
            role="tab"
            id="hosp-tab-register"
            aria-selected={tab === 'register'}
            className={`hosp-seg-btn ${tab === 'register' ? 'hosp-seg-btn--active' : ''}`}
            onClick={() => { setTab('register'); setRError(''); setRSuccess(''); }}
          >
            Register Institution
          </button>
        </div>

        {/* ── SIGN IN FORM ── */}
        {tab === 'login' && (
          <form className="hosp-form-body" onSubmit={handleLogin} noValidate>
            <div className="hosp-form-group">
              <label htmlFor="h-login-email" className="hosp-field-label">Institutional Email</label>
              <div className="hosp-input-container">
                <Mail size={16} className="hosp-input-adornment" />
                <input
                  id="h-login-email"
                  type="email"
                  className="hosp-text-input"
                  placeholder="admin@hospital.org"
                  value={lEmail}
                  onChange={(e) => setLEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="hosp-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="h-login-pass" className="hosp-field-label">Password</label>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Case-sensitive</span>
              </div>
              <div className="hosp-input-container">
                <Lock size={16} className="hosp-input-adornment" />
                <input
                  id="h-login-pass"
                  type={showPass ? 'text' : 'password'}
                  className="hosp-text-input"
                  placeholder="Enter administrator password"
                  value={lPass}
                  onChange={(e) => setLPass(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="hosp-icon-action-btn"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {lError && (
              <div className="hosp-banner hosp-banner--error" role="alert">
                <span>{lError}</span>
              </div>
            )}

            <button
              id="h-login-submit"
              type="submit"
              className="hosp-btn-primary"
              disabled={lLoading}
            >
              {lLoading ? (
                <span className="hosp-spinner" />
              ) : (
                <>
                  <span>Authenticate to Console</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {tab === 'register' && (
          <form className="hosp-form-body" onSubmit={handleRegister} noValidate>
            <div className="hosp-grid-2">
              <div className="hosp-form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="h-reg-name" className="hosp-field-label">Hospital / Institution Name *</label>
                <div className="hosp-input-container">
                  <Building2 size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-name"
                    type="text"
                    className="hosp-text-input"
                    placeholder="e.g. St. Jude Regional Medical Center"
                    value={rName}
                    onChange={(e) => setRName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="hosp-form-group">
                <label htmlFor="h-reg-email" className="hosp-field-label">Administrator Email *</label>
                <div className="hosp-input-container">
                  <Mail size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-email"
                    type="email"
                    className="hosp-text-input"
                    placeholder="admin@hospital.org"
                    value={rEmail}
                    onChange={(e) => setREmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="hosp-form-group">
                <label htmlFor="h-reg-reg" className="hosp-field-label">Accreditation / Reg. Number</label>
                <div className="hosp-input-container">
                  <FileText size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-reg"
                    type="text"
                    className="hosp-text-input"
                    placeholder="e.g. REG-HOSP-7701"
                    value={rReg}
                    onChange={(e) => setRReg(e.target.value)}
                  />
                </div>
              </div>

              <div className="hosp-form-group">
                <label htmlFor="h-reg-pass" className="hosp-field-label">Admin Password *</label>
                <div className="hosp-input-container">
                  <Lock size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-pass"
                    type={showPass ? 'text' : 'password'}
                    className="hosp-text-input"
                    placeholder="Min. 6 characters"
                    value={rPass}
                    onChange={(e) => setRPass(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="hosp-icon-action-btn"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label="Toggle password view"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="hosp-form-group">
                <label htmlFor="h-reg-confirm" className="hosp-field-label">Confirm Password *</label>
                <div className="hosp-input-container">
                  <Lock size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-confirm"
                    type={showPass ? 'text' : 'password'}
                    className="hosp-text-input"
                    placeholder="Repeat password"
                    value={rConfirmPass}
                    onChange={(e) => setRConfirmPass(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="hosp-form-group">
                <label htmlFor="h-reg-phone" className="hosp-field-label">Phone Contact</label>
                <div className="hosp-input-container">
                  <Phone size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-phone"
                    type="tel"
                    className="hosp-text-input"
                    placeholder="+1 (555) 234-5678"
                    value={rPhone}
                    onChange={(e) => setRPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="hosp-form-group">
                <label htmlFor="h-reg-city" className="hosp-field-label">City</label>
                <div className="hosp-input-container">
                  <MapPin size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-city"
                    type="text"
                    className="hosp-text-input"
                    placeholder="e.g. Metro City"
                    value={rCity}
                    onChange={(e) => setRCity(e.target.value)}
                  />
                </div>
              </div>

              <div className="hosp-form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="h-reg-address" className="hosp-field-label">Campus Address</label>
                <div className="hosp-input-container">
                  <MapPin size={16} className="hosp-input-adornment" />
                  <input
                    id="h-reg-address"
                    type="text"
                    className="hosp-text-input"
                    placeholder="e.g. 100 Healthcare Blvd, Building A"
                    value={rAddress}
                    onChange={(e) => setRAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {rError && (
              <div className="hosp-banner hosp-banner--error" role="alert">
                <span>{rError}</span>
              </div>
            )}
            {rSuccess && (
              <div className="hosp-banner hosp-banner--success" role="status">
                <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                <span>{rSuccess}</span>
              </div>
            )}

            <button
              id="h-reg-submit"
              type="submit"
              className="hosp-btn-primary"
              disabled={rLoading}
            >
              {rLoading ? (
                <span className="hosp-spinner" />
              ) : (
                <>
                  <span>Register Hospital Profile</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Demo Quick Fill */}
        <div className="hosp-demo-pill-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="hosp-key-tag">DEMO</span>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>
              <strong>admin@citygeneral.com</strong> / <strong>password123</strong>
            </span>
          </div>
          {tab === 'login' && (
            <button
              type="button"
              onClick={fillDemo}
              className="hosp-btn-secondary"
            >
              Auto-Fill
            </button>
          )}
        </div>

        {/* Security / Compliance note */}
        <div className="hosp-auth-footer-notice">
          <span>Protected by 256-bit AES encryption. HIPAA and HL7 FHIR standards compliant.</span>
        </div>
      </div>
    </div>
  );
}
