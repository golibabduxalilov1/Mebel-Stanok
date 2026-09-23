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
      { id: 'management', name: 'Управление (колонка и кнопка «Открыть»)' },
      { id: 'cards', name: 'Карточка станка (Паспорт)' },
      { id: 'files', name: 'Папка файлов (видео, фото, документы, схемы)' },
      { id: 'depreciation', name: 'Амортизация и оценка стоимости' },
      { id: 'photos', name: 'Фотогалерея оборудования' },
      { id: 'transfers', name: 'Перемещение между филиалами' },
      { id: 'decommission', name: 'Списание оборудования (Вывод из эксплуатации)' }
    ]
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
      { id: 'costs', name: 'Калькуляция затрат на обслуживание' }
    ]
  },
  {
    id: 'branches',
    label: 'Филиалы',
    rows: [
      { id: 'branch_list', name: 'Справочник филиалов' },
      { id: 'branch_machines', name: 'Оборудование по филиалам' }
    ]
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
      { id: 'min_stock', name: 'Контроль неснижаемого остатка' }
    ]
  },
  {
    id: 'users',
    label: 'Пользователи и роли',
    rows: [
      { id: 'user_list', name: 'Сотрудники и учетные записи' },
      { id: 'credentials', name: 'Логины и пароли' },
      { id: 'roles_matrix', name: 'Роли и матрица прав доступа' },
      { id: 'branch_access', name: 'Ограничение доступа по филиалам' }
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
      { id: 'activity_log', name: 'Журнал действий пользователей' },
      { id: 'equipment_history', name: 'История перемещений станков' },
      { id: 'audit_deletions', name: 'Аудит удалений и списаний' }
    ]
  }
];

export const PERMISSION_ACTIONS: { id: keyof PermissionMatrixItem; label: string }[] = [
  { id: 'menu', label: 'Доступно в меню' },
  { id: 'create', label: 'Создавать' },
  { id: 'view', label: 'Смотреть' },
  { id: 'edit', label: 'Редактировать' },
  { id: 'delete', label: 'Удалять' },
  { id: 'export', label: 'Экспортировать' }
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

  ['catalog', 'management', 'cards', 'depreciation', 'photos', 'transfers'].forEach(id => {
    perms[`machines.${id}`] = { menu: true, create: true, view: true, edit: true, delete: false, export: true };
  });
  perms['machines.decommission'] = { menu: false, create: false, view: true, edit: false, delete: false, export: false };

  ['schedules', 'guide', 'logs', 'repairs', 'parts_usage', 'costs'].forEach(id => {
    perms[`maintenance.${id}`] = { menu: true, create: true, view: true, edit: true, delete: false, export: true };
  });

  ['branch_list', 'branch_machines'].forEach(id => {
    perms[`branches.${id}`] = { menu: true, create: false, view: true, edit: false, delete: false, export: true };
  });

  ['parts_catalog', 'balances', 'min_stock'].forEach(id => {
    perms[`inventory.${id}`] = { menu: true, create: true, view: true, edit: true, delete: false, export: true };
  });
  ['receipts', 'writeoffs', 'units'].forEach(id => {
    perms[`inventory.${id}`] = { menu: false, create: false, view: true, edit: false, delete: false, export: false };
  });

  ['user_list', 'credentials', 'roles_matrix', 'branch_access'].forEach(id => {
    perms[`users.${id}`] = { menu: false, create: false, view: false, edit: false, delete: false, export: false };
  });

  ['equipment_report', 'toir_report', 'inventory_report', 'summary_report'].forEach(id => {
    perms[`reports.${id}`] = { menu: true, create: false, view: true, edit: false, delete: false, export: true };
  });

  ['activity_log', 'equipment_history'].forEach(id => {
    perms[`history.${id}`] = { menu: true, create: false, view: true, edit: false, delete: false, export: true };
  });
  perms['history.audit_deletions'] = { menu: false, create: false, view: false, edit: false, delete: false, export: false };

  return perms;
}

/**
 * Checks whether a given role has access to a top-level tab
 * @param role The user's role
 * @param tabId 'all' | 'maintenance' | 'branches' | 'inventory' | 'users' | 'reports' | 'history'
 */
export function canAccessTab(role: Role | undefined | null, tabId: string): boolean {
  if (!role) return false;

  const permTabId = tabId === 'all' ? 'machines' : tabId;
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
    if (!item) return false;
    return Boolean(item.menu || item.view || item.create || item.edit || item.delete || item.export);
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

  const permissions = role.permissions;
  if (!permissions) {
    return false;
  }

  // Normalize aliases
  let normalizedKey = rowKey;
  if (rowKey === 'machines.registry') normalizedKey = 'machines.catalog';
  if (rowKey === 'branches.list') normalizedKey = 'branches.branch_list';
  if (rowKey === 'inventory.stock') normalizedKey = 'inventory.parts_catalog';
  if (rowKey === 'maintenance.journal') normalizedKey = 'maintenance.logs';

  // 1. Direct match on row key
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

  // 2. Tab-level fallback (if passed e.g. 'maintenance', 'machines', 'branches', 'inventory')
  const tabPrefix = `${normalizedKey}.`;
  const matchingKeys = Object.keys(permissions).filter(k => k.startsWith(tabPrefix));
  if (matchingKeys.length > 0) {
    return matchingKeys.some(k => Boolean(permissions[k]?.[action]));
  }

  return false;
}

const usersCache = createCollectionCache<AppUser>({
  entity: 'user',
  fetchAll: () => apiClient.get<AppUser[]>('/users'),
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
    const { accessToken, user } = await apiClient.post<{ accessToken: string; user: AppUser }>('/auth/login', {
      usernameOrEmail,
      password,
    });
    setAccessToken(accessToken);
    connectSocket(accessToken);
    return user;
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
    return apiClient.get<AppUser>('/auth/me');
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
    return apiClient.post<AppUser>('/users', userData);
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
