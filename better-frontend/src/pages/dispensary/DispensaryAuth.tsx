import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Building2, Lock, Mail, ArrowRight, Activity, ShieldCheck,
  UserPlus, LogIn, Eye, EyeOff, Phone, MapPin, Clock,
  Timer, CheckCircle2, Hospital as HospitalIcon, AlertCircle
} from 'lucide-react';
import {
  loginDispensary,
  registerDispensary,
  fetchPublicHospitals,
  type PublicHospital
} from '../../lib/dispensaryApi';
import { useAuthStore } from '../../lib/auth';
import { PortalSwitcher } from '../../components/common/PortalSwitcher';

type Tab = 'login' | 'register';

export default function DispensaryAuth() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  // Initial tab from query parameter (?tab=register) or path (/dispensary/register)
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tab') === 'register' || window.location.pathname.includes('/register')) {
        return 'register';
      }
    }
    return 'login';
  });

  /* ─── Sign In State ─── */
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  /* ─── Register State ─── */
  const [hospitals, setHospitals] = useState<PublicHospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [manualHospitalId, setManualHospitalId] = useState(false);

  const [regName, setRegName] = useState('');
  const [regHospitalId, setRegHospitalId] = useState('1');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [regHours, setRegHours] = useState('08:00 - 20:00 Daily');
  const [regPrepMinutes, setRegPrepMinutes] = useState('15');

  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  /* Fetch active hospitals for the dropdown */
  useEffect(() => {
    let active = true;
    setHospitalsLoading(true);
    fetchPublicHospitals()
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) {
          setHospitals(data);
          setRegHospitalId(String(data[0].hospital_id));
        } else {
          setHospitals([{ hospital_id: 1, name: 'City General Hospital', city: 'Metro City' }]);
          setRegHospitalId('1');
        }
      })
      .catch(() => {
        if (!active) return;
        setHospitals([{ hospital_id: 1, name: 'City General Hospital', city: 'Metro City' }]);
        setRegHospitalId('1');
      })
      .finally(() => {
        if (active) setHospitalsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /* ─── Submit Login ─── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;

    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await loginDispensary(loginEmail.trim(), loginPassword);
      setAuth(res.access_token, 'dispensary', res.name, {
        dispensaryId: res.dispensary_id,
        displayName: res.name,
      });
      navigate({ to: '/dispensary' });
    } catch (err: any) {
      setLoginError(err?.message ?? 'Login failed. Please check your email and password.');
    } finally {
      setLoginLoading(false);
    }
  };

  /* ─── Submit Register ─── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const nameTrim = regName.trim();
    const emailTrim = regEmail.trim();
    const parsedHospId = parseInt(regHospitalId, 10);

    if (!nameTrim) {
      setRegError('Dispensary name is required.');
      return;
    }
    if (!emailTrim) {
      setRegError('Dispensary login email is required.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPass) {
      setRegError('Passwords do not match. Please re-enter.');
      return;
    }
    if (isNaN(parsedHospId) || parsedHospId <= 0) {
      setRegError('Please select or specify a valid hospital affiliation.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await registerDispensary({
        hospital_id: parsedHospId,
        name: nameTrim,
        email: emailTrim,
        password: regPassword,
        phone: regPhone.trim() || undefined,
        location: regLocation.trim() || undefined,
        operating_hours: regHours.trim() || undefined,
        avg_prep_minutes: parseInt(regPrepMinutes, 10) || 15,
      });

      setRegSuccess(res.message || 'Dispensary registered successfully! Switching to sign in...');
      setLoginEmail(emailTrim);
      setLoginPassword('');
      setTimeout(() => {
        setTab('login');
        setRegSuccess('');
      }, 1800);
    } catch (err: any) {
      setRegError(err?.message ?? 'Registration failed. Check if this email is already in use.');
    } finally {
      setRegLoading(false);
    }
  };

  const fillDemo = () => {
    setLoginEmail('dispensary@citygeneral.com');
    setLoginPassword('password123');
    setLoginError('');
  };

  return (
    <div className="auth-page">
      {/* Brand Header */}
      <a href="/" className="auth-logo">
        <div className="auth-logo-icon" style={{ background: '#0ea5e9' }}>
          <Activity size={20} />
        </div>
        <span>Rxify Dispensary</span>
      </a>

      {/* Portal Switcher */}
      <PortalSwitcher current="dispensary" />

      <div
        className="auth-card"
        style={{
          maxWidth: tab === 'register' ? '560px' : '440px',
          transition: 'max-width 0.25s ease',
        }}
      >
        {/* Card Header */}
        <div className="auth-card-header">
          <div className="auth-card-icon" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}>
            <Building2 size={26} />
          </div>
          <h1 className="auth-card-title">
            {tab === 'login' ? 'Dispensary Portal' : 'Register Dispensary Unit'}
          </h1>
          <p className="auth-card-subtitle">
            {tab === 'login'
              ? 'Sign in to manage medicine stock & fulfill prescription orders'
              : 'Register your pharmacy under an accredited hospital organization'}
          </p>
        </div>

        {/* Tab Controls: Sign In & Register */}
        <div className="auth-tabs" role="tablist">
          <button
            id="tab-disp-login"
            role="tab"
            aria-selected={tab === 'login'}
            className={`auth-tab ${tab === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => { setTab('login'); setLoginError(''); }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
          <button
            id="tab-disp-register"
            role="tab"
            aria-selected={tab === 'register'}
            className={`auth-tab ${tab === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => { setTab('register'); setRegError(''); setRegSuccess(''); }}
          >
            <UserPlus size={15} />
            <span>Register Unit</span>
          </button>
          <div className={`auth-tab-indicator ${tab === 'register' ? 'auth-tab-indicator--right' : ''}`} />
        </div>

        {/* ── SIGN IN FORM ── */}
        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <div className="auth-field">
              <label htmlFor="disp-email" className="auth-label">Dispensary Email</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="disp-email"
                  type="email"
                  className="auth-input"
                  placeholder="dispensary@hospital.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="disp-password" className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="disp-password"
                  type={showLoginPass ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter dispensary password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowLoginPass((v) => !v)}
                  aria-label={showLoginPass ? 'Hide password' : 'Show password'}
                >
                  {showLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="auth-alert auth-alert--error" role="alert">
                {loginError}
              </div>
            )}

            <button
              id="disp-submit-login"
              type="submit"
              className="auth-submit"
              disabled={loginLoading}
              style={{ background: '#0ea5e9' }}
            >
              {loginLoading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>Sign In to Dispensary</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── REGISTRATION FORM ── */}
        {tab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem' }}>
              {/* Dispensary Unit Name */}
              <div className="auth-field">
                <label htmlFor="reg-name" className="auth-label">Dispensary Unit Name *</label>
                <div className="auth-input-wrap">
                  <Building2 size={16} className="auth-input-icon" />
                  <input
                    id="reg-name"
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Central Inpatient Pharmacy"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Hospital Affiliation Selector */}
              <div className="auth-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="reg-hospital" className="auth-label">Hospital Affiliation *</label>
                  <button
                    type="button"
                    onClick={() => setManualHospitalId((v) => !v)}
                    style={{ fontSize: '0.72rem', color: '#0ea5e9', textDecoration: 'underline', padding: 0 }}
                  >
                    {manualHospitalId ? 'Select List' : 'Enter ID'}
                  </button>
                </div>
                <div className="auth-input-wrap">
                  <HospitalIcon size={16} className="auth-input-icon" />
                  {manualHospitalId ? (
                    <input
                      id="reg-hospital-manual"
                      type="number"
                      min={1}
                      className="auth-input"
                      placeholder="Hospital ID (e.g. 1)"
                      value={regHospitalId}
                      onChange={(e) => setRegHospitalId(e.target.value)}
                      required
                    />
                  ) : (
                    <select
                      id="reg-hospital"
                      className="auth-input"
                      style={{ cursor: 'pointer' }}
                      value={regHospitalId}
                      onChange={(e) => setRegHospitalId(e.target.value)}
                      disabled={hospitalsLoading}
                      required
                    >
                      {hospitals.map((h) => (
                        <option key={h.hospital_id} value={h.hospital_id}>
                          {h.name} {h.city ? `(${h.city})` : ''} — ID: {h.hospital_id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="auth-field">
                <label htmlFor="reg-email" className="auth-label">Dispensary Login Email *</label>
                <div className="auth-input-wrap">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="reg-email"
                    type="email"
                    className="auth-input"
                    placeholder="pharmacy@hospital.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="auth-field">
                <label htmlFor="reg-phone" className="auth-label">Contact Phone</label>
                <div className="auth-input-wrap">
                  <Phone size={16} className="auth-input-icon" />
                  <input
                    id="reg-phone"
                    type="tel"
                    className="auth-input"
                    placeholder="+1 (555) 019-2831"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field">
                <label htmlFor="reg-pass" className="auth-label">Password *</label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="reg-pass"
                    type={showRegPass ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Min. 6 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowRegPass((v) => !v)}
                    aria-label={showRegPass ? 'Hide password' : 'Show password'}
                  >
                    {showRegPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="auth-field">
                <label htmlFor="reg-confirm" className="auth-label">Confirm Password *</label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="reg-confirm"
                    type={showRegPass ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Re-enter password"
                    value={regConfirmPass}
                    onChange={(e) => setRegConfirmPass(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Location */}
              <div className="auth-field">
                <label htmlFor="reg-location" className="auth-label">Physical Location</label>
                <div className="auth-input-wrap">
                  <MapPin size={16} className="auth-input-icon" />
                  <input
                    id="reg-location"
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Ground Floor, Counter 2"
                    value={regLocation}
                    onChange={(e) => setRegLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Operating Hours */}
              <div className="auth-field">
                <label htmlFor="reg-hours" className="auth-label">Operating Hours</label>
                <div className="auth-input-wrap">
                  <Clock size={16} className="auth-input-icon" />
                  <input
                    id="reg-hours"
                    type="text"
                    className="auth-input"
                    placeholder="e.g. 08:00 - 20:00 Daily"
                    value={regHours}
                    onChange={(e) => setRegHours(e.target.value)}
                  />
                </div>
              </div>

              {/* Prep Time */}
              <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="reg-prep" className="auth-label">Average Order Preparation Time (Minutes)</label>
                <div className="auth-input-wrap">
                  <Timer size={16} className="auth-input-icon" />
                  <input
                    id="reg-prep"
                    type="number"
                    min={1}
                    max={180}
                    className="auth-input"
                    placeholder="15"
                    value={regPrepMinutes}
                    onChange={(e) => setRegPrepMinutes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {regError && (
              <div className="auth-alert auth-alert--error" role="alert">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{regError}</span>
              </div>
            )}
            {regSuccess && (
              <div className="auth-alert auth-alert--success" role="status">
                <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <span>{regSuccess}</span>
              </div>
            )}

            <button
              id="disp-submit-register"
              type="submit"
              className="auth-submit"
              disabled={regLoading}
              style={{ background: '#0ea5e9' }}
            >
              {regLoading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>Register Dispensary Unit</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Demo Quick-Fill Bar */}
        <div style={{ marginTop: '1.25rem', padding: '0.75rem 0.9rem', borderRadius: '0.5rem', background: 'var(--bg-card-alt, rgba(255,255,255,0.03))', border: '1px solid rgba(14, 165, 233, 0.15)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} style={{ color: '#0ea5e9', flexShrink: 0 }} />
            <span>Demo: <strong>dispensary@citygeneral.com</strong> / <strong>password123</strong></span>
          </div>
          {tab === 'login' && (
            <button
              type="button"
              onClick={fillDemo}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(14, 165, 233, 0.12)',
                color: '#0ea5e9',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Quick Fill
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
