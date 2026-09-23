import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authService } from './auth.service';

const REFRESH_COOKIE = 'refreshToken';

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { accessToken, refreshToken, user } = await authService.login(req.body);
    res.cookie(REFRESH_COOKIE, refreshToken, authService.refreshCookieOptions());
    res.json({ accessToken, user });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { accessToken, refreshToken } = await authService.refresh(req.cookies?.[REFRESH_COOKIE]);
    res.cookie(REFRESH_COOKIE, refreshToken, authService.refreshCookieOptions());
    res.json({ accessToken });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.status(204).send();
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.sub);
    res.json(user);
  }),
};
