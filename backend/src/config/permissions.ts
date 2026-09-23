/**
 * Server-side port of PERMISSION_TABS / canAccessTab / canPerformAction from the
 * frontend's src/services/userService.ts. Kept behaviourally identical so a role's
 * `permissions` JSON means the same thing on both sides once the frontend is wired
 * up to this API - only now every write route enforces it, not just the UI.
 */

export type PermissionAction = 'menu' | 'create' | 'view' | 'edit' | 'delete' | 'export';

export interface PermissionMatrixItem {
  menu: boolean;
  create: boolean;
  view: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
}

export type PermissionTabId =
  | 'machines'
  | 'maintenance'
  | 'branches'
  | 'inventory'
  | 'users'
  | 'reports'
  | 'history';

interface PermissionRowDef {
  id: string;
  name: string;
}

interface PermissionTabDef {
  id: PermissionTabId;
  label: string;
  rows: PermissionRowDef[];
}

export const PERMISSION_TABS: PermissionTabDef[] = [
  {
    id: 'machines',
    label: 'Оборудование',
    rows: [
      { id: 'catalog', name: 'Реестр оборудования (Станки)' },
      { id: 'management', name: 'Управление (колонка и кнопка «Открыть»)' },
      { id: 'cards', name: 'Карточка станка (Паспорт)' },
      { id: 'files', name: 'Папка файлов (видео, фото, документы, схемы)' },
      { id: 'depreciation', name: 'Амортизация и оценка стоимости' },
      { id: 'photos', name: 'Фотогалерея оборудования' },
      { id: 'transfers', name: 'Перемещение между филиалами' },
      { id: 'decommission', name: 'Списание оборудования (Вывод из эксплуатации)' },
    ],
  },
  {
    id: 'maintenance',
    label: 'Техобслуживание',
    rows: [
      { id: 'schedules', name: 'График регламентных работ (ТОиР)' },
      { id: 'guide', name: 'Справочник регламентов (ЕТО, ТО-1, ТО-2, КР)' },
      { id: 'logs', name: 'Журнал выполненных работ (ТОиР)' },
      { id: 'repairs', name: 'Ремонтный цех и дефекты' },
      { id: 'parts_usage', name: 'Расход запчастей на ТО' },
      { id: 'costs', name: 'Калькуляция затрат на обслуживание' },
    ],
  },
  {
    id: 'branches',
    label: 'Филиалы',
    rows: [
      { id: 'branch_list', name: 'Справочник филиалов' },
      { id: 'branch_machines', name: 'Оборудование по филиалам' },
    ],
  },
  {
    id: 'inventory',
    label: 'Склад запчастей',
    rows: [
      { id: 'parts_catalog', name: 'Каталог запчастей и расходников' },
      { id: 'balances', name: 'Остатки на складах' },
      { id: 'receipts', name: 'Оприходование (поступление)' },
      { id: 'writeoffs', name: 'Списание запчастей' },
      { id: 'units', name: 'Справочник единиц измерения' },
      { id: 'min_stock', name: 'Контроль неснижаемого остатка' },
    ],
  },
  {
    id: 'users',
    label: 'Пользователи и роли',
    rows: [
      { id: 'user_list', name: 'Сотрудники и учетные записи' },
      { id: 'credentials', name: 'Логины и пароли' },
      { id: 'roles_matrix', name: 'Роли и матрица прав доступа' },
      { id: 'branch_access', name: 'Ограничение доступа по филиалам' },
    ],
  },
  {
    id: 'reports',
    label: 'Отчеты',
    rows: [
      { id: 'equipment_report', name: 'Отчет по парку оборудования' },
      { id: 'toir_report', name: 'Отчет по ТОиР и затратам' },
      { id: 'inventory_report', name: 'Отчет по остаткам запчастей' },
      { id: 'summary_report', name: 'Сводная аналитическая панель' },
    ],
  },
  {
    id: 'history',
    label: 'История',
    rows: [
      { id: 'activity_log', name: 'Журнал действий пользователей' },
      { id: 'equipment_history', name: 'История перемещений станков' },
      { id: 'audit_deletions', name: 'Аудит удалений и списаний' },
    ],
  },
];

export function createEmptyPermissions(): Record<string, PermissionMatrixItem> {
  const perms: Record<string, PermissionMatrixItem> = {};
  for (const tab of PERMISSION_TABS) {
    for (const row of tab.rows) {
      perms[`${tab.id}.${row.id}`] = {
        menu: false,
        create: false,
        view: false,
        edit: false,
        delete: false,
        export: false,
      };
    }
  }
  return perms;
}

export function createFullPermissions(): Record<string, PermissionMatrixItem> {
  const perms: Record<string, PermissionMatrixItem> = {};
  for (const tab of PERMISSION_TABS) {
    for (const row of tab.rows) {
      perms[`${tab.id}.${row.id}`] = {
        menu: true,
        create: true,
        view: true,
        edit: true,
        delete: true,
        export: true,
      };
    }
  }
  return perms;
}

/** Fixed ids assigned during seeding so the admin short-circuit below is stable. */
export const ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000001';

interface RoleLike {
  id: string;
  name: string;
  permissions: Record<string, PermissionMatrixItem> | null | undefined;
}

function isAdminRole(role: RoleLike | null | undefined): boolean {
  if (!role) return false;
  return role.id === ADMIN_ROLE_ID || role.name?.trim().toLowerCase() === 'администратор';
}

export function canAccessTab(role: RoleLike | null | undefined, tabId: string): boolean {
  if (!role) return false;
  const permTabId = tabId === 'all' ? 'machines' : tabId;
  const permissions = role.permissions;

  if (!permissions) return isAdminRole(role);

  const tabKeys = Object.keys(permissions).filter((k) => k.startsWith(`${permTabId}.`));
  if (tabKeys.length === 0) return isAdminRole(role);

  return tabKeys.some((key) => {
    const item = permissions[key];
    if (!item) return false;
    return Boolean(item.menu || item.view || item.create || item.edit || item.delete || item.export);
  });
}

export function canPerformAction(
  role: RoleLike | null | undefined,
  rowKey: string,
  action: PermissionAction
): boolean {
  if (!role) return false;
  if (isAdminRole(role)) return true;

  const permissions = role.permissions;
  if (!permissions) return false;

  let normalizedKey = rowKey;
  if (rowKey === 'machines.registry') normalizedKey = 'machines.catalog';
  if (rowKey === 'branches.list') normalizedKey = 'branches.branch_list';
  if (rowKey === 'inventory.stock') normalizedKey = 'inventory.parts_catalog';
  if (rowKey === 'maintenance.journal') normalizedKey = 'maintenance.logs';

  const item = permissions[normalizedKey];
  if (item) {
    if (normalizedKey === 'machines.management') {
      return Boolean(item.view || item.menu || item.edit || item.create || item.delete || item.export);
    }
    if (item[action] !== undefined) {
      return Boolean(item[action]);
    }
  } else if (normalizedKey === 'machines.management') {
    const fallbackItem = permissions['machines.cards'] || permissions['machines.catalog'];
    if (fallbackItem) {
      return Boolean(fallbackItem.view || fallbackItem.menu || fallbackItem.edit);
    }
  } else if (normalizedKey === 'machines.files') {
    const fallbackItem = permissions['machines.photos'] || permissions['machines.cards'] || permissions['machines.catalog'];
    if (fallbackItem && fallbackItem[action] !== undefined) {
      return Boolean(fallbackItem[action]);
    }
    return true;
  }

  const tabPrefix = `${normalizedKey}.`;
  const matchingKeys = Object.keys(permissions).filter((k) => k.startsWith(tabPrefix));
  if (matchingKeys.length > 0) {
    return matchingKeys.some((k) => Boolean(permissions[k]?.[action]));
  }

  return false;
}
