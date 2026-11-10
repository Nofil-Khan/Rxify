import * as React from 'react';
import { FileText, SlidersHorizontal, Check, ArrowDownUp, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useDispensaryWorkspace, QueueSortOption } from '../hooks/useDispensaryWorkspace';

interface QueueHeaderProps {
  totalCount: number;
}

export const QueueHeader: React.FC<QueueHeaderProps> = ({ totalCount }) => {
  const {
    sortOrder,
    setSortOrder,
    filterUnavailableOnly,
    setFilterUnavailableOnly,
    setStatusFilter,
    statusFilter,
  } = useDispensaryWorkspace();

  return (
    <div className="flex items-center justify-between border-b border-mint-400/15 pb-4">
      {/* Title with FileText Icon & Count Badge */}
      <div className="flex items-center gap-2.5">
        <FileText size={18} strokeWidth={1.75} className="text-mint-300" />
        <h2 className="font-sans text-[22px] font-semibold text-white tracking-tight leading-none">
          Prescriptions
        </h2>
        <span className="flex h-5 items-center justify-center rounded-full bg-emerald-500/20 px-2.5 text-xs font-semibold text-mint-300 ring-1 ring-mint-400/30">
          {totalCount}
        </span>
      </div>

      {/* Filter Menu Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-mint-400/20 bg-bg-1/40 text-emerald-200/70 hover:border-mint-400/40 hover:bg-bg-1/70 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
            aria-label="Filter and Sort Prescriptions"
          >
            <SlidersHorizontal size={18} strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 border-mint-400/30 bg-bg-1/95 p-1.5 backdrop-blur-xl shadow-2xl">
          <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-mint-300">
            Sort Prescriptions
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => setSortOrder('newest')}
            className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-cream-from hover:bg-mint-400/15"
          >
            <span>Newest first</span>
            {sortOrder === 'newest' && <Check size={14} className="text-mint-300" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setSortOrder('oldest')}
            className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-cream-from hover:bg-mint-400/15"
          >
            <span>Oldest first</span>
            {sortOrder === 'oldest' && <Check size={14} className="text-mint-300" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setSortOrder('urgent')}
            className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-cream-from hover:bg-mint-400/15"
          >
            <span>Urgent priority</span>
            {sortOrder === 'urgent' && <Check size={14} className="text-mint-300" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 border-t border-mint-400/15" />

          <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-mint-300">
            Stock Filters
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => setFilterUnavailableOnly((prev: boolean) => !prev)}
            className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-cream-from hover:bg-mint-400/15"
          >
            <span className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-400" />
              <span>Unavailable stock</span>
            </span>
            {filterUnavailableOnly && <Check size={14} className="text-mint-300" />}
          </DropdownMenuItem>

          {(statusFilter !== 'ALL' || filterUnavailableOnly || sortOrder !== 'newest') && (
            <>
              <DropdownMenuSeparator className="my-1 border-t border-mint-400/15" />
              <DropdownMenuItem
                onClick={() => {
                  setStatusFilter('ALL');
                  setFilterUnavailableOnly(false);
                  setSortOrder('newest');
                }}
                className="cursor-pointer text-center text-xs text-emerald-200/60 hover:text-white justify-center"
              >
                Reset filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default QueueHeader;

