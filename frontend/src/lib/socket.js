import { io } from 'socket.io-client';

// In production default to the page origin (Nginx proxies /socket.io to the
// backend), so live updates work even if VITE_SOCKET_URL wasn't set at build time.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

let socket = null;

export const getSocket = () => socket;

export const connectSocket = (user) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    // Join rooms
    if (user?.tenantId) socket.emit('join:tenant', user.tenantId);
    if (user?.id) socket.emit('join:user', user.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
