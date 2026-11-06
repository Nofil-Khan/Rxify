import * as React from 'react';
import { ChevronDown, User, Building2, LogOut, Home, Hospital } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export const UserMenuDropdown: React.FC = () => {
  const { displayName, username, clearAuth } = useAuthStore();
  const pharmacyName = displayName || username || 'City Care Pharmacy';
  const initials = pharmacyName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'CP';

  const handleSignOut = () => {
    clearAuth();
    localStorage.removeItem('rxify_token');
    window.location.href = '/login';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-10 items-center gap-3 rounded-full border border-mint-400/20 bg-bg-0/50 py-1 pl-1.5 pr-4 text-left backdrop-blur-md transition-all hover:border-mint-400/40 hover:bg-bg-0/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
          aria-label={`User Account Menu for ${pharmacyName}`}
        >
          {/* Circular CP Avatar */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cream-from font-sans text-xs font-bold text-ink shadow-sm">
            {initials}
          </div>
          <span className="font-sans text-xs font-medium text-cream-from group-hover:text-white">
            {pharmacyName}
          </span>
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            className="text-cream-to/50 transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 border-mint-400/30 bg-bg-1/95 p-1.5 shadow-2xl backdrop-blur-xl">
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-cream-from hover:bg-mint-400/15 focus:bg-mint-400/20 focus:text-white"
          onClick={() => {}}
        >
          <User size={18} strokeWidth={1.75} className="text-mint-300" />
          <span>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-cream-from hover:bg-mint-400/15 focus:bg-mint-400/20 focus:text-white"
          onClick={() => {}}
        >
          <Building2 size={18} strokeWidth={1.75} className="text-mint-300" />
          <span>Switch branch</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-t border-mint-400/15" />

        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-cream-from hover:bg-mint-400/15 focus:bg-mint-400/20 focus:text-white"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          <Home size={18} strokeWidth={1.75} className="text-mint-300" />
          <span>Landing Page</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-cream-from hover:bg-mint-400/15 focus:bg-mint-400/20 focus:text-white"
          onClick={() => {
            window.location.href = '/hospital/login';
          }}
        >
          <Hospital size={18} strokeWidth={1.75} className="text-mint-300" />
          <span>Hospital Portal</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-t border-mint-400/15" />

        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-red-400 hover:bg-red-500/15 focus:bg-red-500/20 focus:text-red-300"
          onClick={handleSignOut}
        >
          <LogOut size={18} strokeWidth={1.75} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenuDropdown;

