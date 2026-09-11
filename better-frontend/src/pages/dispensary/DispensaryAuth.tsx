import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Building2, Lock, Mail, ArrowRight, Activity, ShieldCheck } from 'lucide-react';
import { loginDispensary } from '../../lib/dispensaryApi';
import { useAuthStore } from '../../lib/auth';
import { PortalSwitcher } from '../../components/common/PortalSwitcher';

export default function DispensaryAuth() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError('');
    setLoading(true);
    try {
      const res = await loginDispensary(email.trim(), password);
      setAuth(res.access_token, 'dispensary', res.name, {
        dispensaryId: res.dispensary_id,
        displayName: res.name,
      });
      navigate({ to: '/dispensary' });
    } catch (err: any) {
      setError(err?.message ?? 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <a href="/" className="auth-logo">
        <div className="auth-logo-icon" style={{ background: '#0ea5e9' }}>
          <Activity size={20} />
        </div>
        <span>Rxify Dispensary</span>
      </a>

      {/* Cross-Portal Switcher */}
      <PortalSwitcher current="dispensary" />

      <div className="auth-card" style={{ maxWidth: '440px' }}>
        <div className="auth-card-header">
          <div className="auth-card-icon" style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
            <Building2 size={28} />
          </div>
          <h1 className="auth-card-title">Dispensary Portal</h1>
          <p className="auth-card-subtitle">
            Sign in to manage medicine stock & fulfill prescription orders
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="disp-email" className="auth-label">Dispensary Email</label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                id="disp-email"
                type="email"
                className="auth-input"
                placeholder="dispensary@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                type="password"
                className="auth-input"
                placeholder="Enter dispensary password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
            style={{ background: '#0ea5e9' }}
          >
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              <>
                <span>Sign In to Dispensary</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', padding: '0.85rem', borderRadius: '0.5rem', background: 'var(--surface-hover)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} style={{ color: '#0ea5e9', flexShrink: 0 }} />
          <span>Demo login: <strong>dispensary@citygeneral.com</strong> / <strong>password123</strong></span>
        </div>
      </div>
    </div>
  );
}
