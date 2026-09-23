import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { machinesController } from './machines.controller';
import { createMachineSchema, listMachinesQuerySchema, machineIdParamsSchema, updateMachineSchema } from './machines.schema';
import { attachmentsRouter } from '../attachments/attachments.routes';

export const machinesRouter = Router();

machinesRouter.use(requireAuth);

machinesRouter.get('/', validate(listMachinesQuerySchema, 'query'), machinesController.list);
machinesRouter.get('/:id', validate(machineIdParamsSchema, 'params'), machinesController.getById);
machinesRouter.post('/', requirePermission('machines.catalog', 'create'), validate(createMachineSchema), machinesController.create);
machinesRouter.put(
  '/:id',
  validate(machineIdParamsSchema, 'params'),
  requirePermission('machines.catalog', 'edit'),
  validate(updateMachineSchema),
  machinesController.update
);
machinesRouter.delete(
  '/:id',
  validate(machineIdParamsSchema, 'params'),
  requirePermission('machines.catalog', 'delete'),
  machinesController.remove
);

machinesRouter.use('/:machineId/attachments', attachmentsRouter);
