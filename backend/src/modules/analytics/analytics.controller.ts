import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getBranchScope } from '../../utils/branchScope';
import { analyticsService } from './analytics.service';

export const analyticsController = {
  transfers: asyncHandler(async (req: Request, res: Response) => {
    res.json(await analyticsService.transfers(req.query as any, getBranchScope(req.user)));
  }),
  reservations: asyncHandler(async (req: Request, res: Response) => {
    res.json(await analyticsService.reservations(req.query as any, getBranchScope(req.user)));
  }),
  usersActivity: asyncHandler(async (req: Request, res: Response) => {
    res.json(await analyticsService.usersActivity(req.query as any, getBranchScope(req.user)));
  }),
  attachmentsSummary: asyncHandler(async (req: Request, res: Response) => {
    res.json(await analyticsService.attachmentsSummary(req.query as any, getBranchScope(req.user)));
  }),
};
