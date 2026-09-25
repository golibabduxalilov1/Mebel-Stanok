import { env } from '../env';

/**
 * The bootstrap superadmin identified by SUPERADMIN_USERNAME/EMAIL in .env. It always
 * has full rights regardless of its role or status in the DB, nobody (including itself)
 * can delete it, and only the account itself can edit its own data.
 */
export function isEnvSuperadmin(user: { username: string; email: string } | null | undefined): boolean {
  if (!user) return false;
  return user.username === env.SUPERADMIN_USERNAME || user.email === env.SUPERADMIN_EMAIL;
}

/**
 * Fields the superadmin can't change even on its own account: username/email are how
 * it is recognised (changing them would silently drop the protection), and role/status
 * must never lock it out.
 */
export const SUPERADMIN_LOCKED_FIELDS = ['username', 'email', 'roleId', 'status'] as const;
