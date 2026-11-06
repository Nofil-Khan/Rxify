import * as React from 'react';
import { Bell } from 'lucide-react';

export const NotificationBell: React.FC = () => {
  return (
    <button
      type="button"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-mint-400/20 bg-bg-0/50 text-cream-from/80 backdrop-blur-md transition-all hover:border-mint-400/40 hover:bg-bg-0/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
      aria-label="Notifications, 1 unread"
    >
      <Bell size={18} strokeWidth={1.75} />
      {/* Green Notification Dot */}
      <span
        className="absolute top-2 right-2 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-mint-400 shadow-glow-mint ring-2 ring-bg-0"
        aria-hidden="true"
      />
    </button>
  );
};

export default NotificationBell;

