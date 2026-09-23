import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { branchesService } from './branches.service';

export const branchesController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await branchesService.list());
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await branchesService.create(req.body, { userId: req.user!.sub }));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await branchesService.update(req.params.id, req.body, { userId: req.user!.sub }));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await branchesService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
