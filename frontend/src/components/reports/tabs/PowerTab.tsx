import React, { useMemo } from 'react';
import { AlertTriangle, Building2, ExternalLink, Info, Zap } from 'lucide-react';
import {
  ReportData, ampsByStatus, formatAmps, formatNumber, formatPercent, MACHINE_STATUS_LABELS, missingAmperageMachines, pluralRu,
  powerByBranch, powerSummary, topConsumers,
} from '../reportUtils';
import { CsvButton, EmptyState, KpiCard, Panel, ProgressBar, SCROLL_BOX, StatusBadge, TD, TD_FIRST, TFOOT_ROW, THEAD_ROW } from '../ReportUi';
import { STATUS_COLORS } from '../charts/ChartFrame';
import { StackedBarChart } from '../charts/StackedBarChart';

const STATUS_SERIES = [
  { key: 'active', label: 'В работе', color: STATUS_COLORS.active },
  { key: 'maintenance', label: 'На обслуживании', color: STATUS_COLORS.maintenance },
  { key: 'repair', label: 'В ремонте', color: STATUS_COLORS.repair },
];

export function PowerTab({ data, canExport, onOpenMachine }: { data: ReportData; canExport: boolean; onOpenMachine?: (machineId: string) => void }) {
  const allBranches = data.filters.branchId === 'all';
  const scopeName = allBranches ? 'Все филиалы' : data.branchMap.get(data.filters.branchId)?.name || 'Филиал';

  const stats = useMemo(() => {
    const byBranch = powerByBranch(data.machines, data.branches);
    return {
      summary: powerSummary(data.machines),
      byBranch,
      statusChart: allBranches
        ? byBranch.rows.filter(r => r.totalAmps > 0).map(r => ({ name: r.branchName, ...r.byStatus }))
        : [{ name: scopeName, ...ampsByStatus(data.machines) }],
      top: topConsumers(data.machines, 10),
      missing: missingAmperageMachines(data.machines, data.branchMap),
    };
  }, [data, allBranches, scopeName]);

  const { summary } = stats;
  const hasChart = stats.statusChart.some(r => r.active + r.maintenance + r.repair > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
        <Zap className="w-4 h-4 text-amber-500" />
        {scopeName}
        {data.filters.machineId !== 'all' && <span className="normal-case tracking-normal font-medium text-slate-400">· выбран один станок</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label="Суммарный ток (все)" value={formatAmps(summary.totalAmps)} tone="dark" hint={`Все станки, кроме списанных: ${summary.machineCount}`} />
        <KpiCard label="Суммарный ток (в работе)" value={formatAmps(summary.activeAmps)}
          hint={summary.totalAmps > 0 ? `${formatPercent((summary.activeAmps / summary.totalAmps) * 100)} от суммарного · статус «В работе»` : 'Только статус «В работе»'} />
        <KpiCard label="Отключено (ремонт / ТО)" value={formatAmps(summary.disconnectedAmps)}
          hint="Станки в статусах «В ремонте» и «На обслуживании»" />
        <KpiCard label="Не указан ампераж" value={formatNumber(summary.missingCount)} tone={summary.missingCount > 0 ? 'warning' : 'default'}
          hint={summary.missingCount > 0 ? 'Суммы неполные: эти станки не учтены' : 'Ампераж указан у всех станков'} />
        <KpiCard label="Средний ток на станок" value={formatAmps(summary.averageAmps)}
          hint={`По ${summary.withAmperage} ${pluralRu(summary.withAmperage, ['станку', 'станкам', 'станкам'])} с указанным амперажем`} />
        <KpiCard label="Максимальный ток" value={formatAmps(summary.maxAmps)}
          hint={summary.maxMachine ? (onOpenMachine
            ? <button type="button" onClick={() => onOpenMachine(summary.maxMachine!.id)} className="font-bold text-blue-600 hover:underline cursor-pointer text-left">{summary.maxMachine.name}</button>
            : summary.maxMachine.name) : '—'} />
      </div>

      {allBranches && (
        <Panel
          title="Нагрузка по филиалам"
          icon={Building2}
          bodyClass=""
          actions={canExport && (
            <CsvButton
              filename="elektricheskaya_nagruzka"
              disabled={!stats.byBranch.rows.length}
              headers={['Филиал', 'Станков (без списанных)', 'Всего, А', 'В работе, А', 'Отключено, А', 'Не указан ампераж', 'Доля, %']}
              rows={() => [
                ...stats.byBranch.rows.map(r => [r.branchName, r.machineCount, r.totalAmps, r.activeAmps, r.disconnectedAmps, r.missingCount, r.share]),
                ['Итого', summary.machineCount, summary.totalAmps, summary.activeAmps, summary.disconnectedAmps, summary.missingCount, summary.totalAmps ? 100 : 0],
              ]}
            />
          )}
        >
          {stats.byBranch.rows.length === 0 ? <EmptyState text="Нет оборудования по выбранным фильтрам" /> : (
            <div className="report-scroll overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Филиал</th>
                    <th className="px-4 py-3 text-right">Станков</th>
                    <th className="px-4 py-3 text-right">Всего</th>
                    <th className="px-4 py-3 text-right">В работе</th>
                    <th className="px-4 py-3 text-right">Отключено</th>
                    <th className="px-4 py-3 text-right">Не указан</th>
                    <th className="px-4 sm:px-6 py-3">Доля</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byBranch.rows.map(r => (
                    <tr key={r.branchId} className="hover:bg-blue-50/20 transition-colors">
                      <td className={`${TD_FIRST} font-bold text-slate-800 min-w-40`}>{r.branchName}</td>
                      <td className={`${TD} text-right font-mono text-slate-600`}>{r.machineCount}</td>
                      <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatAmps(r.totalAmps)}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap text-emerald-700`}>{formatAmps(r.activeAmps)}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.disconnectedAmps ? 'text-rose-700' : 'text-slate-300'}`}>{formatAmps(r.disconnectedAmps)}</td>
                      <td className={`${TD} text-right font-mono ${r.missingCount ? 'text-amber-600 font-bold' : 'text-slate-300'}`}>{r.missingCount}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-2 min-w-32">
                          <ProgressBar percent={r.share} className="h-1.5 w-20" colorClass="bg-blue-500" />
                          <span className="text-[10px] font-mono font-bold">{formatPercent(r.share, 1)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={TFOOT_ROW}>
                    <td className={`${TD_FIRST} text-[11px] uppercase tracking-widest`}>Итого</td>
                    <td className={`${TD} text-right font-mono`}>{summary.machineCount}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(summary.totalAmps)}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(summary.activeAmps)}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatAmps(summary.disconnectedAmps)}</td>
                    <td className={`${TD} text-right font-mono ${summary.missingCount ? 'text-amber-600' : ''}`}>{summary.missingCount}</td>
                    <td className="px-4 sm:px-6 py-3 font-mono text-[11px]">{summary.totalAmps ? '100%' : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel title={allBranches ? 'Ток по филиалам и статусам, А' : 'Ток по статусам, А'} icon={Zap} iconClass="text-amber-500">
          {!hasChart ? <EmptyState text="Ампераж не указан ни у одного станка" compact /> : (
            <StackedBarChart
              horizontal
              data={stats.statusChart}
              categoryKey="name"
              series={STATUS_SERIES}
              valueFormatter={formatAmps}
              height={Math.max(140, stats.statusChart.length * 48 + 40)}
            />
          )}
        </Panel>

        <Panel
          title={`ТОП-10 потребителей тока: ${scopeName}`}
          icon={Zap}
          iconClass="text-amber-500"
          actions={canExport && (
            <CsvButton filename="top_potrebiteley_toka" disabled={!stats.top.length}
              headers={['Станок', 'Модель', 'Статус', 'Ток, А', 'Доля, %']}
              rows={() => stats.top.map(t => [t.name, t.model, MACHINE_STATUS_LABELS[t.status], t.amps, t.share])} />
          )}
        >
          {stats.top.length === 0 ? <EmptyState text="Ампераж не указан ни у одного станка" compact /> : (
            <div className="space-y-2.5">
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
      </div>

      <Panel
        title={`Не указан ампераж: ${stats.missing.length}`}
        icon={AlertTriangle}
        iconClass="text-amber-500"
        bodyClass=""
        actions={canExport && (
          <CsvButton filename="bez_amperazha" disabled={!stats.missing.length}
            headers={['Станок', 'Модель', 'Филиал', 'Статус']}
            rows={() => stats.missing.map(m => [m.name, m.model, m.branchName, MACHINE_STATUS_LABELS[m.status]])} />
        )}
      >
        {stats.missing.length === 0 ? <EmptyState text="Ампераж указан у всех станков" compact /> : (
          <div className={SCROLL_BOX}>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Станок</th>
                  <th className="px-4 py-3">Филиал</th>
                  <th className="px-4 py-3">Статус</th>
                  {onOpenMachine && <th className="px-4 sm:px-6 py-3 text-right print:hidden">Действие</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.missing.map(m => (
                  <tr key={m.id}>
                    <td className={`${TD_FIRST} min-w-44`}>
                      <p className="font-bold text-slate-800">{m.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono uppercase">{m.model}</p>
                    </td>
                    <td className={`${TD} text-slate-600`}>{m.branchName}</td>
                    <td className={TD}><StatusBadge label={MACHINE_STATUS_LABELS[m.status]} className="bg-slate-100 text-slate-600" /></td>
                    {onOpenMachine && (
                      <td className="px-4 sm:px-6 py-3 text-right print:hidden">
                        <button type="button" onClick={() => onOpenMachine(m.id)} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                          <ExternalLink className="w-3.5 h-3.5" />Открыть и указать
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
        <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
        Суммарный ток приблизителен и корректен для оборудования одного напряжения. Списанные станки не учитываются; станки без указанного ампеража в суммы не входят.
      </p>
    </div>
  );
}
