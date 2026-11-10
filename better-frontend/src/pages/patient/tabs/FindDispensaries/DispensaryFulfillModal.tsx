import React from 'react';
import { ShieldCheck, X, Loader2, ArrowRight } from 'lucide-react';
import type { NearbyDispensary, PatientDispensaryRequest } from '../../../../lib/patientApi';

interface DispensaryFulfillModalProps {
  dispensary: NearbyDispensary | null;
  selectedRxId: number | null;
  prescriptionDiagnosis?: string | null;
  activeTicket?: PatientDispensaryRequest;
  notes: string;
  onNotesChange: (n: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DispensaryFulfillModal: React.FC<DispensaryFulfillModalProps> = ({
  dispensary: d,
  selectedRxId,
  prescriptionDiagnosis,
  activeTicket,
  notes,
  onNotesChange,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  if (!d) return null;
  const isConflict = Boolean(activeTicket && activeTicket.dispensary_id !== d.dispensary_id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-surface rounded-2xl border border-border-color max-w-lg w-full p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-sky-500" />
            <h3 className="text-lg font-bold text-primary m-0">Confirm Dispensary Pickup Order</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-secondary hover:text-primary cursor-pointer p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-secondary mb-4">
          Your prescription will be routed to this dispensary. The pharmacist will prepare your medications and notify you when ready for counter pickup.
        </p>

        {/* Target Dispensary Info */}
        <div className="p-3.5 rounded-xl bg-surface-hover mb-4">
          <div className="font-bold text-sm text-primary mb-1">{d.name}</div>
          <div className="text-xs text-secondary mb-1.5">{d.address}</div>
          <div className="flex gap-4 text-xs text-sky-500 font-semibold">
            <span>📍 {d.distance_km != null ? `${d.distance_km} km away` : 'Nearby'}</span>
            <span>⏱ Prep Time: ~{d.avg_prep_minutes} mins</span>
          </div>
        </div>

        {selectedRxId && (
          <div className="mb-4 text-xs">
            <span className="font-semibold text-primary">Prescription: </span>
            <span className="text-secondary">Rx #{selectedRxId} — {prescriptionDiagnosis || 'Prescription Order'}</span>
          </div>
        )}

        {isConflict && activeTicket && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500 text-red-600 text-xs leading-relaxed">
            <strong>⚠️ Active Ticket In Progress:</strong> You already have ticket <strong>#{activeTicket.request_id}</strong> active with <strong>{activeTicket.dispensary_name}</strong>. Cancel that ticket first before routing to this dispensary.
          </div>
        )}

        <div className="mb-5">
          <label className="block text-xs font-semibold text-secondary mb-1.5">
            Optional Instructions for Pharmacist:
          </label>
          <textarea
            rows={2}
            placeholder="e.g. I will pick up around 5:30 PM..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-border-color bg-surface text-primary text-xs focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-surface-hover text-secondary font-semibold text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || isConflict}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <span>Confirm Order & Route</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispensaryFulfillModal;
