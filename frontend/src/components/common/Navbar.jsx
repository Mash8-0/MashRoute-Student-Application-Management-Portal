import { useState, useEffect } from 'react';
import { Bell, Search, Sun, Moon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { analyticsAPI } from '../../api/endpoints';
import { getInitials, timeAgo } from '../../lib/utils';
import { Button } from '../ui/button';
import { toast } from '../ui/toast';

export default function Navbar() {
  const { user } = useAuthStore();
  const { darkMode, toggleDarkMode, unreadCount, setNotifications, notifications, markNotificationRead, markAllRead } = useUIStore();
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await analyticsAPI.notifications();
        setNotifications(res.data.data || []);
      } catch {}
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await analyticsAPI.markNotificationRead(id);
      markNotificationRead(id);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await analyticsAPI.markAllRead();
      markAllRead();
    } catch {}
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Search */}
      <div className="relative hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          className="h-9 w-64 rounded-lg border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Dark mode */}
        <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="h-9 w-9">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl border border-border bg-card shadow-premium overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">No notifications</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => !n.isRead && handleMarkRead(n.id)}
                          className={`flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent cursor-pointer border-b border-border last:border-0 ${!n.isRead ? 'bg-primary/5' : ''}`}
                        >
                          {!n.isRead && <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />}
                          <div className={!n.isRead ? '' : 'pl-3'}>
                            <p className="font-medium text-xs">{n.title}</p>
                            <p className="text-xs text-muted-foreground">{n.message}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {getInitials(`${user?.firstName} ${user?.lastName}`)}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-muted-foreground">{user?.tenant?.name || 'Super Admin'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
