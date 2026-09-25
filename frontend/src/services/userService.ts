import { apiClient, getAccessToken, setAccessToken } from '../lib/apiClient';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { createCollectionCache } from '../lib/collectionCache';
import { Role, AppUser, PermissionTabId, PermissionMatrixItem } from '../types';

export interface PermissionRowDef {
  id: string;
  name: string;
}

export interface PermissionTabDef {
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
      { id: 'decommission', name: 'Списание оборудования (Вывод из эксплуатации)' }
    ]
  },
  {
    id: 'maintenance',
    label: 'Техобслуживание',
    rows: [
      { id: 'schedules', name: 'График регламентных работ (ТОиР)' },
      { id: 'logs', name: 'Журнал выполненных работ (ТОиР)' }
    ]
  },
  {
    id: 'branches',
    label: 'Филиалы',
    rows: [
      { id: 'branch_list', name: 'Справочник филиалов' }
    ]
  },
  {
    id: 'inventory',
    label: 'Склад запчастей',
    rows: [
      { id: 'parts_catalog', name: 'Каталог запчастей и расходников' },
      { id: 'units', name: 'Справочник единиц измерения' }
    ]
  },
  {
    id: 'users',
    label: 'Пользователи и роли',
    rows: [
      { id: 'user_list', name: 'Сотрудники и учетные записи' },
      { id: 'credentials', name: 'Логины и пароли' },
      { id: 'roles_matrix', name: 'Роли и матрица прав доступа' }
    ]
  },
  {
    id: 'reports',
    label: 'Отчеты',
    rows: [
      { id: 'equipment_report', name: 'Отчет по парку оборудования' },
      { id: 'toir_report', name: 'Отчет по ТОиР и затратам' },
      { id: 'inventory_report', name: 'Отчет по остаткам запчастей' },
      { id: 'summary_report', name: 'Сводная аналитическая панель' }
    ]
  },
  {
    id: 'history',
    label: 'История',
    rows: [
      { id: 'activity_log', name: 'Журнал действий пользователей' }
    ]
  }
];

// Row keys accepted by canPerformAction that resolve to a different stored row.
// Includes rows removed from PERMISSION_TABS, which were folded into these rows
// (the backend's normalizePermissions does the same fold on stored roles).
const ROW_KEY_ALIASES: Record<string, string> = {
  'machines.registry': 'machines.catalog',
  'machines.management': 'machines.cards',
  'machines.photos': 'machines.files',
  'maintenance.journal': 'maintenance.logs',
  'maintenance.guide': 'maintenance.schedules',
  'maintenance.repairs': 'maintenance.logs',
  'maintenance.parts_usage': 'maintenance.logs',
  'maintenance.costs': 'maintenance.logs',
  'branches.list': 'branches.branch_list',
  'branches.branch_machines': 'branches.branch_list',
  'inventory.stock': 'inventory.parts_catalog',
  'inventory.balances': 'inventory.parts_catalog',
  'inventory.receipts': 'inventory.parts_catalog',
  'inventory.writeoffs': 'inventory.parts_catalog',
  'inventory.min_stock': 'inventory.parts_catalog',
  'users.branch_access': 'users.user_list',
  'history.equipment_history': 'history.activity_log',
  'history.audit_deletions': 'history.activity_log'
};

export const PERMISSION_ACTIONS: { id: keyof PermissionMatrixItem; label: string }[] = [
  { id: 'create', label: 'Создавать' },
  { id: 'view', label: 'Смотреть' },
  { id: 'edit', label: 'Редактировать' },
  { id: 'delete', label: 'Удалять' }
];

// Helper to create all-false permissions
export function createEmptyPermissions(): Record<string, PermissionMatrixItem> {
  const perms: Record<string, PermissionMatrixItem> = {};
  PERMISSION_TABS.forEach(tab => {
    tab.rows.forEach(row => {
      perms[`${tab.id}.${row.id}`] = {
        menu: false,
        create: false,
        view: false,
        edit: false,
        delete: false,
        export: false
      };
    });
  });
  return perms;
}

// Helper for full permissions (Administrator)
export function createFullPermissions(): Record<string, PermissionMatrixItem> {
  const perms: Record<string, PermissionMatrixItem> = {};
  PERMISSION_TABS.forEach(tab => {
    tab.rows.forEach(row => {
      perms[`${tab.id}.${row.id}`] = {
        menu: true,
        create: true,
        view: true,
        edit: true,
        delete: true,
        export: true
      };
    });
  });
  return perms;
}

// Default starting point offered when creating a brand-new role in RolePermissionModal.
export function createTechnologistPermissions(): Record<string, PermissionMatrixItem> {
  const perms = createEmptyPermissions();

  ['catalog', 'cards', 'depreciation', 'transfers'].forEach(id => {
    perms[`machines.${id}`] = { menu: true, create: true, view: true, edit: true, delete: false, export: true };
  });
  perms['machines.decommission'] = { menu: false, create: false, view: true, edit: false, delete: false, export: false };

  ['schedules', 'logs'].forEach(id => {
    perms[`maintenance.${id}`] = { menu: true, create: true, view: true, edit: true, delete: false, export: true };
  });

  perms['branches.branch_list'] = { menu: true, create: false, view: true, edit: false, delete: false, export: true };

  perms['inventory.parts_catalog'] = { menu: true, create: true, view: true, edit: true, delete: false, export: true };
  perms['inventory.units'] = { menu: false, create: false, view: true, edit: false, delete: false, export: false };

  ['user_list', 'credentials', 'roles_matrix'].forEach(id => {
    perms[`users.${id}`] = { menu: false, create: false, view: false, edit: false, delete: false, export: false };
  });

  ['equipment_report', 'toir_report', 'inventory_report', 'summary_report'].forEach(id => {
    perms[`reports.${id}`] = { menu: true, create: false, view: true, edit: false, delete: false, export: true };
  });

  perms['history.activity_log'] = { menu: true, create: false, view: true, edit: false, delete: false, export: true };

  return perms;
}

// The role matrix only exposes create/view/edit/delete. `menu` and `export` are still
// stored (presets set them) but can't be toggled, so they follow `view` instead of
// being read directly - otherwise unchecking every visible box could leave a tab or
// export silently enabled. Mirrors backend/src/config/permissions.ts.
const EDITABLE_ACTIONS = ['create', 'view', 'edit', 'delete'] as const;

function effectiveAction(action: keyof PermissionMatrixItem): (typeof EDITABLE_ACTIONS)[number] {
  return action === 'menu' || action === 'export' ? 'view' : action;
}

export function isAdminRole(role: Pick<Role, 'name'> | undefined | null): boolean {
  return role?.name?.toLowerCase().trim() === 'администратор';
}

/**
 * Checks whether a given role has access to a top-level tab
 * @param role The user's role
 * @param tabId 'all' | 'maintenance' | 'branches' | 'inventory' | 'users' | 'reports' | 'history'
 */
export function canAccessTab(role: Role | undefined | null, tabId: string): boolean {
  if (!role) return false;

  const permTabId = tabId === 'all' ? 'machines' : tabId;

  // "История" is admin-only regardless of the role's permission matrix, so
  // granting other rows/actions to a role (e.g. Мастер) never exposes it.
  if (permTabId === 'history') {
    return role.name?.toLowerCase().trim() === 'администратор';
  }

  const permissions = role.permissions;

  // If no permissions object exists yet on the role
  if (!permissions) {
    return role.name?.toLowerCase().trim() === 'администратор';
  }

  // Find all keys configured for this tab (e.g. 'reports.equipment_report', 'reports.toir_report')
  const tabKeys = Object.keys(permissions).filter(k => k.startsWith(`${permTabId}.`));
  if (tabKeys.length === 0) {
    // If no row keys exist for this tab, check if it's admin
    return role.name?.toLowerCase().trim() === 'администратор';
  }

  // Check if at least ONE action on ANY row in this tab is true
  const hasAnyGranted = tabKeys.some(key => {
    const item = permissions[key];
    return Boolean(item && EDITABLE_ACTIONS.some(a => item[a]));
  });

  return hasAnyGranted;
}

/**
 * Checks whether a given role has a specific action permission for a specific row
 * @param role The user's role
 * @param rowKey E.g. 'reports.equipment_report' or 'machines.catalog'
 * @param action 'menu' | 'create' | 'view' | 'edit' | 'delete' | 'export'
 */
export function canPerformAction(
  role: Role | undefined | null,
  rowKey: string,
  action: keyof PermissionMatrixItem
): boolean {
  if (!role) return false;

  // Superuser / Admin always has full access
  if (role.name?.toLowerCase().trim() === 'администратор') {
    return true;
  }

  // "История" is admin-only regardless of the role's permission matrix.
  if (rowKey === 'history' || rowKey.startsWith('history.')) {
    return false;
  }

  const permissions = role.permissions;
  if (!permissions) {
    return false;
  }

  action = effectiveAction(action);
  const normalizedKey = ROW_KEY_ALIASES[rowKey] ?? rowKey;

  // 1. Direct match on row key
  const item = permissions[normalizedKey];
  if (item) {
    if (item[action] !== undefined) {
      return Boolean(item[action]);
    }
  } else if (normalizedKey === 'machines.files') {
    const fallbackItem = permissions['machines.cards'] || permissions['machines.catalog'];
    return Boolean(fallbackItem?.[action]);
  }

  // 2. Tab-level fallback (if passed e.g. 'maintenance', 'machines', 'branches', 'inventory')
  const tabPrefix = `${normalizedKey}.`;
  const matchingKeys = Object.keys(permissions).filter(k => k.startsWith(tabPrefix));
  if (matchingKeys.length > 0) {
    return matchingKeys.some(k => Boolean(permissions[k]?.[action]));
  }

  return false;
}

/**
 * The role the UI should enforce for a user. The .env superadmin always has full rights
 * (the backend ignores its DB role), so it gets the administrator role whatever it has.
 */
export function resolveUserRole(user: AppUser | null | undefined, roles: Role[]): Role | null {
  if (!user) return null;
  const role =
    roles.find(r => r.id === user.roleId) ||
    roles.find(r => r.name.toLowerCase().trim() === user.roleName?.toLowerCase().trim()) ||
    null;
  if (!user.isSuperadmin || isAdminRole(role)) return role;
  return roles.find(r => isAdminRole(r)) || { id: '', name: 'Администратор', permissions: createFullPermissions() };
}

// The API returns the assigned role nested as `role: { id, name, color }`;
// flatten it into roleName/roleColor, which is what the UI reads.
type ApiUser = AppUser & { role?: { id: string; name: string; color?: string | null } | null };

function mapUser(user: ApiUser): AppUser {
  const { role, ...rest } = user;
  return {
    ...rest,
    roleName: role?.name ?? rest.roleName,
    roleColor: role?.color ?? rest.roleColor,
  };
}

const usersCache = createCollectionCache<AppUser>({
  entity: 'user',
  fetchAll: async () => (await apiClient.get<ApiUser[]>('/users')).map(mapUser),
  map: mapUser,
  sort: (items) => [...items].sort((a, b) => a.fullName.localeCompare(b.fullName)),
});

const rolesCache = createCollectionCache<Role>({
  entity: 'role',
  fetchAll: () => apiClient.get<Role[]>('/roles'),
  sort: (items) => [...items].sort((a, b) => a.name.localeCompare(b.name)),
});

export const userService = {
  // --- Auth ---
  async login(usernameOrEmail: string, password: string): Promise<AppUser> {
    const { accessToken, user } = await apiClient.post<{ accessToken: string; user: ApiUser }>('/auth/login', {
      usernameOrEmail,
      password,
    });
    setAccessToken(accessToken);
    connectSocket(accessToken);
    return mapUser(user);
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAccessToken(null);
      disconnectSocket();
    }
  },

  async me(): Promise<AppUser> {
    return mapUser(await apiClient.get<ApiUser>('/auth/me'));
  },

  /** Tries to restore a session from the httpOnly refresh cookie on app load. Returns the user, or null if there isn't one. */
  async restoreSession(): Promise<AppUser | null> {
    const refreshed = await apiClient.tryRefresh();
    if (!refreshed) return null;
    const token = getAccessToken();
    if (token) connectSocket(token);
    try {
      return await this.me();
    } catch {
      return null;
    }
  },

  async changePassword(userId: string, newPassword: string): Promise<void> {
    await apiClient.patch(`/users/${userId}/password`, { password: newPassword });
  },

  // --- Real-time Subscriptions ---
  subscribeUsers(callback: (users: AppUser[]) => void) {
    return usersCache.subscribe(callback);
  },

  subscribeRoles(callback: (roles: Role[]) => void) {
    return rolesCache.subscribe(callback);
  },

  async getUsers(): Promise<AppUser[]> {
    return apiClient.get<AppUser[]>('/users');
  },

  async getRoles(): Promise<Role[]> {
    return apiClient.get<Role[]>('/roles');
  },

  // --- CRUD Users ---
  // `password` is required by the backend on create (zod-enforced, min 8 chars) even
  // though it's optional on the AppUser type - UserModal always supplies one here.
  async createUser(userData: Omit<AppUser, 'id' | 'createdAt'>): Promise<AppUser> {
    return mapUser(await apiClient.post<ApiUser>('/users', userData));
  },

  async updateUser(id: string, updates: Partial<AppUser>): Promise<void> {
    const { password, ...rest } = updates as Partial<AppUser> & { password?: string };
    if (Object.keys(rest).length > 0) {
      await apiClient.put(`/users/${id}`, rest);
    }
    if (password) {
      await this.changePassword(id, password);
    }
  },

  async deleteUser(id: string, _userName: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },

  // --- CRUD Roles ---
  async createRole(roleData: Omit<Role, 'id' | 'createdAt'>): Promise<Role> {
    return apiClient.post<Role>('/roles', roleData);
  },

  async updateRole(id: string, updates: Partial<Role>): Promise<void> {
    await apiClient.put(`/roles/${id}`, updates);
  },

  async deleteRole(id: string, _roleName: string): Promise<void> {
    await apiClient.delete(`/roles/${id}`);
  },
};
