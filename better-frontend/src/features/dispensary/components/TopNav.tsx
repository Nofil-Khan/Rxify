import * as React from 'react';
import BrandLogo from './BrandLogo';
import NavTabs from './NavTabs';
import SearchCommandPalette from './SearchCommandPalette';
import NotificationBell from './NotificationBell';
import UserMenuDropdown from './UserMenuDropdown';

export const TopNav: React.FC = () => {
  return (
    <header
      className="sticky top-0 z-40 flex h-[76px] w-full shrink-0 items-center justify-between border-b border-mint-400/10 bg-bg-0/40 px-14 backdrop-blur-md select-none"
      data-testid="slot-top-nav"
      aria-label="Dispensary Workspace Top Navigation"
    >
      {/* Left: Brand Logo & Center-Left: Pill Nav Tabs */}
      <div className="flex items-center gap-10">
        <BrandLogo />
        <NavTabs />
      </div>

      {/* Right Controls: Search Pill, Notifications Bell, User Menu */}
      <div className="flex items-center gap-4">
        <SearchCommandPalette />
        <NotificationBell />
        <UserMenuDropdown />
      </div>
    </header>
  );
};

export default TopNav;
