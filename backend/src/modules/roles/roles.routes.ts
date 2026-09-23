import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { rolesController } from './roles.controller';
import { createRoleSchema, updateRoleSchema } from './roles.schema';

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

// Every authenticated user needs to read the role list (permission lookups, role
// dropdowns); only mutating the roles/permission matrix is admin-gated.
rolesRouter.get('/', rolesController.list);
rolesRouter.post('/', requireAdmin, validate(createRoleSchema), rolesController.create);
rolesRouter.put('/:id', requireAdmin, validate(updateRoleSchema), rolesController.update);
rolesRouter.delete('/:id', requireAdmin, rolesController.remove);
