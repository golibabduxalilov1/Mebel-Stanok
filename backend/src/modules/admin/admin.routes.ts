import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { adminController } from './admin.controller';
import { clearDatabaseSchema } from './admin.schema';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.post('/clear-database', validate(clearDatabaseSchema), adminController.clearDatabase);
