import React from 'react';
import {
  Building2, Navigation, Clock, MapPin, Phone,
  CheckCircle2, ArrowRight
} from 'lucide-react';
import type { NearbyDispensary, PatientDispensaryRequest } from '../../../../lib/patientApi';
import { AvailabilityBadge } from './StockStatusBadges';
import { MedicineStockBreakdown } from './MedicineStockBreakdown';

interface DispensaryCardItemProps {
  dispensary: NearbyDispensary;
  isSelected: boolean;
  isBreakdownOpen: boolean;
  selectedRxId: number | null;
  activeTicket?: PatientDispensaryRequest;
  onSelect: () => void;
  onToggleBreakdown: () => void;
  onOpenFulfillModal: (d: NearbyDispensary) => void;
}

export const DispensaryCardItem: React.FC<DispensaryCardItemProps> = ({
  dispensary: d,
  isSelected,
  isBreakdownOpen,
  selectedRxId,
  activeTicket,
  onSelect,
  onToggleBreakdown,
  onOpenFulfillModal,
}) => {
  const avail = d.availability;

  return (
    <div
      onClick={onSelect}
      className={`pd-rx-row p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
        isSelected
          ? 'border-sky-500 bg-surface-hover shadow-sm'
          : 'border-border-color bg-surface hover:border-sky-500/50'
      }`}
    >
      {/* Ranking Badge */}
      {d.ranking && (
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-2 border ${
            d.ranking.rank === 1
              ? 'bg-amber-500/20 text-amber-600 border-amber-500/40'
              : d.ranking.rank === 2
              ? 'bg-slate-400/20 text-slate-600 border-slate-400/40'
              : d.ranking.rank === 3
              ? 'bg-orange-500/20 text-orange-600 border-orange-500/40'
              : 'bg-slate-500/10 text-secondary border-border-color'
          }`}
        >
          <span>{d.ranking.rank === 1 ? '🏆' : d.ranking.rank === 2 ? '🥈' : d.ranking.rank === 3 ? '🥉' : `#${d.ranking.rank}`}</span>
          <span>{d.ranking.rank_badge || `Rank #${d.ranking.rank}`}</span>
          <span className="opacity-50">•</span>
          <span>{d.ranking.rank_score}% Match Score</span>
        </div>
      )}

      {/* Header: Name & Status */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <h4 className="text-base font-bold text-primary m-0">{d.name}</h4>
          </div>
          {d.hospital_name && (
            <span className="text-xs text-secondary ml-5">Affiliated with {d.hospital_name}</span>
          )}
        </div>
        <div className="flex-shrink-0">
          <AvailabilityBadge
            status={avail?.overall_status}
            availableCount={avail?.available_count}
            totalCount={avail?.total_count}
          />
        </div>
      </div>

      {/* Score Breakdown Bar */}
      {d.ranking && (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/10 text-xs mb-2 flex-wrap">
          <span className="font-semibold text-primary">
            Stock:{' '}
            <strong className={d.ranking.score_breakdown.availability_score >= 80 ? 'text-emerald-500' : 'text-amber-500'}>
              {d.ranking.score_breakdown.availability_score}%
            </strong>
          </span>
          <span className="text-border-color">•</span>
          <span className="font-semibold text-primary">
            Proximity: <strong className="text-sky-500">{d.ranking.score_breakdown.distance_score}%</strong>
          </span>
          {d.ranking.score_breakdown.bonus_points > 0 && (
            <>
              <span className="text-border-color">•</span>
              <span className="text-purple-500 font-semibold">+{d.ranking.score_breakdown.bonus_points} pts Fast</span>
            </>
          )}
        </div>
      )}

      {/* Distance, Hours & Address */}
      <div className="text-xs text-secondary my-2 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 font-semibold text-sky-500">
          <Navigation className="w-3.5 h-3.5" />
          <span>{d.distance_km != null ? `${d.distance_km} km away` : 'Distance unknown'}</span>
          <span className="text-border-color">•</span>
          <Clock className="w-3.5 h-3.5 text-secondary" />
          <span className="text-secondary font-normal">{d.operating_hours}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{d.address}</span>
        </div>
        {d.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{d.phone}</span>
          </div>
        )}
      </div>

      {/* Stock Accordion */}
      {avail && (
        <MedicineStockBreakdown
          availability={avail}
          isOpen={isBreakdownOpen}
          onToggle={onToggleBreakdown}
        />
      )}

      {/* Actions */}
      <div className="mt-3 flex justify-between items-center flex-wrap gap-2">
        {d.latitude != null && d.longitude != null ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-sky-500 hover:text-sky-400 text-xs font-semibold"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Get Directions</span>
          </a>
        ) : <div />}

        {selectedRxId && (
          activeTicket ? (
            activeTicket.dispensary_id === d.dispensary_id ? (
              <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-600 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-bold text-xs">
                <CheckCircle2 size={14} />
                <span>Active Order #{activeTicket.request_id}</span>
              </div>
            ) : (
              <span className="text-[11px] text-secondary italic">Ticket Active Elsewhere</span>
            )
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenFulfillModal(d); }}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
            >
              <span>Fulfill & Order Pickup</span>
              <ArrowRight size={14} />
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default DispensaryCardItem;
