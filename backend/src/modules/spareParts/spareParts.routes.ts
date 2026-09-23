import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { sparePartsController } from './spareParts.controller';
import { createSparePartSchema, updateQuantitySchema, updateSparePartSchema } from './spareParts.schema';

export const sparePartsRouter = Router();
sparePartsRouter.use(requireAuth);

sparePartsRouter.get('/', sparePartsController.list);
sparePartsRouter.post('/', requirePermission('inventory.parts_catalog', 'create'), validate(createSparePartSchema), sparePartsController.create);
sparePartsRouter.put('/:id', requirePermission('inventory.parts_catalog', 'edit'), validate(updateSparePartSchema), sparePartsController.update);
sparePartsRouter.patch(
  '/:id/quantity',
  requirePermission('inventory.parts_catalog', 'edit'),
  validate(updateQuantitySchema),
  sparePartsController.updateQuantity
);
sparePartsRouter.delete('/:id', requirePermission('inventory.parts_catalog', 'delete'), sparePartsController.remove);
