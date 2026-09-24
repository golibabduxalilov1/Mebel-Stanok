import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getBranchScope } from '../../utils/branchScope';
import { transfersService } from './transfers.service';

export const transfersController = {
  listForMachine: asyncHandler(async (req: Request, res: Response) => {
    res.json(await transfersService.listForMachine(req.params.machineId));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await transfersService.create(req.body, { userId: req.user!.sub }, getBranchScope(req.user)));
  }),
};
