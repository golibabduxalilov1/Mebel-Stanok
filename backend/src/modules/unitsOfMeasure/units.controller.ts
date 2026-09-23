import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { unitsService } from './units.service';

export const unitsController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await unitsService.list());
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await unitsService.create(req.body, { userId: req.user!.sub }));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await unitsService.update(req.params.id, req.body, { userId: req.user!.sub }));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await unitsService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
