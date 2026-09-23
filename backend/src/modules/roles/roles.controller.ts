import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { rolesService } from './roles.service';

export const rolesController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await rolesService.list());
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await rolesService.create(req.body, { userId: req.user!.sub }));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await rolesService.update(req.params.id, req.body, { userId: req.user!.sub }));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await rolesService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
