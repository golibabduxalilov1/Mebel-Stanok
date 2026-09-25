/**
 * One-off cleanup: rewrites every role's stored `permissions` onto the current
 * PERMISSION_TABS layout (legacy rows folded into their surviving row, unknown keys
 * dropped). The API already normalizes on read, save and login, so this only tidies
 * the stored JSON. Dry run by default; pass --apply to write.
 *
 *   npm run permissions:normalize            # show what would change
 *   npm run permissions:normalize -- --apply # write the changes
 */
import { PrismaClient } from '@prisma/client';
import { normalizePermissions, type PermissionMatrixItem } from '../src/config/permissions';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  let changed = 0;

  for (const role of roles) {
    const before = (role.permissions ?? {}) as unknown as Record<string, PermissionMatrixItem>;
    const after = normalizePermissions(before);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    changed++;
    const removed = Object.keys(before).filter((k) => !(k in after));
    const granted = Object.keys(after).flatMap((k) =>
      (Object.keys(after[k]) as (keyof PermissionMatrixItem)[])
        .filter((a) => after[k][a] && !before[k]?.[a])
        .map((a) => `${k}.${a}`)
    );
    console.log(`\n${role.name} (${role.id})`);
    console.log(`  removed keys: ${removed.join(', ') || '-'}`);
    console.log(`  carried over: ${granted.join(', ') || '-'}`);

    if (apply) {
      await prisma.role.update({ where: { id: role.id }, data: { permissions: after } });
    }
  }

  console.log(`\n${changed} of ${roles.length} role(s) ${apply ? 'updated' : 'would change (dry run, pass --apply to write)'}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
