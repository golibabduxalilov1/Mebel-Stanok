import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { schedulesService } from './schedules.service';

export const schedulesController = {
  listForMachine: asyncHandler(async (req: Request, res: Response) => {
    res.json(await schedulesService.listForMachine(req.params.machineId));
  }),
  listAll: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await schedulesService.listAll());
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await schedulesService.create(req.body, { userId: req.user!.sub }));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await schedulesService.update(req.params.id, req.body, { userId: req.user!.sub }));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await schedulesService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
