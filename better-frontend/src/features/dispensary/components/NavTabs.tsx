import * as React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { LayoutGrid, ClipboardList, FileText, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Workspace', to: '/workspace', icon: LayoutGrid },
  { name: 'Inventory', to: '/inventory', icon: ClipboardList },
  { name: 'Orders', to: '/orders', icon: FileText },
  { name: 'Analytics', to: '/analytics', icon: TrendingUp },
];

export const NavTabs: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="flex items-center gap-1.5" aria-label="Main Navigation Tabs">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          location.pathname === item.to ||
          (item.to === '/workspace' && location.pathname === '/dispensary');

        return (
          <Link
            key={item.name}
            to={item.to}
            className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400 ${
              isActive
                ? 'text-white'
                : 'text-cream-to/70 hover:text-cream-from'
            }`}
            aria-label={`${item.name} tab`}
          >
            {isActive && (
              <motion.span
                layoutId="activeNavTab"
                className="absolute inset-0 rounded-full border border-mint-400/60 bg-gradient-to-r from-mint-400/25 to-emerald-500/20 backdrop-blur-md shadow-glow-mint"
                transition={{
                  type: 'spring',
                  stiffness: 450,
                  damping: 32,
                }}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon size={18} strokeWidth={1.75} className={isActive ? 'text-mint-300' : 'text-cream-to/60 group-hover:text-cream-from'} />
              <span>{item.name}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default NavTabs;

