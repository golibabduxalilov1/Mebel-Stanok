/**
 * Server-side port of PERMISSION_TABS / canAccessTab / canPerformAction from the
 * frontend's src/services/userService.ts. Kept behaviourally identical so a role's
 * `permissions` JSON means the same thing on both sides once the frontend is wired
 * up to this API - only now every write route enforces it, not just the UI.
 */

export type PermissionAction = 'menu' | 'create' | 'view' | 'edit' | 'delete' | 'export';

// A type alias (not an interface) so it stays assignable to Prisma's JSON input type.
export type PermissionMatrixItem = {
  menu: boolean;
  create: boolean;
  view: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
};

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
      { id: 'cards', name: 'Карточка станка (Паспорт)' },
      { id: 'files', name: 'Папка файлов (видео, фото, документы, схемы)' },
      { id: 'depreciation', name: 'Амортизация и оценка стоимости' },
      { id: 'transfers', name: 'Перемещение между филиалами' },
      { id: 'decommission', name: 'Списание оборудования (Вывод из эксплуатации)' },
    ],
  },
  {
    id: 'maintenance',
    label: 'Техобслуживание',
    rows: [
      { id: 'schedules', name: 'График регламентных работ (ТОиР)' },
      { id: 'logs', name: 'Журнал выполненных работ (ТОиР)' },
    ],
  },
  {
    id: 'branches',
    label: 'Филиалы',
    rows: [{ id: 'branch_list', name: 'Справочник филиалов' }],
  },
  {
    id: 'inventory',
    label: 'Склад запчастей',
    rows: [
      { id: 'parts_catalog', name: 'Каталог запчастей и расходников' },
      { id: 'units', name: 'Справочник единиц измерения' },
    ],
  },
  {
    id: 'users',
    label: 'Пользователи и роли',
    rows: [
      { id: 'user_list', name: 'Сотрудники и учетные записи' },
      { id: 'credentials', name: 'Логины и пароли' },
      { id: 'roles_matrix', name: 'Роли и матрица прав доступа' },
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
    rows: [{ id: 'activity_log', name: 'Журнал действий пользователей' }],
  },
];

/**
 * Rows that were removed from PERMISSION_TABS, and the surviving row each one folds
 * into. `carry` lists the actions copied over (OR-merged) when a stored role is
 * normalized: only visibility by default, so a legacy grant never escalates into
 * create/edit/delete on the broader surviving row. Extra actions are carried only
 * where the legacy row actually gated that action in the UI.
 */
const VISIBILITY: PermissionAction[] = ['menu', 'view'];

const LEGACY_ROWS: Record<string, { to: string; carry: PermissionAction[] }> = {
  'machines.management': { to: 'machines.cards', carry: VISIBILITY },
  'machines.photos': { to: 'machines.files', carry: VISIBILITY },
  'maintenance.guide': { to: 'maintenance.schedules', carry: VISIBILITY },
  'maintenance.repairs': { to: 'maintenance.logs', carry: VISIBILITY },
  'maintenance.parts_usage': { to: 'maintenance.logs', carry: VISIBILITY },
  'maintenance.costs': { to: 'maintenance.logs', carry: VISIBILITY },
  'branches.branch_machines': { to: 'branches.branch_list', carry: VISIBILITY },
  'inventory.balances': { to: 'inventory.parts_catalog', carry: [...VISIBILITY, 'export'] },
  'inventory.receipts': { to: 'inventory.parts_catalog', carry: VISIBILITY },
  'inventory.writeoffs': { to: 'inventory.parts_catalog', carry: VISIBILITY },
  'inventory.min_stock': { to: 'inventory.parts_catalog', carry: VISIBILITY },
  'users.branch_access': { to: 'users.user_list', carry: VISIBILITY },
  'history.equipment_history': { to: 'history.activity_log', carry: VISIBILITY },
  'history.audit_deletions': { to: 'history.activity_log', carry: VISIBILITY },
};

/** Row keys accepted by canPerformAction that resolve to a different stored row. */
const ROW_KEY_ALIASES: Record<string, string> = {
  'machines.registry': 'machines.catalog',
  'branches.list': 'branches.branch_list',
  'inventory.stock': 'inventory.parts_catalog',
  'maintenance.journal': 'maintenance.logs',
  ...Object.fromEntries(Object.entries(LEGACY_ROWS).map(([from, { to }]) => [from, to])),
};

const KNOWN_ROW_KEYS = new Set(PERMISSION_TABS.flatMap((tab) => tab.rows.map((row) => `${tab.id}.${row.id}`)));

/**
 * Brings a stored `permissions` object onto the current PERMISSION_TABS layout:
 * legacy rows are folded into their surviving row (see LEGACY_ROWS) and any key
 * not in PERMISSION_TABS is dropped. Idempotent.
 */
export function normalizePermissions(stored: unknown): Record<string, PermissionMatrixItem> {
  const result: Record<string, PermissionMatrixItem> = {};
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return result;
  const permissions = stored as Record<string, PermissionMatrixItem | null | undefined>;

  for (const [key, item] of Object.entries(permissions)) {
    if (KNOWN_ROW_KEYS.has(key) && item) result[key] = { ...item };
  }

  for (const [key, item] of Object.entries(permissions)) {
    const legacy = LEGACY_ROWS[key];
    if (!legacy || !item) continue;
    const target = (result[legacy.to] ??= {
      menu: false,
      create: false,
      view: false,
      edit: false,
      delete: false,
      export: false,
    });
    for (const action of legacy.carry) {
      if (item[action]) target[action] = true;
    }
  }

  return result;
}

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

/**
 * The role matrix only exposes create/view/edit/delete. `menu` and `export` are still
 * stored (presets set them) but can't be toggled, so they follow `view` instead of
 * being read directly - otherwise unchecking every visible box could leave a tab or
 * export silently enabled.
 */
const EDITABLE_ACTIONS = ['create', 'view', 'edit', 'delete'] as const;

function effectiveAction(action: PermissionAction): (typeof EDITABLE_ACTIONS)[number] {
  return action === 'menu' || action === 'export' ? 'view' : action;
}

export function isAdminRole(role: Pick<RoleLike, 'id' | 'name'> | null | undefined): boolean {
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
    return Boolean(item && EDITABLE_ACTIONS.some((a) => item[a]));
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

  action = effectiveAction(action);
  const normalizedKey = ROW_KEY_ALIASES[rowKey] ?? rowKey;

  const item = permissions[normalizedKey];
  if (item) {
    if (item[action] !== undefined) {
      return Boolean(item[action]);
    }
  } else if (normalizedKey === 'machines.files') {
    const fallbackItem = permissions['machines.cards'] || permissions['machines.catalog'];
    return Boolean(fallbackItem?.[action]);
  }

  const tabPrefix = `${normalizedKey}.`;
  const matchingKeys = Object.keys(permissions).filter((k) => k.startsWith(tabPrefix));
  if (matchingKeys.length > 0) {
    return matchingKeys.some((k) => Boolean(permissions[k]?.[action]));
  }

  return false;
}
