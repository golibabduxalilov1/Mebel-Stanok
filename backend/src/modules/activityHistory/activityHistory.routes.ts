import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { activityHistoryController } from './activityHistory.controller';
import { listActivityQuerySchema } from './activityHistory.schema';

export const activityHistoryRouter = Router();
activityHistoryRouter.use(requireAuth);
activityHistoryRouter.get(
  '/',
  requirePermission('history.activity_log', 'view'),
  validate(listActivityQuerySchema, 'query'),
  activityHistoryController.list
);
