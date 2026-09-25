import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { actorIsAdmin, requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { isAdminRole } from '../../config/permissions';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../utils/errors';
import { usersController } from './users.controller';
import { createUserSchema, updatePasswordSchema, updateUserSchema } from './users.schema';

/**
 * A non-admin granted users.* rights in the role matrix still can't touch administrator
 * accounts or hand out the administrator role - otherwise those rights would be a
 * one-step path to full admin.
 */
async function protectAdminAccounts(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (await actorIsAdmin(req)) return next();

    if (typeof req.body?.roleId === 'string') {
      const role = await prisma.role.findUnique({ where: { id: req.body.roleId }, select: { id: true, name: true } });
      if (isAdminRole(role)) return next(Errors.forbidden('Only an administrator can assign the administrator role'));
    }
    if (req.params.id) {
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { role: { select: { id: true, name: true } } },
      });
      if (isAdminRole(target?.role)) return next(Errors.forbidden('Only an administrator can modify administrator accounts'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Reading the user list is needed broadly (technician pickers, tab counts), so it
// stays open to every authenticated user; mutations follow the role matrix.
usersRouter.get('/', usersController.list);
usersRouter.post('/', requirePermission('users.user_list', 'create'), protectAdminAccounts, validate(createUserSchema), usersController.create);
usersRouter.put('/:id', requirePermission('users.user_list', 'edit'), protectAdminAccounts, validate(updateUserSchema), usersController.update);
usersRouter.patch(
  '/:id/password',
  requirePermission('users.credentials', 'edit'),
  protectAdminAccounts,
  validate(updatePasswordSchema),
  usersController.updatePassword
);
usersRouter.delete('/:id', requirePermission('users.user_list', 'delete'), protectAdminAccounts, usersController.remove);
