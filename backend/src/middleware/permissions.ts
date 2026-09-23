import type { NextFunction, Request, Response } from 'express';
import { ADMIN_ROLE_ID, canPerformAction, type PermissionAction, type PermissionMatrixItem } from '../config/permissions';
import { Errors } from '../utils/errors';

/**
 * Requires the authenticated user's role to grant `action` on `rowKey`
 * (e.g. requirePermission('machines.catalog', 'create')). Must run after requireAuth.
 * Permissions are read straight from the access token, which is minted from the
 * user's role at login/refresh time - identical semantics to canPerformAction()
 * on the frontend, just enforced here instead of only in the UI.
 */
export function requirePermission(rowKey: string, action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(Errors.unauthorized());

    const role = {
      id: req.user.roleId ?? '',
      name: req.user.roleName ?? '',
      permissions: (req.user.permissions ?? {}) as Record<string, PermissionMatrixItem>,
    };

    if (canPerformAction(role, rowKey, action)) return next();
    next(Errors.forbidden());
  };
}

/** Shortcut for routes only the admin role may use (user/role management, DB clear). */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(Errors.unauthorized());
  const isAdmin = req.user.isAdmin || req.user.roleId === ADMIN_ROLE_ID;
  if (!isAdmin) return next(Errors.forbidden('Administrator role required'));
  next();
}
