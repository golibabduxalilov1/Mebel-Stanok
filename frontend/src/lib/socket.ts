import { io, type Socket } from 'socket.io-client';

const SOCKET_URL: string = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:4000';

let socket: Socket | null = null;
const readyListeners = new Set<(socket: Socket) => void>();

/** Opens (or reuses) the authenticated Socket.io connection used for live updates. */
export function connectSocket(token: string): Socket {
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  readyListeners.forEach((cb) => cb(socket!));
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
