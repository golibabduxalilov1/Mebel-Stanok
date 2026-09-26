import React, { useMemo } from 'react';
import { ArrowLeft, Building2, Cog, History as HistoryIcon, MapPin, User } from 'lucide-react';
import {
  BranchComparisonRow, NO_BRANCH_ID, ReportData, branchComparison, costByMachine, formatAmps, formatDateKey, formatMoney, formatNumber,
  formatPercent, hasPurchaseData, isCompleted, LOG_TYPE_BADGE, LOG_TYPE_LABELS, MACHINE_STATUS_LABELS, sortLogsByDateDesc, toLocalDateKey,
} from '../reportUtils';
import { XlsxButton, EmptyState, KpiCard, Panel, SCROLL_BOX, SortTh, StatusBadge, TD, TD_FIRST, TFOOT_ROW, THEAD_ROW, useSorted } from '../ReportUi';
import { machineService } from '../../../services/machineService';

const STATUS_BADGE = {
  active: 'bg-emerald-50 text-emerald-700',
  maintenance: 'bg-amber-50 text-amber-700',
  repair: 'bg-rose-50 text-rose-700',
  retired: 'bg-slate-100 text-slate-600',
} as const;

const SORT = {
  name: (r: BranchComparisonRow) => r.branchName,
  machines: (r: BranchComparisonRow) => r.machineCount,
  active: (r: BranchComparisonRow) => r.byStatus.active,
  maintenance: (r: BranchComparisonRow) => r.byStatus.maintenance,
  repair: (r: BranchComparisonRow) => r.byStatus.repair,
  retired: (r: BranchComparisonRow) => r.byStatus.retired,
  amps: (r: BranchComparisonRow) => r.totalAmps,
  activeAmps: (r: BranchComparisonRow) => r.activeAmps,
  residual: (r: BranchComparisonRow) => r.residual,
  cost: (r: BranchComparisonRow) => r.cost,
  emergencies: (r: BranchComparisonRow) => r.emergencies,
  overdue: (r: BranchComparisonRow) => r.overdue,
  stock: (r: BranchComparisonRow) => r.stockValue,
  users: (r: BranchComparisonRow) => r.users,
};

const CSV_HEADERS = ['Филиал', 'Станков', 'В работе', 'На ТО', 'В ремонте', 'Ток всего, А', 'Ток в работе, А',
  'Остаточная амортизация, $', 'Ремонт за период, $', 'Склад, $'];
const csvRow = (r: BranchComparisonRow) => [r.branchName, r.machineCount, r.byStatus.active, r.byStatus.maintenance, r.byStatus.repair,
  r.totalAmps, r.activeAmps, r.residual, r.cost, r.stockValue];

export function BranchesTab({ data, canExport, onSelectBranch, onOpenMachine }: {
  data: ReportData;
  canExport: boolean;
  onSelectBranch: (branchId: string) => void;
  onOpenMachine?: (machineId: string) => void;
}) {
  const comparison = useMemo(() => branchComparison(data), [data]);
  const { sorted, sort, toggle } = useSorted(comparison.rows, SORT, { key: 'cost', dir: 'desc' });
  const selected = data.filters.branchId !== 'all' ? data.branchMap.get(data.filters.branchId) : undefined;

  if (selected) {
    const row = comparison.rows.find(r => r.branchId === selected.id) ?? comparison.total;
    return <BranchPassport data={data} row={row} canExport={canExport} onBack={() => onSelectBranch('all')} onOpenMachine={onOpenMachine} />;
  }

  const th = (label: string, key: string, align: 'left' | 'right' = 'right') => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} align={align} />;
  return (
    <Panel
      title="Сравнение филиалов"
      icon={Building2}
      bodyClass=""
      actions={canExport && (
        <XlsxButton filename="sravnenie_filialov" disabled={!sorted.length} headers={CSV_HEADERS}
          rows={() => [...sorted.map(csvRow), csvRow(comparison.total)]} />
      )}
      footer="Нажмите на филиал, чтобы открыть его паспорт. Ремонт и аварии — выполненные работы за период; пользователь, привязанный к нескольким филиалам, в «Итого» учтён один раз."
    >
      {sorted.length === 0 ? (
        <EmptyState text="Нет филиалов по выбранным фильтрам" />
      ) : (
        <div className="report-scroll overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={THEAD_ROW}>
                <SortTh label="Филиал" sortKey="name" sort={sort} onSort={toggle} className="sm:pl-6" />
                {th('Станков', 'machines')}
                {th('В работе', 'active')}
                {th('ТО', 'maintenance')}
                {th('Ремонт', 'repair')}
                {th('Ток', 'amps')}
                {th('Ток в работе', 'activeAmps')}
                {th('Ост. амортизация', 'residual')}
                {th('Ремонт', 'cost')}
                {th('Склад', 'stock')}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(r => {
                const clickable = r.branchId !== NO_BRANCH_ID;
                return (
                  <tr key={r.branchId} className={`transition-colors ${clickable ? 'hover:bg-blue-50/40 cursor-pointer' : ''}`} onClick={clickable ? () => onSelectBranch(r.branchId) : undefined}>
                    <td className={`${TD_FIRST} min-w-44`}>
                      <p className={`font-bold ${clickable ? 'text-blue-700' : 'text-slate-800'}`}>{r.branchName}</p>
                      {r.location && <p className="text-[10px] text-slate-400 truncate max-w-56">{r.location}</p>}
                    </td>
                    <td className={`${TD} text-right font-mono`}>{r.machineCount}</td>
                    <td className={`${TD} text-right font-mono text-emerald-700`}>{r.byStatus.active}</td>
                    <td className={`${TD} text-right font-mono ${r.byStatus.maintenance ? 'text-amber-700' : 'text-slate-300'}`}>{r.byStatus.maintenance}</td>
                    <td className={`${TD} text-right font-mono ${r.byStatus.repair ? 'text-rose-700 font-bold' : 'text-slate-300'}`}>{r.byStatus.repair}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(r.totalAmps)}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap text-slate-600`}>{formatAmps(r.activeAmps)}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatMoney(r.residual)}</td>
                    <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatMoney(r.cost)}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatMoney(r.stockValue)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={TFOOT_ROW}>
                <td className={`${TD_FIRST} text-[11px] uppercase tracking-widest`}>Итого</td>
                {csvRow(comparison.total).slice(1).map((v, i) => (
                  <td key={i} className={`${TD} text-right font-mono whitespace-nowrap`}>
                    {[4, 5].includes(i) ? formatAmps(Number(v)) : [6, 7, 8].includes(i) ? formatMoney(Number(v)) : v}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

function BranchPassport({ data, row, canExport, onBack, onOpenMachine }: {
  data: ReportData;
  row: BranchComparisonRow;
  canExport: boolean;
  onBack: () => void;
  onOpenMachine?: (machineId: string) => void;
}) {
  const details = useMemo(() => {
    const costs = costByMachine(data.logs);
    return {
      machines: [...data.machines]
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .map(m => ({
          machine: m,
          residual: hasPurchaseData(m) ? machineService.calculateCurrentValue(m, data.now) : null,
          cost: costs.get(m.id) || 0,
        })),
      lastWorks: sortLogsByDateDesc(data.logs).slice(0, 10),
    };
  }, [data]);
  const inService = row.machineCount - row.byStatus.retired;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Паспорт филиала</p>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 break-words">{row.branchName}</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" />{row.location || 'Адрес не указан'}</span>
            <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" />{row.contactPerson || 'Ответственный не указан'}</span>
          </div>
        </div>
        <button type="button" onClick={onBack} className="print:hidden inline-flex items-center gap-1.5 min-h-9 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          Все филиалы
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Станков" value={row.machineCount} tone="dark"
          hint={`В работе ${row.byStatus.active} · ТО ${row.byStatus.maintenance} · ремонт ${row.byStatus.repair} · списано ${row.byStatus.retired}`} />
        <KpiCard label="В работе" value={formatPercent(inService ? (row.byStatus.active / inService) * 100 : 0)} hint="Активные / не списанные" />
        <KpiCard label="Суммарный ток" value={formatAmps(row.totalAmps)} hint={`В работе ${formatAmps(row.activeAmps)}`} />
        <KpiCard label="Остаточная амортизация" value={formatMoney(row.residual)} />
        <KpiCard label="Ремонт за период" value={formatMoney(row.cost)} />
        <KpiCard label="Аварий" value={row.emergencies} tone={row.emergencies ? 'danger' : 'default'} />
        <KpiCard label="Просрочено ТО" value={row.overdue} tone={row.overdue ? 'danger' : 'default'} />
        <KpiCard label="Склад / пользователи" value={formatMoney(row.stockValue)} hint={`Пользователей филиала: ${row.users}`} />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel
          title="Оборудование филиала"
          icon={Cog}
          bodyClass=""
          actions={canExport && (
            <XlsxButton filename="oborudovanie_filiala" disabled={!details.machines.length}
              headers={['Станок', 'Модель', 'Статус', 'Ток, А', 'Остаточная амортизация, $', 'Ремонт за период, $']}
              rows={() => details.machines.map(r => [r.machine.name, r.machine.model, MACHINE_STATUS_LABELS[r.machine.status], Number(r.machine.amperage) || null, r.residual, r.cost])} />
          )}
        >
          {details.machines.length === 0 ? <EmptyState text="Нет оборудования по выбранным фильтрам" compact /> : (
            <div className={SCROLL_BOX}>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Станок</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3 text-right">Ток</th>
                    <th className="px-4 py-3 text-right">Ост. амортизация</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Ремонт</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {details.machines.map(({ machine, residual, cost }) => (
                    <tr key={machine.id} className="hover:bg-blue-50/20">
                      <td className={`${TD_FIRST} min-w-44`}>
                        {onOpenMachine ? (
                          <button type="button" onClick={() => onOpenMachine(machine.id)} className="font-bold text-blue-700 hover:underline text-left cursor-pointer">{machine.name}</button>
                        ) : <p className="font-bold text-slate-800">{machine.name}</p>}
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{machine.model}</p>
                      </td>
                      <td className={TD}><StatusBadge label={MACHINE_STATUS_LABELS[machine.status]} className={STATUS_BADGE[machine.status]} /></td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${Number(machine.amperage) > 0 ? '' : 'text-amber-600'}`}>
                        {Number(machine.amperage) > 0 ? formatAmps(Number(machine.amperage)) : 'не указан'}
                      </td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${residual === null ? 'text-slate-400' : ''}`}>{residual === null ? 'нет данных' : formatMoney(residual)}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap">{formatMoney(cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Последние 10 работ" icon={HistoryIcon} bodyClass="">
          {details.lastWorks.length === 0 ? <EmptyState compact /> : (
            <ul className="divide-y divide-slate-50">
              {details.lastWorks.map(log => (
                <li key={log.id} className="px-4 sm:px-6 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-slate-400">{formatDateKey(toLocalDateKey(log.date))}</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{data.machineMap.get(log.machineId)?.name || '—'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <StatusBadge label={LOG_TYPE_LABELS[log.type] || log.type} className={LOG_TYPE_BADGE[log.type] || 'bg-slate-100 text-slate-600'} />
                      {!isCompleted(log) && <StatusBadge label="Запланировано" className="bg-amber-50 text-amber-700" />}
                      {log.technicianName && <span className="text-[10px] text-slate-500">{log.technicianName}</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-black shrink-0 ${isCompleted(log) ? 'text-slate-900' : 'text-slate-400'}`}>{formatMoney(log.cost || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="text-[10px] text-slate-400 px-1">Показатели учитывают все фильтры: станок, производитель, статус, тип и статус работ, период ({formatNumber(data.logs.length)} записей).</p>
    </div>
  );
}
