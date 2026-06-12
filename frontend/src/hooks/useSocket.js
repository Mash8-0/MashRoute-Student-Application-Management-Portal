import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { toast } from '../components/ui/toast';

export const useSocket = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { setNotifications, notifications } = useUIStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = connectSocket(user);

    // ── Application events ──────────────────────────────────────
    socket.on('application:statusChanged', (data) => {
      toast.info(
        `Status updated: ${data.referenceNo}`,
        `${data.oldStatus?.replace(/_/g, ' ')} → ${data.newStatus?.replace(/_/g, ' ')}`
      );
      // Trigger a custom event so pages can refresh their data
      window.dispatchEvent(new CustomEvent('mashroute:statusChanged', { detail: data }));
    });

    socket.on('application:created', (data) => {
      window.dispatchEvent(new CustomEvent('mashroute:applicationCreated', { detail: data }));
    });

    socket.on('application:noteAdded', (data) => {
      window.dispatchEvent(new CustomEvent('mashroute:noteAdded', { detail: data }));
    });

    // ── Notification events ─────────────────────────────────────
    socket.on('notification:new', (notification) => {
      setNotifications([notification, ...notifications]);
      toast.info(notification.title, notification.message);
    });

    return () => {
      socket.off('application:statusChanged');
      socket.off('application:created');
      socket.off('application:noteAdded');
      socket.off('notification:new');
    };
  }, [isAuthenticated, user?.id]);

  // Disconnect on logout
  useEffect(() => {
    if (!isAuthenticated) disconnectSocket();
  }, [isAuthenticated]);
};
