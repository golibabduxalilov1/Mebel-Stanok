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

  // Trust the first proxy hop so express-rate-limit reads the real client IP
  // from X-Forwarded-For instead of the proxy's address.
  app.set('trust proxy', 1);

  // The API runs over plain HTTP (no TLS termination).
  // crossOriginOpenerPolicy, crossOriginResourcePolicy, originAgentCluster remain disabled:
  // enabling them over HTTP causes ERR_SSL_PROTOCOL_ERROR when browsers follow
  // attachment download/inline URLs served from the same origin.
  app.use(helmet({
    contentSecurityPolicy: {
      // useDefaults: false so we can omit upgrade-insecure-requests entirely
      // (the directive would force browsers to HTTPS, breaking plain-HTTP deploys).
      useDefaults: false,
      directives: {
        defaultSrc:     ["'self'"],
        baseUri:        ["'self'"],
        fontSrc:        ["'self'", "https:", "data:"],
        formAction:     ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc:         ["'self'", "data:", "blob:"],
        mediaSrc:       ["'self'", "blob:"],
        objectSrc:      ["'none'"],
        scriptSrc:      ["'self'"],
        scriptSrcAttr:  ["'none'"],
        styleSrc:       ["'self'", "https:", "'unsafe-inline'"],
        // blob: and ws:/wss: for Socket.IO real-time connection
        connectSrc:     ["'self'", "ws:", "wss:", "blob:"],
        workerSrc:      ["'self'", "blob:"],
      },
    },
    crossOriginOpenerPolicy:  false,
    crossOriginResourcePolicy: false,
    originAgentCluster:       false,
  }));
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(serializeDecimals);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Routes that embed compressed base64 image strings in the JSON body get a higher limit.
  // Everything else is capped at 1 mb to reduce the blast radius of a malformed-payload attack.
  const bigJson = express.json({ limit: '15mb' });
  const stdJson = express.json({ limit: '1mb' });

  const api = express.Router();
  api.use('/auth', stdJson, authRouter);
  api.use('/machines/:machineId/schedules', bigJson, schedulesForMachineRouter);
  api.use('/machines/:machineId/transfers', bigJson, transfersForMachineRouter);
  api.use('/machines/:machineId/logs', bigJson, logsForMachineRouter);
  api.use('/machines', bigJson, machinesRouter);
  api.use('/attachments', stdJson, attachmentsStandaloneRouter);
  api.use('/branches', stdJson, branchesRouter);
  api.use('/units-of-measure', stdJson, unitsRouter);
  api.use('/spare-parts', bigJson, sparePartsRouter);
  api.use('/schedules', bigJson, schedulesRouter);
  api.use('/transfers', bigJson, transfersRouter);
  api.use('/logs', bigJson, logsRouter);
  api.use('/activity-history', stdJson, activityHistoryRouter);
  api.use('/users', stdJson, usersRouter);
  api.use('/roles', stdJson, rolesRouter);
  api.use('/admin', stdJson, adminRouter);
  api.use('/analytics', stdJson, analyticsRouter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
