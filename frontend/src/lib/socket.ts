import { io, type Socket } from 'socket.io-client';
import { apiClient, getAccessToken } from './apiClient';

const SOCKET_URL: string = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:4000';

let socket: Socket | null = null;
const readyListeners = new Set<(socket: Socket) => void>();

/** Opens (or reuses) the authenticated Socket.io connection used for live updates. */
export function connectSocket(token: string): Socket {
  if (socket) socket.disconnect();

  // auth as a callback so every reconnect (e.g. after a backend restart) sends the *current*
  // access token - a fixed `{ token }` goes stale after JWT_ACCESS_TTL and the server rejects it.
  const s = io(SOCKET_URL, {
    auth: (cb) => cb({ token: getAccessToken() ?? token }),
    transports: ['websocket', 'polling'],
  });
  socket = s;

  // A middleware rejection stops socket.io-client from reconnecting on its own, which would
  // silently freeze every socket-fed list (machines, branches, users, roles) until a page reload.
  s.on('connect_error', async (err) => {
    if (err.message !== 'unauthorized' || s !== socket) return;
    if (await apiClient.tryRefresh()) s.connect();
  });

  readyListeners.forEach((cb) => cb(s));
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

/**
 * Registers a callback that (re-)attaches event listeners every time a new socket
 * connects, including reconnects after re-login. Services that cache collections
 * (machineService, userService) call this once at module load time instead of
 * reaching for `getSocket()` directly, so listener attachment never races login.
 */
export function onSocketReady(cb: (socket: Socket) => void): () => void {
  readyListeners.add(cb);
  if (socket) cb(socket);
  return () => readyListeners.delete(cb);
}
