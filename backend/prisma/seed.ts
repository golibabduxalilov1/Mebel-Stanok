import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from '../src/env';
import { ADMIN_ROLE_ID, createFullPermissions } from '../src/config/permissions';

const prisma = new PrismaClient();

const DEFAULT_UNITS = [
  { code: 'шт', name: 'Штука' },
  { code: 'кг', name: 'Килограмм' },
  { code: 'м', name: 'Метр' },
  { code: 'л', name: 'Литр' },
  { code: 'компл', name: 'Комплект' },
  { code: 'упак', name: 'Упаковка' },
  { code: 'м²', name: 'Квадратный метр' },
  { code: 'т', name: 'Тонна' },
  { code: 'рул', name: 'Рулон' },
];

async function main() {
  console.log('Seeding units of measure...');
  for (const unit of DEFAULT_UNITS) {
    await prisma.unitOfMeasure.upsert({
      where: { id: `sys-${unit.code}` },
      create: { id: `sys-${unit.code}`, code: unit.code, name: unit.name, isSystem: true },
      update: { code: unit.code, name: unit.name, isSystem: true },
    });
  }

  console.log('Seeding superadmin role...');
  await prisma.role.upsert({
    where: { id: ADMIN_ROLE_ID },
    create: {
      id: ADMIN_ROLE_ID,
      name: 'Администратор',
      description: 'Полный неограниченный доступ ко всем разделам, справочникам и настройкам системы',
      isSystem: true,
      color: '#8b5cf6',
      permissions: createFullPermissions(),
    },
    update: {
      name: 'Администратор',
      description: 'Полный неограниченный доступ ко всем разделам, справочникам и настройкам системы',
      isSystem: true,
      color: '#8b5cf6',
      permissions: createFullPermissions(),
    },
  });

  console.log('Seeding superadmin user from .env...');
  const passwordHash = await bcrypt.hash(env.SUPERADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { username: env.SUPERADMIN_USERNAME },
    create: {
      username: env.SUPERADMIN_USERNAME,
      fullName: env.SUPERADMIN_FULL_NAME,
      email: env.SUPERADMIN_EMAIL,
      passwordHash,
      roleId: ADMIN_ROLE_ID,
      status: 'active',
    },
    update: {
      fullName: env.SUPERADMIN_FULL_NAME,
      email: env.SUPERADMIN_EMAIL,
      passwordHash,
      roleId: ADMIN_ROLE_ID,
      status: 'active',
    },
  });

  console.log(`Seed complete. Superadmin login: username "${env.SUPERADMIN_USERNAME}" (password from .env SUPERADMIN_PASSWORD). Create every other user and role from the app itself.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
