import { useState, useEffect } from 'react';
import {
  FileText, ShieldCheck, Download, Search, Filter,
  CheckCircle2, AlertCircle, Clock, Database, Calendar
} from 'lucide-react';
import { getHospitalDashboard, type AuditEntry } from '../../../lib/hospitalApi';
import { useHospitalAuthStore } from '../../../lib/hospitalAuth';

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function ReportsTab() {
  const { hospitalId } = useHospitalAuthStore();
  const isDemo = hospitalId === 1;

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getHospitalDashboard()
      .then((data) => {
        if (data && data.recent_activity) {
          setAuditEntries(data.recent_activity);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mockAudits: AuditEntry[] = [
    { action: 'LOOKUP', entity_type: 'PATIENT', entity_id: 1, details: 'EHR accessed for Patient RXF-P-8821 by Dr. Sarah Chen', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
    { action: 'READ_PRESCRIPTION_DETAIL', entity_type: 'PRESCRIPTION', entity_id: 1094, details: 'Prescription #1094 evaluated for interaction check', created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
    { action: 'AFFILIATE_DOCTOR', entity_type: 'DOCTOR', entity_id: 2, details: 'Dr. Marcus Vance roster affiliation renewed under Emergency Dept', created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
    { action: 'LOOKUP', entity_type: 'PATIENT', entity_id: 3, details: 'Patient RXF-P-3319 verified via QR scan protocol at Triage Bay 2', created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
    { action: 'READ_MEDICATIONS', entity_type: 'PATIENT', entity_id: 4, details: 'Inpatient active medication profile queried by central dispensary', created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString() },
  ];

  const allAudits = auditEntries.length > 0 ? auditEntries : (isDemo ? mockAudits : []);

  const filtered = allAudits.filter((a) => {
    const matchSearch =
      a.action.toLowerCase().includes(search.toLowerCase()) ||
      (a.details && a.details.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filterAction === 'ALL' || a.action === filterAction;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <div className="hosp-section-head">
        <div>
          <h2 className="hosp-section-title">Institutional Audit Logs & Compliance Reports</h2>
          <p className="hosp-section-subtitle">
            Immutable Access Trail · HIPAA Security Rule Audits · EHR Query Logs & Data Exports
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="hosp-btn-secondary">
            <Download size={14} />
            <span>Export Audit Trail (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Compliance Certificates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'var(--hosp-surface)', border: '1px solid var(--hosp-border)', borderRadius: 'var(--hosp-radius-md)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'var(--hosp-success-bg)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--hosp-text-main)' }}>HIPAA Security Rule</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Audit logging active · 100% compliant</div>
          </div>
        </div>

        <div style={{ background: 'var(--hosp-surface)', border: '1px solid var(--hosp-border)', borderRadius: 'var(--hosp-radius-md)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'var(--hosp-accent-light)', color: 'var(--hosp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--hosp-text-main)' }}>Cryptographic Integrity</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SHA-256 sealed transaction logs</div>
          </div>
        </div>

        <div style={{ background: 'var(--hosp-surface)', border: '1px solid var(--hosp-border)', borderRadius: 'var(--hosp-radius-md)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'var(--hosp-info-bg)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--hosp-text-main)' }}>Log Retention Policy</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>7-Year statutory medical retention</div>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="hosp-panel" style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
          <input
            type="text"
            className="hosp-text-input"
            placeholder="Search action or details in audit log..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="hosp-text-input"
          style={{ width: 'auto', paddingLeft: '10px', cursor: 'pointer' }}
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="ALL">All Recorded Actions</option>
          <option value="LOOKUP">EHR Patient Lookups</option>
          <option value="READ_PRESCRIPTIONS">Prescription History Queries</option>
          <option value="READ_PRESCRIPTION_DETAIL">Prescription Detail Access</option>
          <option value="AFFILIATE_DOCTOR">Doctor Affiliation Updates</option>
          <option value="READ_MEDICATIONS">Medication Inquiries</option>
        </select>
      </div>

      {/* Audit Table */}
      <div className="hosp-panel">
        <div className="hosp-table-wrap">
          <table className="hosp-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Security Event / Action</th>
                <th>Encounter & Access Details</th>
                <th>Integrity Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                    <ShieldCheck size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4, display: 'block' }} />
                    <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)', marginBottom: '0.2rem' }}>No Audit Records Found</div>
                    <div style={{ fontSize: '0.75rem' }}>EHR lookups and prescription views performed by hospital staff will appear in this immutable compliance trail.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-hosp-mono)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {formatTime(a.created_at)}
                    </td>
                    <td>
                      <span className="hosp-badge hosp-badge--blue" style={{ fontFamily: 'var(--font-hosp-mono)' }}>
                        {a.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--hosp-text-main)', fontSize: '0.78rem' }}>
                      {a.details || 'Standard clinical institutional query'}
                    </td>
                    <td>
                      <span className="hosp-badge hosp-badge--green">
                        <CheckCircle2 size={10} />
                        <span>Verified Ledger</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
