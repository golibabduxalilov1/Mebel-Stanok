import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Printer, RotateCcw, ShieldAlert,
} from 'lucide-react';
import type { Branch, Machine, MaintenanceLog, MaintenanceSchedule, Role, SparePart, UnitOfMeasure } from '../../types';
import { canPerformAction } from '../../services/userService';
import {
  buildReportData, defaultDateRange, detectPreset, formatDateTime, formatPeriod, PERIOD_PRESETS, presetRange, ReportFilters,
} from './reportUtils';
import { OverviewTab } from './tabs/OverviewTab';

const STORAGE_KEY = 'mebel-stanok.reports.v2';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const defaultFilters = (): ReportFilters => ({
  branchId: 'all', machineId: 'all', manufacturer: 'all', machineStatus: 'all', type: 'all', status: 'all', ...defaultDateRange(),
});

function readStorage(): ReportFilters {
  const fallback = defaultFilters();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) ?? {};
    const f = saved.filters ?? {};
    const str = (v: unknown) => (typeof v === 'string' && v ? v : 'all');
    const date = (v: unknown, def: string) => (typeof v === 'string' && (v === '' || DATE_RE.test(v)) ? v : def);
    return {
      branchId: str(f.branchId),
      machineId: str(f.machineId),
      manufacturer: str(f.manufacturer),
      machineStatus: str(f.machineStatus) as ReportFilters['machineStatus'],
      type: str(f.type) as ReportFilters['type'],
      status: str(f.status) as ReportFilters['status'],
      start: date(f.start, fallback.start),
      end: date(f.end, fallback.end),
    };
  } catch {
    return fallback;
  }
}

function writeStorage(filters: ReportFilters) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ filters }));
  } catch {
    // storage unavailable
  }
}

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

export function ReportsTab({ machines, branches, logs, parts, schedules, users = [], roles = [], units = [], role, onOpenMachine }: {
  machines: Machine[];
  branches: Branch[];
  logs: MaintenanceLog[];
  parts: SparePart[];
  schedules: MaintenanceSchedule[];
  users?: AppUser[];
  roles?: Role[];
  units?: UnitOfMeasure[];
  role: Role | null;
  onOpenMachine?: (machine: Machine) => void;
}) {
  const [filters, setFilters] = useState<ReportFilters>(readStorage);

  const can = (key: string, action: 'view' | 'export' = 'view') => canPerformAction(role, key, action);
  const canSummary = can('reports.summary_report');
  const exportSummary = can('reports.summary_report', 'export');

  useEffect(() => {
    setFilters(prev => {
      let next = prev;
      if (next.branchId !== 'all' && branches.length > 0 && !branches.some(b => b.id === next.branchId)) {
        next = { ...next, branchId: 'all', machineId: 'all' };
      }
      return next;
    });
  }, [branches]);

  useEffect(() => writeStorage(filters), [filters]);

  const data = useMemo(
    () => buildReportData({ machines, branches, logs, parts, schedules, users, roles, units }, filters),
    [machines, branches, logs, parts, schedules, users, roles, units, filters],
  );

  const update = (patch: Partial<ReportFilters>) => setFilters(prev => ({ ...prev, ...patch }));
  const activePreset = detectPreset(filters);
  const invalidRange = Boolean(filters.start && filters.end && filters.start > filters.end);
  const openMachine = onOpenMachine ? (id: string) => {
    const machine = data.machineMap.get(id);
    if (machine) onOpenMachine(machine);
  } : undefined;

  if (!canSummary) {
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

  return (
    <div className="report-print-area space-y-4 sm:space-y-6 overflow-auto pb-20 px-1 custom-scrollbar">
      <style>{PRINT_CSS}</style>

      <div className="hidden print:block border-b-2 border-slate-800 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">StankoBase · Аналитический отчёт</p>
        <h1 className="text-xl font-black text-slate-900">Обзор</h1>
        <p className="text-xs text-slate-700 mt-1">
          Филиал: <strong>{branchName}</strong> · Период: <strong>{formatPeriod(filters)}</strong>
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
            {exportSummary && (
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className={LABEL_CLASS}>Филиал</label>
            <select className={SELECT_CLASS} value={filters.branchId} onChange={e => update({ branchId: e.target.value, machineId: 'all', manufacturer: 'all' })}>
              <option value="all">Все филиалы</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
          <div>
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

      <OverviewTab data={data} canExport={exportSummary} canEquipment={false} canToir={false} canInventory={false} onNavigate={() => {}} />
    </div>
  );
}
