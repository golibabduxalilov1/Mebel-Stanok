import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getBranchScope } from '../../utils/branchScope';
import { schedulesService } from './schedules.service';

export const schedulesController = {
  listForMachine: asyncHandler(async (req: Request, res: Response) => {
    res.json(await schedulesService.listForMachine(req.params.machineId));
  }),
  listAll: asyncHandler(async (req: Request, res: Response) => {
    res.json(await schedulesService.listAll(getBranchScope(req.user)));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await schedulesService.create(req.body, { userId: req.user!.sub }, getBranchScope(req.user)));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await schedulesService.update(req.params.id, req.body, { userId: req.user!.sub }, getBranchScope(req.user)));
  }),
  execute: asyncHandler(async (req: Request, res: Response) => {
    res.json(await schedulesService.execute(req.params.id, req.body, { userId: req.user!.sub }, getBranchScope(req.user)));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await schedulesService.remove(req.params.id, { userId: req.user!.sub }, getBranchScope(req.user));
    res.status(204).send();
  }),
};
