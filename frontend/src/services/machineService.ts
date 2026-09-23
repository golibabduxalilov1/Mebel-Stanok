import { apiClient, API_BASE_URL } from '../lib/apiClient';
import { createCollectionCache } from '../lib/collectionCache';
import {
  Machine,
  MachineAttachment,
  MachineAttachmentType,
  MaintenanceLog,
  Branch,
  SparePart,
  MaintenanceSchedule,
  Transfer,
  ActivityLog,
  UnitOfMeasure,
} from '../types';

export const DEFAULT_UNITS: UnitOfMeasure[] = [
  { id: 'sys-1', code: 'шт', name: 'Штука', isSystem: true },
  { id: 'sys-2', code: 'кг', name: 'Килограмм', isSystem: true },
  { id: 'sys-3', code: 'м', name: 'Метр', isSystem: true },
  { id: 'sys-4', code: 'л', name: 'Литр', isSystem: true },
  { id: 'sys-5', code: 'компл', name: 'Комплект', isSystem: true },
  { id: 'sys-6', code: 'упак', name: 'Упаковка', isSystem: true },
  { id: 'sys-7', code: 'м²', name: 'Квадратный метр', isSystem: true },
  { id: 'sys-8', code: 'т', name: 'Тонна', isSystem: true },
  { id: 'sys-9', code: 'рул', name: 'Рулон', isSystem: true },
];

// The backend's DateTime? columns need an explicit `null` to clear a field - the UI
// sends `''` for that today (see e.g. the ToIR "clear next maintenance date" flow).
// This keeps that call pattern working without touching every App.tsx call site.
const DATE_FIELDS = new Set([
  'purchaseDate',
  'installationDate',
  'lastMaintenanceDate',
  'nextMaintenanceDate',
  'lastPerformed',
  'nextDue',
  'date',
]);

function normalizeDates<T extends Record<string, any>>(obj: T): T {
  const out: any = { ...obj };
  for (const key of Object.keys(out)) {
    if (DATE_FIELDS.has(key) && out[key] === '') out[key] = null;
  }
  return out;
}

function toIsoStrings<T extends Record<string, any>>(obj: T): T {
  const out: any = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] instanceof Date) out[key] = out[key].toISOString();
  }
  return out;
}

/** Maps a raw backend attachment row (storageKey/thumbnailKey) to the frontend's url-based shape. */
function mapAttachment(a: any): MachineAttachment {
  const isLink = a.type === 'link';
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    url: isLink ? a.storageKey : `${API_BASE_URL}/attachments/${a.id}/download`,
    thumbnailUrl: a.thumbnailKey ? `${API_BASE_URL}/attachments/${a.id}/thumbnail` : undefined,
    size: a.size ?? undefined,
    uploadedAt: a.uploadedAt,
    uploadedBy: a.uploadedBy ?? undefined,
    description: a.description ?? undefined,
    isMainImage: a.isMainImage,
  };
}

function mapMachine(m: any): Machine {
  return { ...m, attachments: (m.attachments ?? []).map(mapAttachment) };
}

const attachmentUrlCache = new Map<string, string>();

const machinesCache = createCollectionCache<Machine>({
  entity: 'machine',
  fetchAll: async () => (await apiClient.get<any[]>('/machines')).map(mapMachine),
  sort: (items) => [...items].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()),
});

const branchesCache = createCollectionCache<Branch>({
  entity: 'branch',
  fetchAll: () => apiClient.get<Branch[]>('/branches'),
});

const activityCache = createCollectionCache<ActivityLog>({
  entity: 'activity',
  fetchAll: () => apiClient.get<ActivityLog[]>('/activity-history'),
  sort: (items) => [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
});

export const machineService = {
  // --- Machines ---
  async getMachines(): Promise<Machine[]> {
    const machines = await apiClient.get<any[]>('/machines');
    return machines.map(mapMachine);
  },

  subscribeToMachines(callback: (machines: Machine[]) => void) {
    return machinesCache.subscribe(callback);
  },

  async addMachine(machine: Omit<Machine, 'id' | 'createdBy' | 'updatedAt'>) {
    const created = await apiClient.post<Machine>('/machines', normalizeDates(machine));
    return created.id;
  },

  async updateMachine(id: string, updates: Partial<Machine>) {
    await apiClient.put(`/machines/${id}`, normalizeDates(updates));
  },

  async deleteMachine(id: string) {
    await apiClient.delete(`/machines/${id}`);
  },

  // --- Branches ---
  async getBranches(): Promise<Branch[]> {
    return apiClient.get<Branch[]>('/branches');
  },

  subscribeToBranches(callback: (branches: Branch[]) => void) {
    return branchesCache.subscribe(callback);
  },

  async addBranch(branch: Omit<Branch, 'id' | 'createdBy'>) {
    const created = await apiClient.post<Branch>('/branches', branch);
    return created.id;
  },

  async deleteBranch(id: string) {
    await apiClient.delete(`/branches/${id}`);
  },

  async updateBranch(id: string, updates: Partial<Branch>) {
    await apiClient.put(`/branches/${id}`, updates);
  },

  // --- Spare Parts ---
  async getSpareParts(): Promise<SparePart[]> {
    return apiClient.get<SparePart[]>('/spare-parts');
  },

  async addSparePart(part: Omit<SparePart, 'id' | 'createdBy'>) {
    const created = await apiClient.post<SparePart>('/spare-parts', part);
    return created.id;
  },

  async deleteSparePart(id: string) {
    await apiClient.delete(`/spare-parts/${id}`);
  },

  async updateSparePart(id: string, part: Partial<Omit<SparePart, 'id' | 'createdBy'>>) {
    await apiClient.put(`/spare-parts/${id}`, part);
  },

  async updatePartQuantity(id: string, newQuantity: number) {
    await apiClient.patch(`/spare-parts/${id}/quantity`, { quantity: newQuantity });
  },

  // --- Units of Measure ---
  async getUnitsOfMeasure(): Promise<UnitOfMeasure[]> {
    try {
      return await apiClient.get<UnitOfMeasure[]>('/units-of-measure');
    } catch (error) {
      console.warn('Could not fetch units from backend, returning defaults:', error);
      return DEFAULT_UNITS;
    }
  },

  async addUnitOfMeasure(unit: { code: string; name: string }): Promise<string | undefined> {
    const created = await apiClient.post<UnitOfMeasure>('/units-of-measure', unit);
    return created.id;
  },

  async updateUnitOfMeasure(id: string, unit: { code: string; name: string }): Promise<void> {
    await apiClient.put(`/units-of-measure/${id}`, unit);
  },

  async deleteUnitOfMeasure(id: string): Promise<void> {
    await apiClient.delete(`/units-of-measure/${id}`);
  },

  // --- Maintenance Schedules ---
  async getSchedules(machineId: string): Promise<MaintenanceSchedule[]> {
    return apiClient.get<MaintenanceSchedule[]>(`/machines/${machineId}/schedules`);
  },

  async getAllSchedules(): Promise<MaintenanceSchedule[]> {
    return apiClient.get<MaintenanceSchedule[]>('/schedules');
  },

  async addSchedule(schedule: Omit<MaintenanceSchedule, 'id'>) {
    const created = await apiClient.post<MaintenanceSchedule>('/schedules', normalizeDates(toIsoStrings(schedule)));
    return created.id;
  },

  async deleteSchedule(id: string) {
    await apiClient.delete(`/schedules/${id}`);
  },

  async updateSchedule(id: string, updates: Partial<MaintenanceSchedule>) {
    await apiClient.put(`/schedules/${id}`, normalizeDates(toIsoStrings(updates)));
  },

  // --- Transfers ---
  async getTransfers(machineId: string): Promise<Transfer[]> {
    return apiClient.get<Transfer[]>(`/machines/${machineId}/transfers`);
  },

  async transferMachine(machineId: string, _fromBranchId: string, toBranchId: string) {
    if (!machineId || !toBranchId) throw new Error('Machine ID and destination Branch ID are required');
    // fromBranchId isn't sent - the backend determines it transactionally from the
    // machine's current branch_id, closing the race the old two-write Firestore flow had.
    await apiClient.post('/transfers', { machineId, toBranchId });
  },

  // --- Logs ---
  async getLogs(machineId: string): Promise<MaintenanceLog[]> {
    return apiClient.get<MaintenanceLog[]>(`/machines/${machineId}/logs`);
  },

  async getAllLogs(): Promise<MaintenanceLog[]> {
    return apiClient.get<MaintenanceLog[]>('/logs');
  },

  async addLog(log: Omit<MaintenanceLog, 'id' | 'performedBy'>) {
    const created = await apiClient.post<MaintenanceLog>('/logs', normalizeDates(toIsoStrings(log)));
    return created.id;
  },

  async deleteLog(id: string) {
    await apiClient.delete(`/logs/${id}`);
  },

  async updateLog(id: string, updates: Partial<MaintenanceLog>) {
    await apiClient.put(`/logs/${id}`, normalizeDates(toIsoStrings(updates)));
  },

  calculateCurrentValue(machine: Machine) {
    if (!machine.purchasePrice || !machine.purchaseDate) return 0;
    const usefulLifeYears = machine.usefulLifeYears || 10;
    const purchaseDate = new Date(machine.purchaseDate);
    const now = new Date();
    const monthsPassed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
    const totalMonths = usefulLifeYears * 12;

    if (monthsPassed >= totalMonths) return 0;

    const monthlyDepreciation = machine.purchasePrice / totalMonths;
    const currentValue = machine.purchasePrice - (monthlyDepreciation * monthsPassed);
    return Math.max(0, currentValue);
  },

  getDepreciationData(machine: Machine) {
    if (!machine.purchasePrice || !machine.purchaseDate) return [];
    const usefulLifeYears = machine.usefulLifeYears || 10;
    const purchaseDate = new Date(machine.purchaseDate);
    const data = [];
    const totalMonths = usefulLifeYears * 12;
    const monthlyDepreciation = machine.purchasePrice / totalMonths;

    for (let i = 0; i <= usefulLifeYears; i++) {
      const year = purchaseDate.getFullYear() + i;
      const monthsPassed = i * 12;
      const value = Math.max(0, machine.purchasePrice - (monthlyDepreciation * monthsPassed));
      data.push({
        year: year.toString(),
        value: Math.round(value),
      });
    }
    return data;
  },

  getTotalDepreciationData(machines: Machine[]) {
    if (machines.length === 0) return [];

    const yearlyData: { [year: number]: number } = {};

    machines.forEach(machine => {
      const depData = this.getDepreciationData(machine);
      depData.forEach(d => {
        const year = parseInt(d.year);
        yearlyData[year] = (yearlyData[year] || 0) + d.value;
      });
    });

    return Object.entries(yearlyData)
      .map(([year, value]) => ({ year, value }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  },

  // --- History/Activity Logs ---
  async getActivityLogs(): Promise<ActivityLog[]> {
    return apiClient.get<ActivityLog[]>('/activity-history');
  },

  subscribeToActivityLogs(callback: (logs: ActivityLog[]) => void) {
    return activityCache.subscribe(callback);
  },

  async clearAllData(password: string) {
    await apiClient.post('/admin/clear-database', { password });
  },

  // --- Attachments ---
  async uploadAttachment(
    machineId: string,
    file: File,
    meta: { name?: string; type: MachineAttachmentType; description?: string; isMainImage?: boolean },
    thumbnail?: Blob
  ): Promise<MachineAttachment> {
    const form = new FormData();
    form.append('file', file);
    if (thumbnail) form.append('thumbnail', thumbnail, 'thumbnail.jpg');
    form.append('type', meta.type);
    if (meta.name) form.append('name', meta.name);
    if (meta.description) form.append('description', meta.description);
    if (meta.isMainImage) form.append('isMainImage', 'true');
    const created = await apiClient.upload<any>(`/machines/${machineId}/attachments`, form);
    return mapAttachment(created);
  },

  async deleteAttachment(attachmentId: string) {
    attachmentUrlCache.delete(attachmentId);
    await apiClient.delete(`/attachments/${attachmentId}`);
  },

  async setMainImage(attachmentId: string) {
    const updated = await apiClient.patch<any>(`/attachments/${attachmentId}`, { isMainImage: true });
    return mapAttachment(updated);
  },

  /**
   * Resolves an attachment (by id) to a URL usable in <img>/<video> src. Backend
   * download routes require an auth header, so real attachments are fetched as a
   * blob and cached as an object URL - external "link" attachments and already-
   * resolved data: URLs (legacy machine.imageUrl entries) pass straight through.
   */
  async resolveAttachmentUrl(id: string, currentUrl?: string, opts?: { thumbnail?: boolean }): Promise<string> {
    // Thumbnail and full-download blobs must be cached separately - they're different
    // files (a JPEG poster vs. the actual video/PDF/etc), and sharing one `id` key here
    // previously caused e.g. a video's <video> src to resolve to its own thumbnail image.
    const cacheKey = opts?.thumbnail ? `${id}:thumbnail` : id;
    if (attachmentUrlCache.has(cacheKey)) return attachmentUrlCache.get(cacheKey)!;

    if (currentUrl && (currentUrl.startsWith('data:') || (currentUrl.startsWith('http') && !currentUrl.startsWith(API_BASE_URL)))) {
      return currentUrl;
    }

    try {
      const path = opts?.thumbnail ? `/attachments/${id}/thumbnail` : `/attachments/${id}/download`;
      const blob = await apiClient.getBlob(path);
      const objectUrl = URL.createObjectURL(blob);
      attachmentUrlCache.set(cacheKey, objectUrl);
      return objectUrl;
    } catch {
      return currentUrl || '';
    }
  },

  async seedDemoData(): Promise<boolean> {
    const branch1Id = await this.addBranch({
      name: 'Цех механической обработки №1',
      location: 'г. Москва, ул. Заводская, 12, корп. 1',
      contactPerson: 'Иванов И.И., начальник цеха (+7 495 123-45-67)'
    });
    const branch2Id = await this.addBranch({
      name: 'Сборочно-сварочный цех №2',
      location: 'г. Санкт-Петербург, пр. Промышленный, 45',
      contactPerson: 'Петров С.В., зам. гл. инженера (+7 812 987-65-43)'
    });
    const branch3Id = await this.addBranch({
      name: 'Участок высокоточной ЧПУ обработки №3',
      location: 'г. Казань, Технопарк «Идея», блок 4',
      contactPerson: 'Смирнов А.Н., ведущий технолог (+7 843 555-11-22)'
    });

    const b1 = branch1Id || '';
    const b2 = branch2Id || '';
    const b3 = branch3Id || '';

    const m1Id = await this.addMachine({
      name: 'Токарно-винторезный станок 16К20',
      model: '16К20',
      manufacturer: 'Красный пролетарий',
      serialNumber: 'ТС-2023-884',
      inventoryNumber: 'ИНВ-001042',
      category: 'Токарные станки',
      branchId: b1,
      status: 'active',
      purchasePrice: 1850000,
      purchaseDate: '2022-04-15T00:00:00.000Z',
      installationDate: '2022-05-01T00:00:00.000Z',
      lastMaintenanceDate: '2026-08-10T00:00:00.000Z',
      nextMaintenanceDate: '2026-09-25T00:00:00.000Z',
      usefulLifeYears: 15,
      description: 'Универсальный токарно-винторезный станок высокой надежности. Применяется для чистовой и черновой обработки деталей типа тел вращения.'
    });

    const m2Id = await this.addMachine({
      name: 'Фрезерный обрабатывающий центр Haas VF-2',
      model: 'VF-2SS',
      manufacturer: 'Haas Automation',
      serialNumber: 'H-VF2-2022-109',
      inventoryNumber: 'ИНВ-001043',
      category: 'Фрезерные центры ЧПУ',
      branchId: b3,
      status: 'active',
      purchasePrice: 7400000,
      purchaseDate: '2023-01-20T00:00:00.000Z',
      installationDate: '2023-02-10T00:00:00.000Z',
      lastMaintenanceDate: '2026-07-15T00:00:00.000Z',
      nextMaintenanceDate: '2026-09-18T00:00:00.000Z',
      usefulLifeYears: 10,
      description: 'Высокоскоростной вертикально-фрезерный центр с ЧПУ. Частота вращения шпинделя 12 000 об/мин, магазин на 30 инструментов.'
    });

    const m3Id = await this.addMachine({
      name: 'Токарный обрабатывающий центр DMG MORI CLX 450',
      model: 'CLX 450',
      manufacturer: 'DMG MORI',
      serialNumber: 'DMG-450-9932',
      inventoryNumber: 'ИНВ-001044',
      category: 'Токарные центры ЧПУ',
      branchId: b3,
      status: 'maintenance',
      purchasePrice: 12800000,
      purchaseDate: '2023-06-12T00:00:00.000Z',
      installationDate: '2023-07-01T00:00:00.000Z',
      lastMaintenanceDate: '2026-09-01T00:00:00.000Z',
      nextMaintenanceDate: '2026-09-15T00:00:00.000Z',
      usefulLifeYears: 12,
      description: 'Прецизионный токарный центр с осью C и приводным инструментом. Выполняется плановое техническое обслуживание ТО-1.'
    });

    const m4Id = await this.addMachine({
      name: 'Ленточнопильный полуавтоматический станок BMSY 320',
      model: 'BMSY 320',
      manufacturer: 'Beka-Mak',
      serialNumber: 'BM-320-441',
      inventoryNumber: 'ИНВ-001045',
      category: 'Отрезное оборудование',
      branchId: b1,
      status: 'repair',
      purchasePrice: 950000,
      purchaseDate: '2021-09-05T00:00:00.000Z',
      installationDate: '2021-09-12T00:00:00.000Z',
      lastMaintenanceDate: '2026-08-20T00:00:00.000Z',
      nextMaintenanceDate: '2026-09-12T00:00:00.000Z',
      usefulLifeYears: 8,
      description: 'Полуавтоматический ленточнопильный станок для резки сортового и фасонного металлопроката. Ожидает замены направляющих полотна.'
    });

    const m5Id = await this.addMachine({
      name: 'Пресс гидравлический усилием 100 тонн Д2430Б',
      model: 'Д2430Б',
      manufacturer: 'Гидропресс',
      serialNumber: 'ГП-100-512',
      inventoryNumber: 'ИНВ-001046',
      category: 'Кузнечно-прессовое оборудование',
      branchId: b2,
      status: 'active',
      purchasePrice: 2600000,
      purchaseDate: '2020-03-10T00:00:00.000Z',
      installationDate: '2020-04-05T00:00:00.000Z',
      lastMaintenanceDate: '2026-08-05T00:00:00.000Z',
      nextMaintenanceDate: '2026-10-01T00:00:00.000Z',
      usefulLifeYears: 20,
      description: 'Гидравлический пресс для формовки и штамповки деталей из листового металла и композитных материалов.'
    });
    await this.addSparePart({
      name: 'Масло гидравлическое И-20А',
      sku: 'OIL-I20A-200L',
      quantity: 4,
      minQuantity: 2,
      unitPrice: 45000,
      unit: 'бочка'
    });

    const p3Id = await this.addSparePart({
      name: 'Ремень клиновой приводной профиль В (В-1800)',
      sku: 'BELT-V1800-B',
      quantity: 24,
      minQuantity: 10,
      unitPrice: 750,
      unit: 'шт'
    });

    await this.addSparePart({
      name: 'Подшипник радиально-упорный 7014-B-2RS',
      sku: 'BRG-7014-2RS',
      quantity: 8,
      minQuantity: 4,
      unitPrice: 12800,
      unit: 'шт'
    });

    await this.addSparePart({
      name: 'Линейные роликовые направляющие 35 мм L=1200мм',
      sku: 'RAIL-HR35-1200',
      quantity: 6,
      minQuantity: 2,
      unitPrice: 24500,
      unit: 'шт'
    });

    await this.addSparePart({
      name: 'Концевой датчик индуктивный M12 PNP NO',
      sku: 'SENS-M12-PNP',
      quantity: 16,
      minQuantity: 5,
      unitPrice: 1950,
      unit: 'шт'
    });

    await this.addSparePart({
      name: 'Фильтроэлемент напорный тонкой очистки 10 мкм',
      sku: 'FLT-HYD-10M',
      quantity: 12,
      minQuantity: 6,
      unitPrice: 3800,
      unit: 'шт'
    });

    if (m1Id) {
      await this.addSchedule({
        machineId: m1Id,
        taskName: 'Ежесменное обслуживание: очистка направляющих и проверка уровня масла',
        intervalDays: 1,
        lastPerformed: '2026-09-09T08:00:00.000Z',
        nextDue: '2026-09-10T08:00:00.000Z',
        taskType: 'routine',
        description: 'Удалить металлическую стружку, протереть направляющие суппорта и смазать индустриальным маслом И-20А.',
        priority: 'medium',
        assignedTechnician: 'Иванов А.С.',
        estimatedHours: 0.5
      });

      await this.addSchedule({
        machineId: m1Id,
        taskName: 'ТО-1: проверка натяжения ремней и регулировка зазоров суппорта',
        intervalDays: 30,
        lastPerformed: '2026-08-10T00:00:00.000Z',
        nextDue: '2026-09-15T00:00:00.000Z',
        taskType: 'routine',
        description: 'Проверка люфтов в ходовом винте, подтяжка клиньев, проверка соосности передней и задней бабок.',
        priority: 'high',
        assignedTechnician: 'Сидоров М.К.',
        estimatedHours: 2.5
      });
    }

    if (m2Id) {
      await this.addSchedule({
        machineId: m2Id,
        taskName: 'ТО-2: Комплексная калибровка шпинделя и проверка пневмосистемы',
        intervalDays: 90,
        lastPerformed: '2026-06-15T00:00:00.000Z',
        nextDue: '2026-09-18T00:00:00.000Z',
        taskType: 'ppr',
        description: 'Проверка биения конуса шпинделя, слив конденсата из ресивера, тест механизма смены инструмента.',
        priority: 'critical',
        assignedTechnician: 'Алексеев Д.В.',
        estimatedHours: 4
      });
    }

    if (m3Id) {
      await this.addSchedule({
        machineId: m3Id,
        taskName: 'Регламентная замена фильтра СОЖ и очистка бака',
        intervalDays: 60,
        lastPerformed: '2026-07-20T00:00:00.000Z',
        nextDue: '2026-09-16T00:00:00.000Z',
        taskType: 'routine',
        description: 'Откачка шлама, промывка бака СОЖ, установка нового фильтроэлемента тонкой очистки.',
        priority: 'medium',
        assignedTechnician: 'Кузнецов В.Г.',
        estimatedHours: 3
      });
    }

    if (m1Id && p3Id) {
      await this.addLog({
        machineId: m1Id,
        date: '2026-08-10T14:30:00.000Z',
        technicianName: 'Сидоров М.К.',
        type: 'repair',
        taskType: 'routine',
        notes: 'Плановая замена изношенного клинового ремня привода шпинделя. Произведена регулировка натяжения, тест на холостом ходу пройден успешно.',
        cost: 2200,
        partsUsed: [
          { partId: p3Id, name: 'Ремень клиновой приводной профиль В (В-1800)', quantity: 2 }
        ]
      });
    }

    return true;
  }
};
