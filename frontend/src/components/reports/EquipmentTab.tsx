import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ClipboardList, Cog, TrendingDown } from 'lucide-react';
import { machineService } from '../../services/machineService';
import type { MachineStatus } from '../../types';
import {
  ReportData, assetSummary, costByMachine, formatMoney, formatNumber, formatPercent, incompleteMachines, isRetired,
  machineRanking, MACHINE_STATUS_LABELS, MachineRankingRow, ratioLevel, statusDistribution,
} from './reportUtils';
import { CHART_AXIS_TICK, CHART_TOOLTIP_STYLE, ChartFrame, CsvButton, EmptyState, KpiCard, Panel, SERIES_COLORS, SortTh, TD, THEAD_ROW, useSorted } from './ReportUi';

const STATUS_STYLE: Record<MachineStatus, { bar: string; badge: string }> = {
  active: { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  maintenance: { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  repair: { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  retired: { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const formatRatio = (ratio: number | null) => (ratio === null ? '—' : ratio === Infinity ? '> 100%' : formatPercent(ratio, 1));

const RANKING_SORT = {
  name: (r: MachineRankingRow) => r.name,
  branch: (r: MachineRankingRow) => r.branchName,
  residual: (r: MachineRankingRow) => r.residual,
  cost: (r: MachineRankingRow) => r.cost,
  ratio: (r: MachineRankingRow) => (r.ratio === Infinity ? Number.MAX_VALUE : r.ratio),
};

export function EquipmentTab({ data, canExport }: { data: ReportData; canExport: boolean }) {
  const selectedMachine = data.filters.machineId !== 'all' ? data.machineMap.get(data.filters.machineId) : undefined;
  const currentYear = String(new Date().getFullYear());

  const stats = useMemo(() => {
    const inService = data.machines.filter(m => !isRetired(m));
    return {
      distribution: statusDistribution(data.machines),
      assets: assetSummary(data.machines),
      depreciation: selectedMachine
        ? machineService.getDepreciationData(selectedMachine)
        : machineService.getTotalDepreciationData(inService),
      ranking: machineRanking(data.machines, costByMachine(data.logs), data.branchMap),
      incomplete: incompleteMachines(data.machines, data.branchMap),
    };
  }, [data, selectedMachine]);

  const { sorted, sort, toggle } = useSorted(stats.ranking, RANKING_SORT, { key: 'cost', dir: 'desc' });
  const total = data.machines.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Panel title="Состояние оборудования" icon={Cog}>
        {total === 0 ? (
          <EmptyState text="Нет оборудования по выбранным фильтрам" compact />
        ) : (
          <div className="space-y-4">
            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100 gap-0.5">
              {stats.distribution.filter(d => d.count > 0).map(d => (
                <div key={d.status} className={STATUS_STYLE[d.status].bar} style={{ width: `${d.percent}%` }} title={`${d.label}: ${d.count}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.distribution.map(d => (
                <div key={d.status} className={`p-3 rounded-xl border ${STATUS_STYLE[d.status].badge}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[d.status].bar}`} />
                    {d.label}
                  </p>
                  <p className="text-xl font-mono font-black mt-1 text-slate-900">{d.count}</p>
                  <p className="text-[10px] font-mono">{formatPercent(d.percent)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="space-y-4">
          <KpiCard label="Остаточная стоимость" value={formatMoney(stats.assets.total)} tone="dark"
            hint={
              <>
                <p>Без списанных · учтено станков: {stats.assets.counted}</p>
                {stats.assets.missing > 0 && <p className="text-amber-400 font-bold mt-1">Без данных: {stats.assets.missing}</p>}
              </>
            } />
          <p className="text-[10px] text-slate-400 leading-relaxed px-1">
            Линейная амортизация по сроку полезного использования; учитываются только полностью прошедшие месяцы.
          </p>
        </div>
        <div className="xl:col-span-2 min-w-0">
          <Panel title={selectedMachine ? `Амортизация: ${selectedMachine.name}` : 'Сводный прогноз амортизации'} icon={TrendingDown} iconClass="text-indigo-600">
            {stats.depreciation.length === 0 ? (
              <EmptyState text="Нет данных для расчёта амортизации: укажите цену и дату покупки" compact />
            ) : (
              <ChartFrame height={260}>
                {({ width, height }) => (
                  <AreaChart width={width} height={height} data={stats.depreciation} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportDepreciation" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SERIES_COLORS.value} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={SERIES_COLORS.value} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} width={64} tickFormatter={(v: number) => formatNumber(v, 0)} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                      labelFormatter={(label: string) => (label === currentYear ? `${label} (сейчас)` : `${label} (на 1 января)`)}
                      formatter={(val: number) => [formatMoney(val), 'Стоимость']}
                    />
                    <ReferenceLine x={currentYear} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Сейчас', position: 'top', fontSize: 10, fill: '#475569' }} />
                    <Area type="monotone" dataKey="value" stroke={SERIES_COLORS.value} strokeWidth={2} fill="url(#reportDepreciation)" dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} />
                  </AreaChart>
                )}
              </ChartFrame>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        title="Рейтинг станков: затраты к остаточной стоимости"
        icon={AlertTriangle}
        iconClass="text-amber-500"
        bodyClass=""
        actions={canExport && (
          <CsvButton
            filename="reiting_stankov"
            disabled={sorted.length === 0}
            headers={['Станок', 'Модель', 'Филиал', 'Статус', 'Остаточная стоимость, $', 'Затраты на ТО за период, $', 'Затраты / стоимость, %']}
            rows={() => sorted.map(r => [r.name, r.model, r.branchName, MACHINE_STATUS_LABELS[r.status], r.residual, r.cost, r.ratio === Infinity ? '>100' : r.ratio])}
          />
        )}
      >
        {sorted.length === 0 ? (
          <EmptyState text="Нет оборудования по выбранным фильтрам" />
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <SortTh label="Станок" sortKey="name" sort={sort} onSort={toggle} className="sm:pl-6" />
                  <SortTh label="Филиал" sortKey="branch" sort={sort} onSort={toggle} />
                  <SortTh label="Ост. стоимость" sortKey="residual" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="Затраты на ТО" sortKey="cost" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="Затраты / стоимость" sortKey="ratio" sort={sort} onSort={toggle} align="right" className="sm:pr-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map(r => {
                  const level = ratioLevel(r.ratio);
                  return (
                    <tr key={r.id} className={`transition-colors ${level === 'critical' ? 'bg-rose-50/60' : level === 'warn' ? 'bg-amber-50/60' : 'hover:bg-blue-50/20'}`}>
                      <td className={`${TD} sm:pl-6 min-w-44`}>
                        <p className="font-bold text-slate-800 leading-tight">{r.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{r.model} · {MACHINE_STATUS_LABELS[r.status]}</p>
                      </td>
                      <td className={`${TD} text-slate-600 min-w-32`}>{r.branchName}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.residual === null ? 'text-slate-400' : 'text-slate-700'}`}>
                        {r.residual === null ? 'нет данных' : formatMoney(r.residual)}
                      </td>
                      <td className={`${TD} text-right font-mono font-bold text-slate-900 whitespace-nowrap`}>{formatMoney(r.cost)}</td>
                      <td className={`${TD} sm:pr-6 text-right whitespace-nowrap`}>
                        <span className={`font-mono font-black ${level === 'critical' ? 'text-rose-700' : level === 'warn' ? 'text-amber-700' : 'text-slate-600'}`}>
                          {formatRatio(r.ratio)}
                        </span>
                        {level === 'critical' && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase">
                            <AlertTriangle className="w-3 h-3" />
                            рассмотреть замену
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 sm:px-6 py-3 text-[10px] text-slate-400 border-t border-slate-100">
          Выше 50% — повышенные затраты, выше 80% — рекомендуется рассмотреть замену станка.
        </p>
      </Panel>

      <Panel
        title="Неполные данные"
        icon={ClipboardList}
        iconClass="text-slate-500"
        bodyClass=""
        actions={canExport && (
          <CsvButton
            filename="nepolnye_dannye"
            disabled={stats.incomplete.length === 0}
            headers={['Станок', 'Филиал', 'Не указано']}
            rows={() => stats.incomplete.map(r => [r.name, r.branchName, r.missing.join(', ')])}
          />
        )}
      >
        {stats.incomplete.length === 0 ? (
          <EmptyState text="У всех станков заполнены цена, дата покупки и ампераж" compact />
        ) : (
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Станок</th>
                  <th className="px-4 py-3">Филиал</th>
                  <th className="px-4 sm:px-6 py-3">Не указано</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.incomplete.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 sm:px-6 py-3 font-bold text-slate-800 min-w-40">{r.name}</td>
                    <td className={`${TD} text-slate-600 min-w-32`}>{r.branchName}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.missing.map(f => (
                          <span key={f} className="text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
