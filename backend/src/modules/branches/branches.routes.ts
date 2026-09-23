import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { branchesController } from './branches.controller';
import { createBranchSchema, updateBranchSchema } from './branches.schema';

export const branchesRouter = Router();
branchesRouter.use(requireAuth);

branchesRouter.get('/', branchesController.list);
branchesRouter.post('/', requirePermission('branches.branch_list', 'create'), validate(createBranchSchema), branchesController.create);
branchesRouter.put('/:id', requirePermission('branches.branch_list', 'edit'), validate(updateBranchSchema), branchesController.update);
branchesRouter.delete('/:id', requirePermission('branches.branch_list', 'delete'), branchesController.remove);
