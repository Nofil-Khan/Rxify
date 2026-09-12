import React, { useEffect, useState } from 'react';
import {
  Package, MapPin, Clock, RefreshCw, AlertCircle, ShoppingBag,
  ExternalLink, CheckCircle2, Building2, Plus
} from 'lucide-react';
import {
  fetchHospitalDispensaries,
  type HospitalDispensary
} from '../../../lib/hospitalApi';

interface DispensaryTabProps {
  onScanClick?: () => void;
}

export default function DispensaryTab({ onScanClick }: DispensaryTabProps) {
  const [dispensaries, setDispensaries] = useState<HospitalDispensary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDispensaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHospitalDispensaries();
      setDispensaries(res.dispensaries || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load affiliated dispensaries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDispensaries();
  }, []);

  return (
    <div className="hd-dispensary-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Affiliated Dispensaries & Pharmacies</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
            Hospital dispensary units managing medication stock, prescriptions, and walk-in collections.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <a
            href="/dispensary/register"
            target="_blank"
            rel="noopener noreferrer"
            className="rx-btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
          >
            <Plus size={14} />
            <span>Register New Dispensary</span>
          </a>

          <button
            className="rx-btn-secondary"
            onClick={loadDispensaries}
            style={{ borderRadius: '9999px', padding: '0.45rem 0.9rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading & Error */}
      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
          <p>Connecting to dispensary network...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#f87171', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && dispensaries.length === 0 && (
        <div style={{ padding: '4rem 1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Package size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
          <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 600 }}>No Dispensaries Registered Yet</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Dispensaries register under this hospital via the Dispensary Organization Portal.
          </p>
          <a
            href="/dispensary/register"
            className="rx-btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>Open Dispensary Registration</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {/* Dispensary Cards */}
      {!loading && dispensaries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {dispensaries.map((disp) => (
            <div
              key={disp.dispensary_id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{disp.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                        {disp.status.toUpperCase()} UNIT
                      </span>
                    </div>
                  </div>
                  <span className="rx-role-pill" style={{ margin: 0, fontSize: '0.65rem' }}>
                    {disp.dispensary_code || `RXF-DISP-${disp.dispensary_id}`}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: '0.85rem 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} className="text-amber-400" />
                    <span>{disp.location || 'Hospital Pharmacy Wing'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={14} className="text-cyan-400" />
                    <span>{disp.operating_hours || '08:00 - 20:00 Daily'} (Avg Prep: {disp.avg_prep_minutes}m)</span>
                  </div>
                  <div><strong>Email:</strong> {disp.email}</div>
                  {disp.phone && <div><strong>Phone:</strong> {disp.phone}</div>}
                </div>

                {/* Metrics Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.6rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Inventory Items</span>
                    <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{disp.total_inventory_items || 0}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.6rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Active Orders</span>
                    <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>{disp.active_queue_count || 0}</strong>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href="/dispensary/login"
                  style={{
                    color: '#38bdf8',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span>Go to Dispensary Portal</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
