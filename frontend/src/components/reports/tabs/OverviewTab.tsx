import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Building2, ChevronRight, Cog, History as HistoryIcon, Package, TrendingDown } from 'lucide-react';
import {
  AttentionTab, BranchComparisonRow, MachineRankingRow, NO_BRANCH_ID, ReportData, assetSummary, attentionGroups, branchComparison,
  formatAmps, formatDateKey, formatMoney, formatNumber, formatPercent, isCompleted, isEmergencyType, isRetired,
  lastMaintenanceByMachine, LOG_TYPE_BADGE, LOG_TYPE_LABELS, MACHINE_STATUS_LABELS, machineRanking, monthlyCost, overdueSchedules,
  percentChange, plannedSummary, pluralRu, powerSummary, ratioLevel, searchLogs, searchMatches, sortLogsByDate, stockSummary,
  sumCompletedCost, toLocalDateKey, uptimePercent, WORKS_FORMS,
} from '../reportUtils';
import {
  CsvButton, EmptyState, KpiCard, KPI_GRID, Pagination, Panel, ProgressBar, SCROLL_BOX, SearchInput, SortTh, StatusBadge,
  TD, TD_FIRST, TFOOT_ROW, THEAD_ROW, usePaged, useSorted,
} from '../ReportUi';
import type { MaintenanceLog } from '../../../types';
import { machineService } from '../../../services/machineService';
import { SERIES_COLORS } from '../charts/ChartFrame';
import { DepreciationChart } from '../charts/DepreciationChart';
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

const CSV_BRANCH_HEADERS = ['Филиал', 'Станков', 'В работе', 'На ТО', 'В ремонте', 'Ток всего, А',
  'Остаточная амортизация, $', 'Ремонт за период, $', 'Склад, $'];
const csvBranchRow = (r: BranchComparisonRow) => [r.branchName, r.machineCount, r.byStatus.active, r.byStatus.maintenance, r.byStatus.repair,
  r.totalAmps, r.residual, r.cost, r.stockValue];

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
  const [journalSearch, setJournalSearch] = useState('');
  const [journalDir, setJournalDir] = useState<'asc' | 'desc'>('desc');

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
  const depreciation = useMemo(
    () => machineService.getTotalDepreciationData(data.machines.filter(m => !isRetired(m)), data.now),
    [data.machines, data.now],
  );
  const currentYear = String(data.now.getFullYear());

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

  const journal: MaintenanceLog[] = useMemo(
    () => sortLogsByDate(searchLogs(data.logs, journalSearch, data.machineMap), journalDir),
    [data.logs, data.machineMap, journalSearch, journalDir],
  );
  const paged = usePaged(journal, 25);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Всего станков"
          value={formatNumber(stats.total)}
          hint={`В работе: ${stats.inService}`}
        />
        <KpiCard
          label="Итого на складе"
          value={formatMoney(stock.value)}
          hint={`${formatNumber(stock.items)} позиций`}
        />
        <KpiCard
          label="Итого ремонт"
          value={formatMoney(stats.cost)}
          hint={stats.costChange !== undefined ? <ChangeBadge change={stats.costChange} /> : 'Расходы за период'}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Амортизация покупки"
          value={formatMoney(assets.purchaseTotal)}
          hint={`Учтено станков: ${assets.counted} (без списанных)`}
        />
        <KpiCard
          label="Остаточная амортизация"
          value={formatMoney(assets.total)}
          tone="dark"
          hint={assets.missing > 0 ? <span className="text-amber-400 font-bold">Без данных: {assets.missing}</span> : 'Линейная амортизация, полные месяцы'}
        />
        <KpiCard
          label="Накопленная амортизация"
          value={formatMoney(assets.depreciation)}
          hint={assets.purchaseTotal ? `${formatPercent((assets.depreciation / assets.purchaseTotal) * 100)} от амортизации покупки` : undefined}
        />
      </div>

      <Panel title="Сводный прогноз амортизации" icon={TrendingDown} iconClass="text-indigo-600">
        {depreciation.length === 0
          ? <EmptyState text="Нет данных для расчёта амортизации: укажите цену и дату покупки" compact />
          : <DepreciationChart data={depreciation} currentYear={currentYear} />}
      </Panel>

      <Panel
        title="Сравнение филиалов"
        icon={Building2}
        bodyClass=""
        actions={canExport && (
          <CsvButton filename="sravnenie_filialov" disabled={!branchSorted.length} headers={CSV_BRANCH_HEADERS}
            rows={() => [...branchSorted.map(csvBranchRow), csvBranchRow(comparison.total)]} />
        )}
        footer="Нажмите на филиал, чтобы перейти в его паспорт. Ремонт и аварии — выполненные работы за период."
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
                  {bth('Ток', 'amps')}
                  {bth('Ост. амортизация', 'residual')}
                  {bth('Ремонт', 'cost')}
                  {bth('Склад', 'stock')}
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
                      <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(r.totalAmps)}</td>
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
                  {csvBranchRow(comparison.total).slice(1).map((v, i) => (
                    <td key={i} className={`${TD} text-right font-mono whitespace-nowrap`}>
                      {i === 4 ? formatAmps(Number(v)) : [5, 6, 7].includes(i) ? formatMoney(Number(v)) : v}
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
                headers={['Станок', 'Модель', 'Производитель', 'Филиал', 'Статус', 'Возраст, лет', 'Остаточная амортизация, $',
                  'Ремонт на ТО за период, $', 'Ремонт / амортизация, %', 'MTBF, дней', 'Последнее ТО']}
                rows={() => machineSorted.map(r => [r.name, r.model, r.manufacturer, r.branchName, MACHINE_STATUS_LABELS[r.status],
                  r.ageYears, r.residual, r.cost, r.ratio === Infinity ? '>100' : r.ratio, r.mtbfDays,
                  r.lastMaintenance ? formatDateKey(r.lastMaintenance) : ''])}
              />
            )}
          </>
        }
        footer="Выше 50% — повышенный ремонт, выше 80% — рекомендуется рассмотреть замену. Нажмите на станок, чтобы открыть его карточку."
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
                  {mth('Ост. амортизация', 'residual')}
                  {mth('Ремонт', 'cost')}
                  {mth('Ремонт / стоим.', 'ratio')}
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

      <Panel
        title="Журнал обслуживания и ремонтов"
        icon={HistoryIcon}
        bodyClass=""
        actions={
          <>
            <SearchInput value={journalSearch} onChange={v => { setJournalSearch(v); paged.setPage(0); }} placeholder="Станок, мастер, запчасть…" />
            <button type="button" onClick={() => setJournalDir(d => (d === 'desc' ? 'asc' : 'desc'))}
              className="print:hidden inline-flex items-center gap-1 min-h-8 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 cursor-pointer">
              {journalDir === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              {journalDir === 'desc' ? 'Сначала новые' : 'Сначала старые'}
            </button>
            {canExport && canToir && (
              <CsvButton
                filename="zhurnal_obsluzhivaniya"
                disabled={!journal.length}
                headers={['Дата', 'Станок', 'Модель', 'Вид работ', 'Статус', 'Исполнитель', 'Описание', 'Запчасти', 'Амортизация, $']}
                rows={() => journal.map(log => {
                  const machine = data.machineMap.get(log.machineId);
                  return [formatDateKey(toLocalDateKey(log.date)), machine?.name, machine?.model, LOG_TYPE_LABELS[log.type] || log.type,
                    isCompleted(log) ? 'Выполнено' : 'Запланировано', log.technicianName, log.notes,
                    (log.partsUsed || []).map(p => `${p.name} x${p.quantity}`).join(', '), log.cost || 0];
                })}
              />
            )}
          </>
        }
      >
        {journal.length === 0 ? <EmptyState text={journalSearch ? 'Ничего не найдено' : undefined} /> : (
          <>
            <div className="report-scroll overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Дата / Станок</th>
                    <th className="px-4 py-3">Вид работ</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3">Исполнитель</th>
                    <th className="px-4 py-3">Запчасти</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Амортизация</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.pageRows.map(log => {
                    const machine = data.machineMap.get(log.machineId);
                    const done = isCompleted(log);
                    return (
                      <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className={TD_FIRST}>
                          <p className="text-xs font-mono text-slate-400 mb-0.5">{formatDateKey(toLocalDateKey(log.date))}</p>
                          <p className="font-bold text-slate-800 leading-tight min-w-40">{machine?.name || '—'}</p>
                          <p className="text-[10px] text-slate-400 font-mono uppercase">{machine?.model}</p>
                        </td>
                        <td className={TD}>
                          <StatusBadge label={LOG_TYPE_LABELS[log.type] || log.type} className={LOG_TYPE_BADGE[log.type] || 'bg-slate-100 text-slate-600'} />
                          {log.notes && <p className="text-xs text-slate-600 italic truncate w-44 mt-1" title={log.notes}>"{log.notes}"</p>}
                        </td>
                        <td className={TD}><StatusBadge label={done ? 'Выполнено' : 'Запланировано'} className={done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} /></td>
                        <td className={`${TD} text-xs text-slate-600`}>{log.technicianName || '—'}</td>
                        <td className={TD}>
                          <div className="flex flex-wrap gap-1 min-w-32">
                            {log.partsUsed?.length ? log.partsUsed.map((p, i) => (
                              <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{p.name} (x{p.quantity})</span>
                            )) : <span className="text-slate-300">—</span>}
                          </div>
                        </td>
                        <td className={`px-4 sm:px-6 py-3 text-right font-black whitespace-nowrap ${done ? 'text-slate-900' : 'text-slate-400'}`}>{formatMoney(log.cost || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={paged.page} pageCount={paged.pageCount} total={journal.length} pageSize={paged.pageSize} onPage={paged.setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
