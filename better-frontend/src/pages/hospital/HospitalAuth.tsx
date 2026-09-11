import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Lock, ArrowRight, Building2, Mail } from 'lucide-react';
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

  const [tab, setTab] = useState<Tab>('login');
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
  const [rPhone, setRPhone] = useState('');
  const [rReg, setRReg] = useState('');
  const [rCity, setRCity] = useState('');
  const [rState, setRState] = useState('');
  const [rError, setRError] = useState('');
  const [rSuccess, setRSuccess] = useState('');
  const [rLoading, setRLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!lEmail.trim() || !lPass) return;
    setLError(''); setLLoading(true);
    try {
      const res = await hospitalLogin(lEmail.trim(), lPass);
      setHospitalAuth(res.access_token, res.hospital_id, res.name, res.hospital_code);
      navigate({ to: '/hospital' });
    } catch (err) {
      setLError(err instanceof Error ? err.message : 'Login failed.');
    } finally { setLLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!rName.trim() || !rEmail.trim() || !rPass) return;
    setRError(''); setRSuccess(''); setRLoading(true);
    try {
      await registerHospital({ name: rName.trim(), email: rEmail.trim(), password: rPass, phone: rPhone, registration_number: rReg, city: rCity, state: rState });
      setRSuccess('Hospital registered! You can now sign in.');
      setTimeout(() => setTab('login'), 2000);
    } catch (err) {
      setRError(err instanceof Error ? err.message : 'Registration failed.');
    } finally { setRLoading(false); }
  }

  return (
    <div className="hosp-auth">
      <PortalSwitcher current="hospital" />
      <div className="hosp-auth-paper">

        {/* Header plate */}
        <div className="hosp-auth-header">
          <div className="hosp-auth-emblem" aria-hidden="true">
            <Building2 size={26} />
          </div>
          <div>
            <h1 className="hosp-auth-title">Rxify Hospital Portal</h1>
            <p className="hosp-auth-subtitle">Secure institutional access</p>
          </div>
        </div>

        {/* Tab strip */}
        <div className="hosp-auth-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'login'} className={`hosp-tab ${tab === 'login' ? 'hosp-tab--active' : ''}`} onClick={() => { setTab('login'); setLError(''); }}>Sign In</button>
          <button role="tab" aria-selected={tab === 'register'} className={`hosp-tab ${tab === 'register' ? 'hosp-tab--active' : ''}`} onClick={() => { setTab('register'); setRError(''); setRSuccess(''); }}>Register</button>
        </div>

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <form className="hosp-auth-form" onSubmit={handleLogin} noValidate>
            <fieldset className="hosp-fieldset">
              <label htmlFor="h-login-email" className="hosp-label">Hospital Email</label>
              <div className="hosp-input-wrap">
                <Mail size={15} className="hosp-input-icon" aria-hidden="true" />
                <input id="h-login-email" type="email" className="hosp-input" placeholder="admin@hospital.com" value={lEmail} onChange={e => setLEmail(e.target.value)} autoComplete="email" required />
              </div>
            </fieldset>
            <fieldset className="hosp-fieldset">
              <label htmlFor="h-login-pass" className="hosp-label">Password</label>
              <div className="hosp-input-wrap">
                <Lock size={15} className="hosp-input-icon" aria-hidden="true" />
                <input id="h-login-pass" type={showPass ? 'text' : 'password'} className="hosp-input" placeholder="••••••••••" value={lPass} onChange={e => setLPass(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="hosp-eye-btn" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide password' : 'Show password'}>{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </fieldset>
            {lError && <div className="hosp-alert hosp-alert--error" role="alert">{lError}</div>}
            <button id="h-login-submit" type="submit" className="hosp-submit" disabled={lLoading}>
              {lLoading ? <span className="hosp-spinner" /> : <><span>Access Dashboard</span><ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* ── REGISTER ── */}
        {tab === 'register' && (
          <form className="hosp-auth-form" onSubmit={handleRegister} noValidate>
            <div className="hosp-form-grid-2">
              <fieldset className="hosp-fieldset">
                <label htmlFor="h-reg-name" className="hosp-label">Hospital Name *</label>
                <div className="hosp-input-wrap">
                  <Building2 size={15} className="hosp-input-icon" aria-hidden="true" />
                  <input id="h-reg-name" type="text" className="hosp-input" placeholder="Metro General Hospital" value={rName} onChange={e => setRName(e.target.value)} required />
                </div>
              </fieldset>
              <fieldset className="hosp-fieldset">
                <label htmlFor="h-reg-email" className="hosp-label">Admin Email *</label>
                <div className="hosp-input-wrap">
                  <Mail size={15} className="hosp-input-icon" aria-hidden="true" />
                  <input id="h-reg-email" type="email" className="hosp-input" placeholder="admin@hospital.com" value={rEmail} onChange={e => setREmail(e.target.value)} required />
                </div>
              </fieldset>
              <fieldset className="hosp-fieldset">
                <label htmlFor="h-reg-pass" className="hosp-label">Password *</label>
                <div className="hosp-input-wrap">
                  <Lock size={15} className="hosp-input-icon" aria-hidden="true" />
                  <input id="h-reg-pass" type={showPass ? 'text' : 'password'} className="hosp-input" placeholder="••••••••••" value={rPass} onChange={e => setRPass(e.target.value)} required />
                  <button type="button" className="hosp-eye-btn" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide' : 'Show'}>{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </fieldset>
              <fieldset className="hosp-fieldset">
                <label htmlFor="h-reg-reg" className="hosp-label">Registration No.</label>
                <div className="hosp-input-wrap"><input id="h-reg-reg" type="text" className="hosp-input" placeholder="REG-12345" value={rReg} onChange={e => setRReg(e.target.value)} /></div>
              </fieldset>
              <fieldset className="hosp-fieldset">
                <label htmlFor="h-reg-phone" className="hosp-label">Phone</label>
                <div className="hosp-input-wrap"><input id="h-reg-phone" type="tel" className="hosp-input" placeholder="+1 555 000 0000" value={rPhone} onChange={e => setRPhone(e.target.value)} /></div>
              </fieldset>
              <fieldset className="hosp-fieldset">
                <label htmlFor="h-reg-city" className="hosp-label">City</label>
                <div className="hosp-input-wrap"><input id="h-reg-city" type="text" className="hosp-input" placeholder="New York" value={rCity} onChange={e => setRCity(e.target.value)} /></div>
              </fieldset>
            </div>
            {rError && <div className="hosp-alert hosp-alert--error" role="alert">{rError}</div>}
            {rSuccess && <div className="hosp-alert hosp-alert--success" role="status">{rSuccess}</div>}
            <button id="h-reg-submit" type="submit" className="hosp-submit" disabled={rLoading}>
              {rLoading ? <span className="hosp-spinner" /> : <><span>Register Hospital</span><ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        <p className="hosp-auth-footer">Protected by TLS 1.3 · HIPAA-compliant infrastructure</p>
      </div>
    </div>
  );
}
