import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { usersService } from './users.service';

export const usersController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await usersService.list());
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await usersService.create(req.body, { userId: req.user!.sub }));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    res.json(await usersService.update(req.params.id, req.body, { userId: req.user!.sub }));
  }),
  updatePassword: asyncHandler(async (req: Request, res: Response) => {
    await usersService.updatePassword(req.params.id, req.body.password, { userId: req.user!.sub });
    res.status(204).send();
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await usersService.remove(req.params.id, { userId: req.user!.sub });
    res.status(204).send();
  }),
};
