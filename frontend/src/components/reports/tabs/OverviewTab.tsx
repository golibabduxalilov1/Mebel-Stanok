import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Building2, ChevronRight, Cog, Package, TrendingDown } from 'lucide-react';
import {
  AttentionTab, BranchComparisonRow, MachineRankingRow, NO_BRANCH_ID, ReportData, assetSummary, attentionGroups, branchComparison,
  formatAmps, formatDateKey, formatMoney, formatNumber, formatPercent, isCompleted, isEmergencyType, isRetired,
  lastMaintenanceByMachine, MACHINE_STATUS_LABELS, machineRanking, monthlyCost, overdueSchedules, percentChange, plannedSummary,
  pluralRu, powerSummary, ratioLevel, searchMatches, stockSummary, sumCompletedCost, uptimePercent, WORKS_FORMS,
} from '../reportUtils';
import {
  CsvButton, EmptyState, KpiCard, KPI_GRID, Panel, ProgressBar, SCROLL_BOX, SearchInput, SortTh, StatusBadge,
  TD, TD_FIRST, TFOOT_ROW, THEAD_ROW, useSorted,
} from '../ReportUi';
import { SERIES_COLORS } from '../charts/ChartFrame';
import { StackedBarChart } from '../charts/StackedBarChart';

const STATUS_BADGE = {
  active: 'bg-emerald-50 text-emerald-700',
  maintenance: 'bg-amber-50 text-amber-700',
  repair: 'bg-rose-50 text-rose-700',
  retired: 'bg-slate-100 text-slate-600',
} as const;

const formatRatio = (ratio: number | null) => (ratio === null ? '—' : ratio === Infinity ? '> 100%' : formatPercent(ratio, 1));

const BRANCH_SORT = {
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

const RANKING_SORT = {
  name: (r: MachineRankingRow) => r.name,
  branch: (r: MachineRankingRow) => r.branchName,
  status: (r: MachineRankingRow) => r.status,
  age: (r: MachineRankingRow) => r.ageYears,
  residual: (r: MachineRankingRow) => r.residual,
  cost: (r: MachineRankingRow) => r.cost,
  ratio: (r: MachineRankingRow) => (r.ratio === Infinity ? Number.MAX_VALUE : r.ratio),
  emergencies: (r: MachineRankingRow) => r.emergencies,
  mtbf: (r: MachineRankingRow) => r.mtbfDays,
  last: (r: MachineRankingRow) => r.lastMaintenance || null,
};

const CSV_BRANCH_HEADERS = ['Филиал', 'Станков', 'В работе', 'На ТО', 'В ремонте', 'Списано', 'Ток всего, А', 'Ток в работе, А',
  'Остаточная стоимость, $', 'Затраты за период, $', 'Аварий', 'Просрочено ТО', 'Склад, $', 'Пользователей'];
const csvBranchRow = (r: BranchComparisonRow) => [r.branchName, r.machineCount, r.byStatus.active, r.byStatus.maintenance, r.byStatus.repair,
  r.byStatus.retired, r.totalAmps, r.activeAmps, r.residual, r.cost, r.emergencies, r.overdue, r.stockValue, r.users];

function ChangeBadge({ change, invert = false }: { change: number | null | undefined; invert?: boolean }) {
  if (change === undefined) return <span>Нет периода для сравнения</span>;
  if (change === null) return <span>В прошлом периоде было 0</span>;
  const worse = invert ? change < 0 : change > 0;
  const tone = change === 0 ? 'text-slate-500' : worse ? 'text-rose-600' : 'text-emerald-600';
  return (
    <span className={`font-bold ${tone}`}>
      {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {formatPercent(Math.abs(change), 1)} к прошлому периоду
    </span>
  );
}

export function OverviewTab({ data, canExport, canEquipment, canToir, canInventory, onNavigate, onSelectBranch, onSelectMachine }: {
  data: ReportData;
  canExport: boolean;
  canEquipment: boolean;
  canToir: boolean;
  canInventory: boolean;
  onNavigate: (tab: AttentionTab) => void;
  onSelectBranch: (branchId: string) => void;
  onSelectMachine: (machineId: string) => void;
}) {
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const cost = sumCompletedCost(data.logs);
    const emergencies = (logs: typeof data.logs) => logs.filter(l => isCompleted(l) && isEmergencyType(l.type)).length;
    const byStatus = { active: 0, maintenance: 0, repair: 0, retired: 0 };
    data.machines.forEach(m => byStatus[m.status]++);
    return {
      total: data.machines.length,
      inService: data.machines.filter(m => !isRetired(m)).length,
      byStatus,
      uptime: uptimePercent(data.machines),
      cost,
      costChange: data.prevLogs ? percentChange(cost, sumCompletedCost(data.prevLogs)) : undefined,
      completed: data.logs.filter(isCompleted).length,
      completedChange: data.prevLogs ? percentChange(data.logs.filter(isCompleted).length, data.prevLogs.filter(isCompleted).length) : undefined,
      emergencies: emergencies(data.logs),
      emergenciesChange: data.prevLogs ? percentChange(emergencies(data.logs), emergencies(data.prevLogs)) : undefined,
      planned: plannedSummary(data.logs),
      overdue: overdueSchedules(data.schedules, data.machineMap, data.today).length,
      lowStock: stockSummary(data.parts).lowCount,
      power: powerSummary(data.machines),
      monthly: monthlyCost(data.logs, data.filters),
      attention: attentionGroups(data).filter(g =>
        g.tab === 'maintenance' ? canToir : g.tab === 'inventory' ? canInventory : canEquipment),
    };
  }, [data, canEquipment, canToir, canInventory]);

  const hasMonthly = stats.monthly.some(p => p.planned > 0 || p.emergency > 0);
  const branchLabel = data.filters.branchId === 'all' ? 'все филиалы' : data.branchMap.get(data.filters.branchId)?.name || 'филиал';

  const stock = useMemo(() => stockSummary(data.parts), [data.parts]);
  const assets = useMemo(() => assetSummary(data.machines, data.now), [data.machines, data.now]);

  const comparison = useMemo(() => branchComparison(data), [data]);
  const { sorted: branchSorted, sort: branchSort, toggle: branchToggle } = useSorted(comparison.rows, BRANCH_SORT, { key: 'cost', dir: 'desc' });
  const bth = (label: string, key: string) => <SortTh label={label} sortKey={key} sort={branchSort} onSort={branchToggle} />;

  const ranking = useMemo(
    () => machineRanking(data.machines, data.logs, data.branchMap, lastMaintenanceByMachine(data.machines, data.allLogs), data.now),
    [data],
  );
  const filtered = useMemo(
    () => ranking.filter(r => searchMatches(search, r.name, r.model, r.manufacturer, r.branchName, MACHINE_STATUS_LABELS[r.status])),
    [ranking, search],
  );
  const { sorted: machineSorted, sort: machineSort, toggle: machineToggle } = useSorted(filtered, RANKING_SORT, { key: 'cost', dir: 'desc' });
  const mth = (label: string, key: string, align: 'left' | 'right' = 'right') => <SortTh label={label} sortKey={key} sort={machineSort} onSort={machineToggle} align={align} />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Umumiy stanoklar soni"
          value={formatNumber(stats.total)}
          hint={`Faol: ${stats.inService}`}
        />
        <KpiCard
          label="Umumiy skladda xarajat"
          value={formatMoney(stock.value)}
          hint={`${formatNumber(stock.items)} ta pozitsiya`}
        />
        <KpiCard
          label="Umumiy Затраты"
          value={formatMoney(stats.cost)}
          hint={stats.costChange !== undefined ? <ChangeBadge change={stats.costChange} /> : 'Davr uchun xarajatlar'}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Стоимость покупки"
          value={formatMoney(assets.purchaseTotal)}
          hint={`Учтено станков: ${assets.counted} (без списанных)`}
        />
        <KpiCard
          label="Остаточная стоимость"
          value={formatMoney(assets.total)}
          tone="dark"
          hint={assets.missing > 0 ? <span className="text-amber-400 font-bold">Без данных: {assets.missing}</span> : 'Линейная амортизация, полные месяцы'}
        />
        <KpiCard
          label="Накопленная амортизация"
          value={formatMoney(assets.depreciation)}
          hint={assets.purchaseTotal ? `${formatPercent((assets.depreciation / assets.purchaseTotal) * 100)} от стоимости покупки` : undefined}
        />
      </div>

      <Panel
        title="Сравнение филиалов"
        icon={Building2}
        bodyClass=""
        actions={canExport && (
          <CsvButton filename="sravnenie_filialov" disabled={!branchSorted.length} headers={CSV_BRANCH_HEADERS}
            rows={() => [...branchSorted.map(csvBranchRow), csvBranchRow(comparison.total)]} />
        )}
        footer="Нажмите на филиал, чтобы перейти в его паспорт. Затраты и аварии — выполненные работы за период."
      >
        {branchSorted.length === 0 ? (
          <EmptyState text="Нет филиалов по выбранным фильтрам" />
        ) : (
          <div className="report-scroll overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={THEAD_ROW}>
                  <SortTh label="Филиал" sortKey="name" sort={branchSort} onSort={branchToggle} className="sm:pl-6" />
                  {bth('Станков', 'machines')}
                  {bth('В работе', 'active')}
                  {bth('ТО', 'maintenance')}
                  {bth('Ремонт', 'repair')}
                  {bth('Списано', 'retired')}
                  {bth('Ток', 'amps')}
                  {bth('Ток в работе', 'activeAmps')}
                  {bth('Ост. стоимость', 'residual')}
                  {bth('Затраты', 'cost')}
                  {bth('Аварий', 'emergencies')}
                  {bth('Просрочено ТО', 'overdue')}
                  {bth('Склад', 'stock')}
                  {bth('Польз.', 'users')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {branchSorted.map(r => {
                  const clickable = r.branchId !== NO_BRANCH_ID;
                  return (
                    <tr key={r.branchId} className={`transition-colors ${clickable ? 'hover:bg-blue-50/40 cursor-pointer' : ''}`}
                      onClick={clickable ? () => onSelectBranch(r.branchId) : undefined}>
                      <td className={`${TD_FIRST} min-w-44`}>
                        <p className={`font-bold ${clickable ? 'text-blue-700' : 'text-slate-800'}`}>{r.branchName}</p>
                        {r.location && <p className="text-[10px] text-slate-400 truncate max-w-56">{r.location}</p>}
                      </td>
                      <td className={`${TD} text-right font-mono`}>{r.machineCount}</td>
                      <td className={`${TD} text-right font-mono text-emerald-700`}>{r.byStatus.active}</td>
                      <td className={`${TD} text-right font-mono ${r.byStatus.maintenance ? 'text-amber-700' : 'text-slate-300'}`}>{r.byStatus.maintenance}</td>
                      <td className={`${TD} text-right font-mono ${r.byStatus.repair ? 'text-rose-700 font-bold' : 'text-slate-300'}`}>{r.byStatus.repair}</td>
                      <td className={`${TD} text-right font-mono text-slate-400`}>{r.byStatus.retired}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(r.totalAmps)}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap text-slate-600`}>{formatAmps(r.activeAmps)}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatMoney(r.residual)}</td>
                      <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatMoney(r.cost)}</td>
                      <td className={`${TD} text-right font-mono ${r.emergencies ? 'text-rose-600 font-bold' : 'text-slate-300'}`}>{r.emergencies}</td>
                      <td className={`${TD} text-right font-mono ${r.overdue ? 'text-rose-600 font-bold' : 'text-slate-300'}`}>{r.overdue}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatMoney(r.stockValue)}</td>
                      <td className={`${TD} text-right font-mono`}>{r.users}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={TFOOT_ROW}>
                  <td className={`${TD_FIRST} text-[11px] uppercase tracking-widest`}>Итого</td>
                  {csvBranchRow(comparison.total).slice(1).map((v, i) => (
                    <td key={i} className={`${TD} text-right font-mono whitespace-nowrap`}>
                      {[5, 6].includes(i) ? formatAmps(Number(v)) : [7, 8, 11].includes(i) ? formatMoney(Number(v)) : v}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Рейтинг станков"
        icon={AlertTriangle}
        iconClass="text-amber-500"
        bodyClass=""
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Станок, модель, филиал…" />
            {canExport && canEquipment && (
              <CsvButton
                filename="reiting_stankov"
                disabled={!machineSorted.length}
                headers={['Станок', 'Модель', 'Производитель', 'Филиал', 'Статус', 'Возраст, лет', 'Остаточная стоимость, $',
                  'Затраты на ТО за период, $', 'Затраты / стоимость, %', 'Аварий', 'MTBF, дней', 'Последнее ТО']}
                rows={() => machineSorted.map(r => [r.name, r.model, r.manufacturer, r.branchName, MACHINE_STATUS_LABELS[r.status],
                  r.ageYears, r.residual, r.cost, r.ratio === Infinity ? '>100' : r.ratio, r.emergencies, r.mtbfDays,
                  r.lastMaintenance ? formatDateKey(r.lastMaintenance) : ''])}
              />
            )}
          </>
        }
        footer="Выше 50% — повышенные затраты, выше 80% — рекомендуется рассмотреть замену. Нажмите на станок, чтобы открыть его карточку."
      >
        {machineSorted.length === 0 ? (
          <EmptyState text={search ? 'Ничего не найдено' : 'Нет оборудования по выбранным фильтрам'} />
        ) : (
          <div className={`${SCROLL_BOX} max-h-[600px]`}>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <SortTh label="Станок" sortKey="name" sort={machineSort} onSort={machineToggle} className="sm:pl-6" />
                  {mth('Филиал', 'branch', 'left')}
                  {mth('Статус', 'status', 'left')}
                  {mth('Возраст', 'age')}
                  {mth('Ост. стоимость', 'residual')}
                  {mth('Затраты', 'cost')}
                  {mth('Затраты / стоим.', 'ratio')}
                  {mth('Аварий', 'emergencies')}
                  {mth('MTBF', 'mtbf')}
                  {mth('Посл. ТО', 'last')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {machineSorted.map(r => {
                  const level = ratioLevel(r.ratio);
                  return (
                    <tr key={r.id}
                      className={`cursor-pointer transition-colors ${level === 'critical' ? 'bg-rose-50/60 hover:bg-rose-50' : level === 'warn' ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-blue-50/30'}`}
                      onClick={() => onSelectMachine(r.id)}>
                      <td className={`${TD_FIRST} min-w-44`}>
                        <p className="font-bold text-slate-800 leading-tight">{r.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{[r.manufacturer, r.model].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className={`${TD} text-slate-600 min-w-32`}>{r.branchName}</td>
                      <td className={TD}><StatusBadge label={MACHINE_STATUS_LABELS[r.status]} className={STATUS_BADGE[r.status]} /></td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.ageYears === null ? 'text-slate-300' : ''}`}>{r.ageYears === null ? '—' : `${formatNumber(r.ageYears, 1)} г.`}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.residual === null ? 'text-slate-400' : ''}`}>{r.residual === null ? 'нет данных' : formatMoney(r.residual)}</td>
                      <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatMoney(r.cost)}</td>
                      <td className={`${TD} text-right whitespace-nowrap`}>
                        <span className={`font-mono font-black ${level === 'critical' ? 'text-rose-700' : level === 'warn' ? 'text-amber-700' : 'text-slate-600'}`}>{formatRatio(r.ratio)}</span>
                        {level === 'critical' && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase">
                            <AlertTriangle className="w-3 h-3" />рассмотреть замену
                          </span>
                        )}
                      </td>
                      <td className={`${TD} text-right font-mono ${r.emergencies ? 'text-rose-600 font-bold' : 'text-slate-300'}`}>{r.emergencies}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.mtbfDays === null ? 'text-slate-300' : ''}`}>{r.mtbfDays === null ? '—' : `${formatNumber(r.mtbfDays, 1)} дн.`}</td>
                      <td className={`${TD} text-right font-mono text-xs whitespace-nowrap text-slate-500`}>{r.lastMaintenance ? formatDateKey(r.lastMaintenance) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
