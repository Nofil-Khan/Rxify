import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Building2, Package, LayoutDashboard, Clock,
  RefreshCw, Search, Plus, LogOut, Sun, Moon,
  QrCode, AlertTriangle, Upload, Camera, ShieldCheck,
  XCircle, MapPin, Volume2, VolumeX, BellRing, X,
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth';
import { useNavigate } from '@tanstack/react-router';
import ShareIdModal from '../../components/common/ShareIdModal';
import QrScannerModal from '../../components/common/QrScannerModal';
import {
  fetchDispensaryProfile, fetchInventory, fetchDispensaryQueue,
  fetchDispensaryRequestDetail,
  processDispensaryRequest, markDispensaryRequestReady,
  approveDispensaryRequest, reconsultDispensaryRequest,
  dispenseDispensaryRequest, cancelDispensaryRequest,
  updateRequestItemDecision, verifyPrescription, fetchInventoryTransactions,
  fetchDispensaryDashboardStats, fetchDispensaryAlerts,
  uploadInventoryCsv, updateStockPartial,
  type DispensaryProfile, type InventoryItem, type InventoryTransactionItem,
  type QueueItemSummary, type RequestDetail, type DispensaryDashboardStats,
} from '../../lib/dispensaryApi';
import { RequestStatusBadge, StockStatusBadge, TxnTypeBadge } from './components/StatusBadge';
import { History } from 'lucide-react';
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

const STATUS_FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'RECONSULTATION_NEEDED', 'PARTIALLY_AVAILABLE', 'DISPENSED', 'UNAVAILABLE', 'CANCELLED'];

interface QueueTabProps {
  queue: QueueItemSummary[];
  loading: boolean;
  error: string;
  statusFilter: string;
  onFilterChange: (s: string) => void;
  selectedReqId: number | null;
  selectedReqDetail: RequestDetail | null;
  detailLoading: boolean;
  inventory: InventoryItem[];
  currentPharmacistName?: string;
  onSelectReq: (id: number) => void;
  onCloseDetail: () => void;
  onProcess: (id: number) => void;
  onApprove: (id: number, prepMins?: number, notes?: string) => void;
  onReconsult: (id: number, reason: string, notes: string, target?: string, itemIds?: number[]) => void;
  onItemDecision: (requestId: number, itemId: number, decision: any, quantity?: number, substituteMedicineId?: number, notes?: string) => Promise<void>;
  onVerify: (requestId: number, checklist: any) => Promise<void>;
  onMarkReady: (id: number) => void;
  onDispense: (id: number, notes: string, pickupCode?: string) => void;
  onCancel: (id: number) => void;
  actionLoading: boolean;
  onScanOpen: () => void;
  toast: (msg: string, v?: any) => void;
}

function QueueTab({
  queue, loading, error, statusFilter, onFilterChange,
  selectedReqId, selectedReqDetail, detailLoading,
  inventory, currentPharmacistName,
  onSelectReq, onCloseDetail,
  onProcess, onApprove, onReconsult, onItemDecision, onVerify,
  onMarkReady, onDispense, onCancel,
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
            {s === 'ALL' ? 'All' : s === 'CONFIRMED' ? 'Confirmed' : s === 'RECONSULTATION_NEEDED' ? 'Reconsult' : s === 'PARTIALLY_AVAILABLE' ? 'Partial' : s.charAt(0) + s.slice(1).toLowerCase()}
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
                inventory={inventory}
                currentPharmacistName={currentPharmacistName}
                onClose={onCloseDetail}
                onProcess={() => onProcess(selectedReqDetail.request_id)}
                onApprove={(prepMins, notes) => onApprove(selectedReqDetail.request_id, prepMins, notes)}
                onReconsult={(reason, notes, target, itemIds) => onReconsult(selectedReqDetail.request_id, reason, notes, target, itemIds)}
                onItemDecision={(itemId, decision, quantity, substituteMedicineId, notes) =>
                  onItemDecision(selectedReqDetail.request_id, itemId, decision, quantity, substituteMedicineId, notes)
                }
                onVerify={(checklist) => onVerify(selectedReqDetail.request_id, checklist)}
                onMarkReady={() => onMarkReady(selectedReqDetail.request_id)}
                onDispense={(notes, pickupCode) => onDispense(selectedReqDetail.request_id, notes, pickupCode)}
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

const TXN_TYPE_FILTERS = [
  { id: 'ALL', label: 'All Transactions' },
  { id: 'STOCK_ADDED', label: 'Stock In' },
  { id: 'MEDICINE_RESERVED', label: 'Reservations' },
  { id: 'MEDICINE_DISPENSED', label: 'Dispensed' },
  { id: 'RESERVATION_CANCELLED', label: 'Released' },
  { id: 'STOCK_ADJUSTED', label: 'Adjusted' },
];

interface InventoryTabProps {
  inventory: InventoryItem[];
  loading: boolean;
  error: string;
  onReload: () => void;
  toast: (msg: string, v?: any) => void;
}

function InventoryTab({ inventory, loading, error, onReload, toast }: InventoryTabProps) {
  const [subTab, setSubTab]           = useState<'stock' | 'ledger'>('stock');
  const [search, setSearch]           = useState('');
  const [stockFilter, setStockFilter] = useState<InvStockFilter>('ALL');
  const [showAdd, setShowAdd]         = useState(false);
  const [editItem, setEditItem]       = useState<InventoryItem | null>(null);

  /* Transaction Audit Ledger States */
  const [transactions, setTransactions] = useState<InventoryTransactionItem[]>([]);
  const [txnTypeFilter, setTxnTypeFilter] = useState('ALL');
  const [txnLoading, setTxnLoading]   = useState(false);
  const [txnError, setTxnError]       = useState('');

  const loadTransactions = useCallback(async () => {
    setTxnLoading(true);
    setTxnError('');
    try {
      const res = await fetchInventoryTransactions({
        txnType: txnTypeFilter === 'ALL' ? undefined : txnTypeFilter,
        limit: 100,
      });
      setTransactions(res.transactions);
    } catch (err: any) {
      setTxnError(err?.message ?? 'Failed to load transaction audit ledger.');
    } finally {
      setTxnLoading(false);
    }
  }, [txnTypeFilter]);

  useEffect(() => {
    if (subTab === 'ledger') {
      loadTransactions();
    }
  }, [subTab, loadTransactions]);

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

      {/* Subtab Switcher: Active Medicine Stock vs Stock Audit Ledger */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem' }}>
        <button
          type="button"
          onClick={() => setSubTab('stock')}
          style={{
            padding: '0.45rem 0.95rem',
            borderRadius: '0.5rem',
            border: subTab === 'stock' ? '1.5px solid var(--disp-accent)' : '1px solid var(--border-color)',
            background: subTab === 'stock' ? 'var(--disp-accent-bg)' : 'transparent',
            color: subTab === 'stock' ? 'var(--disp-accent)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
          }}
        >
          <Package size={15} />
          <span>Active Stock ({inventory.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('ledger')}
          style={{
            padding: '0.45rem 0.95rem',
            borderRadius: '0.5rem',
            border: subTab === 'ledger' ? '1.5px solid var(--disp-accent)' : '1px solid var(--border-color)',
            background: subTab === 'ledger' ? 'var(--disp-accent-bg)' : 'transparent',
            color: subTab === 'ledger' ? 'var(--disp-accent)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
          }}
        >
          <History size={15} />
          <span>Inventory Audit Ledger</span>
        </button>
      </div>

      {subTab === 'stock' ? (
        <>
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
                <div key={i} className="disp-skeleton disp-skeleton--row" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="disp-empty">
              <Package size={32} className="disp-empty-icon" />
              <div className="disp-empty-title">No medicines found</div>
              <div className="disp-empty-sub">
                {search || stockFilter !== 'ALL'
                  ? 'Try clearing filters or search.'
                  : 'Add medicines or import CSV to populate inventory.'}
              </div>
            </div>
          ) : (
            <div className="disp-table-wrap">
              <table className="disp-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Strength / Form</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Reserved</th>
                    <th style={{ textAlign: 'right' }}>Available</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.inventory_id}>
                      <td>
                        <div className="disp-medicine-name">{item.generic_name}</div>
                        {item.brand_name && (
                          <div className="disp-medicine-brand">{item.brand_name}</div>
                        )}
                      </td>
                      <td>{item.category ?? '—'}</td>
                      <td>
                        {item.strength ?? '—'}
                        {item.form ? ` · ${item.form.toLowerCase()}` : ''}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.available_quantity}</td>
                      <td style={{ textAlign: 'right', color: item.reserved_quantity > 0 ? 'var(--disp-warn-text)' : 'inherit' }}>
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
        </>
      ) : (
        /* ── Inventory Audit Ledger View ── */
        <div>
          {txnError && <div className="disp-error-bar"><XCircle size={14} />{txnError}</div>}

          {/* Ledger Toolbar */}
          <div className="disp-toolbar" style={{ marginBottom: '1rem' }}>
            <div className="disp-filter-bar">
              {TXN_TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`disp-filter-pill ${txnTypeFilter === f.id ? 'disp-filter-pill--active' : ''}`}
                  onClick={() => setTxnTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="disp-btn disp-btn--ghost"
                onClick={loadTransactions}
                title="Refresh audit ledger"
              >
                <RefreshCw size={14} className={txnLoading ? 'disp-spin' : ''} /> Refresh Ledger
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          {txnLoading && !transactions.length ? (
            <div className="disp-table-wrap">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="disp-skeleton disp-skeleton--row" />
              ))}
            </div>
          ) : !transactions.length ? (
            <div className="disp-empty">
              <History size={32} className="disp-empty-icon" />
              <div className="disp-empty-title">No transactions recorded</div>
              <div className="disp-empty-sub">
                Stock changes, order reservations, and dispensations will be audited here in real time.
              </div>
            </div>
          ) : (
            <div className="disp-table-wrap">
              <table className="disp-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Medicine</th>
                    <th>Action / Type</th>
                    <th style={{ textAlign: 'right' }}>Qty Change</th>
                    <th>Reference</th>
                    <th>Audit Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const isPositive = txn.txn_type === 'STOCK_ADDED' || txn.txn_type === 'RESERVATION_CANCELLED';
                    return (
                      <tr key={txn.txn_id}>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {fmtRelTime(txn.created_at)}
                        </td>
                        <td>
                          <div className="disp-medicine-name">{txn.generic_name}</div>
                          {txn.brand_name && (
                            <div className="disp-medicine-brand">{txn.brand_name} {txn.strength || ''}</div>
                          )}
                        </td>
                        <td><TxnTypeBadge type={txn.txn_type} /></td>
                        <td style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isPositive ? 'var(--disp-ok-text)' : 'var(--disp-warn-text)',
                        }}>
                          {isPositive ? `+${txn.quantity}` : `-${txn.quantity}`}
                        </td>
                        <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {txn.reference_id ?? '—'}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '220px' }}>
                          {txn.notes ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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


function playOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // AudioContext blocked or not supported
  }
}

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

  /* Live Sound & Notification Alert States */
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState<{ id: number; patient: string; rxId: number } | null>(null);
  const prevQueueIdsRef = useRef<Set<number>>(new Set());

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

        // Detect newly arrived orders in real-time
        const currentIds = new Set(q.map((item) => item.request_id));
        if (prevQueueIdsRef.current.size > 0) {
          const newlyAdded = q.find(
            (item) => !prevQueueIdsRef.current.has(item.request_id) && item.status === 'PENDING'
          );
          if (newlyAdded) {
            if (soundEnabled) {
              playOrderChime();
            }
            setNewOrderAlert({
              id: newlyAdded.request_id,
              patient: newlyAdded.patient_name,
              rxId: newlyAdded.prescription_id,
            });
            toast(`🔔 New Prescription Order #${newlyAdded.prescription_id} from ${newlyAdded.patient_name}!`, 'ok');
          }
        }
        prevQueueIdsRef.current = currentIds;
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
    const interval = setInterval(() => loadTabData(true), 8000);
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

  const handleApprove = (id: number, prepMins?: number, notes?: string) => withAction(async () => {
    const res = await approveDispensaryRequest(id, prepMins, notes);
    toast('Prescription confirmed & stock reserved!', 'ok');
    if (res?.request) {
      detailCacheRef.current.set(id, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(id);
    }
    loadTabData(true);
  });

  const handleReconsult = (id: number, reason: string, notes: string, target?: string, itemIds?: number[]) => withAction(async () => {
    const res = await reconsultDispensaryRequest(id, { reason, pharmacistNotes: notes, target, itemIds });
    toast('Reconsultation advisory recorded. Patient alerted.', 'info');
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

  const handleDispense = (id: number, notes: string, pickupCode?: string) => withAction(async () => {
    const res = await dispenseDispensaryRequest(id, notes, pickupCode);
    toast('Medicines dispensed. Stock updated.', 'ok');
    if (res?.request) {
      detailCacheRef.current.set(id, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(id);
    }
    loadTabData(true);
  });

  const handleItemDecision = (requestId: number, itemId: number, decision: any, quantity?: number, substituteMedicineId?: number, notes?: string) => withAction(async () => {
    const res = await updateRequestItemDecision(requestId, itemId, { decision, quantity, substituteMedicineId, notes });
    toast(`Prescription item updated to ${decision}. Stock recalibrated.`, 'ok');
    if (res?.request) {
      detailCacheRef.current.set(requestId, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(requestId);
    }
    loadTabData(true);
  });

  const handleVerify = (requestId: number, checklist: any) => withAction(async () => {
    const res = await verifyPrescription(requestId, checklist);
    toast(`Prescription clinically certified & signed: ${res.verification_signature}`, 'ok');
    if (res?.request) {
      detailCacheRef.current.set(requestId, res.request);
      setSelectedReqDetail(res.request);
    } else {
      await loadDetail(requestId);
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
            <button
              className="disp-btn disp-btn--ghost"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                toast(soundEnabled ? 'Order sound chime muted.' : 'Order sound chime enabled.', 'info');
              }}
              title={soundEnabled ? 'Live Order Sound Alerts Active (Click to Mute)' : 'Live Order Sound Alerts Muted (Click to Enable)'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {soundEnabled ? <Volume2 size={15} style={{ color: '#10b981' }} /> : <VolumeX size={15} style={{ color: 'var(--text-secondary)' }} />}
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{soundEnabled ? 'Alerts ON' : 'Muted'}</span>
            </button>
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

        {/* Live Incoming Order Alert Banner */}
        {newOrderAlert && (
          <div style={{
            margin: '0 0 1rem 0',
            padding: '0.85rem 1.25rem',
            borderRadius: '0.65rem',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.18))',
            border: '1.5px solid #0284c7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BellRing size={20} style={{ color: '#0284c7', animation: 'bounce 1s infinite' }} />
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  🔔 New Prescription Fulfillment Order #{newOrderAlert.rxId} Received!
                </span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Patient: {newOrderAlert.patient} • Ready to be reviewed & prepared
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="disp-btn disp-btn--primary disp-btn--sm"
                onClick={() => {
                  setTab('queue');
                  handleSelectReq(newOrderAlert.id);
                  setNewOrderAlert(null);
                }}
              >
                Open Ticket
              </button>
              <button
                className="disp-btn disp-btn--ghost disp-btn--sm"
                onClick={() => setNewOrderAlert(null)}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

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
            inventory={inventory}
            currentPharmacistName={profile?.name}
            onSelectReq={handleSelectReq}
            onCloseDetail={() => { setSelectedReqId(null); setSelectedReqDetail(null); }}
            onProcess={handleProcess}
            onApprove={handleApprove}
            onReconsult={handleReconsult}
            onItemDecision={handleItemDecision}
            onVerify={handleVerify}
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
