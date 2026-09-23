import jwt from 'jsonwebtoken';
import { env } from '../env';

export interface AccessTokenPayload {
  sub: string; // user id
  username: string;
  roleId: string | null;
  roleName: string | null;
  branchId: string | null;
  permissions: Record<string, unknown>;
  isAdmin: boolean;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // refresh_tokens.id, for revocation lookup
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as unknown as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d` });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as unknown as RefreshTokenPayload;
}
