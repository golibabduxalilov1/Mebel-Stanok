import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAnyPermission, requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { analyticsController } from './analytics.controller';
import {
  attachmentsSummaryQuerySchema,
  reservationsQuerySchema,
  transfersQuerySchema,
  usersActivityQuerySchema,
} from './analytics.schema';

const equipmentReports = requireAnyPermission([
  ['reports.equipment_report', 'view'],
  ['reports.summary_report', 'view'],
]);

/** Mounted at /api/v1/analytics - read-only aggregates for the "Отчеты" tab, all branch-scoped. */
export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.get('/transfers', equipmentReports, validate(transfersQuerySchema, 'query'), analyticsController.transfers);
analyticsRouter.get(
  '/reservations',
  requirePermission('reports.inventory_report', 'view'),
  validate(reservationsQuerySchema, 'query'),
  analyticsController.reservations
);
analyticsRouter.get(
  '/users-activity',
  requirePermission('history.activity_log', 'view'),
  validate(usersActivityQuerySchema, 'query'),
  analyticsController.usersActivity
);
analyticsRouter.get(
  '/attachments-summary',
  equipmentReports,
  validate(attachmentsSummaryQuerySchema, 'query'),
  analyticsController.attachmentsSummary
);
