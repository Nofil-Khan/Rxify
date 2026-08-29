import { useState, useEffect } from 'react';
import { getHospitalDashboard } from '../../../lib/hospitalApi';
import type { DashboardData, AuditEntry } from '../../../lib/hospitalApi';
import { Users, Eye, Calendar, Activity } from 'lucide-react';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    LOOKUP: 'Patient Lookup',
    READ_PRESCRIPTIONS: 'Viewed Prescriptions',
    READ_PRESCRIPTION_DETAIL: 'Viewed Rx Detail',
    READ_MEDICATIONS: 'Viewed Medications',
    DATABASE_SEED: 'System Seed',
    GENERAL: 'General Action',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

function actionDot(action: string) {
  if (action === 'LOOKUP') return 'hosp-dot--blue';
  if (action.startsWith('READ_PRESC')) return 'hosp-dot--amber';
  if (action.startsWith('READ_MED')) return 'hosp-dot--green';
  return 'hosp-dot--gray';
}

export default function HospOverviewTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getHospitalDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="hosp-loading"><span className="hosp-spinner hosp-spinner--lg" />Loading dashboard…</div>;
  if (error) return <div className="hosp-error-banner" role="alert">{error}</div>;

  const stats = [
    { label: 'Total Accesses', value: data!.total_accesses, icon: <Eye size={18} />, cls: 'hosp-kpi--blue' },
    { label: 'Unique Patients', value: data!.unique_patients_accessed, icon: <Users size={18} />, cls: 'hosp-kpi--green' },
    { label: 'Accesses Today', value: data!.accesses_today, icon: <Calendar size={18} />, cls: 'hosp-kpi--amber' },
  ];

  return (
    <section className="hosp-tab-section">
      <header className="hosp-tab-header">
        <Activity size={16} aria-hidden="true" />
        <h2 className="hosp-tab-title">Hospital Overview</h2>
        <time className="hosp-tab-timestamp">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</time>
      </header>

      {/* KPI Row */}
      <div className="hosp-kpi-row">
        {stats.map(s => (
          <div key={s.label} className={`hosp-kpi-card ${s.cls}`}>
            <div className="hosp-kpi-icon" aria-hidden="true">{s.icon}</div>
            <div className="hosp-kpi-body">
              <span className="hosp-kpi-value">{s.value.toLocaleString()}</span>
              <span className="hosp-kpi-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Audit Feed */}
      <div className="hosp-feed-card">
        <h3 className="hosp-feed-heading">Recent Activity Log</h3>
        {data!.recent_activity.length === 0 ? (
          <p className="hosp-empty">No activity recorded yet.</p>
        ) : (
          <ol className="hosp-feed-list" aria-label="Audit activity">
            {data!.recent_activity.map((entry: AuditEntry, i: number) => (
              <li key={i} className="hosp-feed-item">
                <span className={`hosp-dot ${actionDot(entry.action)}`} aria-hidden="true" />
                <div className="hosp-feed-body">
                  <span className="hosp-feed-action">{actionLabel(entry.action)}</span>
                  {entry.details && <span className="hosp-feed-detail">{entry.details}</span>}
                </div>
                <time className="hosp-feed-time" dateTime={entry.created_at}>{formatTime(entry.created_at)}</time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
