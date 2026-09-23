import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { transfersController } from './transfers.controller';
import { createTransferSchema } from './transfers.schema';

/** Mounted at /api/v1/machines/:machineId/transfers */
export const transfersForMachineRouter = Router({ mergeParams: true });
transfersForMachineRouter.use(requireAuth);
transfersForMachineRouter.get('/', transfersController.listForMachine);

/** Mounted at /api/v1/transfers */
export const transfersRouter = Router();
transfersRouter.use(requireAuth);
transfersRouter.post('/', requirePermission('machines.transfers', 'create'), validate(createTransferSchema), transfersController.create);
