import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Stethoscope, User, Lock, LogIn, UserPlus, ArrowRight, Activity } from 'lucide-react';
import { login, register, ApiError } from '../lib/api';
import { useAuthStore } from '../lib/auth';
import type { Role } from '../lib/api';
import { PortalSwitcher } from '../components/common/PortalSwitcher';

type Tab = 'login' | 'register';

export default function Auth() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, role } = useAuthStore();

  /* Redirect if already logged in */
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: role === 'doctor' ? '/doctor' : '/patient' });
    }
  }, [isAuthenticated, role, navigate]);

  const [tab, setTab] = useState<Tab>('login');
  const [showPass, setShowPass] = useState(false);

  /* Login state */
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  /* Register state */
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<Role>('patient');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  /* Ink cursor glow */
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) return;
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await login(loginUsername.trim(), loginPassword);
      setAuth(res.access_token, res.role, loginUsername.trim(), {
        userId: res.user_id,
        displayName: res.display_name,
        patientId: res.patient_id,
        patientCode: res.patient_code,
        doctorId: res.doctor_id,
        doctorCode: res.doctor_code,
        dispensaryId: res.dispensary_id,
      });
      navigate({ to: res.role === 'doctor' ? '/doctor' : '/patient' });
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword) return;
    setRegError('');
    setRegSuccess('');
    setRegLoading(true);
    try {
      const res = await register(regUsername.trim(), regPassword, regRole);
      setRegSuccess(`Account created! Welcome, ${regUsername}. You can now log in.`);
      setRegUsername('');
      setRegPassword('');
      setTimeout(() => setTab('login'), 1800);
    } catch (err) {
      setRegError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="auth-page" ref={containerRef}>
      {/* Cursor glow */}
      <div
        className="auth-cursor-glow"
        style={{
          '--glow-x': `${mouse.x * 100}%`,
          '--glow-y': `${mouse.y * 100}%`,
        } as React.CSSProperties}
      />

      {/* Background decoration */}
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />

      {/* Grid pattern */}
      <div className="auth-grid" />

      {/* Logo */}
      <a href="/" className="auth-logo">
        <div className="auth-logo-icon">
          <Activity size={20} />
        </div>
        <span>Rxify</span>
      </a>

      {/* Cross-Portal Switcher */}
      <PortalSwitcher current="main" />

      {/* Card */}
      <div className="auth-card">
        {/* Card header */}
        <div className="auth-card-header">
          <div className="auth-card-icon">
            <Stethoscope size={28} />
          </div>
          <h1 className="auth-card-title">
            {tab === 'login' ? 'Welcome back' : 'Join Rxify'}
          </h1>
          <p className="auth-card-subtitle">
            {tab === 'login'
              ? 'Sign in to access your health ecosystem'
              : 'Create your account to get started'}
          </p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            id="tab-login"
            role="tab"
            aria-selected={tab === 'login'}
            className={`auth-tab ${tab === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => { setTab('login'); setLoginError(''); }}
          >
            <LogIn size={15} />
            Sign In
          </button>
          <button
            id="tab-register"
            role="tab"
            aria-selected={tab === 'register'}
            className={`auth-tab ${tab === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => { setTab('register'); setRegError(''); setRegSuccess(''); }}
          >
            <UserPlus size={15} />
            Register
          </button>
          <div className={`auth-tab-indicator ${tab === 'register' ? 'auth-tab-indicator--right' : ''}`} />
        </div>

        {/* ── LOGIN FORM ── */}
        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <div className="auth-field">
              <label htmlFor="login-username" className="auth-label">Username</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  id="login-username"
                  type="text"
                  className="auth-input"
                  placeholder="Enter your username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="login-password" className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="auth-alert auth-alert--error" role="alert">
                {loginError}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="auth-submit"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {tab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister} noValidate>
            <div className="auth-field">
              <label htmlFor="reg-username" className="auth-label">Username</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  id="reg-username"
                  type="text"
                  className="auth-input"
                  placeholder="Choose a username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password" className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="reg-password"
                  type={showPass ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Create a strong password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Role selector */}
            <div className="auth-field">
              <label className="auth-label">I am a…</label>
              <div className="auth-role-grid">
                <button
                  id="role-patient"
                  type="button"
                  className={`auth-role-card ${regRole === 'patient' ? 'auth-role-card--active' : ''}`}
                  onClick={() => setRegRole('patient')}
                >
                  <User size={22} />
                  <span className="auth-role-title">Patient</span>
                  <span className="auth-role-desc">Manage my records & share with doctors</span>
                </button>
                <button
                  id="role-doctor"
                  type="button"
                  className={`auth-role-card ${regRole === 'doctor' ? 'auth-role-card--active' : ''}`}
                  onClick={() => setRegRole('doctor')}
                >
                  <Stethoscope size={22} />
                  <span className="auth-role-title">Doctor</span>
                  <span className="auth-role-desc">View patient records & provide care</span>
                </button>
              </div>
            </div>

            {regError && (
              <div className="auth-alert auth-alert--error" role="alert">
                {regError}
              </div>
            )}
            {regSuccess && (
              <div className="auth-alert auth-alert--success" role="status">
                {regSuccess}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              className="auth-submit"
              disabled={regLoading}
            >
              {regLoading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="auth-footer-note">
          By continuing, you agree to Rxify's{' '}
          <a href="#" className="auth-link">Terms of Service</a> and{' '}
          <a href="#" className="auth-link">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
