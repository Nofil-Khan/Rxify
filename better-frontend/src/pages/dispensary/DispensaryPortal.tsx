import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Package, Clock, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Search, Plus, LogOut, Sun, Moon, QrCode, Filter,
  TrendingUp, Activity, Check, X, ShieldCheck, Upload, FileText, Camera
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth';
import { useNavigate } from '@tanstack/react-router';
import ShareIdModal from '../../components/common/ShareIdModal';
import QrScannerModal from '../../components/common/QrScannerModal';
import {
  fetchDispensaryProfile, fetchInventory, addOrUpdateStock, updateStockPartial,
  searchMedicineCatalog, fetchDispensaryQueue, fetchDispensaryRequestDetail,
  processDispensaryRequest, markDispensaryRequestReady, dispenseDispensaryRequest,
  cancelDispensaryRequest, fetchDispensaryDashboardStats, fetchDispensaryAlerts,
  uploadInventoryCsv,
  type DispensaryProfile, type InventoryItem, type CatalogMedicine,
  type QueueItemSummary, type RequestDetail, type DispensaryDashboardStats
} from '../../lib/dispensaryApi';

type Tab = 'queue' | 'inventory' | 'dashboard' | 'alerts';

export default function DispensaryPortal() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const [dark, setDark] = useState(() => localStorage.getItem('rxify-theme') === 'dark');
  const [profile, setProfile] = useState<DispensaryProfile | null>(null);
  const [tab, setTab] = useState<Tab>('queue');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  /* Queue state */
  const [queue, setQueue] = useState<QueueItemSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [selectedReqDetail, setSelectedReqDetail] = useState<RequestDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dispenseNotes, setDispenseNotes] = useState('');

  /* Inventory state */
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  /* Add stock modal state */
  const [catSearch, setCatSearch] = useState('');
  const [catResults, setCatResults] = useState<CatalogMedicine[]>([]);
  const [selectedMed, setSelectedMed] = useState<CatalogMedicine | null>(null);
  const [addQty, setAddQty] = useState(100);
  const [addReorder, setAddReorder] = useState(10);
  const [addUnit, setAddUnit] = useState('tablets');

  /* Edit stock modal state */
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editQty, setEditQty] = useState(0);

  /* Dashboard stats */
  const [stats, setStats] = useState<DispensaryDashboardStats | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Theme application */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('rxify-theme', dark ? 'dark' : 'light');
  }, [dark]);

  /* Initial Load */
  useEffect(() => {
    fetchDispensaryProfile()
      .then(setProfile)
      .catch(() => {
        // Not authenticated as dispensary -> redirect to login
        clearAuth();
        navigate({ to: '/login' });
      });
  }, [clearAuth, navigate]);

  /* Load Active Tab Data */
  const loadTabData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'queue') {
        const q = await fetchDispensaryQueue(statusFilter === 'ALL' ? undefined : statusFilter);
        setQueue(q);
      } else if (tab === 'inventory') {
        const inv = await fetchInventory();
        setInventory(inv);
      } else if (tab === 'dashboard') {
        const s = await fetchDispensaryDashboardStats();
        setStats(s);
      } else if (tab === 'alerts') {
        const a = await fetchDispensaryAlerts();
        setAlerts(a.alerts || []);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter]);

  useEffect(() => {
    loadTabData();
    const interval = setInterval(() => loadTabData(), 15000); // 15s polling
    return () => clearInterval(interval);
  }, [loadTabData]);

  /* Fetch detail when a queue request is selected */
  useEffect(() => {
    if (selectedReqId) {
      fetchDispensaryRequestDetail(selectedReqId)
        .then(setSelectedReqDetail)
        .catch((err) => setError(err?.message ?? 'Failed to load request detail.'));
    } else {
      setSelectedReqDetail(null);
    }
  }, [selectedReqId]);

  /* Catalog Search for Add Stock Modal */
  useEffect(() => {
    if (showAddModal) {
      searchMedicineCatalog(catSearch).then(setCatResults).catch(console.error);
    }
  }, [showAddModal, catSearch]);

  const handleLogout = () => {
    clearAuth();
    navigate({ to: '/login' });
  };

  /* Action Handlers */
  const handleProcess = async (reqId: number) => {
    setActionLoading(true);
    try {
      await processDispensaryRequest(reqId);
      const detail = await fetchDispensaryRequestDetail(reqId);
      setSelectedReqDetail(detail);
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to process request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReady = async (reqId: number) => {
    setActionLoading(true);
    try {
      await markDispensaryRequestReady(reqId);
      const detail = await fetchDispensaryRequestDetail(reqId);
      setSelectedReqDetail(detail);
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to mark ready.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispense = async (reqId: number) => {
    setActionLoading(true);
    try {
      await dispenseDispensaryRequest(reqId, dispenseNotes);
      const detail = await fetchDispensaryRequestDetail(reqId);
      setSelectedReqDetail(detail);
      setDispenseNotes('');
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to dispense.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (reqId: number) => {
    const reason = prompt('Enter cancellation reason (optional):');
    if (reason === null) return;
    setActionLoading(true);
    try {
      await cancelDispensaryRequest(reqId, reason);
      const detail = await fetchDispensaryRequestDetail(reqId);
      setSelectedReqDetail(detail);
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to cancel.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed) return alert('Please select a medicine from the catalog.');
    try {
      await addOrUpdateStock({
        medicine_id: selectedMed.medicine_id,
        available_quantity: addQty,
        reorder_level: addReorder,
        unit: addUnit,
      });
      setShowAddModal(false);
      setSelectedMed(null);
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to add stock.');
    }
  };

  const handleEditStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    try {
      await updateStockPartial(editItem.inventory_id, { available_quantity: editQty });
      setEditItem(null);
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update stock.');
    }
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadInventoryCsv(file);
      alert(res.message);
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to upload CSV.');
    } finally {
      e.target.value = '';
    }
  };

  const handleQuickAdd = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.available_quantity + delta);
    try {
      await updateStockPartial(item.inventory_id, { available_quantity: newQty });
      loadTabData();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update stock.');
    }
  };

  const filteredInventory = inventory.filter((i) => {
    if (!invSearch.trim()) return true;
    const q = invSearch.toLowerCase();
    return (
      i.generic_name.toLowerCase().includes(q) ||
      i.brand_name?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="pd-shell" data-theme={dark ? 'dark' : 'light'}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="pd-sidebar" style={{ width: '260px' }}>
        <div className="pd-logo">
          <div className="pd-logo-icon" style={{ background: '#0ea5e9' }}>
            <Building2 size={18} color="#fff" />
          </div>
          <span className="pd-logo-text">Dispensary Portal</span>
        </div>

        <nav className="pd-nav">
          <p className="pd-nav-label">Management</p>

          <button
            className={`pd-nav-item ${tab === 'queue' ? 'pd-nav-item--active' : ''}`}
            onClick={() => setTab('queue')}
          >
            <Clock size={18} />
            <span className="pd-nav-text">
              <span className="pd-nav-label-text">Live Queue</span>
              <span className="pd-nav-desc">Prescription fulfillment</span>
            </span>
          </button>

          <button
            className={`pd-nav-item ${tab === 'inventory' ? 'pd-nav-item--active' : ''}`}
            onClick={() => setTab('inventory')}
          >
            <Package size={18} />
            <span className="pd-nav-text">
              <span className="pd-nav-label-text">Medicine Stock</span>
              <span className="pd-nav-desc">Inventory & reservations</span>
            </span>
          </button>

          <button
            className={`pd-nav-item ${tab === 'dashboard' ? 'pd-nav-item--active' : ''}`}
            onClick={() => setTab('dashboard')}
          >
            <TrendingUp size={18} />
            <span className="pd-nav-text">
              <span className="pd-nav-label-text">Dashboard</span>
              <span className="pd-nav-desc">Analytics & summary</span>
            </span>
          </button>

          <button
            className={`pd-nav-item ${tab === 'alerts' ? 'pd-nav-item--active' : ''}`}
            onClick={() => setTab('alerts')}
          >
            <AlertTriangle size={18} />
            <span className="pd-nav-text">
              <span className="pd-nav-label-text">Stock Alerts</span>
              <span className="pd-nav-desc">Low stock warnings</span>
            </span>
          </button>
        </nav>

        <div className="pd-sidebar-footer">
          <div className="pd-user-row">
            <div className="pd-avatar" style={{ background: '#0ea5e9', color: '#fff' }}>
              {(profile?.name ?? 'DP').slice(0, 2).toUpperCase()}
            </div>
            <div className="pd-user-info">
              <span className="pd-user-name">{profile?.name ?? 'Main Dispensary'}</span>
              <span className="pd-user-role">{profile?.location ?? 'Dispensary'}</span>
            </div>
          </div>

          <div className="pd-footer-actions">
            <button className="pd-icon-btn" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="pd-logout-btn" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Area ────────────────────────────────────────────────────── */}
      <main className="pd-main" style={{ padding: '2rem' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {profile?.name ?? 'Dispensary Management'}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              {profile?.location ? `${profile.location} · ` : ''}
              {profile?.operating_hours ? `Hours: ${profile.operating_hours}` : ''}
            </p>
          </div>

          <div className="rx-top-action-bar">
            <button
              id="dispensary-share-id-btn"
              className="rx-id-badge-btn"
              onClick={() => setShowShareModal(true)}
              title="View and share Dispensary ID and QR Code"
            >
              <ShieldCheck size={14} />
              <span>ID: {profile?.dispensary_code || (profile?.dispensary_id ? `RXF-DISP-${profile.dispensary_id}` : 'Dispensary ID')}</span>
            </button>
            <button
              id="dispensary-scan-btn"
              className="rx-scan-action-btn"
              onClick={() => setShowScannerModal(true)}
              title="Scan Walk-In Patient or Prescription QR Code"
            >
              <Camera size={14} />
              <span>Scan Patient / Rx</span>
            </button>
            <button
              type="button"
              className="pd-btn-sm"
              onClick={() => loadTabData()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} className={loading ? 'pd-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* TAB 1: LIVE QUEUE */}
        {tab === 'queue' && (
          <div>
            {/* Walk-in Fast Action Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#38bdf8' }}>Walk-in Patient Verification</strong>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.15rem 0 0 0' }}>
                  Ask the patient to show their Rxify Patient QR code or Prescription code to pull up their orders instantly.
                </p>
              </div>
              <button
                className="rx-scan-action-btn"
                onClick={() => setShowScannerModal(true)}
                style={{ padding: '0.45rem 1.1rem' }}
              >
                <Camera size={15} />
                <span>Scan Walk-In QR</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              {['ALL', 'PENDING', 'PROCESSING', 'READY', 'DISPENSED', 'UNAVAILABLE', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '2rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: statusFilter === st ? '#0ea5e9' : 'var(--surface-color)',
                    color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Queue List & Drawer Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedReqId ? '1fr 1.2fr' : '1fr', gap: '1.5rem' }}>
              {/* Queue Items */}
              <div>
                {queue.length === 0 && !loading && (
                  <div className="pd-empty" style={{ padding: '3rem 1rem' }}>
                    <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                    <p>Queue is empty! All requests processed.</p>
                  </div>
                )}

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {queue.map((q) => (
                    <div
                      key={q.request_id}
                      onClick={() => setSelectedReqId(q.request_id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        background: selectedReqId === q.request_id ? 'var(--surface-hover)' : 'var(--surface-color)',
                        border: selectedReqId === q.request_id ? '2px solid #0ea5e9' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0ea5e9' }}>
                          REQ #{q.request_id} · Rx #{q.prescription_id}
                        </span>
                        <span className={`pd-badge ${
                          q.status === 'READY' ? 'pd-badge--emerald' :
                          q.status === 'PROCESSING' ? 'pd-badge--sky' :
                          q.status === 'PENDING' ? 'pd-badge--amber' : 'pd-badge--slate'
                        }`}>
                          {q.status}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.2rem 0' }}>
                        {q.patient_name}
                      </h4>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>Patient Code: <strong>{q.patient_code ?? `PT-${q.patient_id}`}</strong></span>
                        <span>{q.total_items} prescribed item(s)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Detail Drawer */}
              {selectedReqId && selectedReqDetail && (
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '1rem',
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  position: 'sticky',
                  top: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                      Request #{selectedReqDetail.request_id} Overview
                    </h3>
                    <button
                      onClick={() => setSelectedReqId(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Patient Identity Banner */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(14, 165, 233, 0.08)',
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <ShieldCheck size={24} style={{ color: '#0ea5e9' }} />
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {selectedReqDetail.patient_name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        ID Code: <strong>{selectedReqDetail.patient_code ?? `PT-${selectedReqDetail.patient_id}`}</strong> · Phone: {selectedReqDetail.patient_phone ?? '—'}
                      </div>
                    </div>
                  </div>

                  {/* Doctor & Diagnosis info */}
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    <div>Prescribing Doctor: <strong>{selectedReqDetail.doctor_name ? `Dr. ${selectedReqDetail.doctor_name}` : 'Hospital Doctor'}</strong></div>
                    <div>Diagnosis: <strong>{selectedReqDetail.diagnosis ?? 'General Prescription'}</strong></div>
                  </div>

                  {/* Itemized List */}
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Prescribed Medicines</h4>
                  <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {selectedReqDetail.items?.map((item) => (
                      <div
                        key={item.item_id}
                        style={{
                          padding: '0.6rem 0.8rem',
                          borderRadius: '0.5rem',
                          background: 'var(--surface-hover)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.prescribed_medicine_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {item.dosage ?? 'As prescribed'} · Qty: {item.required_quantity}
                          </div>
                        </div>

                        <span className={`pd-badge ${
                          item.availability_status === 'AVAILABLE' || item.availability_status === 'DISPENSED'
                            ? 'pd-badge--emerald'
                            : item.availability_status === 'PARTIAL' ? 'pd-badge--amber' : 'pd-badge--rose'
                        }`}>
                          {item.availability_status}
                          {item.reserved ? ' (Reserved)' : ''}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Status Action Buttons */}
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {selectedReqDetail.status === 'PENDING' && (
                      <button
                        className="auth-submit"
                        onClick={() => handleProcess(selectedReqDetail.request_id)}
                        disabled={actionLoading}
                        style={{ background: '#0ea5e9' }}
                      >
                        Process & Reserve Stock
                      </button>
                    )}

                    {selectedReqDetail.status === 'PROCESSING' && (
                      <button
                        className="auth-submit"
                        onClick={() => handleMarkReady(selectedReqDetail.request_id)}
                        disabled={actionLoading}
                        style={{ background: '#10b981' }}
                      >
                        Mark Ready for Collection
                      </button>
                    )}

                    {(selectedReqDetail.status === 'PROCESSING' || selectedReqDetail.status === 'READY') && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <textarea
                          placeholder="Pharmacist dispensing notes (optional)..."
                          value={dispenseNotes}
                          onChange={(e) => setDispenseNotes(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface-hover)',
                            fontSize: '0.8rem',
                            marginBottom: '0.5rem'
                          }}
                        />
                        <button
                          className="auth-submit"
                          onClick={() => handleDispense(selectedReqDetail.request_id)}
                          disabled={actionLoading}
                          style={{ background: '#10b981' }}
                        >
                          Confirm & Dispense Stock
                        </button>
                      </div>
                    )}

                    {selectedReqDetail.status !== 'DISPENSED' && selectedReqDetail.status !== 'CANCELLED' && (
                      <button
                        className="pd-btn-sm"
                        onClick={() => handleCancel(selectedReqDetail.request_id)}
                        disabled={actionLoading}
                        style={{ color: '#ef4444', border: '1px solid #ef4444', width: '100%', marginTop: '0.25rem' }}
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY */}
        {tab === 'inventory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="pd-search-wrap" style={{ flex: 1, maxWidth: '380px' }}>
                <Search size={16} className="pd-search-icon" />
                <input
                  type="search"
                  className="pd-search-input"
                  placeholder="Search medicine stock by name or category..."
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <label
                  className="pd-btn-sm"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1rem',
                    background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  <Upload size={15} style={{ color: '#0ea5e9' }} />
                  <span>Import Inventory CSV</span>
                  <input type="file" accept=".csv" onChange={handleCsvFileChange} style={{ display: 'none' }} />
                </label>

                <button
                  className="auth-submit"
                  onClick={() => setShowAddModal(true)}
                  style={{ width: 'auto', padding: '0.5rem 1.25rem', background: '#0ea5e9' }}
                >
                  <Plus size={16} />
                  <span>Add Medicine Stock</span>
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <div style={{ borderRadius: '0.75rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Medicine</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Form / Category</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Total Physical Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Reserved Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Free Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Actions & Quick Stock Add</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr key={item.inventory_id} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        {item.generic_name}
                        {item.brand_name && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>({item.brand_name})</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {item.form} · {item.category ?? 'General'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{item.available_quantity} {item.unit}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#f59e0b' }}>{item.reserved_quantity}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: item.free_stock > 0 ? '#10b981' : '#ef4444' }}>
                        {item.free_stock}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`pd-badge ${
                          item.stock_status === 'NORMAL' ? 'pd-badge--emerald' :
                          item.stock_status === 'LOW_STOCK' ? 'pd-badge--amber' : 'pd-badge--rose'
                        }`}>
                          {item.stock_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button
                            className="pd-btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => handleQuickAdd(item, 10)}
                            title="Add 10 units"
                          >
                            +10
                          </button>
                          <button
                            className="pd-btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => handleQuickAdd(item, 50)}
                            title="Add 50 units"
                          >
                            +50
                          </button>
                          <button
                            className="pd-btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => handleQuickAdd(item, 100)}
                            title="Add 100 units"
                          >
                            +100
                          </button>
                          <button
                            className="pd-btn-sm"
                            style={{ background: 'var(--surface-color)' }}
                            onClick={() => { setEditItem(item); setEditQty(item.available_quantity); }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DASHBOARD */}
        {tab === 'dashboard' && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Pending Requests', value: stats.pending, color: '#f59e0b' },
              { label: 'Being Processed', value: stats.processing, color: '#0ea5e9' },
              { label: 'Ready for Pickup', value: stats.ready, color: '#10b981' },
              { label: 'Dispensed', value: stats.dispensed, color: '#64748b' },
              { label: 'Out of Stock Alert', value: stats.out_of_stock, color: '#ef4444' },
              { label: 'Low Stock Alert', value: stats.low_stock, color: '#f97316' },
            ].map((st) => (
              <div key={st.label} style={{ padding: '1.25rem', borderRadius: '0.75rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{st.label}</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: st.color, marginTop: '0.2rem' }}>{st.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: ALERTS */}
        {tab === 'alerts' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Low Stock & Out of Stock Warnings</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {alerts.map((a: any) => (
                <div key={a.inventory_id} style={{ padding: '1rem', borderRadius: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700, color: '#ef4444' }}>{a.generic_name} {a.brand_name ? `(${a.brand_name})` : ''}</h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Free Stock: <strong>{a.free_stock} {a.unit}</strong> · Reorder Threshold: {a.reorder_level}
                    </p>
                  </div>
                  <button
                    className="auth-submit"
                    style={{ width: 'auto', background: '#10b981', padding: '0.4rem 1rem' }}
                    onClick={() => { setEditItem(a); setEditQty(a.available_quantity + 100); }}
                  >
                    Replenish Stock (+100)
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ADD STOCK MODAL */}
      {showAddModal && (
        <div className="pd-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: '1.5rem', borderRadius: '1rem', background: 'var(--surface-color)', width: '90%', maxWidth: '500px' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Add Medicine to Dispensary Stock</h3>
            <form onSubmit={handleAddStockSubmit}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Search Central Medicine Catalog</label>
              <input
                type="search"
                className="pd-search-input"
                placeholder="Type medicine name..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                style={{ width: '100%', margin: '0.4rem 0 1rem 0' }}
              />

              {/* Search Results */}
              <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
                {catResults.map((m) => (
                  <div
                    key={m.medicine_id}
                    onClick={() => setSelectedMed(m)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      background: selectedMed?.medicine_id === m.medicine_id ? '#0ea5e9' : 'transparent',
                      color: selectedMed?.medicine_id === m.medicine_id ? '#fff' : 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  >
                    {m.generic_name} {m.brand_name ? `(${m.brand_name})` : ''} · {m.strength ?? ''}
                  </div>
                ))}
              </div>

              {selectedMed && (
                <div style={{ fontSize: '0.85rem', color: '#10b981', marginBottom: '1rem' }}>
                  Selected: <strong>{selectedMed.generic_name}</strong>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Initial Quantity</label>
                  <input
                    type="number"
                    className="auth-input"
                    value={addQty}
                    onChange={(e) => setAddQty(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reorder Threshold</label>
                  <input
                    type="number"
                    className="auth-input"
                    value={addReorder}
                    onChange={(e) => setAddReorder(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="pd-btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="auth-submit" style={{ width: 'auto', background: '#0ea5e9' }}>Save Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STOCK MODAL */}
      {editItem && (
        <div className="pd-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: '1.5rem', borderRadius: '1rem', background: 'var(--surface-color)', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Update Physical Stock</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{editItem.generic_name}</p>

            <form onSubmit={handleEditStockSubmit}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Physical Quantity</label>
              <input
                type="number"
                className="auth-input"
                value={editQty}
                onChange={(e) => setEditQty(Number(e.target.value))}
                min={0}
                required
                style={{ margin: '0.4rem 0 1rem 0' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="pd-btn-sm" onClick={() => setEditItem(null)}>Cancel</button>
                <button type="submit" className="auth-submit" style={{ width: 'auto', background: '#0ea5e9' }}>Update Quantity</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Dispensary ID & QR Modal */}
      <ShareIdModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        role="dispensary"
        code={profile?.dispensary_code || (profile?.dispensary_id ? `RXF-DISP-${profile.dispensary_id}` : 'RXF-DISP-1')}
        name={profile?.name || 'Dispensary Pharmacy'}
        subtitle="Patients and doctors can scan this code to route prescriptions and check medication inventory."
        details={[
          { label: 'Dispensary Code', value: profile?.dispensary_code || `RXF-DISP-${profile?.dispensary_id || 1}` },
          { label: 'Location', value: profile?.location || 'Main Hospital Wing' },
          { label: 'Operating Hours', value: profile?.operating_hours || 'Daily' },
          { label: 'Network', value: 'Rxify Verified Pharmacy Unit' },
        ]}
      />

      {/* Universal QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        role="dispensary"
        onSuccessAction={(actionType, payload) => {
          if (actionType === 'dispensary_open_requests' && payload?.requests?.[0]) {
            const req = payload.requests[0];
            setSelectedReqId(req.request_id);
            fetchDispensaryRequestDetail(req.request_id).then(setSelectedReqDetail).catch(() => {});
            setTab('queue');
          }
        }}
      />
    </div>
  );
}
