import type { Prisma, ActionType, EntityType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { emitEntity } from '../lib/socket';
import type { AccessTokenPayload } from './jwt';

type Tx = Prisma.TransactionClient;

export interface ActivityWrite {
  actionType: ActionType;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  details: string;
  userId: string;
  userEmail?: string | null;
}

/** Writes one activity_history row. Always call inside the same transaction as the mutation it describes. */
export async function writeActivity(tx: Tx, entry: ActivityWrite): Promise<void> {
  const row = await tx.activityHistory.create({
    data: {
      actionType: entry.actionType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName,
      details: entry.details,
      userId: entry.userId,
      userEmail: entry.userEmail ?? undefined,
    },
  });
  emitEntity('activity', 'created', row);
}

export function actorFromUser(user: AccessTokenPayload): { userId: string; userEmail?: string } {
  return { userId: user.sub, userEmail: undefined };
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Наименование / Имя',
  manufacturer: 'Производитель',
  model: 'Модель',
  serialNumber: 'Серийный номер',
  branchId: 'Филиал',
  status: 'Статус',
  purchasePrice: 'Стоимость закупки',
  purchaseDate: 'Дата закупки',
  installationDate: 'Дата установки',
  lastMaintenanceDate: 'Дата последнего обслуживания',
  nextMaintenanceDate: 'Дата следующего обслуживания',
  usefulLifeYears: 'Срок службы (лет)',
  description: 'Описание',
  location: 'Адрес',
  contactPerson: 'Контакты',
  sku: 'Артикул / SKU',
  quantity: 'Количество',
  minQuantity: 'Минимальный остаток',
  unitPrice: 'Цена за единицу',
  machineId: 'ID станка / Станок',
  taskName: 'Задача',
  intervalDays: 'Интервал (дни)',
  lastPerformed: 'Последнее выполнение',
  nextDue: 'Дата следующего ТО',
  date: 'Дата',
  technicianName: 'Техник',
  type: 'Тип работы',
  notes: 'Заметки',
  cost: 'Затраты',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'в работе',
  maintenance: 'на ТО',
  repair: 'в ремонте',
  retired: 'списан',
};

const LOG_TYPE_LABELS: Record<string, string> = {
  routine: 'Плановое ТО',
  repair: 'Аварийный ремонт',
  inspection: 'Инспекция',
};

function translateValue(key: string, val: unknown): string {
  if (val === undefined || val === null || val === '') return 'не указано';
  if (key === 'status') return STATUS_LABELS[String(val)] || String(val);
  if (key === 'type') return LOG_TYPE_LABELS[String(val)] || String(val);
  if (key === 'purchasePrice' || key === 'unitPrice' || key === 'cost') {
    return `${Number(val).toLocaleString('ru-RU')} ₽`;
  }
  return String(val);
}

/** Port of getDiffDetails() from the frontend's machineService.ts - same field labels and phrasing. */
export function getDiffDetails(original: Record<string, unknown>, updates: Record<string, unknown>): string {
  const changes: string[] = [];
  for (const [key, newVal] of Object.entries(updates)) {
    if (['updatedAt', 'createdBy', 'id', 'performedBy'].includes(key)) continue;
    const oldVal = original[key];

    const oldStr = oldVal !== undefined && oldVal !== null ? String(oldVal).trim() : '';
    const newStr = newVal !== undefined && newVal !== null ? String(newVal).trim() : '';

    if (typeof oldVal === 'object' || typeof newVal === 'object') {
      if (key === 'partsUsed' || key === 'parts') {
        const fmt = (arr: unknown) =>
          Array.isArray(arr) ? arr.map((p: any) => `${p.name} (x${p.quantity})`).join(', ') : '';
        const oldParts = fmt(oldVal);
        const newParts = fmt(newVal);
        if (oldParts !== newParts) {
          changes.push(`Задействованные запчасти: было "${oldParts || 'нет'}", стало "${newParts || 'нет'}"`);
        }
      }
      continue;
    }

    if (oldStr !== newStr) {
      const label = FIELD_LABELS[key] || key;
      changes.push(`${label}: было "${translateValue(key, oldVal)}", стало "${translateValue(key, newVal)}"`);
    }
  }
  return changes.length > 0 ? `Изменено конкретно: ${changes.join('; ')}` : 'Изменена информация (без явного изменения полей)';
}

/** Convenience for handlers that don't need their own transaction (reads-then-writes outside a Tx). */
export async function writeActivityStandalone(entry: ActivityWrite): Promise<void> {
  await writeActivity(prisma as unknown as Tx, entry);
}
