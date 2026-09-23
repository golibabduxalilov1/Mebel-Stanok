import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { Errors } from '../../utils/errors';
import { storage } from '../../lib/storage';
import { attachmentsService } from './attachments.service';

export const attachmentsController = {
  listForMachine: asyncHandler(async (req: Request, res: Response) => {
    const attachments = await attachmentsService.listByMachine(req.params.machineId);
    res.json(attachments);
  }),

  upload: asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;
    const file = files?.file?.[0];
    if (!file) throw Errors.badRequest('A "file" field is required', 'FILE_REQUIRED');
    const thumbnail = files?.thumbnail?.[0];
    const attachment = await attachmentsService.upload(
      req.params.machineId,
      file,
      req.body,
      { userId: req.user!.sub },
      thumbnail ? { buffer: thumbnail.buffer, originalname: thumbnail.originalname } : undefined
    );
    res.status(201).json(attachment);
  }),

  addLink: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await attachmentsService.addLink(req.params.machineId, req.body, { userId: req.user!.sub });
    res.status(201).json(attachment);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await attachmentsService.updateMeta(req.params.id, req.body, { userId: req.user!.sub });
    res.json(attachment);
  }),

  download: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await attachmentsService.getForDownload(req.params.id);
    if (attachment.type === 'link') {
      res.redirect(302, attachment.storageKey);
      return;
    }
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.name)}"`);
    storage.createReadStream(attachment.storageKey).pipe(res);
  }),

  downloadThumbnail: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await attachmentsService.getForThumbnail(req.params.id);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent('thumb-' + attachment.name)}"`);
    storage.createReadStream(attachment.thumbnailKey!).pipe(res);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await attachmentsService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
