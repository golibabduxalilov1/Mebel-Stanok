import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { Errors } from '../../utils/errors';
import { storage } from '../../lib/storage';
import { attachmentsService } from './attachments.service';

// The stored file has no persisted mime type, so the download/thumbnail routes
// derive one from the original filename's extension. Without a Content-Type
// header, the frontend's blob-based inline preview (e.g. embedding a PDF in an
// <iframe>) can't be recognized by the browser and falls back to a raw text dump.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
};

function mimeTypeFor(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return EXTENSION_MIME_TYPES[ext] || 'application/octet-stream';
}

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

  update: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await attachmentsService.updateMeta(req.params.id, req.body, { userId: req.user!.sub });
    res.json(attachment);
  }),

  download: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await attachmentsService.getForDownload(req.params.id);
    res.setHeader('Content-Type', mimeTypeFor(attachment.name));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.name)}"`);
    storage.createReadStream(attachment.storageKey).pipe(res);
  }),

  downloadThumbnail: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await attachmentsService.getForThumbnail(req.params.id);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent('thumb-' + attachment.name)}"`);
    storage.createReadStream(attachment.thumbnailKey!).pipe(res);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await attachmentsService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
