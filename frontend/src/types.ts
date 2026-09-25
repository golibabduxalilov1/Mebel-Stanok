export type MachineStatus = 'active' | 'maintenance' | 'repair' | 'retired';

export type MachineAttachmentType = 'image' | 'video' | 'pdf' | 'document' | 'archive' | 'other';

export interface MachineAttachment {
  id: string;
  name: string;
  type: MachineAttachmentType;
  url: string; // Base64 data URL, blob URL, IndexedDB ref, or external web link
  thumbnailUrl?: string; // Video or document thumbnail image
  size?: number; // Size in bytes
  sizeFormatted?: string; // e.g. "1.8 МБ"
  uploadedAt: string; // ISO date string
  uploadedBy?: string; // Author name or username
  description?: string; // Note or comment
  isMainImage?: boolean;
}

export interface Machine {
  id: string;
  name: string;
  manufacturer?: string;
  model: string;
  serialNumber: string;
  branchId: string;
  status: MachineStatus;
  purchasePrice: number;
  purchaseDate: string;
  installationDate: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  usefulLifeYears: number;
  amperage?: number;
  description: string;
  imageUrl?: string;
  imageUrls?: string[];
  attachments?: MachineAttachment[];
  createdBy: string;
  updatedAt: any;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  contactPerson: string;
  createdBy: string;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  createdBy?: string;
  isSystem?: boolean;
}

export interface SparePart {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minQuantity: number;
  unitPrice: number;
  unit?: string;
  imageUrl?: string;
  imageUrls?: string[];
  branchId?: string;
  machineIds?: string[];
  isArchived?: boolean;
  createdBy: string;
}

export type ToirTaskType = 'routine' | 'diagnostic' | 'ppr' | 'emergency';

export interface MaintenanceSchedule {
  id: string;
  machineId: string;
  taskName: string;
  intervalDays: number;
  lastPerformed: string;
  nextDue: string;
  taskType?: ToirTaskType;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedTechnician?: string;
  laborCost?: number;
  estimatedHours?: number;
  partsUsed?: { partId: string; quantity: number; name: string }[];
  imageUrl?: string;
  imageUrls?: string[];
  createdBy?: string;
}

export interface Transfer {
  id: string;
  machineId: string;
  fromBranchId: string;
  toBranchId: string;
  date: string;
  createdBy: string;
}

export type LogType = 'routine' | 'repair' | 'inspection' | 'diagnostic' | 'ppr' | 'emergency';

export type LogStatus = 'planned' | 'completed';

export interface MaintenanceLog {
  id: string;
  machineId: string;
  date: string;
  technicianName: string;
  type: LogType;
  /** Always present on logs read from the backend; omit it when creating one to default to 'completed'. */
  status?: LogStatus;
  taskType?: ToirTaskType;
  notes: string;
  cost: number;
  partsUsed?: { partId: string; quantity: number; name: string }[];
  performedBy: string;
  scheduleId?: string;
  nextMaintenanceDate?: string;
  imageUrl?: string;
  imageUrls?: string[];
}

export interface ActivityLog {
  id: string;
  actionType: 'create' | 'update' | 'delete' | 'transfer' | 'other';
  entityType: 'machine' | 'branch' | 'part' | 'schedule' | 'log' | 'transfer' | 'user' | 'role';
  entityId: string;
  entityName: string;
  details: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
}

export interface PermissionMatrixItem {
  menu: boolean;        // Доступно в меню
  create: boolean;      // Создавать
  view: boolean;        // Смотреть
  edit: boolean;        // Редактировать
  delete: boolean;      // Удалять
  export: boolean;      // Экспортировать
}

export type PermissionTabId = 
  | 'machines'      // Оборудование
  | 'maintenance'   // Техобслуживание
  | 'branches'      // Филиалы
  | 'inventory'     // Склад запчастей
  | 'users'         // Пользователи и роли
  | 'reports'       // Отчеты
  | 'history';      // История

export interface Role {
  id: string;
  name: string; // e.g., 'Технолог', 'Администратор', 'Мастер ТОиР', 'Оператор', 'Кладовщик'
  description?: string;
  isSystem?: boolean;
  color?: string; // Hex or tailwind badge style
  permissions: Record<string, PermissionMatrixItem>; // key: `${tabId}.${rowId}`
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppUser {
  id: string;
  username: string; // Логин
  fullName: string; // ФИО
  email: string; // Email
  password?: string; // Пароль учетной записи
  roleId: string; // ID назначенной роли
  roleName?: string; // Название роли
  roleColor?: string; // Цвет роли (для аватара), из Role.color
  branchIds?: string[]; // ID филиалов; пусто/не задано = все филиалы
  position?: string; // Должность (например: Ведущий технолог ЧПУ)
  phone?: string;
  status: 'active' | 'blocked';
  notes?: string;
  lastLogin?: string;
  createdAt?: string;
  createdBy?: string;
  isSuperadmin?: boolean; // Суперадмин из .env: всегда все права, удалить нельзя
}

