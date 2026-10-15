import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Building2, Package, LayoutDashboard, Clock,
  RefreshCw, Search, Plus, LogOut, Sun, Moon,
  QrCode, AlertTriangle, Upload, Camera, ShieldCheck,
  XCircle, MapPin,
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth';
import { useNavigate } from '@tanstack/react-router';
import ShareIdModal from '../../components/common/ShareIdModal';
import QrScannerModal from '../../components/common/QrScannerModal';
import {
  fetchDispensaryProfile, fetchInventory, fetchDispensaryQueue,
  fetchDispensaryRequestDetail,
  processDispensaryRequest, markDispensaryRequestReady,
  dispenseDispensaryRequest, cancelDispensaryRequest,
  fetchDispensaryDashboardStats, fetchDispensaryAlerts,
  uploadInventoryCsv, updateStockPartial,
  type DispensaryProfile, type InventoryItem,
  type QueueItemSummary, type RequestDetail, type DispensaryDashboardStats,
} from '../../lib/dispensaryApi';
import { RequestStatusBadge, StockStatusBadge } from './components/StatusBadge';
import RequestDetailPanel from './components/RequestDetailPanel';
import { AddStockModal, EditStockModal } from './components/StockModals';
import { useToast, ToastStack } from './components/useToast';
import ProfileTab from './components/ProfileTab';

type Tab = 'queue' | 'inventory' | 'dashboard' | 'profile';

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function fmtRelTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Queue Tab ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['ALL', 'PENDING', 'PROCESSING', 'READY', 'PARTIALLY_AVAILABLE', 'DISPENSED', 'UNAVAILABLE', 'CANCELLED'];

interface QueueTabProps {
  queue: QueueItemSummary[];
  loading: boolean;
  error: string;
  statusFilter: string;
  onFilterChange: (s: string) => void;
  selectedReqId: number | null;
  selectedReqDetail: RequestDetail | null;
  detailLoading: boolean;
  onSelectReq: (id: number) => void;
  onCloseDetail: () => void;
  onProcess: (id: number) => void;
  onMarkReady: (id: number) => void;
  onDispense: (id: number, notes: string) => void;
  onCancel: (id: number) => void;
  actionLoading: boolean;
  onScanOpen: () => void;
  toast: (msg: string, v?: any) => void;
}

function QueueTab({
  queue, loading, error, statusFilter, onFilterChange,
  selectedReqId, selectedReqDetail, detailLoading,
  onSelectReq, onCloseDetail,
  onProcess, onMarkReady, onDispense, onCancel,
  actionLoading, onScanOpen, toast,
}: QueueTabProps) {
  return (
    <div className="disp-section">
      {/* Walk-in scan bar */}
      <div className="disp-scan-bar">
        <div>
          <div className="disp-scan-bar-text">Walk-in patient verification</div>
          <div className="disp-scan-bar-sub">Scan patient QR or prescription code to retrieve their orders instantly.</div>
        </div>
        <button className="disp-btn disp-btn--primary" onClick={onScanOpen}>
          <Camera size={14} /> Scan QR
        </button>
      </div>

      {/* Filter pills */}
      <div className="disp-filter-bar">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`disp-filter-pill ${statusFilter === s ? 'disp-filter-pill--active' : ''}`}
            onClick={() => onFilterChange(s)}
          >
            {s === 'ALL' ? 'All' : s === 'PARTIALLY_AVAILABLE' ? 'Partial' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="disp-error-bar"><XCircle size={14} />{error}</div>
      )}

      {/* Queue grid — table left, detail right */}
      <div className={`disp-queue-wrap ${selectedReqId ? 'disp-queue-wrap--with-detail' : ''}`}>
        {/* Table */}
        <div>
          {loading && !queue.length ? (
            <div className="disp-table-wrap">
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: 52, borderBottom: '1px solid var(--disp-border)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 0.85rem' }}>
                  <div className="disp-skeleton" style={{ width: 80, height: 14 }} />
                  <div className="disp-skeleton" style={{ width: 120, height: 14 }} />
                  <div className="disp-skeleton" style={{ width: 60, height: 14, marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="disp-table-wrap">
              <div className="disp-empty">
                <Clock size={36} className="disp-empty-icon" />
                <div className="disp-empty-title">Queue is clear</div>
                <div className="disp-empty-sub">
                  {statusFilter === 'ALL' ? 'No active requests at this time.' : `No ${statusFilter.toLowerCase()} requests.`}
                </div>
              </div>
            </div>
          ) : (
            <div className="disp-table-wrap">
              <table className="disp-table">
                <thead>
                  <tr>
                    <th>Request / Rx</th>
                    <th>Patient</th>
                    <th>Items</th>
                    <th>Received</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((q) => (
                    <tr
                      key={q.request_id}
                      className={selectedReqId === q.request_id ? 'disp-table-row--selected' : ''}
                      onClick={() => onSelectReq(q.request_id)}
                    >
                      <td>
                        <div className="disp-cell-primary">Req #{q.request_id}</div>
                        <div className="disp-cell-mono">Rx #{q.prescription_id}</div>
                      </td>
                      <td>
                        <div className="disp-cell-primary">{q.patient_name}</div>
                        <div className="disp-cell-secondary">{q.patient_code ?? `PT-${q.patient_id}`}</div>
                      </td>
                      <td style={{ color: 'var(--disp-text-sub)' }}>{q.total_items}</td>
                      <td style={{ color: 'var(--disp-text-muted)', fontSize: '0.8rem' }}>{fmtRelTime(q.created_at)}</td>
                      <td><RequestStatusBadge status={q.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedReqId && (
          <div>
            {!selectedReqDetail ? (
              <div className="disp-detail">
                <div className="disp-detail-header">
                  <div className="disp-skeleton" style={{ width: 140, height: 16 }} />
                </div>
                <div className="disp-detail-body">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="disp-skeleton" style={{ height: 36 }} />
                  ))}
                </div>
              </div>
            ) : (
              <RequestDetailPanel
                detail={selectedReqDetail}
                loading={actionLoading || (detailLoading && (!selectedReqDetail.items || selectedReqDetail.items.length === 0))}
                onClose={onCloseDetail}
                onProcess={() => onProcess(selectedReqDetail.request_id)}
                onMarkReady={() => onMarkReady(selectedReqDetail.request_id)}
                onDispense={(notes) => onDispense(selectedReqDetail.request_id, notes)}
                onCancel={() => onCancel(selectedReqDetail.request_id)}
                toast={toast}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

const INV_STOCK_FILTERS = ['ALL', 'NORMAL', 'LOW_STOCK', 'OUT_OF_STOCK'] as const;
type InvStockFilter = typeof INV_STOCK_FILTERS[number];

interface InventoryTabProps {
  inventory: InventoryItem[];
  loading: boolean;
  error: string;
  onReload: () => void;
  toast: (msg: string, v?: any) => void;
}

function InventoryTab({ inventory, loading, error, onReload, toast }: InventoryTabProps) {
  const [search, setSearch]         = useState('');
  const [stockFilter, setStockFilter] = useState<InvStockFilter>('ALL');
  const [showAdd, setShowAdd]       = useState(false);
  const [editItem, setEditItem]     = useState<InventoryItem | null>(null);

  const filtered = inventory.filter((i) => {
    const matchSearch = !search.trim() ||
      i.generic_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.brand_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.category ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = stockFilter === 'ALL' || i.stock_status === stockFilter;
    return matchSearch && matchFilter;
  });

  const quickAdd = async (item: InventoryItem, delta: number) => {
    try {
      await updateStockPartial(item.inventory_id, { available_quantity: Math.max(0, item.available_quantity + delta) });
      toast(`+${delta} added to ${item.generic_name}`, 'ok');
      onReload();
    } catch (err: any) {
      toast(err?.message ?? 'Update failed.', 'err');
    }
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadInventoryCsv(file);
      toast(res.message, 'ok');
      onReload();
    } catch (err: any) {
      toast(err?.message ?? 'CSV import failed.', 'err');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="disp-section">
      {error && <div className="disp-error-bar"><XCircle size={14} />{error}</div>}

      {/* Toolbar */}
      <div className="disp-toolbar">
        <div className="disp-search-wrap">
          <Search size={14} className="disp-search-icon" />
          <input
            type="search"
            className="disp-search-input"
            placeholder="Search medicines…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="disp-filter-bar">
          {INV_STOCK_FILTERS.map((f) => (
            <button
              key={f}
              className={`disp-filter-pill ${stockFilter === f ? 'disp-filter-pill--active' : ''}`}
              onClick={() => setStockFilter(f)}
            >
              {f === 'ALL' ? 'All' : f === 'NORMAL' ? 'In Stock' : f === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label className="disp-btn disp-btn--ghost" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Import CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsv} />
          </label>
          <button className="disp-btn disp-btn--primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Medicine
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && !inventory.length ? (
        <div className="disp-table-wrap">
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 48, borderBottom: '1px solid var(--disp-border)', padding: '0 0.85rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="disp-skeleton" style={{ width: 180, height: 13 }} />
              <div className="disp-skeleton" style={{ width: 80, height: 13, marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="disp-table-wrap">
          <div className="disp-empty">
            <Package size={36} className="disp-empty-icon" />
            <div className="disp-empty-title">{inventory.length === 0 ? 'No stock yet' : 'No matches'}</div>
            <div className="disp-empty-sub">
              {inventory.length === 0
                ? 'Add medicines from the catalog to start tracking inventory.'
                : 'Adjust your search or filter.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="disp-table-wrap">
          <table className="disp-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Form / Category</th>
                <th style={{ textAlign: 'right' }}>Physical</th>
                <th style={{ textAlign: 'right' }}>Reserved</th>
                <th style={{ textAlign: 'right' }}>Free</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.inventory_id}>
                  <td>
                    <div className="disp-cell-primary">{item.generic_name}</div>
                    {item.brand_name && <div className="disp-cell-secondary">{item.brand_name}</div>}
                    {item.strength && <div className="disp-cell-secondary">{item.strength}</div>}
                  </td>
                  <td style={{ color: 'var(--disp-text-sub)', fontSize: '0.82rem' }}>
                    {item.form}{item.category ? ` · ${item.category}` : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {item.available_quantity}
                    {item.unit && <span style={{ fontSize: '0.75rem', color: 'var(--disp-text-muted)', marginLeft: 4 }}>{item.unit}</span>}
                  </td>
                  <td style={{ textAlign: 'right', color: item.reserved_quantity > 0 ? 'var(--disp-warn-text)' : 'var(--disp-text-muted)' }}>
                    {item.reserved_quantity}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: item.free_stock > 0 ? 'var(--disp-ok-text)' : 'var(--disp-err-text)' }}>
                    {item.free_stock}
                  </td>
                  <td><StockStatusBadge status={item.stock_status} /></td>
                  <td>
                    <div className="disp-inv-actions-col">
                      <button className="disp-btn disp-btn--ghost disp-btn--sm" onClick={() => quickAdd(item, 10)} title="Add 10">+10</button>
                      <button className="disp-btn disp-btn--ghost disp-btn--sm" onClick={() => quickAdd(item, 50)} title="Add 50">+50</button>
                      <button className="disp-btn disp-btn--ghost disp-btn--sm" onClick={() => setEditItem(item)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddStockModal onClose={() => setShowAdd(false)} onSuccess={onReload} toast={toast} />}
      {editItem && <EditStockModal item={editItem} onClose={() => setEditItem(null)} onSuccess={onReload} toast={toast} />}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

interface DashboardTabProps {
  stats: DispensaryDashboardStats | null;
  alerts: any[];
  statsLoading: boolean;
  onReplenish: (item: any) => void;
}

function DashboardTab({ stats, alerts, statsLoading, onReplenish }: DashboardTabProps) {
  if (statsLoading && !stats) {
    return (
      <div className="disp-section">
        <div className="disp-stats-strip">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="disp-stat-cell">
              <div className="disp-skeleton" style={{ height: 12, width: 80, marginBottom: 8 }} />
              <div className="disp-skeleton" style={{ height: 28, width: 50 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="disp-section">
      {/* Stats strip */}
      {stats && (
        <>
          <div className="disp-section-heading">Request Queue</div>
          <div className="disp-stats-strip">
            <div className="disp-stat-cell disp-stat-cell--warn">
              <div className="disp-stat-label">Pending</div>
              <div className="disp-stat-value">{stats.pending}</div>
            </div>
            <div className="disp-stat-cell disp-stat-cell--info">
              <div className="disp-stat-label">Processing</div>
              <div className="disp-stat-value">{stats.processing}</div>
            </div>
            <div className="disp-stat-cell disp-stat-cell--ok">
              <div className="disp-stat-label">Ready</div>
              <div className="disp-stat-value">{stats.ready}</div>
            </div>
            <div className="disp-stat-cell">
              <div className="disp-stat-label">Dispensed</div>
              <div className="disp-stat-value">{stats.dispensed}</div>
            </div>
          </div>

          <div className="disp-section-heading" style={{ marginTop: '0.5rem' }}>Inventory Alerts</div>
          <div className="disp-stats-strip">
            <div className="disp-stat-cell disp-stat-cell--err">
              <div className="disp-stat-label">Out of Stock</div>
              <div className="disp-stat-value">{stats.out_of_stock}</div>
            </div>
            <div className="disp-stat-cell disp-stat-cell--warn">
              <div className="disp-stat-label">Low Stock</div>
              <div className="disp-stat-value">{stats.low_stock}</div>
            </div>
            <div className="disp-stat-cell">
              <div className="disp-stat-label">Total Medicines</div>
              <div className="disp-stat-value">{stats.total_medicines}</div>
            </div>
          </div>
        </>
      )}

      {/* Alert list */}
      {alerts.length > 0 && (
        <>
          <div className="disp-section-heading" style={{ marginTop: '0.5rem' }}>Stock Alerts</div>
          <div className="disp-alert-list">
            {alerts.map((a: any) => (
              <div
                key={a.inventory_id}
                className={`disp-alert-row ${a.stock_status === 'OUT_OF_STOCK' ? 'disp-alert-row--out' : 'disp-alert-row--low'}`}
              >
                <div>
                  <div className="disp-alert-medicine">
                    {a.generic_name}{a.brand_name ? ` (${a.brand_name})` : ''}
                  </div>
                  <div className="disp-alert-detail">
                    Free: {a.free_stock} {a.unit} · Reorder at: {a.reorder_level}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className={`disp-alert-qty ${a.free_stock === 0 ? '' : ''}`} style={{ color: a.free_stock === 0 ? 'var(--disp-err-text)' : 'var(--disp-warn-text)' }}>
                    {a.free_stock} left
                  </div>
                  <button className="disp-btn disp-btn--ghost disp-btn--sm" onClick={() => onReplenish(a)}>
                    Replenish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {alerts.length === 0 && stats && (
        <div className="disp-empty" style={{ paddingTop: '1.5rem' }}>
          <AlertTriangle size={28} className="disp-empty-icon" />
          <div className="disp-empty-title">No stock alerts</div>
          <div className="disp-empty-sub">All medicines are above their reorder thresholds.</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Shell ───────────────────────────────────────────────────────────────

export default function DispensaryPortal() {
  const { clearAuth }  = useAuthStore();
  const navigate       = useNavigate();
  const { toasts, push: toast } = useToast();

  const [dark, setDark]         = useState(() => localStorage.getItem('rxify-theme') === 'dark');
  const [profile, setProfile]   = useState<DispensaryProfile | null>(null);
  const [tab, setTab]           = useState<Tab>('queue');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShareModal, setShowShareModal]   = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  /* Queue */
  const [queue, setQueue]               = useState<QueueItemSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedReqId, setSelectedReqId]       = useState<number | null>(null);
  const [selectedReqDetail, setSelectedReqDetail] = useState<RequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  /* Inventory */
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  /* Dashboard */
  const [stats, setStats]   = useState<DispensaryDashboardStats | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [editReplenish, setEditReplenish] = useState<InventoryItem | null>(null);

  /* Loading/Error per tab */
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  /* Theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('rxify-theme', dark ? 'dark' : 'light');
  }, [dark]);

  /* Auth check */
  useEffect(() => {
    fetchDispensaryProfile()
      .then(setProfile)
      .catch(() => { clearAuth(); navigate({ to: '/dispensary/login' }); });
  }, [clearAuth, navigate]);

  /* Detail cache to make clicking tickets 100% instant */
  const detailCacheRef = useRef<Map<number, RequestDetail>>(new Map());

  /* Queue filtered client-side for 0ms filter pill switching */
  const filteredQueue = useMemo(() => {
    if (statusFilter === 'ALL') return queue;
    return queue.filter((q) => q.status === statusFilter);
  }, [queue, statusFilter]);

  /* Load tab data */
  const loadTabData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      if (tab === 'queue') {
        const q = await fetchDispensaryQueue();
        setQueue(q);
      } else if (tab === 'inventory') {
        const inv = await fetchInventory();
        setInventory(inv);
      } else if (tab === 'dashboard') {
        const [s, a] = await Promise.all([fetchDispensaryDashboardStats(), fetchDispensaryAlerts()]);
        setStats(s);
        setAlerts(a.alerts ?? []);
      }
    } catch (err: any) {
      if (!silent) setError(err?.message ?? 'Failed to load data.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadTabData(false);
    const interval = setInterval(() => loadTabData(true), 20000);
    return () => clearInterval(interval);
  }, [loadTabData]);

  /* Load detail when queue item selected with optimistic instant UI and caching */
  const loadDetail = useCallback(async (id: number) => {
    try {
      const d = await fetchDispensaryRequestDetail(id);
      detailCacheRef.current.set(id, d);
      setSelectedReqDetail(d);
    } catch (err: any) {
      toast(err?.message ?? 'Failed to load request.', 'err');
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  const handleSelectReq = (id: number) => {
    setSelectedReqId(id);

    // 1. Instant cache hit
    if (detailCacheRef.current.has(id)) {
      setSelectedReqDetail(detailCacheRef.current.get(id)!);
      setDetailLoading(false);
      // Background silent revalidation
      fetchDispensaryRequestDetail(id)
        .then((fresh) => {
          detailCacheRef.current.set(id, fresh);
          setSelectedReqDetail(fresh);
        })
        .catch(() => {});
      return;
    }

    // 2. Optimistic initial render from queue summary item
    const summary = queue.find((q) => q.request_id === id);
    if (summary) {
      setSelectedReqDetail({
        request_id: summary.request_id,
        prescription_id: summary.prescription_id,
        dispensary_id: profile?.dispensary_id ?? 0,
        dispensary_name: profile?.name ?? '',
        dispensary_location: profile?.location ?? null,
        patient_id: summary.patient_id,
        patient_code: summary.patient_code,
        patient_name: summary.patient_name,
        patient_email: '',
        patient_phone: null,
        patient_dob: null,
        issue_date: null,
        diagnosis: null,
        prescription_notes: null,
        doctor_name: null,
        doctor_specialty: null,
        status: summary.status,
        estimated_ready_at: summary.estimated_ready_at,
        ready_at: null,
        dispensed_at: null,
        notes: null,
        created_at: summary.created_at,
        items: [],
      });
    } else {
      setSelectedReqDetail(null);
    }

    // 3. Fetch full line items and complete detail
    setDetailLoading(true);
    loadDetail(id);
  };

  /* Actions */
  const withAction = async (fn: () => Promise<void>) => {
    setActionLoading(true);
    try { await fn(); }
    finally { setActionLoading(false); }
  };

  const handleProcess = (id: number) => withAction(async () => {
    const res = await processDispensaryRequest(id);
    toast('Request is now processing. Stock reserved.', 'ok');
    if (res?.request) {
      detailCacheRef.current.set(id, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(id);
    }
    loadTabData(true);
  });

  const handleMarkReady = (id: number) => withAction(async () => {
    const res = await markDispensaryRequestReady(id);
    toast('Marked ready for collection.', 'ok');
    if (res?.request) {
      detailCacheRef.current.set(id, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(id);
    }
    loadTabData(true);
  });

  const handleDispense = (id: number, notes: string) => withAction(async () => {
    const res = await dispenseDispensaryRequest(id, notes);
    toast('Medicines dispensed. Stock updated.', 'ok');
    if (res?.request) {
      detailCacheRef.current.set(id, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(id);
    }
    loadTabData(true);
  });

  const handleCancel = (id: number) => withAction(async () => {
    const res = await cancelDispensaryRequest(id);
    toast('Request cancelled. Reserved stock released.', 'info');
    if (res?.request) {
      detailCacheRef.current.set(id, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(id);
    }
    loadTabData(true);
  });

  const handleLogout = () => { clearAuth(); navigate({ to: '/dispensary/login' }); };

  const NAV: { id: Tab; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'queue',     label: 'Live Queue',    desc: 'Prescription fulfilment', icon: <Clock size={18} /> },
    { id: 'inventory', label: 'Medicine Stock', desc: 'Inventory & reservations', icon: <Package size={18} /> },
    { id: 'dashboard', label: 'Dashboard',      desc: 'Stats & stock alerts',    icon: <LayoutDashboard size={18} /> },
    { id: 'profile',   label: 'Profile',        desc: 'Location & settings',     icon: <MapPin size={18} /> },
  ];

  const PAGE_TITLES: Record<Tab, string> = {
    queue:     'Prescription Queue',
    inventory: 'Medicine Stock',
    dashboard: 'Dashboard',
    profile:   'Dispensary Profile',
  };

  const dispCode = profile?.dispensary_code ?? (profile?.dispensary_id ? `RXF-DISP-${profile.dispensary_id}` : 'Dispensary ID');

  return (
    <div className="pd-shell" data-theme={dark ? 'dark' : 'light'}>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="pd-overlay" onClick={() => setSidebarOpen(false)} style={{ zIndex: 99 }} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`pd-sidebar ${sidebarOpen ? 'pd-sidebar--open' : ''}`}>
        <div className="pd-logo">
          <div className="pd-logo-icon"><Building2 size={18} color="#fff" /></div>
          <span className="pd-logo-text">Dispensary</span>
        </div>

        <nav className="pd-nav">
          <p className="pd-nav-label">Pharmacy</p>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`pd-nav-item ${tab === n.id ? 'pd-nav-item--active' : ''}`}
              onClick={() => { setTab(n.id); setSidebarOpen(false); }}
            >
              <div className="pd-nav-indicator" />
              {n.icon}
              <span className="pd-nav-text">
                <span className="pd-nav-label-text">{n.label}</span>
                <span className="pd-nav-desc">{n.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="pd-sidebar-footer">
          <div className="pd-user-row">
            <div className="pd-avatar">{(profile?.name ?? 'DP').slice(0, 2).toUpperCase()}</div>
            <div className="pd-user-info">
              <span className="pd-user-name">{profile?.name ?? 'Dispensary'}</span>
              <span className="pd-user-role">{profile?.location ?? 'Pharmacy'}</span>
            </div>
          </div>
          <div className="pd-footer-actions">
            <button className="pd-icon-btn" onClick={() => setDark((d) => !d)} title="Toggle theme">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="pd-logout-btn" onClick={handleLogout}>
              <LogOut size={15} /> Log out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="pd-main">
        {/* Mobile topbar */}
        <div className="pd-topbar">
          <button className="pd-menu-btn" onClick={() => setSidebarOpen(true)}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="pd-topbar-logo"><Building2 size={16} />Dispensary</div>
          <button className="pd-icon-btn" onClick={() => setShowScannerModal(true)}><QrCode size={18} /></button>
        </div>

        {/* Page header */}
        <div className="disp-page-header">
          <div>
            <h1 className="disp-page-title">{PAGE_TITLES[tab]}</h1>
            <p className="disp-page-sub">
              {profile?.name ?? ''}
              {profile?.operating_hours ? ` · ${profile.operating_hours}` : ''}
            </p>
          </div>

          <div className="disp-header-actions">
            <button className="disp-btn disp-btn--ghost" style={{ fontSize: '0.78rem' }} onClick={() => setShowShareModal(true)}>
              <ShieldCheck size={13} /> {dispCode}
            </button>
            <button className="disp-btn disp-btn--ghost" onClick={() => setShowScannerModal(true)}>
              <Camera size={14} /> Scan
            </button>
            <button className="disp-btn disp-btn--ghost" onClick={() => loadTabData()} title="Refresh">
              <RefreshCw size={14} className={loading ? 'disp-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tab content */}
        {tab === 'queue' && (
          <QueueTab
            queue={filteredQueue}
            loading={loading}
            error={error}
            statusFilter={statusFilter}
            onFilterChange={setStatusFilter}
            selectedReqId={selectedReqId}
            selectedReqDetail={selectedReqDetail}
            detailLoading={detailLoading}
            onSelectReq={handleSelectReq}
            onCloseDetail={() => { setSelectedReqId(null); setSelectedReqDetail(null); }}
            onProcess={handleProcess}
            onMarkReady={handleMarkReady}
            onDispense={handleDispense}
            onCancel={handleCancel}
            actionLoading={actionLoading}
            onScanOpen={() => setShowScannerModal(true)}
            toast={toast}
          />
        )}

        {tab === 'inventory' && (
          <InventoryTab
            inventory={inventory}
            loading={loading}
            error={error}
            onReload={loadTabData}
            toast={toast}
          />
        )}

        {tab === 'dashboard' && (
          <DashboardTab
            stats={stats}
            alerts={alerts}
            statsLoading={loading}
            onReplenish={(a) => setEditReplenish(a as InventoryItem)}
          />
        )}

        {tab === 'profile' && (
          <ProfileTab
            profile={profile}
            onProfileUpdate={(updated) => setProfile(updated)}
            toast={toast}
          />
        )}
      </main>

      {/* Modals */}
      <ShareIdModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        role="dispensary"
        code={dispCode}
        name={profile?.name ?? 'Dispensary Pharmacy'}
        subtitle="Patients and doctors can scan this code to route prescriptions."
        details={[
          { label: 'Dispensary Code', value: dispCode },
          { label: 'Location',        value: profile?.location ?? '—' },
          { label: 'Operating Hours', value: profile?.operating_hours ?? '—' },
          { label: 'Network',         value: 'Rxify Verified Pharmacy' },
        ]}
      />

      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        role="dispensary"
        onSuccessAction={(actionType, payload) => {
          if (actionType === 'dispensary_open_requests' && payload?.requests?.[0]) {
            const req = payload.requests[0];
            setSelectedReqId(req.request_id);
            loadDetail(req.request_id);
            setTab('queue');
          }
        }}
      />

      {editReplenish && (
        <EditStockModal
          item={editReplenish}
          onClose={() => setEditReplenish(null)}
          onSuccess={() => { loadTabData(); setEditReplenish(null); }}
          toast={toast}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
