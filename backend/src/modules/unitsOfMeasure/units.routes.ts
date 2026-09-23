import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { unitsController } from './units.controller';
import { createUnitSchema, updateUnitSchema } from './units.schema';

export const unitsRouter = Router();
unitsRouter.use(requireAuth);

unitsRouter.get('/', unitsController.list);
unitsRouter.post('/', requirePermission('inventory.units', 'create'), validate(createUnitSchema), unitsController.create);
unitsRouter.put('/:id', requirePermission('inventory.units', 'edit'), validate(updateUnitSchema), unitsController.update);
unitsRouter.delete('/:id', requirePermission('inventory.units', 'delete'), unitsController.remove);
