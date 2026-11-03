import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Replace, Stethoscope, Ban, ShieldCheck } from 'lucide-react';
import type { RequestItemDetail, InventoryItem } from '../../../lib/dispensaryApi';

interface Props {
  item: RequestItemDetail;
  inventory: InventoryItem[];
  onClose: () => void;
  onSave: (decision: 'FULFILL' | 'PARTIAL' | 'SUBSTITUTE' | 'UNAVAILABLE' | 'RECONSULT', quantity?: number, substituteMedicineId?: number, notes?: string) => Promise<void>;
}

export default function ItemDecisionModal({ item, inventory, onClose, onSave }: Props) {
  const [decision, setDecision] = useState<'FULFILL' | 'PARTIAL' | 'SUBSTITUTE' | 'UNAVAILABLE' | 'RECONSULT'>(
    item.availability_status === 'PARTIAL' ? 'PARTIAL' :
    item.availability_status === 'SUBSTITUTE' ? 'SUBSTITUTE' :
    item.availability_status === 'UNAVAILABLE' ? 'UNAVAILABLE' :
    item.availability_status === 'RECONSULTATION_NEEDED' || item.reconsultation_needed ? 'RECONSULT' :
    'FULFILL'
  );

  const [quantity, setQuantity] = useState<number>(
    item.dispensed_quantity && item.dispensed_quantity > 0 ? item.dispensed_quantity : item.required_quantity
  );
  const [substituteId, setSubstituteId] = useState<number | undefined>(
    item.suggested_substitute_id ?? undefined
  );
  const [notes, setNotes] = useState<string>(item.reconsultation_notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalQty = decision === 'FULFILL' ? item.required_quantity :
                       decision === 'PARTIAL' ? Number(quantity) :
                       decision === 'SUBSTITUTE' ? Number(quantity) : 0;
      await onSave(
        decision,
        decision === 'UNAVAILABLE' || decision === 'RECONSULT' ? 0 : finalQty,
        decision === 'SUBSTITUTE' ? substituteId : undefined,
        notes.trim() || undefined
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // Filter available inventory stock that could be substitute
  const availableSubstitutes = inventory.filter(
    (inv) => inv.available_quantity > 0 && inv.medicine_id !== item.medicine_id
  );

  return (
    <div className="disp-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="disp-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '540px',
          width: '92%',
          background: 'var(--surface-color)',
          borderRadius: '0.85rem',
          padding: '1.25rem',
          boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Fulfillment Decision
            </h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {item.prescribed_medicine_name} (Req: {item.required_quantity} {item.form ? item.form.toLowerCase() : 'unit'}s)
            </p>
          </div>
          <button type="button" className="disp-btn disp-btn--icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Decision Selector Options */}
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Pharmacist Fulfillment Action:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.45rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => { setDecision('FULFILL'); setQuantity(item.required_quantity); }}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '0.5rem',
                border: decision === 'FULFILL' ? '2px solid #10b981' : '1px solid var(--border-color)',
                background: decision === 'FULFILL' ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-sub)',
                color: decision === 'FULFILL' ? '#047857' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
            >
              <CheckCircle size={16} style={{ color: '#10b981' }} />
              <span>Full Supply</span>
            </button>

            <button
              type="button"
              onClick={() => { setDecision('PARTIAL'); setQuantity(Math.max(1, Math.floor(item.required_quantity / 2))); }}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '0.5rem',
                border: decision === 'PARTIAL' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                background: decision === 'PARTIAL' ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-sub)',
                color: decision === 'PARTIAL' ? '#b45309' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
            >
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              <span>Partial Supply</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision('SUBSTITUTE')}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '0.5rem',
                border: decision === 'SUBSTITUTE' ? '2px solid #0284c7' : '1px solid var(--border-color)',
                background: decision === 'SUBSTITUTE' ? 'rgba(2, 132, 199, 0.12)' : 'var(--surface-sub)',
                color: decision === 'SUBSTITUTE' ? '#0369a1' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
            >
              <Replace size={16} style={{ color: '#0284c7' }} />
              <span>Generic Substitute</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision('UNAVAILABLE')}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '0.5rem',
                border: decision === 'UNAVAILABLE' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                background: decision === 'UNAVAILABLE' ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface-sub)',
                color: decision === 'UNAVAILABLE' ? '#b91c1c' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
            >
              <Ban size={16} style={{ color: '#ef4444' }} />
              <span>Out of Stock</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision('RECONSULT')}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '0.5rem',
                border: decision === 'RECONSULT' ? '2px solid #9333ea' : '1px solid var(--border-color)',
                background: decision === 'RECONSULT' ? 'rgba(147, 51, 234, 0.12)' : 'var(--surface-sub)',
                color: decision === 'RECONSULT' ? '#7e22ce' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
            >
              <Stethoscope size={16} style={{ color: '#9333ea' }} />
              <span>Flag Reconsult</span>
            </button>
          </div>

          {/* Quantity Input for Partial / Substitute */}
          {(decision === 'PARTIAL' || decision === 'SUBSTITUTE') && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--surface-sub)', borderRadius: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Quantity to Dispense (Prescribed: {item.required_quantity}):
              </label>
              <input
                type="number"
                min={1}
                max={item.required_quantity * 2}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Inventory will automatically reserve {quantity} units for this item.
              </span>
            </div>
          )}

          {/* Substitute Selector if decision is SUBSTITUTE */}
          {decision === 'SUBSTITUTE' && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '0.5rem', border: '1px solid rgba(2, 132, 199, 0.25)' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.35rem' }}>
                Select Generic / In-Stock Alternative:
              </label>
              <select
                value={substituteId ?? ''}
                onChange={(e) => setSubstituteId(e.target.value ? Number(e.target.value) : undefined)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">-- Choose generic alternative from pharmacy inventory --</option>
                {availableSubstitutes.map((inv) => (
                  <option key={inv.medicine_id} value={inv.medicine_id}>
                    {inv.generic_name} {inv.brand_name ? `(${inv.brand_name})` : ''} - {inv.strength || ''} ({inv.free_stock} in stock)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clinical notes on decision */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Pharmacist Notes / Rationalization (optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dispensing generic equivalent due to brand stock shortage. Verified therapeutic equivalence."
              className="disp-textarea"
              style={{ minHeight: '65px' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="disp-btn disp-btn--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="disp-btn disp-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Save Item Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

