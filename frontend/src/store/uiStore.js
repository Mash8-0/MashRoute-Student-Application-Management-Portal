import { create } from 'zustand';

// Read the persisted theme (falls back to OS preference, then light).
const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('mashroute-theme');
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

// Apply / persist the `dark` class on <html> so every page (including public
// landing & signup) reacts to the same theme.
export const applyTheme = (dark) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('mashroute-theme', dark ? 'dark' : 'light');
};

const initialDarkMode = getInitialDarkMode();
// Apply immediately on load so there is no flash of the wrong theme.
applyTheme(initialDarkMode);

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  darkMode: initialDarkMode,
  notifications: [],
  unreadCount: 0,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleDarkMode: () =>
    set((state) => {
      const darkMode = !state.darkMode;
      applyTheme(darkMode);
      return { darkMode };
    }),
  setDarkMode: (darkMode) => {
    applyTheme(darkMode);
    set({ darkMode });
  },

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
}));
