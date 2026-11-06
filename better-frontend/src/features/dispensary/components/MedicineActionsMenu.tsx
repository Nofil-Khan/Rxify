import * as React from 'react';
import {
  MoreHorizontal,
  Settings2,
  Stethoscope,
  ArrowLeftRight,
  PackageCheck,
  Layers,
} from 'lucide-react';
import { WorkspaceMedicine } from '../types';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface MedicineActionsMenuProps {
  medicine: WorkspaceMedicine;
}

export const MedicineActionsMenu: React.FC<MedicineActionsMenuProps> = ({ medicine }) => {
  const { openAdjustModal, openReconsultModal } = useDispensaryWorkspace();

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-muted hover:bg-ink/5 hover:text-ink transition-colors focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none cursor-pointer"
            aria-label={`Actions for ${medicine.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 bg-white text-ink border border-ink/15 shadow-2xl p-1.5 rounded-2xl"
        >
          <DropdownMenuItem
            onClick={() => openAdjustModal(medicine)}
            className="flex items-center gap-2.5 text-xs text-ink hover:bg-emerald-50 hover:text-emerald-800 rounded-xl px-2.5 py-2 cursor-pointer font-medium"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
            <span>Substitute Medicine</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2.5 text-xs text-ink hover:bg-emerald-50 hover:text-emerald-800 rounded-xl px-2.5 py-2 cursor-pointer font-medium">
            <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Reserve Stock</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2.5 text-xs text-ink hover:bg-emerald-50 hover:text-emerald-800 rounded-xl px-2.5 py-2 cursor-pointer font-medium">
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            <span>View Batches</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-ink/10 my-1" />
          <DropdownMenuItem
            onClick={() => openAdjustModal(medicine)}
            className="flex items-center gap-2.5 text-xs text-ink hover:bg-amber-50 hover:text-amber-800 rounded-xl px-2.5 py-2 cursor-pointer font-medium"
          >
            <Settings2 className="h-3.5 w-3.5 text-amber-600" />
            <span>Adjust Fulfillment</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openReconsultModal(medicine)}
            className="flex items-center gap-2.5 text-xs text-ink hover:bg-purple-50 hover:text-purple-800 rounded-xl px-2.5 py-2 cursor-pointer font-medium"
          >
            <Stethoscope className="h-3.5 w-3.5 text-purple-600" />
            <span>Flag Reconsultation</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default MedicineActionsMenu;

