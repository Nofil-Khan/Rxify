import { useState } from 'react';
import {
  DollarSign, FileText, CheckCircle2, Clock, AlertTriangle,
  Search, Filter, Plus, Download, CreditCard, ShieldCheck
} from 'lucide-react';

interface Bill {
  id: string;
  patient: string;
  mrn: string;
  service: string;
  date: string;
  total: number;
  insuranceCovered: number;
  patientDue: number;
  insurer: string;
  status: 'PAID' | 'INSURANCE_PENDING' | 'CLAIM_APPROVED' | 'OVERDUE';
}

const BILLS_DATA: Bill[] = [
  { id: 'INV-88910', patient: 'Eleanor Vance', mrn: 'RXF-P-8821', service: 'Coronary Artery Bypass + ICU Stay (3d)', date: 'Sep 10, 2026', total: 24500, insuranceCovered: 22000, patientDue: 2500, insurer: 'BlueCross Highmark', status: 'INSURANCE_PENDING' },
  { id: 'INV-88911', patient: 'Liam O’Connor', mrn: 'RXF-P-3319', service: 'ER Closed Reduction + Splinting', date: 'Sep 12, 2026', total: 1850, insuranceCovered: 1600, patientDue: 250, insurer: 'Aetna Health Advantage', status: 'PAID' },
  { id: 'INV-88912', patient: 'Sofia Reyes', mrn: 'RXF-P-9022', service: 'Inpatient General Care + IV Therapy', date: 'Sep 11, 2026', total: 4200, insuranceCovered: 3800, patientDue: 400, insurer: 'UnitedHealthcare', status: 'CLAIM_APPROVED' },
  { id: 'INV-88913', patient: 'Arthur Pendelton', mrn: 'RXF-P-4451', service: 'Pediatric Observation + Nebulizer', date: 'Sep 11, 2026', total: 950, insuranceCovered: 850, patientDue: 100, insurer: 'Cigna Global Health', status: 'PAID' },
  { id: 'INV-88914', patient: 'Martha Jenkins', mrn: 'RXF-P-6120', service: 'Cardiac Telemetry Unit (48h)', date: 'Sep 09, 2026', total: 6800, insuranceCovered: 6000, patientDue: 800, insurer: 'Medicare Part A', status: 'CLAIM_APPROVED' },
  { id: 'INV-88915', patient: 'Devin Brooks', mrn: 'RXF-P-1104', service: 'Neurology MRI + Neuro-consultation', date: 'Sep 11, 2026', total: 3100, insuranceCovered: 2400, patientDue: 700, insurer: 'Humana PPO', status: 'INSURANCE_PENDING' },
];

export default function BillingTab() {
  const [bills] = useState<Bill[]>(BILLS_DATA);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = bills.filter((b) => {
    const matchSearch =
      b.patient.toLowerCase().includes(search.toLowerCase()) ||
      b.mrn.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.insurer.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="hosp-section-head">
        <div>
          <h2 className="hosp-section-title">Hospital Billing, Claims & Revenue Cycle</h2>
          <p className="hosp-section-subtitle">
            Inpatient Invoicing, Commercial Insurance Pre-Auth & Copay Adjudication
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="hosp-btn-secondary">
            <Download size={14} />
            <span>Export Statement (CSV)</span>
          </button>
          <button className="hosp-btn-primary">
            <Plus size={14} />
            <span>Create Patient Invoice</span>
          </button>
        </div>
      </div>

      {/* Revenue KPI Bar */}
      <div className="hosp-kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Total Revenue This Month</span>
          <div className="hosp-stat-number">$348,920</div>
          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>+6.4% vs last billing cycle</span>
        </div>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Pending Insurance Adjudication</span>
          <div className="hosp-stat-number" style={{ color: '#d97706' }}>$48,290</div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>14 commercial claims in queue</span>
        </div>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Patient Copay & Coinsurance Due</span>
          <div className="hosp-stat-number" style={{ color: '#0284c7' }}>$8,450</div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Average collection rate 94.2%</span>
        </div>
        <div className="hosp-stat-card">
          <span className="hosp-stat-label">Clean Claim Pass Rate</span>
          <div className="hosp-stat-number" style={{ color: '#059669' }}>97.8%</div>
          <span style={{ fontSize: '0.72rem', color: '#059669' }}>Electronic 837 claim batching</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="hosp-panel" style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
          <input
            type="text"
            className="hosp-text-input"
            placeholder="Search invoice #, patient, MRN or insurer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="hosp-text-input"
          style={{ width: 'auto', paddingLeft: '10px', cursor: 'pointer' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Claim Statuses</option>
          <option value="PAID">Paid in Full</option>
          <option value="CLAIM_APPROVED">Claim Approved</option>
          <option value="INSURANCE_PENDING">Insurance Adjudicating</option>
          <option value="OVERDUE">Overdue Balance</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="hosp-panel">
        <div className="hosp-table-wrap">
          <table className="hosp-table">
            <thead>
              <tr>
                <th>Invoice # & Date</th>
                <th>Patient Name & MRN</th>
                <th>Service & Clinical Encounter</th>
                <th>Insurance Carrier</th>
                <th>Total Charges</th>
                <th>Coverage / Patient Due</th>
                <th>Claim Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontFamily: 'var(--font-hosp-mono)', fontWeight: 600, color: 'var(--hosp-text-main)' }}>
                      {b.id}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{b.date}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--hosp-text-main)' }}>{b.patient}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-hosp-mono)' }}>{b.mrn}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.78rem', color: 'var(--hosp-text-secondary)', maxWidth: '240px' }}>
                      {b.service}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{b.insurer}</span>
                  </td>
                  <td>
                    <strong style={{ fontFamily: 'var(--font-hosp-mono)', color: 'var(--hosp-text-main)' }}>
                      ${b.total.toLocaleString()}
                    </strong>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.75rem', color: '#059669' }}>Ins: ${b.insuranceCovered.toLocaleString()}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Due: ${b.patientDue.toLocaleString()}</div>
                  </td>
                  <td>
                    {b.status === 'PAID' && (
                      <span className="hosp-badge hosp-badge--green">Paid in Full</span>
                    )}
                    {b.status === 'CLAIM_APPROVED' && (
                      <span className="hosp-badge hosp-badge--blue">Claim Approved</span>
                    )}
                    {b.status === 'INSURANCE_PENDING' && (
                      <span className="hosp-badge hosp-badge--amber">Pending Review</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="hosp-btn-secondary" style={{ fontSize: '0.72rem' }}>
                      View Claim
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
