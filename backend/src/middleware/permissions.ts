import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  ADMIN_ROLE_ID,
  canPerformAction,
  createFullPermissions,
  isAdminRole,
  normalizePermissions,
  type PermissionAction,
  type PermissionMatrixItem,
} from '../config/permissions';
import { isEnvSuperadmin } from '../config/superadmin';
import { Errors } from '../utils/errors';

interface ActorRole {
  id: string;
  name: string;
  permissions: Record<string, PermissionMatrixItem>;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      actorRole?: ActorRole;
    }
  }
}

/**
 * The authenticated user's role as it is in the DB right now. Permissions are not
 * read from the access token: that is minted at login/refresh, so a role edit would
 * otherwise only apply after the token expires, while the UI (which reads live roles)
 * already shows the new rights. Cached on the request. Must run after requireAuth.
 */
async function loadActorRole(req: Request): Promise<ActorRole> {
  if (req.actorRole) return req.actorRole;

  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { username: true, email: true, status: true, role: { select: { id: true, name: true, permissions: true } } },
  });
  if (!user) throw Errors.unauthorized('Account no longer active');

  // The .env superadmin always has every right, whatever its role/status say in the DB.
  if (isEnvSuperadmin(user)) {
    req.actorRole = { id: ADMIN_ROLE_ID, name: user.role?.name ?? '', permissions: createFullPermissions(), isAdmin: true };
    return req.actorRole;
  }
  if (user.status === 'blocked') throw Errors.unauthorized('Account no longer active');

  const role = user.role;
  req.actorRole = {
    id: role?.id ?? '',
    name: role?.name ?? '',
    permissions: normalizePermissions(role?.permissions),
    isAdmin: isAdminRole(role),
  };
  return req.actorRole;
}

/** Whether the authenticated user's current role is the administrator role. */
export async function actorIsAdmin(req: Request): Promise<boolean> {
  return (await loadActorRole(req)).isAdmin;
}

/**
 * Requires the authenticated user's role to grant at least one of the given
 * (rowKey, action) pairs - same semantics as canPerformAction() on the frontend.
 */
export function requireAnyPermission(checks: [rowKey: string, action: PermissionAction][]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(Errors.unauthorized());
    try {
      const role = await loadActorRole(req);
      if (checks.some(([rowKey, action]) => canPerformAction(role, rowKey, action))) return next();
      next(Errors.forbidden());
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Requires the authenticated user's role to grant `action` on `rowKey`
 * (e.g. requirePermission('machines.catalog', 'create')). Must run after requireAuth.
 */
export function requirePermission(rowKey: string, action: PermissionAction) {
  return requireAnyPermission([[rowKey, action]]);
}

/** Shortcut for routes only the admin role may use (DB clear). */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next(Errors.unauthorized());
  try {
    if (await actorIsAdmin(req)) return next();
    next(Errors.forbidden('Administrator role required'));
  } catch (err) {
    next(err);
  }
}
