import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getBranchScope } from '../../utils/branchScope';
import { machinesService } from './machines.service';

export const machinesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const machines = await machinesService.list(req.query as any, getBranchScope(req.user));
    res.json(machines);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const machine = await machinesService.getById(req.params.id, getBranchScope(req.user));
    res.json(machine);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const machine = await machinesService.create(req.body, { userId: req.user!.sub }, getBranchScope(req.user));
    res.status(201).json(machine);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const machine = await machinesService.update(req.params.id, req.body, { userId: req.user!.sub }, getBranchScope(req.user));
    res.json(machine);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await machinesService.remove(req.params.id, { userId: req.user!.sub }, getBranchScope(req.user));
    res.status(204).send();
  }),
};
