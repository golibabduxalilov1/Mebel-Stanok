import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getBranchScope } from '../../utils/branchScope';
import { logsService } from './logs.service';

export const logsController = {
  listForMachine: asyncHandler(async (req: Request, res: Response) => {
    res.json(await logsService.listForMachine(req.params.machineId));
  }),
  listAll: asyncHandler(async (req: Request, res: Response) => {
    res.json(await logsService.listAll(getBranchScope(req.user)));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await logsService.create(req.body, { userId: req.user!.sub }, getBranchScope(req.user)));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await logsService.update(req.params.id, req.body, { userId: req.user!.sub }, getBranchScope(req.user)));
  }),
  complete: asyncHandler(async (req: Request, res: Response) => {
    res.json(await logsService.complete(req.params.id, { userId: req.user!.sub }, getBranchScope(req.user)));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await logsService.remove(req.params.id, { userId: req.user!.sub }, getBranchScope(req.user));
    res.status(204).send();
  }),
};
