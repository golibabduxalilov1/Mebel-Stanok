import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Boxes, Cog, LayoutDashboard, Printer, RotateCcw, ShieldAlert, Wrench, Zap } from 'lucide-react';
import type { Branch, Machine, MaintenanceLog, MaintenanceSchedule, Role, SparePart } from '../../types';
import { canPerformAction } from '../../services/userService';
import { buildReportData, defaultDateRange, LOG_TYPES, LOG_TYPE_LABELS, ReportFilters, StatusFilter } from './reportUtils';
import { OverviewTab } from './OverviewTab';
import { EquipmentTab } from './EquipmentTab';
import { PowerTab } from './PowerTab';
import { MaintenanceTab } from './MaintenanceTab';
import { InventoryTab } from './InventoryTab';

type ReportTabId = 'overview' | 'equipment' | 'power' | 'maintenance' | 'inventory';

const STORAGE_KEY = 'mebel-stanok.reports.v1';
const STATUS_VALUES: StatusFilter[] = ['all', 'completed', 'planned'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const defaultFilters = (): ReportFilters => ({ branchId: 'all', machineId: 'all', type: 'all', status: 'all', ...defaultDateRange() });

function loadSaved(): { tab?: ReportTabId; filters: ReportFilters } {
  const fallback = defaultFilters();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { filters: fallback };
    const saved = JSON.parse(raw) ?? {};
    const f = saved.filters ?? {};
    const date = (v: unknown, def: string) => (typeof v === 'string' && (v === '' || DATE_RE.test(v)) ? v : def);
    return {
      tab: saved.tab,
      filters: {
        branchId: typeof f.branchId === 'string' ? f.branchId : 'all',
        machineId: typeof f.machineId === 'string' ? f.machineId : 'all',
        type: f.type === 'all' || LOG_TYPES.includes(f.type) ? f.type : 'all',
        status: STATUS_VALUES.includes(f.status) ? f.status : 'all',
        start: date(f.start, fallback.start),
        end: date(f.end, fallback.end),
      },
    };
  } catch {
    return { filters: fallback };
  }
}

const SELECT_CLASS = 'w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50';
const LABEL_CLASS = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2';

export function ReportsTab({ machines, branches, logs, parts, schedules, role }: {
  machines: Machine[];
  branches: Branch[];
  logs: MaintenanceLog[];
  parts: SparePart[];
  schedules: MaintenanceSchedule[];
  role: Role | null;
}) {
  const [saved] = useState(loadSaved);
  const [filters, setFilters] = useState<ReportFilters>(saved.filters);
  const [activeTab, setActiveTab] = useState<ReportTabId>(saved.tab ?? 'overview');

  const canEquipment = canPerformAction(role, 'reports.equipment_report', 'view');
  const canToir = canPerformAction(role, 'reports.toir_report', 'view');
  const canInventory = canPerformAction(role, 'reports.inventory_report', 'view');
  const canSummary = canPerformAction(role, 'reports.summary_report', 'view');
  const exportSummary = canPerformAction(role, 'reports.summary_report', 'export');
  const exportEquipment = canPerformAction(role, 'reports.equipment_report', 'export');
  const exportToir = canPerformAction(role, 'reports.toir_report', 'export');
  const exportInventory = canPerformAction(role, 'reports.inventory_report', 'export');
  const canPrint = exportSummary || exportEquipment || exportToir || exportInventory;

  const tabs = [
    { id: 'overview' as const, label: 'Обзор', icon: LayoutDashboard, allowed: canSummary },
    { id: 'equipment' as const, label: 'Оборудование', icon: Cog, allowed: canEquipment },
    { id: 'power' as const, label: 'Электрическая нагрузка', icon: Zap, allowed: canEquipment },
    { id: 'maintenance' as const, label: 'ТОиР и ремонты', icon: Wrench, allowed: canToir },
    { id: 'inventory' as const, label: 'Склад', icon: Boxes, allowed: canInventory },
  ].filter(t => t.allowed);
  const currentTab = tabs.some(t => t.id === activeTab) ? activeTab : tabs[0]?.id;

  // Drop a saved branch/machine that no longer exists (only once the lists have loaded).
  useEffect(() => {
    setFilters(prev => {
      let next = prev;
      if (prev.branchId !== 'all' && branches.length > 0 && !branches.some(b => b.id === prev.branchId)) {
        next = { ...next, branchId: 'all', machineId: 'all' };
      }
      if (next.machineId !== 'all' && machines.length > 0) {
        const machine = machines.find(m => m.id === next.machineId);
        if (!machine || (next.branchId !== 'all' && machine.branchId !== next.branchId)) next = { ...next, machineId: 'all' };
      }
      return next;
    });
  }, [branches, machines]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tab: activeTab, filters }));
    } catch {
      // storage unavailable (private mode, quota) - the report still works without it
    }
  }, [activeTab, filters]);

  const data = useMemo(
    () => buildReportData({ machines, branches, logs, parts, schedules }, filters),
    [machines, branches, logs, parts, schedules, filters],
  );

  const machineOptions = useMemo(
    () => machines.filter(m => filters.branchId === 'all' || m.branchId === filters.branchId),
    [machines, filters.branchId],
  );

  const update = (patch: Partial<ReportFilters>) => setFilters(prev => ({ ...prev, ...patch }));
  const invalidRange = Boolean(filters.start && filters.end && filters.start > filters.end);

  if (tabs.length === 0 || !currentTab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto my-12">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">
          Доступ к аналитическим отчетам отключен
        </h3>
        <p className="text-xs text-slate-500 max-w-md mb-2 leading-relaxed">
          В матрице прав для роли «<strong className="text-slate-800 font-bold">{role?.name || 'Пользователь'}</strong>» отключены все галочки в разделе «Отчеты».
        </p>
        <p className="text-[11px] text-slate-400 max-w-md">
          Для включения доступа администратор должен активировать необходимые права в окне «Пользователи и роли» → «Матрица прав».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-auto pb-20 px-1 custom-scrollbar">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Панель управления отчетом
          </h3>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={() => setFilters(defaultFilters())}
              className="flex items-center gap-2 min-h-10 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Сбросить
            </button>
            {canPrint && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 min-h-10 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <Printer className="w-4 h-4" />
                Печать отчета
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
          <div>
            <label className={LABEL_CLASS}>Филиал</label>
            <select className={SELECT_CLASS} value={filters.branchId} onChange={e => update({ branchId: e.target.value, machineId: 'all' })}>
              <option value="all">Все филиалы</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Станок</label>
            <select className={SELECT_CLASS} value={filters.machineId} onChange={e => update({ machineId: e.target.value })}>
              <option value="all">Все оборудование</option>
              {machineOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
            <label className={LABEL_CLASS}>Статус работ</label>
            <select className={SELECT_CLASS} value={filters.status} onChange={e => update({ status: e.target.value as StatusFilter })}>
              <option value="all">Все</option>
              <option value="completed">Выполненные</option>
              <option value="planned">Запланированные</option>
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
        </div>
        {invalidRange && (
          <p className="text-xs font-bold text-rose-600">Начало периода позже его конца — выборка будет пустой.</p>
        )}
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

      {currentTab === 'overview' && <OverviewTab data={data} canExport={exportSummary} canToir={canToir} canInventory={canInventory} />}
      {currentTab === 'equipment' && <EquipmentTab data={data} canExport={exportEquipment} />}
      {currentTab === 'power' && <PowerTab data={data} canExport={exportEquipment} />}
      {currentTab === 'maintenance' && <MaintenanceTab data={data} canExport={exportToir} />}
      {currentTab === 'inventory' && <InventoryTab data={data} canExport={exportInventory} />}
    </div>
  );
}
