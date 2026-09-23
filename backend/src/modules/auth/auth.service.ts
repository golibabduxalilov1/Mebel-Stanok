import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../env';
import { Errors } from '../../utils/errors';
import { sha256Hex } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken, type AccessTokenPayload } from '../../utils/jwt';
import { ADMIN_ROLE_ID } from '../../config/permissions';
import { writeActivityStandalone } from '../../utils/activityLog';
import type { LoginInput } from './auth.schema';

const userWithRole = { role: true } as const;

type UserWithRole = Prisma.UserGetPayload<{ include: typeof userWithRole }>;

function isAdminRole(role: UserWithRole['role']): boolean {
  if (!role) return false;
  return role.id === ADMIN_ROLE_ID || role.name.trim().toLowerCase() === 'администратор';
}

function buildAccessPayload(user: UserWithRole): AccessTokenPayload {
  return {
    sub: user.id,
    username: user.username,
    roleId: user.roleId,
    roleName: user.role?.name ?? null,
    branchId: user.branchId,
    permissions: (user.role?.permissions as Record<string, unknown>) ?? {},
    isAdmin: isAdminRole(user.role),
  };
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

async function issueRefreshToken(userId: string) {
  const jti = uuidv4();
  const token = signRefreshToken({ sub: userId, jti });
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { id: jti, userId, tokenHash: sha256Hex(token), expiresAt },
  });
  return token;
}

export const authService = {
  refreshCookieOptions,

  async login(input: LoginInput) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: input.usernameOrEmail }, { email: input.usernameOrEmail }],
      },
      include: userWithRole,
    });

    if (!user) throw Errors.invalidCredentials();
    if (user.status === 'blocked') throw Errors.forbidden('This account has been blocked');

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw Errors.invalidCredentials();

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const accessToken = signAccessToken(buildAccessPayload(user));
    const refreshToken = await issueRefreshToken(user.id);

    await writeActivityStandalone({
      actionType: 'other',
      entityType: 'user',
      entityId: user.id,
      entityName: user.fullName,
      details: `Вход в систему: ${user.username}`,
      userId: user.id,
      userEmail: user.email,
    });

    const { passwordHash: _omit, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  },

  async refresh(refreshTokenRaw: string | undefined) {
    if (!refreshTokenRaw) throw Errors.unauthorized('No refresh token provided');

    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenRaw);
    } catch {
      throw Errors.unauthorized('Invalid or expired refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.tokenHash !== sha256Hex(refreshTokenRaw)) {
      throw Errors.unauthorized('Refresh token has been revoked or expired');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: userWithRole });
    if (!user || user.status === 'blocked') throw Errors.unauthorized('Account no longer active');

    // Rotate: revoke the used refresh token and issue a new pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const accessToken = signAccessToken(buildAccessPayload(user));
    const refreshToken = await issueRefreshToken(user.id);

    return { accessToken, refreshToken };
  },

  async logout(refreshTokenRaw: string | undefined) {
    if (!refreshTokenRaw) return;
    try {
      const payload = verifyRefreshToken(refreshTokenRaw);
      await prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Already invalid/expired - nothing to revoke.
    }
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userWithRole,
    });
    if (!user) throw Errors.notFound('User');
    const { passwordHash: _omit, ...safeUser } = user;
    return safeUser;
  },
};
