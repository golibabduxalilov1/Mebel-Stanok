import type { Branch, LogType, Machine, MachineStatus, MaintenanceLog, MaintenanceSchedule, SparePart } from '../../types';
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
  const end = todayKey(now);
  return { start: shiftMonthsKey(end, -3), end };
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

/** Machines matching the branch/machine part of the filter. */
export function filterMachines(machines: Machine[], filters: Pick<ReportFilters, 'branchId' | 'machineId'>): Machine[] {
  return machines.filter(m =>
    (filters.branchId === 'all' || m.branchId === filters.branchId) &&
    (filters.machineId === 'all' || m.id === filters.machineId)
  );
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
    if (!machine) return false;
    if (filters.branchId !== 'all' && machine.branchId !== filters.branchId) return false;
    if (filters.machineId !== 'all' && log.machineId !== filters.machineId) return false;
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
}

/** Everything the report tabs share, derived once from the same filters. */
export interface ReportData {
  filters: ReportFilters;
  today: string;
  branches: Branch[];
  machineMap: Map<string, Machine>;
  branchMap: Map<string, Branch>;
  partLookup: PartLookup;
  /** Machines matching the branch + machine filter (retired included; blocks exclude them where needed). */
  machines: Machine[];
  /** The shared filtered log list (branch + machine + type + status + period). */
  logs: MaintenanceLog[];
  /** Same filters over the equally long previous period; null for an open-ended range. */
  prevLogs: MaintenanceLog[] | null;
  /** Unfiltered logs, only as history for schedule on-time checks. */
  allLogs: MaintenanceLog[];
  /** Non-archived parts of the selected branch. */
  parts: SparePart[];
  /** Schedules of the filtered machines. */
  schedules: MaintenanceSchedule[];
}

export function buildReportData(input: ReportInput, filters: ReportFilters, now: Date = new Date()): ReportData {
  const machineMap = buildIdMap(input.machines);
  const machines = filterMachines(input.machines, filters);
  const machineIds = new Set(machines.map(m => m.id));
  const prev = previousPeriod(filters);
  return {
    filters,
    today: todayKey(now),
    branches: input.branches,
    machineMap,
    branchMap: buildIdMap(input.branches),
    partLookup: buildPartLookup(input.parts),
    machines,
    logs: filterLogs(input.logs, machineMap, filters),
    prevLogs: prev ? filterLogs(input.logs, machineMap, filters, prev) : null,
    allLogs: input.logs,
    parts: filterParts(input.parts, machineMap, filters.branchId),
    schedules: input.schedules.filter(s => machineIds.has(s.machineId)),
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

/** Residual value of non-retired machines; `missing` counts machines without price or purchase date. */
export function assetSummary(machines: Machine[], now: Date = new Date()): { total: number; counted: number; missing: number } {
  let total = 0;
  let counted = 0;
  let missing = 0;
  machines.forEach(m => {
    if (isRetired(m)) return;
    if (!hasPurchaseData(m)) {
      missing++;
      return;
    }
    counted++;
    total += machineService.calculateCurrentValue(m, now);
  });
  return { total: roundTo2(total), counted, missing };
}

export interface MachineRankingRow {
  id: string;
  name: string;
  model: string;
  branchName: string;
  status: MachineStatus;
  residual: number | null;
  cost: number;
  /** cost / residual in %; null without price data, Infinity when fully depreciated but still costing money. */
  ratio: number | null;
}

export function machineRanking(
  machines: Machine[],
  costs: Map<string, number>,
  branchMap: Map<string, Branch>,
  now: Date = new Date(),
): MachineRankingRow[] {
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
      branchName: branchMap.get(m.branchId)?.name || '—',
      status: m.status,
      residual,
      cost,
      ratio,
    };
  });
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
  missingCount: number;
  withAmperage: number;
  averageAmps: number;
}

/** Retired machines are excluded entirely; machines without amperage only increase `missingCount`. */
export function powerSummary(machines: Machine[]): PowerSummary {
  let machineCount = 0;
  let totalAmps = 0;
  let activeAmps = 0;
  let missingCount = 0;
  let withAmperage = 0;
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
  });
  return {
    machineCount,
    totalAmps: roundTo2(totalAmps),
    activeAmps: roundTo2(activeAmps),
    missingCount,
    withAmperage,
    averageAmps: withAmperage ? roundTo2(totalAmps / withAmperage) : 0,
  };
}

export interface BranchPowerRow extends PowerSummary {
  branchId: string;
  branchName: string;
}

export function powerByBranch(machines: Machine[], branches: Branch[]): { rows: BranchPowerRow[]; total: PowerSummary } {
  const groups = groupMachinesByBranch(machines, branches);
  return {
    rows: groups.map(g => ({ branchId: g.branchId, branchName: g.branchName, ...powerSummary(g.machines) })),
    total: powerSummary(machines),
  };
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

export function technicianStats(logs: MaintenanceLog[]): { name: string; count: number; emergencies: number; cost: number }[] {
  const rows = new Map<string, { name: string; count: number; emergencies: number; cost: number }>();
  logs.forEach(l => {
    if (!isCompleted(l)) return;
    const name = (l.technicianName || '').trim() || 'Не указан';
    let row = rows.get(name.toLowerCase());
    if (!row) {
      row = { name, count: 0, emergencies: 0, cost: 0 };
      rows.set(name.toLowerCase(), row);
    }
    row.count++;
    if (isEmergencyType(l.type)) row.emergencies++;
    row.cost = roundTo2(row.cost + (l.cost || 0));
  });
  return [...rows.values()].sort((a, b) => b.count - a.count || b.cost - a.cost);
}

export function sortLogsByDateDesc(logs: MaintenanceLog[]): MaintenanceLog[] {
  return [...logs].sort((a, b) => toLocalDateKey(b.date).localeCompare(toLocalDateKey(a.date)));
}

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

/** Non-archived parts of the branch (by branchId, or by the branches of bound machines). */
export function filterParts(parts: SparePart[], machineMap: Map<string, Machine>, branchId: string): SparePart[] {
  return parts.filter(p => {
    if (p.isArchived) return false;
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
