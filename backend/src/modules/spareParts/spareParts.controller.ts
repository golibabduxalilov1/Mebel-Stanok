import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sparePartsService } from './spareParts.service';

export const sparePartsController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await sparePartsService.list());
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await sparePartsService.create(req.body, { userId: req.user!.sub }));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await sparePartsService.update(req.params.id, req.body, { userId: req.user!.sub }));
  }),
  updateQuantity: asyncHandler(async (req: Request, res: Response) => {
    res.json(await sparePartsService.updateQuantity(req.params.id, req.body.quantity, { userId: req.user!.sub }));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await sparePartsService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
