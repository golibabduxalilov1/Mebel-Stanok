import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { adminService } from './admin.service';

export const adminController = {
  clearDatabase: asyncHandler(async (req: Request, res: Response) => {
    await adminService.clearDatabase(req.body.password, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
