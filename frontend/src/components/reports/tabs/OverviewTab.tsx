import React, { useMemo } from 'react';
import { AlertTriangle, BarChart3, Building2, ChevronRight, Cog, Package, TrendingDown } from 'lucide-react';
import {
  AttentionTab, BranchComparisonRow, NO_BRANCH_ID, ReportData, assetSummary, attentionGroups, branchComparison, formatAmps, formatMoney,
  formatNumber, formatPercent, isCompleted, isEmergencyType, isRetired, monthlyCost, overdueSchedules, percentChange, plannedSummary,
  pluralRu, powerSummary, stockSummary, sumCompletedCost, uptimePercent, WORKS_FORMS,
} from '../reportUtils';
import { CsvButton, EmptyState, KpiCard, KPI_GRID, Panel, ProgressBar, SCROLL_BOX, SortTh, TD, TD_FIRST, TFOOT_ROW, THEAD_ROW, useSorted } from '../ReportUi';
import { SERIES_COLORS } from '../charts/ChartFrame';
import { StackedBarChart } from '../charts/StackedBarChart';

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

const CSV_HEADERS = ['Филиал', 'Станков', 'В работе', 'На ТО', 'В ремонте', 'Списано', 'Ток всего, А', 'Ток в работе, А',
  'Остаточная стоимость, $', 'Затраты за период, $', 'Аварий', 'Просрочено ТО', 'Склад, $', 'Пользователей'];
const csvRow = (r: BranchComparisonRow) => [r.branchName, r.machineCount, r.byStatus.active, r.byStatus.maintenance, r.byStatus.repair,
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

export function OverviewTab({ data, canExport, canEquipment, canToir, canInventory, onNavigate, onSelectBranch }: {
  data: ReportData;
  canExport: boolean;
  canEquipment: boolean;
  canToir: boolean;
  canInventory: boolean;
  onNavigate: (tab: AttentionTab) => void;
  onSelectBranch: (branchId: string) => void;
}) {
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
  const { sorted, sort, toggle } = useSorted(comparison.rows, SORT, { key: 'cost', dir: 'desc' });
  const th = (label: string, key: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} />;

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
          <CsvButton filename="sravnenie_filialov" disabled={!sorted.length} headers={CSV_HEADERS}
            rows={() => [...sorted.map(csvRow), csvRow(comparison.total)]} />
        )}
        footer="Нажмите на филиал, чтобы перейти в его паспорт. Затраты и аварии — выполненные работы за период."
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
                  {th('Списано', 'retired')}
                  {th('Ток', 'amps')}
                  {th('Ток в работе', 'activeAmps')}
                  {th('Ост. стоимость', 'residual')}
                  {th('Затраты', 'cost')}
                  {th('Аварий', 'emergencies')}
                  {th('Просрочено ТО', 'overdue')}
                  {th('Склад', 'stock')}
                  {th('Польз.', 'users')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map(r => {
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
                  {csvRow(comparison.total).slice(1).map((v, i) => (
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
    </div>
  );
}
