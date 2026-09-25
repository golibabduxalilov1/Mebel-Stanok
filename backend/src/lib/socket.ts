import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { env } from '../env';
import { verifyAccessToken } from '../utils/jwt';
import { getBranchScope } from '../utils/branchScope';

let io: Server | null = null;

/** Room for users who see every branch (admins, users without a branch restriction). */
const ALL_BRANCHES_ROOM = 'branch:*';
const branchRoom = (branchId: string) => `branch:${branchId}`;

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

  io.on('connection', (socket) => {
    const scope = getBranchScope(socket.data.user);
    if (scope) {
      scope.forEach((branchId) => socket.join(branchRoom(branchId)));
    } else {
      socket.join(ALL_BRANCHES_ROOM);
    }
  });

  return io;
}

/**
 * Broadcasts a domain event. Event names follow `${entity}:${action}`, e.g. "machine:created".
 * - `branchId` omitted: sent to every connected, authenticated client (entities not tied to a branch).
 * - `branchId` given (even null): sent only to unrestricted users and to users of that branch,
 *   so branch-restricted users never receive another branch's data.
 */
export function emitEntity(
  entity: string,
  action: 'created' | 'updated' | 'deleted' | 'changed',
  payload: unknown,
  branchId?: string | null
): void {
  if (!io) return;
  const event = `${entity}:${action}`;
  if (branchId === undefined) {
    io.emit(event, payload);
    return;
  }
  const rooms = branchId ? [ALL_BRANCHES_ROOM, branchRoom(branchId)] : [ALL_BRANCHES_ROOM];
  io.to(rooms).emit(event, payload);
}

/** Sends an event only to the users restricted to `branchId` (e.g. a machine leaving their branch). */
export function emitToBranchUsers(branchId: string | null | undefined, event: string, payload: unknown): void {
  if (!io || !branchId) return;
  io.to(branchRoom(branchId)).emit(event, payload);
}
