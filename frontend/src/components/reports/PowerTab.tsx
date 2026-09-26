import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, Info, Zap } from 'lucide-react';
import { ReportData, formatAmps, formatNumber, formatPercent, MACHINE_STATUS_LABELS, pluralRu, powerByBranch, powerSummary, topConsumers } from './reportUtils';
import { CHART_AXIS_TICK, CHART_TOOLTIP_STYLE, ChartFrame, CsvButton, EmptyState, KpiCard, Panel, ProgressBar, SERIES_COLORS, TD, THEAD_ROW } from './ReportUi';

export function PowerTab({ data, canExport }: { data: ReportData; canExport: boolean }) {
  const allBranches = data.filters.branchId === 'all';
  const scopeName = allBranches ? 'Все филиалы' : data.branchMap.get(data.filters.branchId)?.name || 'Филиал';

  const stats = useMemo(() => {
    const byBranch = powerByBranch(data.machines, data.branches);
    return {
      summary: powerSummary(data.machines),
      byBranch,
      chart: byBranch.rows.filter(r => r.totalAmps > 0).map(r => ({ name: r.branchName, total: r.totalAmps, active: r.activeAmps })),
      top: topConsumers(data.machines, 10),
    };
  }, [data]);

  const { summary } = stats;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
        <Zap className="w-4 h-4 text-amber-500" />
        {scopeName}
        {data.filters.machineId !== 'all' && <span className="normal-case tracking-normal font-medium text-slate-400">· выбран один станок</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Суммарный ток (все)" value={formatAmps(summary.totalAmps)} tone="dark"
          hint={`Станков без списанных: ${summary.machineCount}`} />
        <KpiCard label="Суммарный ток (в работе)" value={formatAmps(summary.activeAmps)}
          hint={summary.totalAmps > 0 ? `${formatPercent((summary.activeAmps / summary.totalAmps) * 100)} от суммарного` : 'Только статус «В работе»'} />
        <KpiCard label="Не указан ампераж" value={formatNumber(summary.missingCount)} tone={summary.missingCount > 0 ? 'warning' : 'default'}
          hint={summary.missingCount > 0 ? 'Сумма неполная: эти станки не учтены' : 'Данные заполнены у всех станков'} />
        <KpiCard label="Средний ток на станок" value={formatAmps(summary.averageAmps)}
          hint={`По ${summary.withAmperage} ${pluralRu(summary.withAmperage, ['станку', 'станкам', 'станкам'])} с указанным амперажем`} />
      </div>

      {allBranches && (
        <div className="grid grid-cols-1 2xl:grid-cols-5 gap-4 sm:gap-6">
          <div className="2xl:col-span-3 min-w-0">
            <Panel
              title="Нагрузка по филиалам"
              icon={Building2}
              bodyClass=""
              actions={canExport && (
                <CsvButton
                  filename="elektricheskaya_nagruzka"
                  disabled={stats.byBranch.rows.length === 0}
                  headers={['Филиал', 'Станков (без списанных)', 'Суммарный ток, А', 'В работе, А', 'Не указан ампераж']}
                  rows={() => [
                    ...stats.byBranch.rows.map(r => [r.branchName, r.machineCount, r.totalAmps, r.activeAmps, r.missingCount]),
                    ['Итого', summary.machineCount, summary.totalAmps, summary.activeAmps, summary.missingCount],
                  ]}
                />
              )}
            >
              {stats.byBranch.rows.length === 0 ? (
                <EmptyState text="Нет оборудования по выбранным фильтрам" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={THEAD_ROW}>
                        <th className="px-4 sm:px-6 py-3">Филиал</th>
                        <th className="px-4 py-3 text-right">Станков</th>
                        <th className="px-4 py-3 text-right">Всего, А</th>
                        <th className="px-4 py-3 text-right">В работе, А</th>
                        <th className="px-4 sm:px-6 py-3 text-right">Не указан</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stats.byBranch.rows.map(r => (
                        <tr key={r.branchId} className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-4 sm:px-6 py-3 font-bold text-slate-800 min-w-40">{r.branchName}</td>
                          <td className={`${TD} text-right font-mono text-slate-600`}>{r.machineCount}</td>
                          <td className={`${TD} text-right font-mono font-bold text-slate-900 whitespace-nowrap`}>{formatAmps(r.totalAmps)}</td>
                          <td className={`${TD} text-right font-mono text-slate-700 whitespace-nowrap`}>{formatAmps(r.activeAmps)}</td>
                          <td className={`px-4 sm:px-6 py-3 text-right font-mono ${r.missingCount > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{r.missingCount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-900">
                        <td className="px-4 sm:px-6 py-3 text-[11px] uppercase tracking-widest">Итого</td>
                        <td className={`${TD} text-right font-mono`}>{summary.machineCount}</td>
                        <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(summary.totalAmps)}</td>
                        <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(summary.activeAmps)}</td>
                        <td className={`px-4 sm:px-6 py-3 text-right font-mono ${summary.missingCount > 0 ? 'text-amber-600' : ''}`}>{summary.missingCount}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Panel>
          </div>
          <div className="2xl:col-span-2 min-w-0">
            <Panel title="Сравнение филиалов, А" icon={Zap} iconClass="text-amber-500">
              {stats.chart.length === 0 ? (
                <EmptyState text="Ампераж не указан ни у одного станка" compact />
              ) : (
                <ChartFrame height={Math.max(180, stats.chart.length * 44 + 40)}>
                  {({ width, height }) => (
                    <BarChart layout="vertical" width={width} height={height} data={stats.chart} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} tickFormatter={(v: number) => formatNumber(v, 0)} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ ...CHART_AXIS_TICK, fill: '#475569' }} width={Math.min(140, width * 0.35)} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                        formatter={(val: number, _name: string, item: { payload?: { active: number } }) => [
                          `${formatAmps(val)} (в работе ${formatAmps(item.payload?.active ?? 0)})`,
                          'Суммарный ток',
                        ]}
                      />
                      <Bar dataKey="total" name="Суммарный ток" fill={SERIES_COLORS.amps} radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  )}
                </ChartFrame>
              )}
            </Panel>
          </div>
        </div>
      )}

      <Panel
        title={`ТОП-10 потребителей тока: ${scopeName}`}
        icon={Zap}
        iconClass="text-amber-500"
        actions={canExport && (
          <CsvButton
            filename="top_potrebiteley_toka"
            disabled={stats.top.length === 0}
            headers={['Станок', 'Модель', 'Статус', 'Ток, А', 'Доля, %']}
            rows={() => stats.top.map(t => [t.name, t.model, MACHINE_STATUS_LABELS[t.status], t.amps, t.share])}
          />
        )}
      >
        {stats.top.length === 0 ? (
          <EmptyState text="Ампераж не указан ни у одного станка" compact />
        ) : (
          <div className="space-y-3">
            {stats.top.map((t, i) => (
              <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center gap-3 mb-1.5">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black text-slate-400 w-5 shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{t.model} · {MACHINE_STATUS_LABELS[t.status]}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-black text-slate-900">{formatAmps(t.amps)}</p>
                    <p className="text-[10px] font-mono text-slate-500">{formatPercent(t.share, 1)}</p>
                  </div>
                </div>
                <ProgressBar percent={t.share} className="h-1" colorClass="bg-amber-500" />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <p className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
        <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
        Сумма токов приблизительная: складывать амперы корректно только для оборудования с одинаковым напряжением и числом фаз.
        Списанные станки не учитываются; станки без указанного ампеража в сумму не входят.
      </p>
    </div>
  );
}
