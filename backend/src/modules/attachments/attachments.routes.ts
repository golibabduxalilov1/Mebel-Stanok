import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { env } from '../../env';
import { attachmentsController } from './attachments.controller';
import { addLinkSchema, updateAttachmentSchema, uploadAttachmentSchema } from './attachments.schema';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_BYTES } });
const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

/** Mounted at /api/v1/machines/:machineId/attachments */
export const attachmentsRouter = Router({ mergeParams: true });
attachmentsRouter.use(requireAuth);
attachmentsRouter.get('/', requirePermission('machines.files', 'view'), attachmentsController.listForMachine);
attachmentsRouter.post(
  '/',
  requirePermission('machines.files', 'create'),
  uploadFields,
  validate(uploadAttachmentSchema),
  attachmentsController.upload
);
attachmentsRouter.post(
  '/link',
  requirePermission('machines.files', 'create'),
  validate(addLinkSchema),
  attachmentsController.addLink
);

/** Mounted at /api/v1/attachments */
export const attachmentsStandaloneRouter = Router();
attachmentsStandaloneRouter.use(requireAuth);
attachmentsStandaloneRouter.get('/:id/download', requirePermission('machines.files', 'view'), attachmentsController.download);
attachmentsStandaloneRouter.get('/:id/thumbnail', requirePermission('machines.files', 'view'), attachmentsController.downloadThumbnail);
attachmentsStandaloneRouter.patch(
  '/:id',
  requirePermission('machines.files', 'edit'),
  validate(updateAttachmentSchema),
  attachmentsController.update
);
attachmentsStandaloneRouter.delete('/:id', requirePermission('machines.files', 'delete'), attachmentsController.remove);
