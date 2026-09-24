import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { requireMachineParamInScope } from '../../utils/branchScope';
import { validate } from '../../middleware/validate';
import { logsController } from './logs.controller';
import { createLogSchema, updateLogSchema } from './logs.schema';

/** Mounted at /api/v1/machines/:machineId/logs */
export const logsForMachineRouter = Router({ mergeParams: true });
logsForMachineRouter.use(requireAuth);
logsForMachineRouter.use(requireMachineParamInScope);
logsForMachineRouter.get('/', logsController.listForMachine);

/** Mounted at /api/v1/logs */
export const logsRouter = Router();
logsRouter.use(requireAuth);
logsRouter.get('/', logsController.listAll);
logsRouter.post('/', requirePermission('maintenance.logs', 'create'), validate(createLogSchema), logsController.create);
logsRouter.put('/:id', requirePermission('maintenance.logs', 'edit'), validate(updateLogSchema), logsController.update);
logsRouter.delete('/:id', requirePermission('maintenance.logs', 'delete'), logsController.remove);
