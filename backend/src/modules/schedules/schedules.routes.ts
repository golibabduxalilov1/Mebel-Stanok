import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { requireMachineParamInScope } from '../../utils/branchScope';
import { validate } from '../../middleware/validate';
import { schedulesController } from './schedules.controller';
import { createScheduleSchema, updateScheduleSchema } from './schedules.schema';

/** Mounted at /api/v1/machines/:machineId/schedules */
export const schedulesForMachineRouter = Router({ mergeParams: true });
schedulesForMachineRouter.use(requireAuth);
schedulesForMachineRouter.use(requireMachineParamInScope);
schedulesForMachineRouter.get('/', schedulesController.listForMachine);

/** Mounted at /api/v1/schedules */
export const schedulesRouter = Router();
schedulesRouter.use(requireAuth);
schedulesRouter.get('/', schedulesController.listAll);
schedulesRouter.post('/', requirePermission('maintenance.schedules', 'create'), validate(createScheduleSchema), schedulesController.create);
schedulesRouter.put('/:id', requirePermission('maintenance.schedules', 'edit'), validate(updateScheduleSchema), schedulesController.update);
schedulesRouter.delete('/:id', requirePermission('maintenance.schedules', 'delete'), schedulesController.remove);
