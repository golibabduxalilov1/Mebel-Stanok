import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { actorIsAdmin, requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { isAdminRole } from '../../config/permissions';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../utils/errors';
import { rolesController } from './roles.controller';
import { createRoleSchema, updateRoleSchema } from './roles.schema';

/**
 * A non-admin granted users.roles_matrix rights still can't edit/delete the administrator
 * role or name a role "Администратор" (the admin check also matches by name).
 */
async function protectAdminRole(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (await actorIsAdmin(req)) return next();

    if (typeof req.body?.name === 'string' && isAdminRole({ id: '', name: req.body.name })) {
      return next(Errors.forbidden('Only an administrator can create or rename a role to the administrator role'));
    }
    if (req.params.id) {
      const role = await prisma.role.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
      if (isAdminRole(role)) return next(Errors.forbidden('Only an administrator can modify the administrator role'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

// Every authenticated user needs to read the role list (permission lookups, role
// dropdowns); mutating the roles/permission matrix follows users.roles_matrix.
rolesRouter.get('/', rolesController.list);
rolesRouter.post('/', requirePermission('users.roles_matrix', 'create'), protectAdminRole, validate(createRoleSchema), rolesController.create);
rolesRouter.put('/:id', requirePermission('users.roles_matrix', 'edit'), protectAdminRole, validate(updateRoleSchema), rolesController.update);
rolesRouter.delete('/:id', requirePermission('users.roles_matrix', 'delete'), protectAdminRole, rolesController.remove);
