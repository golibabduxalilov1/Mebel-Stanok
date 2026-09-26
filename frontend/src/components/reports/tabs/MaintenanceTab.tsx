import React, { useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, CalendarClock, CalendarRange, History as HistoryIcon, PieChart, TrendingUp, Users } from 'lucide-react';
import {
  ReportData, TechnicianRow, costBreakdown, formatDateKey, logCostParts, formatMoney, formatNumber, formatPercent, isCompleted, LOG_TYPE_BADGE, LOG_TYPE_LABELS,
  monthlyWorkCounts, mtbfByMachine, plannedSummary, pluralRu, PRIORITY_BADGE, PRIORITY_LABELS, scheduleOnTime, scheduleOverview,
  searchLogs, sortLogsByDate, technicianStats, toLocalDateKey, workTypeRatio,
} from '../reportUtils';
import {
  CsvButton, EmptyState, KpiCard, Pagination, Panel, SCROLL_BOX, SearchInput, SortTh, StatusBadge, TD, TD_FIRST, THEAD_ROW, usePaged, useSorted,
} from '../ReportUi';
import type { MaintenanceLog } from '../../../types';
import { SERIES_COLORS } from '../charts/ChartFrame';
import { StackedBarChart } from '../charts/StackedBarChart';

function RatioBar({ label, planned, emergency, format }: { label: string; planned: number; emergency: number; format: (n: number) => string }) {
  const total = planned + emergency;
  const plannedPct = total ? (planned / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <span>{label}</span>
        <span className="font-mono normal-case tracking-normal">{format(total)}</span>
      </div>
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 gap-0.5">
        {planned > 0 && <div style={{ width: `${plannedPct}%`, background: SERIES_COLORS.planned }} />}
        {emergency > 0 && <div style={{ width: `${100 - plannedPct}%`, background: SERIES_COLORS.emergency }} />}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: SERIES_COLORS.planned }} />
          Плановые: <strong className="font-mono">{format(planned)}</strong> ({formatPercent(plannedPct)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: SERIES_COLORS.emergency }} />
          Аварийные: <strong className="font-mono">{format(emergency)}</strong> ({formatPercent(total ? 100 - plannedPct : 0)})
        </span>
      </div>
    </div>
  );
}

const PriorityBadge = ({ priority }: { priority?: keyof typeof PRIORITY_LABELS }) =>
  priority ? <StatusBadge label={PRIORITY_LABELS[priority]} className={PRIORITY_BADGE[priority]} /> : <span className="text-slate-300">—</span>;

const TECH_SORT = {
  name: (r: TechnicianRow) => r.name,
  count: (r: TechnicianRow) => r.count,
  emergencies: (r: TechnicianRow) => r.emergencies,
  cost: (r: TechnicianRow) => r.cost,
  avg: (r: TechnicianRow) => r.avgCost,
  assigned: (r: TechnicianRow) => r.assignedTasks,
  overdue: (r: TechnicianRow) => r.overdueTasks,
};

export function MaintenanceTab({ data, canExport }: { data: ReportData; canExport: boolean }) {
  const [upcomingWindow, setUpcomingWindow] = useState<7 | 30>(7);
  const [search, setSearch] = useState('');
  const [journalDir, setJournalDir] = useState<'asc' | 'desc'>('desc');

  const stats = useMemo(() => ({
    ratio: workTypeRatio(data.logs),
    breakdown: costBreakdown(data.logs),
    monthly: monthlyWorkCounts(data.logs, data.filters),
    planned: plannedSummary(data.logs),
    mtbf: mtbfByMachine(data.logs, data.machineMap).slice(0, 5),
    schedule: scheduleOverview(data.schedules, data.machineMap, data.today),
    onTime: scheduleOnTime(data.logs, data.allLogs, data.schedules),
    technicians: technicianStats(data.logs, data.schedules, data.machineMap, data.today),
  }), [data]);

  const journal: MaintenanceLog[] = useMemo(
    () => sortLogsByDate(searchLogs(data.logs, search, data.machineMap), journalDir),
    [data.logs, data.machineMap, search, journalDir],
  );
  const paged = usePaged(journal, 25);
  const tech = useSorted(stats.technicians, TECH_SORT, { key: 'count', dir: 'desc' });

  const { ratio, schedule } = stats;
  const hasRatio = ratio.planned.count + ratio.emergency.count > 0;
  const upcoming = upcomingWindow === 7 ? schedule.next7 : schedule.next30;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard label="Выполнено работ" value={formatNumber(ratio.planned.count + ratio.emergency.count)} tone="dark"
          hint={`Работы ${formatMoney(stats.breakdown.labor)} · запчасти ${formatMoney(stats.breakdown.parts)} · всего ${formatMoney(stats.breakdown.total)}`} />
        <KpiCard label="Запланировано" value={formatNumber(stats.planned.count)} tone={stats.planned.count > 0 ? 'warning' : 'default'}
          hint={`Ожидаемые затраты ${formatMoney(stats.planned.cost)}`} />
        <KpiCard label="Задач в графике" value={formatNumber(schedule.total)}
          hint={schedule.withoutDate ? `Без даты: ${schedule.withoutDate}` : 'Только не списанные станки'} />
        <KpiCard label="Просрочено" value={formatNumber(schedule.overdue.length)} tone={schedule.overdue.length > 0 ? 'danger' : 'default'}
          hint={schedule.total ? `${formatPercent((schedule.overdue.length / schedule.total) * 100)} графика` : undefined} />
        <KpiCard label="Выполнено в срок" value={stats.onTime.percent === null ? '—' : formatPercent(stats.onTime.percent)}
          hint={stats.onTime.total ? `${stats.onTime.onTime} из ${stats.onTime.total} повторных работ по графику` : 'Нет повторных работ по графику за период'} />
        <KpiCard label="Нагрузка на 30 дней" value={`${formatNumber(schedule.load30.hours, 1)} ч`}
          hint={`${schedule.load30.tasks} ${pluralRu(schedule.load30.tasks, ['задача', 'задачи', 'задач'])} · работы ${formatMoney(schedule.load30.laborCost)}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
        <div className="xl:col-span-2 min-w-0">
          <Panel title="Плановые и аварийные работы" icon={PieChart} footer="Плановые: ТО, ППР, инспекция, диагностика. Аварийные: ремонт и аварийный ремонт. Только выполненные.">
            {hasRatio ? (
              <div className="space-y-6">
                <RatioBar label="По количеству" planned={ratio.planned.count} emergency={ratio.emergency.count} format={n => formatNumber(n)} />
                <RatioBar label="По затратам" planned={ratio.planned.cost} emergency={ratio.emergency.cost} format={formatMoney} />
              </div>
            ) : <EmptyState compact />}
          </Panel>
        </div>
        <div className="xl:col-span-3 min-w-0">
          <Panel title="Работы по месяцам" icon={TrendingUp}>
            {stats.monthly.some(p => p.planned || p.emergency) ? (
              <StackedBarChart data={stats.monthly} categoryKey="label" height={240}
                series={[{ key: 'planned', label: 'Плановые', color: SERIES_COLORS.planned }, { key: 'emergency', label: 'Аварийные', color: SERIES_COLORS.emergency }]} />
            ) : <EmptyState compact />}
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel title="Наработка на отказ (MTBF): худшие 5" icon={Activity} iconClass="text-rose-500"
          footer="Среднее число дней между выполненными аварийными работами (ремонт, аварийный ремонт); нужно минимум 2 аварии на станок за период.">
          {stats.mtbf.length === 0 ? <EmptyState text="Недостаточно данных: нужно минимум 2 аварии на станок за период" compact /> : (
            <div className="space-y-2.5">
              {stats.mtbf.map(r => (
                <div key={r.machineId} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-500">Аварий: {r.failures}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-black text-rose-600">{formatNumber(r.mtbfDays, 1)} дн.</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">между отказами</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Ближайшие задачи графика"
          icon={CalendarRange}
          bodyClass=""
          actions={
            <>
              <div className="print:hidden inline-flex rounded-lg border border-slate-200 overflow-hidden text-[10px] font-bold">
                {([7, 30] as const).map(w => (
                  <button key={w} type="button" onClick={() => setUpcomingWindow(w)}
                    className={`px-3 py-1.5 cursor-pointer ${upcomingWindow === w ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {w} дней ({w === 7 ? schedule.next7.length : schedule.next30.length})
                  </button>
                ))}
              </div>
              {canExport && (
                <CsvButton filename={`zadachi_${upcomingWindow}_dney`} disabled={!upcoming.length}
                  headers={['Станок', 'Задача', 'Срок', 'Через, дней', 'Приоритет', 'Ответственный', 'Часы', 'Стоимость работ, $']}
                  rows={() => upcoming.map(t => [t.machineName, t.taskName, formatDateKey(t.nextDue), t.inDays, t.priority ? PRIORITY_LABELS[t.priority] : '', t.assignedTechnician, t.estimatedHours, t.laborCost])} />
              )}
            </>
          }
        >
          {upcoming.length === 0 ? <EmptyState text={`Нет задач на ближайшие ${upcomingWindow} дней`} compact /> : (
            <div className={`${SCROLL_BOX} max-h-[360px]`}>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Задача</th>
                    <th className="px-4 py-3">Срок</th>
                    <th className="px-4 py-3">Приоритет</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Часы / стоимость</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {upcoming.map(t => (
                    <tr key={t.id}>
                      <td className={`${TD_FIRST} min-w-48`}>
                        <p className="font-bold text-slate-800 text-xs">{t.taskName}</p>
                        <p className="text-[10px] text-slate-500">{t.machineName}{t.assignedTechnician ? ` · ${t.assignedTechnician}` : ''}</p>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <p className="font-mono text-xs">{formatDateKey(t.nextDue)}</p>
                        <p className="text-[10px] text-slate-500">{t.inDays === 0 ? 'сегодня' : `через ${t.inDays} ${pluralRu(t.inDays, ['день', 'дня', 'дней'])}`}</p>
                      </td>
                      <td className={TD}><PriorityBadge priority={t.priority} /></td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono text-xs whitespace-nowrap">
                        {t.estimatedHours ? `${formatNumber(t.estimatedHours, 1)} ч` : '—'} · {t.laborCost ? formatMoney(t.laborCost) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Просроченные задачи графика ТО"
        icon={CalendarClock}
        iconClass="text-rose-500"
        bodyClass=""
        actions={canExport && (
          <CsvButton filename="prosrochennye_zadachi" disabled={!schedule.overdue.length}
            headers={['Станок', 'Задача', 'Срок', 'Просрочено, дней', 'Приоритет', 'Ответственный']}
            rows={() => schedule.overdue.map(t => [t.machineName, t.taskName, formatDateKey(t.nextDue), t.daysLate, t.priority ? PRIORITY_LABELS[t.priority] : '', t.assignedTechnician])} />
        )}
      >
        {schedule.overdue.length === 0 ? <EmptyState text="Просроченных задач нет" compact /> : (
          <div className={SCROLL_BOX}>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Станок</th>
                  <th className="px-4 py-3">Задача</th>
                  <th className="px-4 py-3">Срок</th>
                  <th className="px-4 py-3 text-right">Просрочка</th>
                  <th className="px-4 py-3">Приоритет</th>
                  <th className="px-4 sm:px-6 py-3">Ответственный</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {schedule.overdue.map(t => (
                  <tr key={t.id} className="hover:bg-rose-50/30 transition-colors">
                    <td className={`${TD_FIRST} font-bold text-slate-800 min-w-40`}>{t.machineName}</td>
                    <td className={`${TD} text-slate-600 min-w-48`}>{t.taskName}</td>
                    <td className={`${TD} font-mono text-xs text-slate-500 whitespace-nowrap`}>{formatDateKey(t.nextDue)}</td>
                    <td className={`${TD} text-right font-mono font-black text-rose-600 whitespace-nowrap`}>{t.daysLate} дн.</td>
                    <td className={TD}><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 sm:px-6 py-3 text-slate-600 text-xs">{t.assignedTechnician || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Статистика по исполнителям"
        icon={Users}
        bodyClass=""
        actions={canExport && (
          <CsvButton filename="ispolniteli" disabled={!tech.sorted.length}
            headers={['Исполнитель', 'Выполнено работ', 'Из них аварийных', 'Затраты, $', 'Средние затраты, $', 'Назначено задач', 'Просрочено задач']}
            rows={() => tech.sorted.map(t => [t.name, t.count, t.emergencies, t.cost, t.avgCost, t.assignedTasks, t.overdueTasks])} />
        )}
        footer="Работы — по полю «исполнитель» выполненных записей журнала за период; задачи — по ответственному в графике ТО."
      >
        {tech.sorted.length === 0 ? <EmptyState compact /> : (
          <div className="report-scroll overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={THEAD_ROW}>
                  <SortTh label="Исполнитель" sortKey="name" sort={tech.sort} onSort={tech.toggle} className="sm:pl-6" />
                  <SortTh label="Работ" sortKey="count" sort={tech.sort} onSort={tech.toggle} align="right" />
                  <SortTh label="Аварийных" sortKey="emergencies" sort={tech.sort} onSort={tech.toggle} align="right" />
                  <SortTh label="Затраты" sortKey="cost" sort={tech.sort} onSort={tech.toggle} align="right" />
                  <SortTh label="Средние" sortKey="avg" sort={tech.sort} onSort={tech.toggle} align="right" />
                  <SortTh label="Задач в графике" sortKey="assigned" sort={tech.sort} onSort={tech.toggle} align="right" />
                  <SortTh label="Просрочено" sortKey="overdue" sort={tech.sort} onSort={tech.toggle} align="right" className="sm:pr-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tech.sorted.map(t => (
                  <tr key={t.name} className="hover:bg-blue-50/20 transition-colors">
                    <td className={`${TD_FIRST} font-bold text-slate-800 min-w-40`}>{t.name}</td>
                    <td className={`${TD} text-right font-mono`}>{t.count}</td>
                    <td className={`${TD} text-right font-mono ${t.emergencies ? 'text-rose-600 font-bold' : 'text-slate-300'}`}>{t.emergencies}</td>
                    <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatMoney(t.cost)}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap text-slate-600`}>{t.count ? formatMoney(t.avgCost) : '—'}</td>
                    <td className={`${TD} text-right font-mono`}>{t.assignedTasks}</td>
                    <td className={`px-4 sm:px-6 py-3 text-right font-mono ${t.overdueTasks ? 'text-rose-600 font-bold' : 'text-slate-300'}`}>{t.overdueTasks}</td>
                  </tr>
                ))}
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
            <SearchInput value={search} onChange={v => { setSearch(v); paged.setPage(0); }} placeholder="Станок, мастер, запчасть…" />
            <button type="button" onClick={() => setJournalDir(d => (d === 'desc' ? 'asc' : 'desc'))}
              className="print:hidden inline-flex items-center gap-1 min-h-8 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 cursor-pointer">
              {journalDir === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              {journalDir === 'desc' ? 'Сначала новые' : 'Сначала старые'}
            </button>
            {canExport && (
              <CsvButton
                filename="zhurnal_obsluzhivaniya"
                disabled={!journal.length}
                headers={['Дата', 'Станок', 'Модель', 'Вид работ', 'Статус', 'Исполнитель', 'Описание', 'Запчасти', 'Работы, $', 'Запчасти, $', 'Итого, $']}
                rows={() => journal.map(log => {
                  const machine = data.machineMap.get(log.machineId);
                  const c = logCostParts(log);
                  return [formatDateKey(toLocalDateKey(log.date)), machine?.name, machine?.model, LOG_TYPE_LABELS[log.type] || log.type,
                    isCompleted(log) ? 'Выполнено' : 'Запланировано', log.technicianName, log.notes,
                    (log.partsUsed || []).map(p => `${p.name} x${p.quantity}${p.unitPrice !== undefined ? ` по ${p.unitPrice} $` : ''}`).join(', '),
                    c.labor, c.parts, c.total];
                })}
              />
            )}
          </>
        }
      >
        {journal.length === 0 ? <EmptyState text={search ? 'Ничего не найдено' : undefined} /> : (
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
                    <th className="px-4 py-3 text-right">Работы</th>
                    <th className="px-4 py-3 text-right">Запчасти, $</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Итого</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.pageRows.map(log => {
                    const machine = data.machineMap.get(log.machineId);
                    const done = isCompleted(log);
                    const c = logCostParts(log);
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
                              <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200"
                                title={p.unitPrice !== undefined ? `Цена на момент записи: ${formatMoney(p.unitPrice)}` : undefined}>{p.name} (x{p.quantity})</span>
                            )) : <span className="text-slate-300">—</span>}
                          </div>
                        </td>
                        <td className={`${TD} text-right font-mono whitespace-nowrap ${done ? 'text-slate-700' : 'text-slate-400'}`}>{formatMoney(c.labor)}</td>
                        <td className={`${TD} text-right font-mono whitespace-nowrap ${done ? 'text-slate-700' : 'text-slate-400'}`}>{formatMoney(c.parts)}</td>
                        <td className={`px-4 sm:px-6 py-3 text-right font-black whitespace-nowrap ${done ? 'text-slate-900' : 'text-slate-400'}`}>{formatMoney(c.total)}</td>
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
