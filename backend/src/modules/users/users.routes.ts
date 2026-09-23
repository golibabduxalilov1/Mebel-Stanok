import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { usersController } from './users.controller';
import { createUserSchema, updatePasswordSchema, updateUserSchema } from './users.schema';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Reading the user list is needed broadly (technician pickers, tab counts), not just by admins.
// Only mutations are admin-gated - matches how the users collection was actually used before.
usersRouter.get('/', usersController.list);
usersRouter.post('/', requireAdmin, validate(createUserSchema), usersController.create);
usersRouter.put('/:id', requireAdmin, validate(updateUserSchema), usersController.update);
usersRouter.patch('/:id/password', requireAdmin, validate(updatePasswordSchema), usersController.updatePassword);
usersRouter.delete('/:id', requireAdmin, usersController.remove);
