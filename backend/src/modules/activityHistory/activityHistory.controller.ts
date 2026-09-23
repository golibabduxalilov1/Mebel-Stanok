import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { activityHistoryService } from './activityHistory.service';

export const activityHistoryController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json(await activityHistoryService.list(req.query as any));
  }),
};
