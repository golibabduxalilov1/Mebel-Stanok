import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft, BarChart3, Boxes, Building2, ClipboardCheck, Cog, LayoutDashboard, Printer, RotateCcw, ShieldAlert, Users, Wrench, Zap,
} from 'lucide-react';
import type { ActivityLog, AppUser, Branch, Machine, MachineStatus, MaintenanceLog, MaintenanceSchedule, Role, SparePart, UnitOfMeasure } from '../../types';
import { canPerformAction } from '../../services/userService';
import {
  AttentionTab, buildReportData, defaultDateRange, detectPreset, formatDateTime, formatPeriod, LOG_TYPES, LOG_TYPE_LABELS, MACHINE_STATUS_LABELS,
  MACHINE_STATUSES, manufacturerKey, manufacturerOptions, PERIOD_PRESETS, presetRange, ReportFilters, StatusFilter,
} from './reportUtils';
import { OverviewTab } from './tabs/OverviewTab';
import { BranchesTab } from './tabs/BranchesTab';
import { EquipmentTab } from './tabs/EquipmentTab';
import { PowerTab } from './tabs/PowerTab';
import { MaintenanceTab } from './tabs/MaintenanceTab';
import { InventoryTab } from './tabs/InventoryTab';
import { TransfersTab } from './tabs/TransfersTab';
import { UsersActivityTab } from './tabs/UsersActivityTab';
import { DataQualityTab } from './tabs/DataQualityTab';

type ReportTabId = 'overview' | 'branches' | 'equipment' | 'power' | 'maintenance' | 'inventory' | 'transfers' | 'users' | 'quality';

const STORAGE_KEY = 'mebel-stanok.reports.v2';
const STATUS_VALUES: StatusFilter[] = ['all', 'completed', 'planned'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const defaultFilters = (): ReportFilters => ({
  branchId: 'all', machineId: 'all', manufacturer: 'all', machineStatus: 'all', type: 'all', status: 'all', ...defaultDateRange(),
});

function readStorage(): { tab?: ReportTabId; filters: ReportFilters } {
  const fallback = defaultFilters();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { filters: fallback };
    const saved = JSON.parse(raw) ?? {};
    const f = saved.filters ?? {};
    const str = (v: unknown) => (typeof v === 'string' && v ? v : 'all');
    const date = (v: unknown, def: string) => (typeof v === 'string' && (v === '' || DATE_RE.test(v)) ? v : def);
    return {
      tab: typeof saved.tab === 'string' ? saved.tab : undefined,
      filters: {
        branchId: str(f.branchId),
        machineId: str(f.machineId),
        manufacturer: str(f.manufacturer),
        machineStatus: MACHINE_STATUSES.includes(f.machineStatus) ? f.machineStatus : 'all',
        type: LOG_TYPES.includes(f.type) ? f.type : 'all',
        status: STATUS_VALUES.includes(f.status) ? f.status : 'all',
        start: date(f.start, fallback.start),
        end: date(f.end, fallback.end),
      },
    };
  } catch {
    return { filters: fallback };
  }
}

function writeStorage(value: { tab: ReportTabId; filters: ReportFilters }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode, quota) - the report works without it
  }
}

// Prints only the report: everything that neither is, contains nor sits inside the report area is hidden,
// and its ancestors lose the height/overflow limits of the app shell so long tables are not clipped.
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body:has(.report-print-area) *:not(.report-print-area):not(:has(.report-print-area)):not(.report-print-area *) { display: none !important; }
  *:has(.report-print-area) { overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; position: static !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .report-print-area { overflow: visible !important; padding: 0 !important; }
  .report-print-area .report-scroll { max-height: none !important; overflow: visible !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const SELECT_CLASS = 'w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 min-w-0';
const LABEL_CLASS = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2';

export function ReportsTab({ machines, branches, logs, parts, schedules, activityLogs = [], users = [], roles = [], units = [], role, onOpenMachine }: {
  machines: Machine[];
  branches: Branch[];
  logs: MaintenanceLog[];
  parts: SparePart[];
  schedules: MaintenanceSchedule[];
  activityLogs?: ActivityLog[];
  users?: AppUser[];
  roles?: Role[];
  units?: UnitOfMeasure[];
  role: Role | null;
  onOpenMachine?: (machine: Machine) => void;
}) {
  const [saved] = useState(readStorage);
  const [filters, setFilters] = useState<ReportFilters>(saved.filters);
  const [activeTab, setActiveTab] = useState<ReportTabId>(saved.tab ?? 'overview');

  const can = (key: string, action: 'view' | 'export' = 'view') => canPerformAction(role, key, action);
  const canEquipment = can('reports.equipment_report');
  const canToir = can('reports.toir_report');
  const canInventory = can('reports.inventory_report');
  const canSummary = can('reports.summary_report');
  const canHistory = can('history.activity_log');
  const exportSummary = can('reports.summary_report', 'export');
  const exportEquipment = can('reports.equipment_report', 'export');
  const exportToir = can('reports.toir_report', 'export');
  const exportInventory = can('reports.inventory_report', 'export');
  const exportHistory = can('history.activity_log', 'export');
  const canPrint = exportSummary || exportEquipment || exportToir || exportInventory;

  const tabs = [
    { id: 'overview' as const, label: 'Обзор', icon: LayoutDashboard, allowed: canSummary },
    { id: 'branches' as const, label: 'Филиалы', icon: Building2, allowed: canSummary },
    { id: 'equipment' as const, label: 'Оборудование', icon: Cog, allowed: canEquipment },
    { id: 'power' as const, label: 'Электрическая нагрузка', icon: Zap, allowed: canEquipment },
    { id: 'maintenance' as const, label: 'ТОиР и ремонты', icon: Wrench, allowed: canToir },
    { id: 'inventory' as const, label: 'Склад', icon: Boxes, allowed: canInventory },
    { id: 'transfers' as const, label: 'Перемещения', icon: ArrowRightLeft, allowed: canEquipment || canSummary },
    { id: 'users' as const, label: 'Пользователи и активность', icon: Users, allowed: canHistory },
    { id: 'quality' as const, label: 'Качество данных', icon: ClipboardCheck, allowed: canEquipment || canInventory || canToir },
  ].filter(t => t.allowed);
  const currentTab = tabs.some(t => t.id === activeTab) ? activeTab : tabs[0]?.id;
  const currentTabLabel = tabs.find(t => t.id === currentTab)?.label ?? '';

  // Drop a saved branch/machine/manufacturer that no longer exists (only once the lists have loaded).
  useEffect(() => {
    setFilters(prev => {
      let next = prev;
      if (next.branchId !== 'all' && branches.length > 0 && !branches.some(b => b.id === next.branchId)) {
        next = { ...next, branchId: 'all', machineId: 'all' };
      }
      if (machines.length > 0) {
        if (next.machineId !== 'all') {
          const machine = machines.find(m => m.id === next.machineId);
          if (!machine || (next.branchId !== 'all' && machine.branchId !== next.branchId)) next = { ...next, machineId: 'all' };
        }
        if (next.manufacturer !== 'all' && !machines.some(m => manufacturerKey(m) === next.manufacturer)) next = { ...next, manufacturer: 'all' };
      }
      return next;
    });
  }, [branches, machines]);

  useEffect(() => writeStorage({ tab: activeTab, filters }), [activeTab, filters]);

  const data = useMemo(
    () => buildReportData({ machines, branches, logs, parts, schedules, users, roles, units }, filters),
    [machines, branches, logs, parts, schedules, users, roles, units, filters],
  );

  const branchMachines = useMemo(() => machines.filter(m => filters.branchId === 'all' || m.branchId === filters.branchId), [machines, filters.branchId]);
  const manufacturers = useMemo(() => manufacturerOptions(branchMachines), [branchMachines]);
  const machineOptions = useMemo(
    () => branchMachines
      .filter(m => (filters.manufacturer === 'all' || manufacturerKey(m) === filters.manufacturer) && (filters.machineStatus === 'all' || m.status === filters.machineStatus))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [branchMachines, filters.manufacturer, filters.machineStatus],
  );

  const update = (patch: Partial<ReportFilters>) => setFilters(prev => ({ ...prev, ...patch }));
  const activePreset = detectPreset(filters);
  const invalidRange = Boolean(filters.start && filters.end && filters.start > filters.end);
  const openMachine = onOpenMachine ? (id: string) => {
    const machine = data.machineMap.get(id);
    if (machine) onOpenMachine(machine);
  } : undefined;
  const navigate = (tab: AttentionTab) => setActiveTab(tabs.some(t => t.id === tab) ? tab : currentTab!);

  if (!currentTab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto my-12">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">Доступ к аналитическим отчетам отключен</h3>
        <p className="text-xs text-slate-500 max-w-md mb-2 leading-relaxed">
          В матрице прав для роли «<strong className="text-slate-800 font-bold">{role?.name || 'Пользователь'}</strong>» отключены все галочки в разделе «Отчеты».
        </p>
        <p className="text-[11px] text-slate-400 max-w-md">
          Для включения доступа администратор должен активировать необходимые права в окне «Пользователи и роли» → «Матрица прав».
        </p>
      </div>
    );
  }

  const branchName = filters.branchId === 'all' ? 'Все филиалы' : data.branchMap.get(filters.branchId)?.name || '—';
  const selectedMachine = filters.machineId !== 'all' ? data.machineMap.get(filters.machineId)?.name : undefined;

  return (
    <div className="report-print-area space-y-4 sm:space-y-6 overflow-auto pb-20 px-1 custom-scrollbar">
      <style>{PRINT_CSS}</style>

      <div className="hidden print:block border-b-2 border-slate-800 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">StankoBase · Аналитический отчёт</p>
        <h1 className="text-xl font-black text-slate-900">{currentTabLabel}</h1>
        <p className="text-xs text-slate-700 mt-1">
          Филиал: <strong>{branchName}</strong>{selectedMachine ? <> · Станок: <strong>{selectedMachine}</strong></> : null} · Период: <strong>{formatPeriod(filters)}</strong>
        </p>
        <p className="text-[10px] text-slate-500">Сформирован: {formatDateTime(new Date().toISOString())}</p>
      </div>

      <div className="print:hidden bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Панель управления отчетом
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilters(defaultFilters())}
              className="flex items-center gap-2 min-h-10 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Сбросить фильтры
            </button>
            {canPrint && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 min-h-10 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <Printer className="w-4 h-4" />
                Печать
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
          <div>
            <label className={LABEL_CLASS}>Филиал</label>
            <select className={SELECT_CLASS} value={filters.branchId} onChange={e => update({ branchId: e.target.value, machineId: 'all', manufacturer: 'all' })}>
              <option value="all">Все филиалы</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Производитель</label>
            <select className={SELECT_CLASS} value={filters.manufacturer} onChange={e => update({ manufacturer: e.target.value, machineId: 'all' })}>
              <option value="all">Все производители</option>
              {manufacturers.map(m => <option key={m.key} value={m.key}>{m.label} ({m.count})</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Статус станка</label>
            <select className={SELECT_CLASS} value={filters.machineStatus} onChange={e => update({ machineStatus: e.target.value as 'all' | MachineStatus, machineId: 'all' })}>
              <option value="all">Любой статус</option>
              {MACHINE_STATUSES.map(s => <option key={s} value={s}>{MACHINE_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="lg:col-span-3 2xl:col-span-3">
            <label className={LABEL_CLASS}>Станок</label>
            <select className={SELECT_CLASS} value={filters.machineId} onChange={e => update({ machineId: e.target.value })}>
              <option value="all">Все оборудование ({machineOptions.length})</option>
              {machineOptions.map(m => <option key={m.id} value={m.id}>{m.name}{m.model ? ` — ${m.model}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Тип работ</label>
            <select className={SELECT_CLASS} value={filters.type} onChange={e => update({ type: e.target.value as ReportFilters['type'] })}>
              <option value="all">Любые работы</option>
              {LOG_TYPES.map(t => <option key={t} value={t}>{LOG_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Статус работы</label>
            <select className={SELECT_CLASS} value={filters.status} onChange={e => update({ status: e.target.value as StatusFilter })}>
              <option value="all">Все</option>
              <option value="completed">Выполнено</option>
              <option value="planned">Запланировано</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Начало периода</label>
            <input type="date" className={SELECT_CLASS} value={filters.start} max={filters.end || undefined} onChange={e => update({ start: e.target.value })} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Конец периода</label>
            <input type="date" className={SELECT_CLASS} value={filters.end} min={filters.start || undefined} onChange={e => update({ end: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 2xl:col-span-2">
            <span className={LABEL_CLASS}>Период</span>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => update(presetRange(p.id))}
                  aria-pressed={activePreset === p.id}
                  className={`min-h-10 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    activePreset === p.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {invalidRange && <p className="text-xs font-bold text-rose-600">Начало периода позже его конца — выборка будет пустой.</p>}
      </div>

      <div className="print:hidden -mx-1 px-1 overflow-x-auto custom-scrollbar">
        <div className="flex gap-2 min-w-max" role="tablist">
          {tabs.map(tab => {
            const active = tab.id === currentTab;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 min-h-10 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap ${
                  active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {currentTab === 'overview' && (
        <OverviewTab data={data} canExport={exportSummary} canEquipment={canEquipment} canToir={canToir} canInventory={canInventory} onNavigate={navigate} />
      )}
      {currentTab === 'branches' && (
        <BranchesTab data={data} canExport={exportSummary} onSelectBranch={id => update({ branchId: id, machineId: 'all' })} onOpenMachine={openMachine} />
      )}
      {currentTab === 'equipment' && (
        <EquipmentTab data={data} canExport={exportEquipment} onSelectMachine={id => update({ machineId: id })} onOpenMachine={openMachine} />
      )}
      {currentTab === 'power' && <PowerTab data={data} canExport={exportEquipment} onOpenMachine={openMachine} />}
      {currentTab === 'maintenance' && <MaintenanceTab data={data} canExport={exportToir} />}
      {currentTab === 'inventory' && <InventoryTab data={data} canExport={exportInventory} />}
      {currentTab === 'transfers' && <TransfersTab data={data} canExport={exportEquipment || exportSummary} />}
      {currentTab === 'users' && <UsersActivityTab data={data} canExport={exportHistory} recentActivity={activityLogs} />}
      {currentTab === 'quality' && (
        <DataQualityTab data={data} canExport={exportEquipment || exportInventory || exportToir}
          canEquipment={canEquipment} canInventory={canInventory} canToir={canToir} onOpenMachine={openMachine} />
      )}
    </div>
  );
}
