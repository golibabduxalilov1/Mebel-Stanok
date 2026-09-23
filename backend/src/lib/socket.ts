import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { env } from '../env';
import { verifyAccessToken } from '../utils/jwt';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  return io;
}

/**
 * Broadcasts a domain event to every connected, authenticated client.
 * Event names follow `${entity}:${action}`, e.g. "machine:created".
 */
export function emitEntity(entity: string, action: 'created' | 'updated' | 'deleted' | 'changed', payload: unknown): void {
  if (!io) return;
  io.emit(`${entity}:${action}`, payload);
}
