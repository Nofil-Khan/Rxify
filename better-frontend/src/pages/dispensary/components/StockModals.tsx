/** Add / Edit stock modal */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  addOrUpdateStock, updateStockPartial, searchMedicineCatalog,
  type InventoryItem, type CatalogMedicine,
} from '../../../lib/dispensaryApi';
import type { ToastVariant } from './useToast';

interface AddModalProps {
  onClose: () => void;
  onSuccess: () => void;
  toast: (msg: string, v?: ToastVariant) => void;
}

const catalogSearchCache = new Map<string, CatalogMedicine[]>();

export function AddStockModal({ onClose, onSuccess, toast }: AddModalProps) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<CatalogMedicine[]>([]);
  const [selected, setSelected]   = useState<CatalogMedicine | null>(null);
  const [qty, setQty]             = useState(100);
  const [reorder, setReorder]     = useState(10);
  const [unit, setUnit]           = useState('tablets');
  const [saving, setSaving]       = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const qKey = (query || '').trim().toLowerCase();
    if (catalogSearchCache.has(qKey)) {
      setResults(catalogSearchCache.get(qKey)!);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const t = setTimeout(() => {
      searchMedicineCatalog(query || undefined)
        .then((data) => {
          catalogSearchCache.set(qKey, data);
          setResults(data);
        })
        .catch(() => setResults([]))
        .finally(() => setSearchLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { toast('Select a medicine from the catalog.', 'err'); return; }
    setSaving(true);
    try {
      await addOrUpdateStock({ medicine_id: selected.medicine_id, available_quantity: qty, reorder_level: reorder, unit });
      toast(`Stock added: ${selected.generic_name}`, 'ok');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err?.message ?? 'Failed to add stock.', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="disp-overlay">
      <div className="disp-modal">
        <div className="disp-modal-header">
          <span className="disp-modal-title">Add Medicine Stock</span>
          <button className="disp-btn disp-btn--icon" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="disp-modal-body">
            <div className="disp-form-group">
              <label className="disp-form-label">Search Medicine Catalog</label>
              <input
                className="disp-form-input"
                type="search"
                placeholder="Type generic or brand name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="disp-catalog-results">
              {results.length === 0 && (
                <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--disp-text-muted)' }}>
                  {searchLoading ? 'Searching medicine catalog…' : (query ? 'No results' : 'Type to search…')}
                </div>
              )}
              {results.map((m) => (
                <div
                  key={m.medicine_id}
                  className={`disp-catalog-item ${selected?.medicine_id === m.medicine_id ? 'disp-catalog-item--selected' : ''}`}
                  onClick={() => {
                    setSelected(m);
                    const f = (m.form || '').toUpperCase();
                    if (f.includes('CAPSULE')) setUnit('capsules');
                    else if (f.includes('TABLET')) setUnit('tablets');
                    else if (f.includes('INHALER')) setUnit('inhalers');
                    else if (f.includes('SOLUTION') || f.includes('SYRUP') || f.includes('LIQUID')) setUnit('mL');
                    else if (f.includes('INJECTION')) setUnit('vials');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--disp-text-main)' }}>
                      {m.generic_name}
                      {m.brand_name && <span style={{ fontWeight: 400, color: 'var(--disp-text-sub)', marginLeft: 4 }}>({m.brand_name})</span>}
                    </span>
                    {m.rxcui && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--disp-text-muted)', fontFamily: 'monospace' }}>
                        RxCUI: {m.rxcui}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', fontSize: '0.76rem', color: 'var(--disp-text-sub)', flexWrap: 'wrap' }}>
                    <span style={{ padding: '0.1rem 0.4rem', background: 'var(--disp-surface)', borderRadius: 4, border: '1px solid var(--disp-border)', fontWeight: 600 }}>
                      {m.strength || 'Standard strength'}
                    </span>
                    <span style={{ padding: '0.1rem 0.4rem', background: 'var(--disp-surface)', borderRadius: 4, border: '1px solid var(--disp-border)' }}>
                      {m.form || 'OTHER'}
                    </span>
                    {m.category && (
                      <span style={{ color: 'var(--disp-text-muted)', fontStyle: 'italic', marginLeft: 'auto' }}>
                        {m.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {selected && (
              <div style={{
                padding: '0.65rem 0.85rem',
                background: 'rgba(13, 148, 136, 0.08)',
                border: '1px solid rgba(13, 148, 136, 0.25)',
                borderRadius: '8px',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: 'var(--disp-accent)' }}>
                    ✓ Selected: {selected.generic_name} {selected.brand_name ? `(${selected.brand_name})` : ''}
                  </span>
                  {selected.rxcui && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--disp-text-muted)', fontFamily: 'monospace' }}>
                      RxCUI #{selected.rxcui}
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--disp-text-sub)', fontSize: '0.78rem' }}>
                  {selected.strength ? `Strength: ${selected.strength}` : 'Strength: Standard'} · Form: {selected.form}
                  <span style={{ marginLeft: 8, color: 'var(--disp-text-muted)' }}>(Catalog ID: {selected.medicine_id})</span>
                </div>
              </div>
            )}
            <div className="disp-form-grid-2">
              <div className="disp-form-group">
                <label className="disp-form-label">Initial Quantity</label>
                <input className="disp-form-input" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} required />
              </div>
              <div className="disp-form-group">
                <label className="disp-form-label">Reorder Threshold</label>
                <input className="disp-form-input" type="number" min={0} value={reorder} onChange={(e) => setReorder(Number(e.target.value))} required />
              </div>
            </div>
            <div className="disp-form-group">
              <label className="disp-form-label">Unit</label>
              <input className="disp-form-input" type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. tablets, mL, capsules" />
            </div>
          </div>
          <div className="disp-modal-footer">
            <button type="button" className="disp-btn disp-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="disp-btn disp-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
  toast: (msg: string, v?: ToastVariant) => void;
}

export function EditStockModal({ item, onClose, onSuccess, toast }: EditModalProps) {
  const [qty, setQty]       = useState(item.available_quantity);
  const [reorder, setReorder] = useState(item.reorder_level);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateStockPartial(item.inventory_id, { available_quantity: qty, reorder_level: reorder });
      toast(`Stock updated: ${item.generic_name}`, 'ok');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err?.message ?? 'Failed to update stock.', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="disp-overlay">
      <div className="disp-modal">
        <div className="disp-modal-header">
          <span className="disp-modal-title">Update Stock</span>
          <button className="disp-btn disp-btn--icon" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="disp-modal-body">
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--disp-text)' }}>
              {item.generic_name}
              {item.brand_name && <span style={{ color: 'var(--disp-text-muted)', fontWeight: 400 }}> ({item.brand_name})</span>}
            </div>
            <div className="disp-form-grid-2">
              <div className="disp-form-group">
                <label className="disp-form-label">Physical Quantity</label>
                <input className="disp-form-input" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} required autoFocus />
              </div>
              <div className="disp-form-group">
                <label className="disp-form-label">Reorder Level</label>
                <input className="disp-form-input" type="number" min={0} value={reorder} onChange={(e) => setReorder(Number(e.target.value))} required />
              </div>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--disp-text-muted)' }}>
              Reserved: {item.reserved_quantity} · Free stock will be: {Math.max(0, qty - item.reserved_quantity)}
            </div>
          </div>
          <div className="disp-modal-footer">
            <button type="button" className="disp-btn disp-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="disp-btn disp-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
