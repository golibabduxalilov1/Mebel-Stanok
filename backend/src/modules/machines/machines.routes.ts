import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAnyPermission, requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { machinesController } from './machines.controller';
import { createMachineSchema, listMachinesQuerySchema, machineIdParamsSchema, updateMachineSchema } from './machines.schema';
import { attachmentsRouter } from '../attachments/attachments.routes';

/**
 * PUT /machines/:id serves several UI actions: editing the passport (catalog or cards
 * edit), and decommissioning, which only sends status 'retired' + a description note
 * and is governed by the machines.decommission row.
 */
const requireMachineEdit = requireAnyPermission([
  ['machines.catalog', 'edit'],
  ['machines.cards', 'edit'],
]);
const requireMachineEditOrDecommission = requireAnyPermission([
  ['machines.catalog', 'edit'],
  ['machines.cards', 'edit'],
  ['machines.decommission', 'create'],
  ['machines.decommission', 'edit'],
]);

function requireMachineUpdatePermission(req: Request, res: Response, next: NextFunction) {
  const body = req.body ?? {};
  const isDecommission = body.status === 'retired' && Object.keys(body).every((k) => k === 'status' || k === 'description');
  return (isDecommission ? requireMachineEditOrDecommission : requireMachineEdit)(req, res, next);
}

export const machinesRouter = Router();

machinesRouter.use(requireAuth);

machinesRouter.get('/', validate(listMachinesQuerySchema, 'query'), machinesController.list);
machinesRouter.get('/:id', validate(machineIdParamsSchema, 'params'), machinesController.getById);
machinesRouter.post('/', requirePermission('machines.catalog', 'create'), validate(createMachineSchema), machinesController.create);
machinesRouter.put(
  '/:id',
  validate(machineIdParamsSchema, 'params'),
  requireMachineUpdatePermission,
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
