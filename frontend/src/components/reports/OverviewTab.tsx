import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Building2 } from 'lucide-react';
import {
  ReportData, branchSummary, formatAmps, formatMoney, formatNumber, formatPercent, isRetired, monthlyCost,
  overdueSchedules, percentChange, pluralRu, WORKS_FORMS, plannedSummary, powerSummary, stockSummary, sumCompletedCost, uptimePercent,
} from './reportUtils';
import { CHART_AXIS_TICK, CHART_TOOLTIP_STYLE, ChartFrame, CsvButton, EmptyState, KpiCard, Panel, ProgressBar, SERIES_COLORS, TD, THEAD_ROW } from './ReportUi';

export function OverviewTab({ data, canExport, canToir, canInventory }: { data: ReportData; canExport: boolean; canToir: boolean; canInventory: boolean }) {
  const stats = useMemo(() => {
    const cost = sumCompletedCost(data.logs);
    const prevCost = data.prevLogs ? sumCompletedCost(data.prevLogs) : null;
    const rows = branchSummary(data.machines, data.branches, data.logs);
    return {
      total: data.machines.length,
      retired: data.machines.filter(isRetired).length,
      active: data.machines.filter(m => m.status === 'active').length,
      uptime: uptimePercent(data.machines),
      cost,
      change: prevCost === null ? undefined : percentChange(cost, prevCost),
      planned: plannedSummary(data.logs),
      overdue: overdueSchedules(data.schedules, data.machineMap, data.today).length,
      lowStock: stockSummary(data.parts).lowCount,
      monthly: monthlyCost(data.logs, data.filters),
      rows,
      totals: {
        machineCount: rows.reduce((a, r) => a + r.machineCount, 0),
        amps: powerSummary(data.machines).totalAmps,
        cost,
        emergencies: rows.reduce((a, r) => a + r.emergencies, 0),
        uptime: uptimePercent(data.machines),
      },
    };
  }, [data]);

  const hasMonthly = stats.monthly.some(p => p.planned > 0 || p.emergency > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard label="Всего станков" value={formatNumber(stats.total)} tone="dark"
          hint={`В работе: ${stats.active} · списано: ${stats.retired}`} />
        <KpiCard label="В работе" value={formatPercent(stats.uptime)}
          hint="Активные / все, кроме списанных">
          <ProgressBar percent={stats.uptime} className="h-1.5 mt-2" colorClass={stats.uptime > 90 ? 'bg-emerald-500' : stats.uptime > 70 ? 'bg-amber-500' : 'bg-rose-500'} />
        </KpiCard>
        <KpiCard label="Затраты за период" value={formatMoney(stats.cost)}
          hint={
            <>
              {stats.change === undefined ? (
                <span>Нет периода для сравнения</span>
              ) : stats.change === null ? (
                <span>В прошлом периоде затрат не было</span>
              ) : (
                <span className={`font-bold ${stats.change > 0 ? 'text-rose-600' : stats.change < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {stats.change > 0 ? '↑' : stats.change < 0 ? '↓' : '→'} {formatPercent(Math.abs(stats.change), 1)} к прошлому периоду
                </span>
              )}
              {stats.planned.count > 0 && (
                <p className="text-amber-600 font-bold mt-1">Запланировано: {stats.planned.count} {pluralRu(stats.planned.count, WORKS_FORMS)}, ожидаемые затраты {formatMoney(stats.planned.cost)}</p>
              )}
            </>
          } />
        {canToir && (
          <KpiCard label="Просроченные ТО" value={formatNumber(stats.overdue)} tone={stats.overdue > 0 ? 'danger' : 'default'}
            hint="Задачи графика с истёкшим сроком" />
        )}
        {canInventory && (
          <KpiCard label="Мало на складе" value={formatNumber(stats.lowStock)} tone={stats.lowStock > 0 ? 'warning' : 'default'}
            hint="Доступно ≤ минимального остатка" />
        )}
      </div>

      <Panel title="Затраты по месяцам: плановые и аварийные" icon={BarChart3}>
        {hasMonthly ? (
          <ChartFrame height={280}>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={stats.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} width={56} tickFormatter={(v: number) => formatNumber(v, 0)} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(val: number, name: string) => [formatMoney(val), name]}
                />
                <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: '#475569' }}>{value}</span>} />
                <Bar dataKey="planned" name="Плановые" stackId="cost" fill={SERIES_COLORS.planned} stroke="#fff" strokeWidth={1} maxBarSize={40} />
                <Bar dataKey="emergency" name="Аварийные" stackId="cost" fill={SERIES_COLORS.emergency} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ChartFrame>
        ) : (
          <EmptyState />
        )}
      </Panel>

      <Panel
        title="Сводка по филиалам"
        icon={Building2}
        bodyClass=""
        actions={canExport && (
          <CsvButton
            filename="svodka_po_filialam"
            disabled={stats.rows.length === 0}
            headers={['Филиал', 'Станков', 'Суммарный ток, А', 'Затраты, $', 'Аварий', 'В работе, %']}
            rows={() => [
              ...stats.rows.map(r => [r.branchName, r.machineCount, r.totalAmps, r.cost, r.emergencies, Math.round(r.uptime)]),
              ['Итого', stats.totals.machineCount, stats.totals.amps, stats.totals.cost, stats.totals.emergencies, Math.round(stats.totals.uptime)],
            ]}
          />
        )}
      >
        {stats.rows.length === 0 ? (
          <EmptyState text="Нет оборудования по выбранным фильтрам" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Филиал</th>
                  <th className="px-4 py-3 text-right">Станков</th>
                  <th className="px-4 py-3 text-right">Ток</th>
                  <th className="px-4 py-3 text-right">Затраты</th>
                  <th className="px-4 py-3 text-right">Аварий</th>
                  <th className="px-4 sm:px-6 py-3">В работе</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.rows.map(r => (
                  <tr key={r.branchId} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-4 sm:px-6 py-3 font-bold text-slate-800 min-w-40">{r.branchName}</td>
                    <td className={`${TD} text-right font-mono text-slate-600 whitespace-nowrap`}>{r.machineCount}</td>
                    <td className={`${TD} text-right font-mono text-slate-600 whitespace-nowrap`}>{formatAmps(r.totalAmps)}</td>
                    <td className={`${TD} text-right font-mono font-bold text-slate-900 whitespace-nowrap`}>{formatMoney(r.cost)}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap ${r.emergencies > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{r.emergencies}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center gap-2 min-w-28">
                        <ProgressBar percent={r.uptime} className="h-1.5 w-16" colorClass={r.uptime > 90 ? 'bg-emerald-500' : r.uptime > 70 ? 'bg-amber-500' : 'bg-rose-500'} />
                        <span className="text-[10px] font-mono font-bold">{formatPercent(r.uptime)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-900">
                  <td className="px-4 sm:px-6 py-3 text-[11px] uppercase tracking-widest">Итого</td>
                  <td className={`${TD} text-right font-mono`}>{stats.totals.machineCount}</td>
                  <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(stats.totals.amps)}</td>
                  <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatMoney(stats.totals.cost)}</td>
                  <td className={`${TD} text-right font-mono`}>{stats.totals.emergencies}</td>
                  <td className="px-4 sm:px-6 py-3 font-mono text-[11px]">{formatPercent(stats.totals.uptime)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
