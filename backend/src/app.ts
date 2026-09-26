import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { serializeDecimals } from './middleware/serializeDecimals';

import { authRouter } from './modules/auth/auth.routes';
import { machinesRouter } from './modules/machines/machines.routes';
import { attachmentsStandaloneRouter } from './modules/attachments/attachments.routes';
import { branchesRouter } from './modules/branches/branches.routes';
import { unitsRouter } from './modules/unitsOfMeasure/units.routes';
import { sparePartsRouter } from './modules/spareParts/spareParts.routes';
import { schedulesRouter, schedulesForMachineRouter } from './modules/schedules/schedules.routes';
import { transfersRouter, transfersForMachineRouter } from './modules/transfers/transfers.routes';
import { logsRouter, logsForMachineRouter } from './modules/logs/logs.routes';
import { activityHistoryRouter } from './modules/activityHistory/activityHistory.routes';
import { usersRouter } from './modules/users/users.routes';
import { rolesRouter } from './modules/roles/roles.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';

export function createApp() {
  const app = express();

  // The API is served over plain HTTP (no TLS termination), so helmet's default
  // CSP (which includes `upgrade-insecure-requests`) and COOP/origin-agent-cluster
  // headers make browsers try to upgrade requests to HTTPS and fail with
  // ERR_SSL_PROTOCOL_ERROR - e.g. opening an attachment's download URL.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
  }));
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  // Machines/logs/parts/schedules carry compressed base64 photo strings (imageUrl/imageUrls)
  // straight in the JSON body, so this needs more headroom than a typical API.
  app.use(express.json({ limit: '15mb' }));
  app.use(cookieParser());
  app.use(serializeDecimals);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/machines/:machineId/schedules', schedulesForMachineRouter);
  api.use('/machines/:machineId/transfers', transfersForMachineRouter);
  api.use('/machines/:machineId/logs', logsForMachineRouter);
  api.use('/machines', machinesRouter);
  api.use('/attachments', attachmentsStandaloneRouter);
  api.use('/branches', branchesRouter);
  api.use('/units-of-measure', unitsRouter);
  api.use('/spare-parts', sparePartsRouter);
  api.use('/schedules', schedulesRouter);
  api.use('/transfers', transfersRouter);
  api.use('/logs', logsRouter);
  api.use('/activity-history', activityHistoryRouter);
  api.use('/users', usersRouter);
  api.use('/roles', rolesRouter);
  api.use('/admin', adminRouter);
  api.use('/analytics', analyticsRouter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
