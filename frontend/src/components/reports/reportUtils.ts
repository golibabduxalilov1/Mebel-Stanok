import type { AppUser, Branch, LogType, Machine, MachineStatus, MaintenanceLog, MaintenanceSchedule, Role, SparePart, UnitOfMeasure } from '../../types';
import { machineService } from '../../services/machineService';
import { daysBetweenKeys, parseDateKey, shiftDateKey, shiftMonthsKey, toLocalDateKey, todayKey } from '../../utils/dates';

export { toLocalDateKey, todayKey } from '../../utils/dates';

// ---------- Labels & formatting ----------

export const LOG_TYPES: LogType[] = ['routine', 'ppr', 'inspection', 'diagnostic', 'repair', 'emergency'];

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  routine: 'Плановое ТО',
  repair: 'Ремонт',
  inspection: 'Инспекция',
  diagnostic: 'Диагностика',
  ppr: 'ППР',
  emergency: 'Аварийный ремонт',
};

export const LOG_TYPE_BADGE: Record<LogType, string> = {
  routine: 'bg-emerald-100 text-emerald-700',
  ppr: 'bg-amber-100 text-amber-700',
  inspection: 'bg-blue-100 text-blue-700',
  diagnostic: 'bg-indigo-100 text-indigo-700',
  repair: 'bg-rose-100 text-rose-700',
  emergency: 'bg-rose-100 text-rose-700',
};

/** Planned (preventive) vs. unplanned (failure) work. */
export const EMERGENCY_TYPES: ReadonlySet<LogType> = new Set<LogType>(['repair', 'emergency']);
export const isEmergencyType = (type: LogType) => EMERGENCY_TYPES.has(type);

export const MACHINE_STATUSES: MachineStatus[] = ['active', 'maintenance', 'repair', 'retired'];

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  active: 'В работе',
  maintenance: 'На обслуживании',
  repair: 'В ремонте',
  retired: 'Списан',
};

export const PRIORITY_LABELS: Record<NonNullable<MaintenanceSchedule['priority']>, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

export const PRIORITY_BADGE: Record<NonNullable<MaintenanceSchedule['priority']>, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  critical: 'bg-rose-50 text-rose-700',
};

const roundTo2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function formatNumber(value: number, maxFractionDigits = 2): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
}

export function formatMoney(value: number): string {
  return `${formatNumber(value, 2)} $`;
}

export function formatAmps(value: number): string {
  return `${formatNumber(value, 2)} А`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`;
}

/** Russian plural form: pluralRu(5, ['работа', 'работы', 'работ']) -> 'работ'. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 19) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export const WORKS_FORMS: [string, string, string] = ['работа', 'работы', 'работ'];

export function formatDateKey(key: string): string {
  return key ? parseDateKey(key).toLocaleDateString('ru-RU') : '—';
}

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
}

// ---------- Filters ----------

export type StatusFilter = 'all' | 'completed' | 'planned';

export interface ReportFilters {
  branchId: string;
  machineId: string;
  /** Normalized manufacturer name, NO_MANUFACTURER for machines without one, or 'all'. */
  manufacturer: string;
  machineStatus: 'all' | MachineStatus;
  type: 'all' | LogType;
  status: StatusFilter;
  start: string;
  end: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export function defaultDateRange(now: Date = new Date()): DateRange {
  return presetRange('quarter', now);
}

export type PeriodPreset = '7d' | '30d' | 'quarter' | 'year' | 'all';

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'year', label: 'Год' },
  { id: 'all', label: 'Всё' },
];

/** Ranges ending today (inclusive); 'all' is open on both ends. */
export function presetRange(preset: PeriodPreset, now: Date = new Date()): DateRange {
  const end = todayKey(now);
  switch (preset) {
    case '7d':
      return { start: shiftDateKey(end, -6), end };
    case '30d':
      return { start: shiftDateKey(end, -29), end };
    case 'quarter':
      return { start: shiftMonthsKey(end, -3), end };
    case 'year':
      return { start: shiftMonthsKey(end, -12), end };
    case 'all':
      return { start: '', end: '' };
  }
}

export function detectPreset(range: DateRange, now: Date = new Date()): PeriodPreset | null {
  return PERIOD_PRESETS.find(p => {
    const r = presetRange(p.id, now);
    return r.start === range.start && r.end === range.end;
  })?.id ?? null;
}

export function formatPeriod(range: DateRange): string {
  if (!range.start && !range.end) return 'за всё время';
  if (!range.start) return `по ${formatDateKey(range.end)}`;
  if (!range.end) return `с ${formatDateKey(range.start)}`;
  return `${formatDateKey(range.start)} — ${formatDateKey(range.end)}`;
}

/** The equally long period right before [start, end]; null when the range is open-ended. */
export function previousPeriod(range: DateRange): DateRange | null {
  if (!range.start || !range.end || range.start > range.end) return null;
  const length = daysBetweenKeys(range.start, range.end) + 1;
  const end = shiftDateKey(range.start, -1);
  return { start: shiftDateKey(end, -(length - 1)), end };
}

export const logStatus = (log: MaintenanceLog) => log.status ?? 'completed';
export const isCompleted = (log: MaintenanceLog) => logStatus(log) === 'completed';

export function buildIdMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map(item => [item.id, item]));
}

export function inDateRange(dateKey: string, range: DateRange): boolean {
  if (!dateKey) return false;
  return (!range.start || dateKey >= range.start) && (!range.end || dateKey <= range.end);
}

export const NO_MANUFACTURER = '__none__';

export function manufacturerKey(m: Machine): string {
  return (m.manufacturer || '').trim().toLowerCase() || NO_MANUFACTURER;
}

/** Distinct manufacturers (first spelling wins), sorted; machines without one go last. */
export function manufacturerOptions(machines: Machine[]): { key: string; label: string; count: number }[] {
  const out = new Map<string, { key: string; label: string; count: number }>();
  machines.forEach(m => {
    const key = manufacturerKey(m);
    const row = out.get(key) ?? { key, label: key === NO_MANUFACTURER ? 'Не указан' : (m.manufacturer || '').trim(), count: 0 };
    row.count++;
    out.set(key, row);
  });
  return [...out.values()].sort((a, b) =>
    a.key === NO_MANUFACTURER ? 1 : b.key === NO_MANUFACTURER ? -1 : a.label.localeCompare(b.label, 'ru'));
}

type MachineFilter = Pick<ReportFilters, 'branchId' | 'machineId'> & Partial<Pick<ReportFilters, 'manufacturer' | 'machineStatus'>>;

export function machineMatches(m: Machine, filters: MachineFilter): boolean {
  return (filters.branchId === 'all' || m.branchId === filters.branchId) &&
    (filters.machineId === 'all' || m.id === filters.machineId) &&
    (!filters.manufacturer || filters.manufacturer === 'all' || manufacturerKey(m) === filters.manufacturer) &&
    (!filters.machineStatus || filters.machineStatus === 'all' || m.status === filters.machineStatus);
}

/** Machines matching the machine part of the filter (branch, machine, manufacturer, status). */
export function filterMachines(machines: Machine[], filters: MachineFilter): Machine[] {
  return machines.filter(m => machineMatches(m, filters));
}

/** The one filtered log list every report block is built from. Logs of unknown machines are dropped. */
export function filterLogs(
  logs: MaintenanceLog[],
  machineMap: Map<string, Machine>,
  filters: ReportFilters,
  range: DateRange = filters,
): MaintenanceLog[] {
  return logs.filter(log => {
    const machine = machineMap.get(log.machineId);
    if (!machine || !machineMatches(machine, filters)) return false;
    if (filters.type !== 'all' && log.type !== filters.type) return false;
    if (filters.status !== 'all' && logStatus(log) !== filters.status) return false;
    return inDateRange(toLocalDateKey(log.date), range);
  });
}

export interface ReportInput {
  machines: Machine[];
  branches: Branch[];
  logs: MaintenanceLog[];
  parts: SparePart[];
  schedules: MaintenanceSchedule[];
  users?: AppUser[];
  roles?: Role[];
  units?: UnitOfMeasure[];
}

/** Everything the report tabs share, derived once from the same filters. */
export interface ReportData {
  filters: ReportFilters;
  today: string;
  now: Date;
  branches: Branch[];
  machineMap: Map<string, Machine>;
  branchMap: Map<string, Branch>;
  partLookup: PartLookup;
  /** Machines matching the machine filters (retired included; blocks exclude them where needed). */
  machines: Machine[];
  /** The shared filtered log list (machine filters + type + status + period). */
  logs: MaintenanceLog[];
  /** Same filters over the equally long previous period; null for an open-ended range. */
  prevLogs: MaintenanceLog[] | null;
  /** Unfiltered logs, only as history (schedule on-time checks, last maintenance date). */
  allLogs: MaintenanceLog[];
  /** Non-archived parts of the selected branch. */
  parts: SparePart[];
  /** Archived parts of the selected branch (shown separately, never in totals). */
  archivedParts: SparePart[];
  /** Schedules of the filtered machines. */
  schedules: MaintenanceSchedule[];
  users: AppUser[];
  roles: Role[];
  units: UnitOfMeasure[];
}

export function buildReportData(input: ReportInput, filters: ReportFilters, now: Date = new Date()): ReportData {
  const machineMap = buildIdMap(input.machines);
  const machines = filterMachines(input.machines, filters);
  const machineIds = new Set(machines.map(m => m.id));
  const prev = previousPeriod(filters);
  const branchParts = filterParts(input.parts, machineMap, filters.branchId, true);
  return {
    filters,
    today: todayKey(now),
    now,
    branches: input.branches,
    machineMap,
    branchMap: buildIdMap(input.branches),
    partLookup: buildPartLookup(input.parts),
    machines,
    logs: filterLogs(input.logs, machineMap, filters),
    prevLogs: prev ? filterLogs(input.logs, machineMap, filters, prev) : null,
    allLogs: input.logs,
    parts: branchParts.filter(p => !p.isArchived),
    archivedParts: branchParts.filter(p => p.isArchived),
    schedules: input.schedules.filter(s => machineIds.has(s.machineId)),
    users: input.users ?? [],
    roles: input.roles ?? [],
    units: input.units ?? [],
  };
}

// ---------- Costs ----------

/** Total cost of completed works; planned logs never count as spent money. */
export function sumCompletedCost(logs: MaintenanceLog[]): number {
  return roundTo2(logs.reduce((acc, l) => acc + (isCompleted(l) ? l.cost || 0 : 0), 0));
}

export function plannedSummary(logs: MaintenanceLog[]): { count: number; cost: number } {
  const planned = logs.filter(l => !isCompleted(l));
  return { count: planned.length, cost: roundTo2(planned.reduce((acc, l) => acc + (l.cost || 0), 0)) };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function costByMachine(logs: MaintenanceLog[]): Map<string, number> {
  const out = new Map<string, number>();
  logs.forEach(l => {
    if (!isCompleted(l)) return;
    out.set(l.machineId, (out.get(l.machineId) || 0) + (l.cost || 0));
  });
  return out;
}

export interface PartLookup {
  byId: Map<string, SparePart>;
  byName: Map<string, SparePart>;
}

const normalizeName = (name?: string) => (name || '').trim().toLowerCase();

export function buildPartLookup(parts: SparePart[]): PartLookup {
  const byName = new Map<string, SparePart>();
  parts.forEach(p => {
    const key = normalizeName(p.name);
    if (key && !byName.has(key)) byName.set(key, p);
  });
  return { byId: buildIdMap(parts), byName };
}

/** Matches a used part by partId; the name is only a fallback for legacy entries without partId. */
export function resolvePart(used: { partId?: string; name?: string }, lookup: PartLookup): SparePart | undefined {
  if (used.partId) return lookup.byId.get(used.partId);
  return lookup.byName.get(normalizeName(used.name));
}

export interface PartUsageRow {
  key: string;
  partId?: string;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  unitPrice: number;
  totalCost: number;
}

/** Spare parts consumed by completed works, most used first. */
export function partsUsage(logs: MaintenanceLog[], lookup: PartLookup): PartUsageRow[] {
  const rows = new Map<string, PartUsageRow>();
  logs.forEach(l => {
    if (!isCompleted(l)) return;
    l.partsUsed?.forEach(used => {
      if (!used || (!used.partId && !used.name)) return;
      const part = resolvePart(used, lookup);
      const key = part?.id || used.partId || `name:${normalizeName(used.name)}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          partId: part?.id || used.partId,
          name: part?.name || used.name || 'Запчасть',
          sku: part?.sku || '',
          unit: part?.unit || 'шт',
          qty: 0,
          unitPrice: part?.unitPrice || 0,
          totalCost: 0,
        };
        rows.set(key, row);
      }
      const qty = used.quantity || 0;
      row.qty += qty;
      row.totalCost = roundTo2(row.totalCost + qty * row.unitPrice);
    });
  });
  return [...rows.values()]
    .filter(r => r.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.totalCost - a.totalCost);
}

export function sumPartsUsage(rows: PartUsageRow[]): { qty: number; cost: number } {
  return rows.reduce((acc, r) => ({ qty: acc.qty + r.qty, cost: roundTo2(acc.cost + r.totalCost) }), { qty: 0, cost: 0 });
}

// ---------- Monthly series ----------

export function monthKeysInRange(range: DateRange, fallbackKeys: string[] = []): string[] {
  let start = range.start;
  let end = range.end;
  if (!start || !end) {
    const sorted = [...fallbackKeys].filter(Boolean).sort();
    start = start || sorted[0] || '';
    end = end || sorted[sorted.length - 1] || '';
  }
  if (!start || !end || start > end) return [];
  const keys: string[] = [];
  let cursor = `${start.slice(0, 7)}-01`;
  while (cursor.slice(0, 7) <= end.slice(0, 7) && keys.length < 240) {
    keys.push(cursor.slice(0, 7));
    cursor = shiftMonthsKey(cursor, 1);
  }
  return keys;
}

export interface MonthlyCostPoint {
  month: string;
  label: string;
  planned: number;
  emergency: number;
}

export function monthlyCost(logs: MaintenanceLog[], range: DateRange): MonthlyCostPoint[] {
  const completed = logs.filter(isCompleted);
  const points = new Map<string, MonthlyCostPoint>();
  monthKeysInRange(range, completed.map(l => toLocalDateKey(l.date))).forEach(month =>
    points.set(month, { month, label: monthLabel(month), planned: 0, emergency: 0 })
  );
  completed.forEach(l => {
    const point = points.get(toLocalDateKey(l.date).slice(0, 7));
    if (!point) return;
    if (isEmergencyType(l.type)) point.emergency = roundTo2(point.emergency + (l.cost || 0));
    else point.planned = roundTo2(point.planned + (l.cost || 0));
  });
  return [...points.values()];
}

export function monthlyPartsCost(logs: MaintenanceLog[], lookup: PartLookup, range: DateRange): { month: string; label: string; cost: number; qty: number }[] {
  const completed = logs.filter(isCompleted);
  const points = new Map<string, { month: string; label: string; cost: number; qty: number }>();
  monthKeysInRange(range, completed.map(l => toLocalDateKey(l.date))).forEach(month =>
    points.set(month, { month, label: monthLabel(month), cost: 0, qty: 0 })
  );
  completed.forEach(l => {
    const point = points.get(toLocalDateKey(l.date).slice(0, 7));
    if (!point) return;
    l.partsUsed?.forEach(used => {
      const qty = used.quantity || 0;
      point.qty += qty;
      point.cost = roundTo2(point.cost + qty * (resolvePart(used, lookup)?.unitPrice || 0));
    });
  });
  return [...points.values()];
}

// ---------- Equipment ----------

export const isRetired = (m: Machine) => m.status === 'retired';
export const hasPurchaseData = (m: Machine) => Boolean(m.purchasePrice && m.purchasePrice > 0 && toLocalDateKey(m.purchaseDate));

/** Share of non-retired machines that are active (0 when there are none). */
export function uptimePercent(machines: Machine[]): number {
  const inService = machines.filter(m => !isRetired(m));
  if (inService.length === 0) return 0;
  return (inService.filter(m => m.status === 'active').length / inService.length) * 100;
}

export function statusDistribution(machines: Machine[]): { status: MachineStatus; label: string; count: number; percent: number }[] {
  const total = machines.length;
  return MACHINE_STATUSES.map(status => {
    const count = machines.filter(m => m.status === status).length;
    return { status, label: MACHINE_STATUS_LABELS[status], count, percent: total ? (count / total) * 100 : 0 };
  });
}

/**
 * Residual value of non-retired machines; `missing` counts machines without price or purchase date
 * (they are left out of every sum rather than silently counted as 0).
 */
export function assetSummary(machines: Machine[], now: Date = new Date()): { total: number; purchaseTotal: number; depreciation: number; counted: number; missing: number } {
  let total = 0;
  let purchaseTotal = 0;
  let counted = 0;
  let missing = 0;
  machines.forEach(m => {
    if (isRetired(m)) return;
    if (!hasPurchaseData(m)) {
      missing++;
      return;
    }
    counted++;
    purchaseTotal += m.purchasePrice;
    total += machineService.calculateCurrentValue(m, now);
  });
  return { total: roundTo2(total), purchaseTotal: roundTo2(purchaseTotal), depreciation: roundTo2(purchaseTotal - total), counted, missing };
}

/** Full years since purchase (one decimal); null without a purchase date. */
export function machineAgeYears(m: Machine, now: Date = new Date()): number | null {
  const key = toLocalDateKey(m.purchaseDate);
  if (!key) return null;
  const days = daysBetweenKeys(key, todayKey(now));
  return days < 0 ? 0 : Math.floor((days / 365.25) * 10) / 10;
}

export const AGE_GROUPS = [
  { id: '0-3', label: '0–3 года', min: 0, max: 3 },
  { id: '3-7', label: '3–7 лет', min: 3, max: 7 },
  { id: '7-10', label: '7–10 лет', min: 7, max: 10 },
  { id: '10+', label: '10+ лет', min: 10, max: Infinity },
] as const;

export function ageGroups(machines: Machine[], now: Date = new Date()): { id: string; label: string; count: number; percent: number }[] {
  const counts = new Map<string, number>();
  let unknown = 0;
  machines.forEach(m => {
    const age = machineAgeYears(m, now);
    if (age === null) {
      unknown++;
      return;
    }
    const group = AGE_GROUPS.find(g => age >= g.min && age < g.max)!;
    counts.set(group.id, (counts.get(group.id) || 0) + 1);
  });
  const total = machines.length;
  const rows: { id: string; label: string; count: number; percent: number }[] = AGE_GROUPS.map(g => ({ id: g.id, label: g.label, count: counts.get(g.id) || 0, percent: total ? ((counts.get(g.id) || 0) / total) * 100 : 0 }));
  if (unknown) rows.push({ id: 'unknown', label: 'Нет даты покупки', count: unknown, percent: total ? (unknown / total) * 100 : 0 });
  return rows;
}

export function manufacturerDistribution(machines: Machine[]): { key: string; label: string; count: number; percent: number }[] {
  const total = machines.length;
  return manufacturerOptions(machines)
    .map(o => ({ ...o, percent: total ? (o.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || (a.key === NO_MANUFACTURER ? 1 : -1));
}

/** Latest completed work per machine over all history; falls back to machine.lastMaintenanceDate. */
export function lastMaintenanceByMachine(machines: Machine[], allLogs: MaintenanceLog[]): Map<string, string> {
  const out = new Map<string, string>();
  allLogs.forEach(l => {
    if (!isCompleted(l)) return;
    const key = toLocalDateKey(l.date);
    if (key && key > (out.get(l.machineId) || '')) out.set(l.machineId, key);
  });
  machines.forEach(m => {
    const fallback = toLocalDateKey(m.lastMaintenanceDate);
    if (fallback && !out.has(m.id)) out.set(m.id, fallback);
  });
  return out;
}

export interface MachineRankingRow {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  branchName: string;
  status: MachineStatus;
  ageYears: number | null;
  residual: number | null;
  cost: number;
  /** cost / residual in %; null without price data, Infinity when fully depreciated but still costing money. */
  ratio: number | null;
  emergencies: number;
  mtbfDays: number | null;
  lastMaintenance: string;
}

export function machineRanking(
  machines: Machine[],
  logs: MaintenanceLog[],
  branchMap: Map<string, Branch>,
  lastMaintenance: Map<string, string> = new Map(),
  now: Date = new Date(),
): MachineRankingRow[] {
  const costs = costByMachine(logs);
  const emergencies = new Map<string, number>();
  logs.forEach(l => {
    if (isCompleted(l) && isEmergencyType(l.type)) emergencies.set(l.machineId, (emergencies.get(l.machineId) || 0) + 1);
  });
  const mtbf = new Map(mtbfByMachine(logs, new Map()).map(r => [r.machineId, r.mtbfDays]));
  return machines.map(m => {
    const residual = hasPurchaseData(m) ? roundTo2(machineService.calculateCurrentValue(m, now)) : null;
    const cost = roundTo2(costs.get(m.id) || 0);
    let ratio: number | null = null;
    if (residual !== null) {
      if (residual > 0) ratio = (cost / residual) * 100;
      else if (cost > 0) ratio = Infinity;
      else ratio = 0;
    }
    return {
      id: m.id,
      name: m.name,
      model: m.model,
      manufacturer: (m.manufacturer || '').trim(),
      branchName: branchMap.get(m.branchId)?.name || '—',
      status: m.status,
      ageYears: machineAgeYears(m, now),
      residual,
      cost,
      ratio,
      emergencies: emergencies.get(m.id) || 0,
      mtbfDays: mtbf.get(m.id) ?? null,
      lastMaintenance: lastMaintenance.get(m.id) || '',
    };
  });
}

export function searchMatches(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some(f => (f || '').toLowerCase().includes(q));
}

export type RatioLevel = 'ok' | 'warn' | 'critical';

export function ratioLevel(ratio: number | null): RatioLevel {
  if (ratio === null) return 'ok';
  if (ratio > 80) return 'critical';
  if (ratio > 50) return 'warn';
  return 'ok';
}

export interface IncompleteMachine {
  id: string;
  name: string;
  branchName: string;
  missing: string[];
}

export function incompleteMachines(machines: Machine[], branchMap: Map<string, Branch>): IncompleteMachine[] {
  return machines
    .filter(m => !isRetired(m))
    .map(m => {
      const missing: string[] = [];
      if (!m.purchasePrice || m.purchasePrice <= 0) missing.push('цена');
      if (!toLocalDateKey(m.purchaseDate)) missing.push('дата покупки');
      if (!hasAmperage(m)) missing.push('ампераж');
      return { id: m.id, name: m.name, branchName: branchMap.get(m.branchId)?.name || '—', missing };
    })
    .filter(r => r.missing.length > 0);
}

// ---------- Electrical load ----------

export const hasAmperage = (m: Machine) => Number(m.amperage) > 0;

export interface PowerSummary {
  machineCount: number;
  totalAmps: number;
  activeAmps: number;
  /** Machines stopped for maintenance or repair. */
  disconnectedAmps: number;
  missingCount: number;
  withAmperage: number;
  averageAmps: number;
  maxAmps: number;
  maxMachine: { id: string; name: string } | null;
}

/** Retired machines are excluded entirely; machines without amperage only increase `missingCount`. */
export function powerSummary(machines: Machine[]): PowerSummary {
  let machineCount = 0;
  let totalAmps = 0;
  let activeAmps = 0;
  let disconnectedAmps = 0;
  let missingCount = 0;
  let withAmperage = 0;
  let max: Machine | null = null;
  machines.forEach(m => {
    if (isRetired(m)) return;
    machineCount++;
    if (!hasAmperage(m)) {
      missingCount++;
      return;
    }
    const amps = Number(m.amperage);
    withAmperage++;
    totalAmps += amps;
    if (m.status === 'active') activeAmps += amps;
    else disconnectedAmps += amps;
    if (!max || amps > Number(max.amperage)) max = m;
  });
  const top = max as Machine | null;
  return {
    machineCount,
    totalAmps: roundTo2(totalAmps),
    activeAmps: roundTo2(activeAmps),
    disconnectedAmps: roundTo2(disconnectedAmps),
    missingCount,
    withAmperage,
    averageAmps: withAmperage ? roundTo2(totalAmps / withAmperage) : 0,
    maxAmps: top ? Number(top.amperage) : 0,
    maxMachine: top ? { id: top.id, name: top.name } : null,
  };
}

export interface BranchPowerRow extends PowerSummary {
  branchId: string;
  branchName: string;
  /** Share of this branch in the total current, %. */
  share: number;
  byStatus: { active: number; maintenance: number; repair: number };
}

export function ampsByStatus(machines: Machine[]): { active: number; maintenance: number; repair: number } {
  const out = { active: 0, maintenance: 0, repair: 0 };
  machines.forEach(m => {
    if (isRetired(m) || !hasAmperage(m)) return;
    out[m.status as keyof typeof out] = roundTo2(out[m.status as keyof typeof out] + Number(m.amperage));
  });
  return out;
}

export function powerByBranch(machines: Machine[], branches: Branch[]): { rows: BranchPowerRow[]; total: PowerSummary } {
  const total = powerSummary(machines);
  const rows = groupMachinesByBranch(machines, branches).map(g => {
    const summary = powerSummary(g.machines);
    return {
      branchId: g.branchId,
      branchName: g.branchName,
      ...summary,
      share: total.totalAmps ? (summary.totalAmps / total.totalAmps) * 100 : 0,
      byStatus: ampsByStatus(g.machines),
    };
  });
  return { rows, total };
}

export function missingAmperageMachines(machines: Machine[], branchMap: Map<string, Branch>): { id: string; name: string; model: string; status: MachineStatus; branchName: string }[] {
  return machines
    .filter(m => !isRetired(m) && !hasAmperage(m))
    .map(m => ({ id: m.id, name: m.name, model: m.model, status: m.status, branchName: branchMap.get(m.branchId)?.name || '—' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function topConsumers(machines: Machine[], limit = 10): { id: string; name: string; model: string; status: MachineStatus; amps: number; share: number }[] {
  const total = powerSummary(machines).totalAmps;
  return machines
    .filter(m => !isRetired(m) && hasAmperage(m))
    .map(m => ({ id: m.id, name: m.name, model: m.model, status: m.status, amps: Number(m.amperage), share: total ? (Number(m.amperage) / total) * 100 : 0 }))
    .sort((a, b) => b.amps - a.amps)
    .slice(0, limit);
}

// ---------- Branch summary ----------

export const NO_BRANCH_ID = '__none__';

/** Groups machines by branch (in `branches` order); machines of unknown branches go to a trailing "Без филиала" group. */
export function groupMachinesByBranch(machines: Machine[], branches: Branch[]): { branchId: string; branchName: string; machines: Machine[] }[] {
  const known = new Map(branches.map(b => [b.id, [] as Machine[]]));
  const orphans: Machine[] = [];
  machines.forEach(m => (known.get(m.branchId) ?? orphans).push(m));
  const groups = branches
    .map(b => ({ branchId: b.id, branchName: b.name, machines: known.get(b.id)! }))
    .filter(g => g.machines.length > 0);
  if (orphans.length) groups.push({ branchId: NO_BRANCH_ID, branchName: 'Без филиала', machines: orphans });
  return groups;
}

export interface BranchSummaryRow {
  branchId: string;
  branchName: string;
  machineCount: number;
  totalAmps: number;
  cost: number;
  emergencies: number;
  uptime: number;
}

/** `logs` must already be the shared filtered list, so the cost column sums to the KPI. */
export function branchSummary(machines: Machine[], branches: Branch[], logs: MaintenanceLog[]): BranchSummaryRow[] {
  const logsByMachine = new Map<string, MaintenanceLog[]>();
  logs.forEach(l => {
    const list = logsByMachine.get(l.machineId);
    if (list) list.push(l);
    else logsByMachine.set(l.machineId, [l]);
  });
  return groupMachinesByBranch(machines, branches).map(g => {
    const branchLogs = g.machines.flatMap(m => logsByMachine.get(m.id) || []);
    return {
      branchId: g.branchId,
      branchName: g.branchName,
      machineCount: g.machines.length,
      totalAmps: powerSummary(g.machines).totalAmps,
      cost: sumCompletedCost(branchLogs),
      emergencies: branchLogs.filter(l => isCompleted(l) && isEmergencyType(l.type)).length,
      uptime: uptimePercent(g.machines),
    };
  });
}

// ---------- Maintenance ----------

export function workTypeRatio(logs: MaintenanceLog[]): { planned: { count: number; cost: number }; emergency: { count: number; cost: number } } {
  const out = { planned: { count: 0, cost: 0 }, emergency: { count: 0, cost: 0 } };
  logs.forEach(l => {
    if (!isCompleted(l)) return;
    const bucket = isEmergencyType(l.type) ? out.emergency : out.planned;
    bucket.count++;
    bucket.cost = roundTo2(bucket.cost + (l.cost || 0));
  });
  return out;
}

export interface MtbfRow {
  machineId: string;
  name: string;
  failures: number;
  mtbfDays: number;
}

/** Mean days between completed failures (repair/emergency) per machine; needs at least 2 failures. */
export function mtbfByMachine(logs: MaintenanceLog[], machineMap: Map<string, Machine>): MtbfRow[] {
  const dates = new Map<string, string[]>();
  logs.forEach(l => {
    if (!isCompleted(l) || !isEmergencyType(l.type)) return;
    const key = toLocalDateKey(l.date);
    if (!key) return;
    const list = dates.get(l.machineId);
    if (list) list.push(key);
    else dates.set(l.machineId, [key]);
  });
  const rows: MtbfRow[] = [];
  dates.forEach((keys, machineId) => {
    if (keys.length < 2) return;
    keys.sort();
    rows.push({
      machineId,
      name: machineMap.get(machineId)?.name || '—',
      failures: keys.length,
      mtbfDays: roundTo2(daysBetweenKeys(keys[0], keys[keys.length - 1]) / (keys.length - 1)),
    });
  });
  return rows.sort((a, b) => a.mtbfDays - b.mtbfDays);
}

export interface OverdueTask {
  id: string;
  machineId: string;
  machineName: string;
  taskName: string;
  nextDue: string;
  daysLate: number;
  priority?: MaintenanceSchedule['priority'];
  assignedTechnician?: string;
}

/** Schedules of the given (non-retired) machines whose nextDue is before today. */
export function overdueSchedules(schedules: MaintenanceSchedule[], machineMap: Map<string, Machine>, today: string = todayKey()): OverdueTask[] {
  const out: OverdueTask[] = [];
  schedules.forEach(s => {
    const machine = machineMap.get(s.machineId);
    if (!machine || isRetired(machine)) return;
    const due = toLocalDateKey(s.nextDue);
    if (!due || due >= today) return;
    out.push({
      id: s.id,
      machineId: s.machineId,
      machineName: machine.name,
      taskName: s.taskName,
      nextDue: due,
      daysLate: daysBetweenKeys(due, today),
      priority: s.priority,
      assignedTechnician: s.assignedTechnician,
    });
  });
  return out.sort((a, b) => b.daysLate - a.daysLate);
}

/**
 * On-time rate of scheduled works done in the period: a completion is on time when it happened no later
 * than the previous completion of the same schedule + intervalDays. The first completion has no reference.
 */
export function scheduleOnTime(
  periodLogs: MaintenanceLog[],
  allLogs: MaintenanceLog[],
  schedules: MaintenanceSchedule[],
): { onTime: number; total: number; percent: number | null } {
  const scheduleMap = buildIdMap(schedules);
  const history = new Map<string, string[]>();
  allLogs.forEach(l => {
    if (!l.scheduleId || !isCompleted(l)) return;
    const key = toLocalDateKey(l.date);
    if (!key) return;
    const list = history.get(l.scheduleId);
    if (list) list.push(key);
    else history.set(l.scheduleId, [key]);
  });
  history.forEach(list => list.sort());

  let onTime = 0;
  let total = 0;
  periodLogs.forEach(l => {
    if (!l.scheduleId || !isCompleted(l)) return;
    const schedule = scheduleMap.get(l.scheduleId);
    const dates = history.get(l.scheduleId);
    const key = toLocalDateKey(l.date);
    if (!schedule || !schedule.intervalDays || !dates || !key) return;
    const idx = dates.indexOf(key);
    if (idx <= 0) return;
    total++;
    if (daysBetweenKeys(dates[idx - 1], key) <= schedule.intervalDays) onTime++;
  });
  return { onTime, total, percent: total ? (onTime / total) * 100 : null };
}

export function monthlyWorkCounts(logs: MaintenanceLog[], range: DateRange): { month: string; label: string; planned: number; emergency: number }[] {
  const completed = logs.filter(isCompleted);
  const points = new Map<string, { month: string; label: string; planned: number; emergency: number }>();
  monthKeysInRange(range, completed.map(l => toLocalDateKey(l.date))).forEach(month =>
    points.set(month, { month, label: monthLabel(month), planned: 0, emergency: 0 })
  );
  completed.forEach(l => {
    const point = points.get(toLocalDateKey(l.date).slice(0, 7));
    if (!point) return;
    if (isEmergencyType(l.type)) point.emergency++;
    else point.planned++;
  });
  return [...points.values()];
}

export interface UpcomingTask {
  id: string;
  machineName: string;
  taskName: string;
  nextDue: string;
  inDays: number;
  priority?: MaintenanceSchedule['priority'];
  assignedTechnician?: string;
  estimatedHours: number;
  laborCost: number;
}

/** Plan status of the schedules of non-retired machines: totals, due soon and the next-30-days workload. */
export function scheduleOverview(schedules: MaintenanceSchedule[], machineMap: Map<string, Machine>, today: string = todayKey()) {
  const active = schedules.filter(s => {
    const m = machineMap.get(s.machineId);
    return m && !isRetired(m);
  });
  const upcoming: UpcomingTask[] = [];
  let withoutDate = 0;
  active.forEach(s => {
    const due = toLocalDateKey(s.nextDue);
    if (!due) {
      withoutDate++;
      return;
    }
    const inDays = daysBetweenKeys(today, due);
    if (inDays < 0 || inDays > 30) return;
    upcoming.push({
      id: s.id,
      machineName: machineMap.get(s.machineId)?.name || '—',
      taskName: s.taskName,
      nextDue: due,
      inDays,
      priority: s.priority,
      assignedTechnician: s.assignedTechnician,
      estimatedHours: Number(s.estimatedHours) || 0,
      laborCost: Number(s.laborCost) || 0,
    });
  });
  upcoming.sort((a, b) => a.inDays - b.inDays);
  const next7 = upcoming.filter(t => t.inDays <= 7);
  return {
    total: active.length,
    withoutDate,
    overdue: overdueSchedules(active, machineMap, today),
    next7,
    next30: upcoming,
    load30: {
      tasks: upcoming.length,
      hours: roundTo2(upcoming.reduce((a, t) => a + t.estimatedHours, 0)),
      laborCost: roundTo2(upcoming.reduce((a, t) => a + t.laborCost, 0)),
    },
  };
}

export function searchLogs(logs: MaintenanceLog[], query: string, machineMap: Map<string, Machine>): MaintenanceLog[] {
  if (!query.trim()) return logs;
  return logs.filter(l => {
    const machine = machineMap.get(l.machineId);
    return searchMatches(query, machine?.name, machine?.model, l.notes, l.technicianName, LOG_TYPE_LABELS[l.type],
      ...(l.partsUsed || []).map(p => p.name));
  });
}

export interface TechnicianRow {
  name: string;
  count: number;
  emergencies: number;
  cost: number;
  avgCost: number;
  assignedTasks: number;
  overdueTasks: number;
}

/** Completed works by technicianName, merged with schedule assignments (assignedTechnician). */
export function technicianStats(
  logs: MaintenanceLog[],
  schedules: MaintenanceSchedule[] = [],
  machineMap: Map<string, Machine> = new Map(),
  today: string = todayKey(),
): TechnicianRow[] {
  const rows = new Map<string, TechnicianRow>();
  const rowFor = (raw?: string) => {
    const name = (raw || '').trim() || 'Не указан';
    let row = rows.get(name.toLowerCase());
    if (!row) {
      row = { name, count: 0, emergencies: 0, cost: 0, avgCost: 0, assignedTasks: 0, overdueTasks: 0 };
      rows.set(name.toLowerCase(), row);
    }
    return row;
  };
  logs.forEach(l => {
    if (!isCompleted(l)) return;
    const row = rowFor(l.technicianName);
    row.count++;
    if (isEmergencyType(l.type)) row.emergencies++;
    row.cost = roundTo2(row.cost + (l.cost || 0));
  });
  schedules.forEach(s => {
    const machine = machineMap.get(s.machineId);
    if ((machine && isRetired(machine)) || !(s.assignedTechnician || '').trim()) return;
    const row = rowFor(s.assignedTechnician);
    row.assignedTasks++;
    const due = toLocalDateKey(s.nextDue);
    if (due && due < today) row.overdueTasks++;
  });
  rows.forEach(r => (r.avgCost = r.count ? roundTo2(r.cost / r.count) : 0));
  return [...rows.values()].sort((a, b) => b.count - a.count || b.assignedTasks - a.assignedTasks || b.cost - a.cost);
}

export function sortLogsByDate(logs: MaintenanceLog[], dir: 'asc' | 'desc' = 'desc'): MaintenanceLog[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...logs].sort((a, b) => toLocalDateKey(a.date).localeCompare(toLocalDateKey(b.date)) * factor);
}

export const sortLogsByDateDesc = (logs: MaintenanceLog[]) => sortLogsByDate(logs, 'desc');

// ---------- Inventory ----------

export const partValue = (p: SparePart) => (p.quantity || 0) * (p.unitPrice || 0);
export const partAvailable = (p: SparePart) => p.availableQuantity ?? p.quantity ?? 0;
export const isLowStock = (p: SparePart) => partAvailable(p) <= (p.minQuantity || 0);

/** Branch a part belongs to: its own branchId, or the single branch of its bound machines. */
export function partHomeBranch(part: SparePart, machineMap: Map<string, Machine>): string | null {
  if (part.branchId) return part.branchId;
  const ids = new Set((part.machineIds ?? []).map(id => machineMap.get(id)?.branchId).filter(Boolean) as string[]);
  return ids.size === 1 ? [...ids][0] : null;
}

/** Parts of the branch (by branchId, or by the branches of bound machines); archived ones only on request. */
export function filterParts(parts: SparePart[], machineMap: Map<string, Machine>, branchId: string, includeArchived = false): SparePart[] {
  return parts.filter(p => {
    if (p.isArchived && !includeArchived) return false;
    if (branchId === 'all') return true;
    if (p.branchId) return p.branchId === branchId;
    return (p.machineIds ?? []).some(id => machineMap.get(id)?.branchId === branchId);
  });
}

export function stockSummary(parts: SparePart[]): { value: number; items: number; lowCount: number } {
  return {
    value: roundTo2(parts.reduce((acc, p) => acc + partValue(p), 0)),
    items: parts.length,
    lowCount: parts.filter(isLowStock).length,
  };
}

export function stockByBranch(
  parts: SparePart[],
  branches: Branch[],
  machineMap: Map<string, Machine>,
  selectedBranchId: string,
): { branchId: string; branchName: string; items: number; value: number }[] {
  const rows = new Map<string, { branchId: string; branchName: string; items: number; value: number }>();
  const branchNames = new Map(branches.map(b => [b.id, b.name]));
  parts.forEach(p => {
    const home = selectedBranchId !== 'all' ? selectedBranchId : partHomeBranch(p, machineMap);
    const branchId = home && branchNames.has(home) ? home : NO_BRANCH_ID;
    let row = rows.get(branchId);
    if (!row) {
      row = { branchId, branchName: branchNames.get(branchId) || 'Общий склад / несколько филиалов', items: 0, value: 0 };
      rows.set(branchId, row);
    }
    row.items++;
    row.value = roundTo2(row.value + partValue(p));
  });
  const order = new Map(branches.map((b, i) => [b.id, i]));
  return [...rows.values()].sort((a, b) => (order.get(a.branchId) ?? 1e9) - (order.get(b.branchId) ?? 1e9));
}

/** Parts in stock that no completed work in `logs` used. */
export function deadStock(parts: SparePart[], logs: MaintenanceLog[], lookup: PartLookup): SparePart[] {
  const used = new Set<string>();
  logs.forEach(l => {
    if (!isCompleted(l)) return;
    l.partsUsed?.forEach(u => {
      const part = resolvePart(u, lookup);
      if (part) used.add(part.id);
    });
  });
  return parts.filter(p => (p.quantity || 0) > 0 && !used.has(p.id)).sort((a, b) => partValue(b) - partValue(a));
}

export function lowStockRows(parts: SparePart[]): { part: SparePart; available: number; reserved: number; min: number; deficit: number }[] {
  return parts
    .filter(isLowStock)
    .map(part => {
      const available = partAvailable(part);
      const min = part.minQuantity || 0;
      return { part, available, reserved: part.reservedQuantity || 0, min, deficit: roundTo2(Math.max(0, min - available)) };
    })
    .sort((a, b) => b.deficit - a.deficit || a.available - b.available);
}

export function usageByMachine(logs: MaintenanceLog[], lookup: PartLookup, machineMap: Map<string, Machine>): { machineId: string; name: string; qty: number; cost: number; works: number }[] {
  const rows = new Map<string, { machineId: string; name: string; qty: number; cost: number; works: number }>();
  logs.forEach(l => {
    if (!isCompleted(l) || !l.partsUsed?.length) return;
    const row = rows.get(l.machineId) ?? { machineId: l.machineId, name: machineMap.get(l.machineId)?.name || '—', qty: 0, cost: 0, works: 0 };
    row.works++;
    l.partsUsed.forEach(u => {
      const qty = u.quantity || 0;
      row.qty += qty;
      row.cost = roundTo2(row.cost + qty * (resolvePart(u, lookup)?.unitPrice || 0));
    });
    rows.set(l.machineId, row);
  });
  return [...rows.values()].sort((a, b) => b.cost - a.cost || b.qty - a.qty);
}

/** Stock grouped by unit of measure; units unknown to the catalog keep their raw code. */
export function stockByUnit(parts: SparePart[], units: UnitOfMeasure[]): { code: string; name: string; items: number; qty: number; value: number }[] {
  const names = new Map(units.map(u => [u.code.trim().toLowerCase(), u.name]));
  const rows = new Map<string, { code: string; name: string; items: number; qty: number; value: number }>();
  parts.forEach(p => {
    const code = (p.unit || 'шт').trim() || 'шт';
    const key = code.toLowerCase();
    const row = rows.get(key) ?? { code, name: names.get(key) || code, items: 0, qty: 0, value: 0 };
    row.items++;
    row.qty = roundTo2(row.qty + (p.quantity || 0));
    row.value = roundTo2(row.value + partValue(p));
    rows.set(key, row);
  });
  return [...rows.values()].sort((a, b) => b.value - a.value || b.items - a.items);
}

// ---------- Overview: attention list ----------

export type AttentionTab = 'equipment' | 'power' | 'maintenance' | 'inventory' | 'quality';

export interface AttentionGroup {
  id: 'repair' | 'overdue' | 'lowStock' | 'noAmperage' | 'noPrice';
  title: string;
  tab: AttentionTab;
  tone: 'danger' | 'warning';
  items: { id: string; title: string; subtitle: string }[];
}

export function attentionGroups(data: ReportData): AttentionGroup[] {
  const branchName = (id: string) => data.branchMap.get(id)?.name || '—';
  const inService = data.machines.filter(m => !isRetired(m));
  const groups: AttentionGroup[] = [
    {
      id: 'repair',
      title: 'Станки в ремонте',
      tab: 'equipment',
      tone: 'danger',
      items: inService.filter(m => m.status === 'repair').map(m => ({ id: m.id, title: m.name, subtitle: branchName(m.branchId) })),
    },
    {
      id: 'overdue',
      title: 'Просроченные задачи ТО',
      tab: 'maintenance',
      tone: 'danger',
      items: overdueSchedules(data.schedules, data.machineMap, data.today).map(t => ({
        id: t.id,
        title: `${t.machineName}: ${t.taskName}`,
        subtitle: `Просрочено на ${t.daysLate} ${pluralRu(t.daysLate, ['день', 'дня', 'дней'])}`,
      })),
    },
    {
      id: 'lowStock',
      title: 'Заканчиваются запчасти',
      tab: 'inventory',
      tone: 'warning',
      items: lowStockRows(data.parts).map(r => ({
        id: r.part.id,
        title: r.part.name,
        subtitle: `Доступно ${formatNumber(r.available)} из мин. ${formatNumber(r.min)} ${r.part.unit || 'шт'}`,
      })),
    },
    {
      id: 'noAmperage',
      title: 'Не указан ампераж',
      tab: 'power',
      tone: 'warning',
      items: inService.filter(m => !hasAmperage(m)).map(m => ({ id: m.id, title: m.name, subtitle: branchName(m.branchId) })),
    },
    {
      id: 'noPrice',
      title: 'Нет цены или даты покупки',
      tab: 'quality',
      tone: 'warning',
      items: inService.filter(m => !hasPurchaseData(m)).map(m => ({ id: m.id, title: m.name, subtitle: branchName(m.branchId) })),
    },
  ];
  return groups.filter(g => g.items.length > 0);
}

// ---------- Branches ----------

export interface BranchComparisonRow {
  branchId: string;
  branchName: string;
  location: string;
  contactPerson: string;
  machineCount: number;
  byStatus: Record<MachineStatus, number>;
  totalAmps: number;
  activeAmps: number;
  residual: number;
  cost: number;
  emergencies: number;
  overdue: number;
  stockValue: number;
  users: number;
}

/**
 * One row per branch with machines, stock or users; built from the shared filtered data so
 * the "Итого" row matches the KPIs of the other tabs (cost, amps, stock value).
 */
export function branchComparison(data: ReportData): { rows: BranchComparisonRow[]; total: BranchComparisonRow } {
  const emptyStatus = (): Record<MachineStatus, number> => ({ active: 0, maintenance: 0, repair: 0, retired: 0 });
  const make = (branchId: string, branchName: string, b?: Branch): BranchComparisonRow => ({
    branchId, branchName, location: b?.location || '', contactPerson: b?.contactPerson || '',
    machineCount: 0, byStatus: emptyStatus(), totalAmps: 0, activeAmps: 0, residual: 0, cost: 0, emergencies: 0, overdue: 0, stockValue: 0, users: 0,
  });
  const rows = new Map<string, BranchComparisonRow>();
  const visible = data.filters.branchId === 'all' ? data.branches : data.branches.filter(b => b.id === data.filters.branchId);
  visible.forEach(b => rows.set(b.id, make(b.id, b.name, b)));
  const rowFor = (branchId: string | null | undefined) => {
    const id = branchId && data.branchMap.has(branchId) ? branchId : NO_BRANCH_ID;
    let row = rows.get(id);
    if (!row) {
      row = id === NO_BRANCH_ID ? make(NO_BRANCH_ID, 'Без филиала / общий склад') : make(id, data.branchMap.get(id)!.name, data.branchMap.get(id));
      rows.set(id, row);
    }
    return row;
  };

  groupMachinesByBranch(data.machines, data.branches).forEach(g => {
    const row = rowFor(g.branchId === NO_BRANCH_ID ? null : g.branchId);
    const power = powerSummary(g.machines);
    row.machineCount = g.machines.length;
    g.machines.forEach(m => row.byStatus[m.status]++);
    row.totalAmps = power.totalAmps;
    row.activeAmps = power.activeAmps;
    row.residual = assetSummary(g.machines, data.now).total;
  });
  branchSummary(data.machines, data.branches, data.logs).forEach(r => {
    const row = rowFor(r.branchId === NO_BRANCH_ID ? null : r.branchId);
    row.cost = r.cost;
    row.emergencies = r.emergencies;
  });
  overdueSchedules(data.schedules, data.machineMap, data.today).forEach(t => rowFor(data.machineMap.get(t.machineId)?.branchId).overdue++);
  data.parts.forEach(p => {
    const home = data.filters.branchId !== 'all' ? data.filters.branchId : partHomeBranch(p, data.machineMap);
    const row = rowFor(home);
    row.stockValue = roundTo2(row.stockValue + partValue(p));
  });
  const assignedUsers = new Set<string>();
  data.users.forEach(u => (u.branchIds || []).forEach(id => {
    const row = rows.get(id);
    if (!row) return;
    row.users++;
    assignedUsers.add(u.id);
  }));

  const list = [...rows.values()];
  const total = make('__total__', 'Итого');
  list.forEach(r => {
    total.machineCount += r.machineCount;
    MACHINE_STATUSES.forEach(st => (total.byStatus[st] += r.byStatus[st]));
    total.totalAmps = roundTo2(total.totalAmps + r.totalAmps);
    total.activeAmps = roundTo2(total.activeAmps + r.activeAmps);
    total.residual = roundTo2(total.residual + r.residual);
    total.cost = roundTo2(total.cost + r.cost);
    total.emergencies += r.emergencies;
    total.overdue += r.overdue;
    total.stockValue = roundTo2(total.stockValue + r.stockValue);
  });
  // A user assigned to several branches is counted once in the total.
  total.users = assignedUsers.size;
  return { rows: list, total };
}

// ---------- Transfers (rows come from /analytics/transfers) ----------

export interface TransferLike {
  machineId: string;
  fromBranchId: string | null;
  toBranchId: string;
}

export function transferBalance(rows: TransferLike[], branches: Branch[]): { branchId: string; branchName: string; incoming: number; outgoing: number; balance: number }[] {
  const out = new Map(branches.map(b => [b.id, { branchId: b.id, branchName: b.name, incoming: 0, outgoing: 0, balance: 0 }]));
  rows.forEach(r => {
    const to = out.get(r.toBranchId);
    if (to) to.incoming++;
    const from = r.fromBranchId ? out.get(r.fromBranchId) : undefined;
    if (from) from.outgoing++;
  });
  return [...out.values()]
    .map(r => ({ ...r, balance: r.incoming - r.outgoing }))
    .filter(r => r.incoming || r.outgoing);
}

/** Applies the machine-level filters the endpoint doesn't know about (manufacturer, machine status). */
export function filterTransferRows<T extends TransferLike & { date: string }>(rows: T[], machineMap: Map<string, Machine>, filters: ReportFilters): T[] {
  const machineLevel = (filters.manufacturer && filters.manufacturer !== 'all') || (filters.machineStatus && filters.machineStatus !== 'all');
  return rows.filter(r => {
    if (!inDateRange(toLocalDateKey(r.date), filters)) return false;
    if (!machineLevel) return true;
    const m = machineMap.get(r.machineId);
    return Boolean(m && machineMatches(m, { branchId: 'all', machineId: 'all', manufacturer: filters.manufacturer, machineStatus: filters.machineStatus }));
  });
}

// ---------- Users & activity (rows come from /analytics/users-activity) ----------

export interface UserLike {
  id: string;
  status: 'active' | 'blocked';
  roleName: string | null;
  branchIds: string[];
  lastLogin: string | null;
  total: number;
}

export function userStats(users: UserLike[], branches: Branch[]) {
  const byRole = new Map<string, number>();
  const byBranch = new Map(branches.map(b => [b.id, { branchId: b.id, branchName: b.name, count: 0 }]));
  let unassigned = 0;
  users.forEach(u => {
    const role = u.roleName || 'Без роли';
    byRole.set(role, (byRole.get(role) || 0) + 1);
    if (!u.branchIds.length) unassigned++;
    u.branchIds.forEach(id => {
      const row = byBranch.get(id);
      if (row) row.count++;
    });
  });
  return {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    blocked: users.filter(u => u.status === 'blocked').length,
    byRole: [...byRole.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    byBranch: [...byBranch.values()].filter(r => r.count > 0).sort((a, b) => b.count - a.count),
    unassigned,
  };
}

/** Active users who never logged in or whose last login is older than `days` days. */
export function inactiveUsers<T extends UserLike>(users: T[], now: Date = new Date(), days = 30): (T & { daysSince: number | null })[] {
  const today = todayKey(now);
  return users
    .filter(u => u.status === 'active')
    .map(u => {
      const last = toLocalDateKey(u.lastLogin);
      return { ...u, daysSince: last ? daysBetweenKeys(last, today) : null };
    })
    .filter(u => u.daysSince === null || u.daysSince > days)
    .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
}

/** Daily series with zero-filled gaps (capped at 400 days so an open range stays drawable). */
export function fillDaily(points: { date: string; count: number }[], range: DateRange): { date: string; label: string; count: number }[] {
  const counts = new Map(points.map(p => [p.date, p.count]));
  const keys = points.map(p => p.date).sort();
  const start = range.start || keys[0];
  const end = range.end || keys[keys.length - 1];
  if (!start || !end || start > end) return [];
  const out: { date: string; label: string; count: number }[] = [];
  for (let key = start; key <= end && out.length < 400; key = shiftDateKey(key, 1)) {
    out.push({ date: key, label: formatDateKey(key).slice(0, 5), count: counts.get(key) || 0 });
  }
  return out;
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  transfer: 'Перемещение',
  other: 'Прочее',
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  machine: 'Оборудование',
  branch: 'Филиалы',
  part: 'Запчасти',
  schedule: 'График ТО',
  log: 'Журнал работ',
  transfer: 'Перемещения',
  user: 'Пользователи',
  role: 'Роли',
  other: 'Прочее',
};

// ---------- Data quality ----------

export interface CompletenessField {
  id: string;
  label: string;
  filled: number;
  total: number;
  percent: number;
}

export interface IncompleteRecord {
  id: string;
  kind: 'machine' | 'part' | 'schedule';
  name: string;
  branchName: string;
  missing: string[];
}

function completeness<T>(items: T[], fields: { id: string; label: string; ok: (item: T) => boolean }[]) {
  return {
    fields: fields.map(f => {
      const filled = items.filter(f.ok).length;
      return { id: f.id, label: f.label, filled, total: items.length, percent: items.length ? (filled / items.length) * 100 : 100 };
    }),
    missing: (item: T) => fields.filter(f => !f.ok(item)).map(f => f.label),
  };
}

const hasMainImage = (m: Machine) => Boolean(m.imageUrl || m.imageUrls?.length || m.attachments?.some(a => a.isMainImage || a.type === 'image'));
const hasDocuments = (m: Machine) => Boolean(m.attachments?.some(a => a.type !== 'image' && a.type !== 'video'));

/** Completeness of machines (non-retired), parts (non-archived) and schedules (of non-retired machines). */
export function dataQuality(data: ReportData): {
  machines: CompletenessField[];
  parts: CompletenessField[];
  schedules: CompletenessField[];
  records: IncompleteRecord[];
  overall: number;
} {
  const branchName = (id?: string | null) => (id && data.branchMap.get(id)?.name) || '—';
  const machines = data.machines.filter(m => !isRetired(m));
  const mq = completeness(machines, [
    { id: 'price', label: 'Цена', ok: m => m.purchasePrice > 0 },
    { id: 'purchaseDate', label: 'Дата покупки', ok: m => Boolean(toLocalDateKey(m.purchaseDate)) },
    { id: 'usefulLife', label: 'Срок службы', ok: m => (m.usefulLifeYears || 0) > 0 },
    { id: 'amperage', label: 'Ампераж', ok: hasAmperage },
    { id: 'manufacturer', label: 'Производитель', ok: m => Boolean((m.manufacturer || '').trim()) },
    { id: 'image', label: 'Основное фото', ok: hasMainImage },
    { id: 'documents', label: 'Документы', ok: hasDocuments },
  ]);
  const pq = completeness(data.parts, [
    { id: 'price', label: 'Цена', ok: p => (p.unitPrice || 0) > 0 },
    { id: 'min', label: 'Мин. остаток', ok: p => (p.minQuantity || 0) > 0 },
    { id: 'unit', label: 'Ед. измерения', ok: p => Boolean((p.unit || '').trim()) },
  ]);
  const schedules = data.schedules.filter(s => {
    const m = data.machineMap.get(s.machineId);
    return m && !isRetired(m);
  });
  const sq = completeness(schedules, [
    { id: 'technician', label: 'Ответственный', ok: s => Boolean((s.assignedTechnician || '').trim()) },
    { id: 'laborCost', label: 'Стоимость работ', ok: s => Number(s.laborCost) > 0 },
  ]);

  const records: IncompleteRecord[] = [
    ...machines.map(m => ({ id: m.id, kind: 'machine' as const, name: m.name, branchName: branchName(m.branchId), missing: mq.missing(m) })),
    ...data.parts.map(p => ({ id: p.id, kind: 'part' as const, name: p.name, branchName: branchName(partHomeBranch(p, data.machineMap)), missing: pq.missing(p) })),
    ...schedules.map(s => ({
      id: s.id,
      kind: 'schedule' as const,
      name: `${data.machineMap.get(s.machineId)?.name || '—'}: ${s.taskName}`,
      branchName: branchName(data.machineMap.get(s.machineId)?.branchId),
      missing: sq.missing(s),
    })),
  ].filter(r => r.missing.length > 0);

  const all = [...mq.fields, ...pq.fields, ...sq.fields];
  const filled = all.reduce((a, f) => a + f.filled, 0);
  const total = all.reduce((a, f) => a + f.total, 0);
  return { machines: mq.fields, parts: pq.fields, schedules: sq.fields, records, overall: total ? (filled / total) * 100 : 100 };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${formatNumber(bytes / 1024 ** i, i ? 1 : 0)} ${units[i]}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Local-day boundaries of the period as ISO instants for backend `from`/`to` params. */
export function rangeToInstants(range: DateRange): { from?: string; to?: string } {
  return {
    from: range.start ? parseDateKey(range.start).toISOString() : undefined,
    to: range.end ? new Date(parseDateKey(shiftDateKey(range.end, 1)).getTime() - 1).toISOString() : undefined,
  };
}

// ---------- CSV ----------

export type CsvCell = string | number | null | undefined;

const escapeCsv = (cell: CsvCell): string => {
  if (cell === null || cell === undefined) return '';
  // Comma decimals so Excel with a Russian locale reads numbers as numbers.
  const text = typeof cell === 'number' ? (Number.isFinite(cell) ? String(roundTo2(cell)).replace('.', ',') : '') : cell;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** ";"-separated CSV with a UTF-8 BOM (Excel needs it to detect Cyrillic). */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return '﻿' + [headers, ...rows].map(r => r.map(escapeCsv).join(';')).join('\r\n');
}
