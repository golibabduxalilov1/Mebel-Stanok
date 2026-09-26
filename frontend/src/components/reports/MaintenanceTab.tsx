import React, { useMemo } from 'react';
import { Activity, CalendarClock, History as HistoryIcon, PieChart, Users } from 'lucide-react';
import {
  ReportData, formatDateKey, formatMoney, formatNumber, formatPercent, isCompleted, LOG_TYPE_BADGE, LOG_TYPE_LABELS,
  mtbfByMachine, overdueSchedules, pluralRu, WORKS_FORMS, plannedSummary, PRIORITY_BADGE, PRIORITY_LABELS, scheduleOnTime, sortLogsByDateDesc,
  technicianStats, toLocalDateKey, workTypeRatio,
} from './reportUtils';
import { CsvButton, EmptyState, KpiCard, Panel, ProgressBar, SERIES_COLORS, TD, THEAD_ROW } from './ReportUi';

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
      <div className="flex justify-between gap-2 text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: SERIES_COLORS.planned }} />
          Плановые: <strong className="font-mono">{format(planned)}</strong> ({formatPercent(plannedPct)})
        </span>
        <span className="flex items-center gap-1.5 text-right">
          <span className="w-2 h-2 rounded-full" style={{ background: SERIES_COLORS.emergency }} />
          Аварийные: <strong className="font-mono">{format(emergency)}</strong> ({formatPercent(total ? 100 - plannedPct : 0)})
        </span>
      </div>
    </div>
  );
}

export function MaintenanceTab({ data, canExport }: { data: ReportData; canExport: boolean }) {
  const stats = useMemo(() => ({
    ratio: workTypeRatio(data.logs),
    planned: plannedSummary(data.logs),
    mtbf: mtbfByMachine(data.logs, data.machineMap).slice(0, 5),
    overdue: overdueSchedules(data.schedules, data.machineMap, data.today),
    onTime: scheduleOnTime(data.logs, data.allLogs, data.schedules),
    technicians: technicianStats(data.logs),
    journal: sortLogsByDateDesc(data.logs),
  }), [data]);

  const { ratio } = stats;
  const hasRatio = ratio.planned.count + ratio.emergency.count > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Выполнено работ" value={formatNumber(ratio.planned.count + ratio.emergency.count)} tone="dark"
          hint={`На сумму ${formatMoney(ratio.planned.cost + ratio.emergency.cost)}`} />
        <KpiCard label="Запланировано" value={formatNumber(stats.planned.count)} tone={stats.planned.count > 0 ? 'warning' : 'default'}
          hint={`Ожидаемые затраты ${formatMoney(stats.planned.cost)}`} />
        <KpiCard label="Просроченные задачи" value={formatNumber(stats.overdue.length)} tone={stats.overdue.length > 0 ? 'danger' : 'default'}
          hint="По текущему графику ТО" />
        <KpiCard label="Выполнено в срок" value={stats.onTime.percent === null ? '—' : formatPercent(stats.onTime.percent)}
          hint={stats.onTime.total ? `${stats.onTime.onTime} из ${stats.onTime.total} ${pluralRu(stats.onTime.total, WORKS_FORMS)} по графику` : 'Нет повторных работ по графику за период'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel title="Плановые и аварийные работы" icon={PieChart}>
          {hasRatio ? (
            <div className="space-y-6">
              <RatioBar label="По количеству" planned={ratio.planned.count} emergency={ratio.emergency.count} format={n => formatNumber(n)} />
              <RatioBar label="По затратам" planned={ratio.planned.cost} emergency={ratio.emergency.cost} format={formatMoney} />
              <p className="text-[10px] text-slate-400">Плановые: ТО, ППР, инспекция, диагностика. Аварийные: ремонт и аварийный ремонт. Только выполненные работы.</p>
            </div>
          ) : (
            <EmptyState compact />
          )}
        </Panel>

        <Panel title="Наработка на отказ (MTBF): худшие 5" icon={Activity} iconClass="text-rose-500">
          {stats.mtbf.length === 0 ? (
            <EmptyState text="Недостаточно данных: нужно минимум 2 аварии на станок за период" compact />
          ) : (
            <div className="space-y-3">
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
      </div>

      <Panel
        title="Просроченные задачи графика ТО"
        icon={CalendarClock}
        iconClass="text-rose-500"
        bodyClass=""
        actions={canExport && (
          <CsvButton
            filename="prosrochennye_zadachi"
            disabled={stats.overdue.length === 0}
            headers={['Станок', 'Задача', 'Срок', 'Просрочено, дней', 'Приоритет']}
            rows={() => stats.overdue.map(t => [t.machineName, t.taskName, formatDateKey(t.nextDue), t.daysLate, t.priority ? PRIORITY_LABELS[t.priority] : ''])}
          />
        )}
      >
        {stats.overdue.length === 0 ? (
          <EmptyState text="Просроченных задач нет" compact />
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Станок</th>
                  <th className="px-4 py-3">Задача</th>
                  <th className="px-4 py-3">Срок</th>
                  <th className="px-4 py-3 text-right">Просрочка</th>
                  <th className="px-4 sm:px-6 py-3">Приоритет</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.overdue.map(t => (
                  <tr key={t.id} className="hover:bg-rose-50/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3 font-bold text-slate-800 min-w-40">{t.machineName}</td>
                    <td className={`${TD} text-slate-600 min-w-48`}>{t.taskName}</td>
                    <td className={`${TD} font-mono text-xs text-slate-500 whitespace-nowrap`}>{formatDateKey(t.nextDue)}</td>
                    <td className={`${TD} text-right font-mono font-black text-rose-600 whitespace-nowrap`}>{t.daysLate} дн.</td>
                    <td className="px-4 sm:px-6 py-3">
                      {t.priority ? (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase whitespace-nowrap ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
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
          <CsvButton
            filename="ispolniteli"
            disabled={stats.technicians.length === 0}
            headers={['Исполнитель', 'Работ', 'Из них аварийных', 'Затраты, $']}
            rows={() => stats.technicians.map(t => [t.name, t.count, t.emergencies, t.cost])}
          />
        )}
      >
        {stats.technicians.length === 0 ? (
          <EmptyState compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Исполнитель</th>
                  <th className="px-4 py-3 text-right">Работ</th>
                  <th className="px-4 py-3 text-right">Аварийных</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Затраты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.technicians.map(t => (
                  <tr key={t.name} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-4 sm:px-6 py-3 font-bold text-slate-800 min-w-40">{t.name}</td>
                    <td className={`${TD} text-right font-mono`}>{t.count}</td>
                    <td className={`${TD} text-right font-mono ${t.emergencies ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{t.emergencies}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap">{formatMoney(t.cost)}</td>
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Выборка: {stats.journal.length} событий</span>
            {canExport && (
              <CsvButton
                filename="zhurnal_obsluzhivaniya"
                disabled={stats.journal.length === 0}
                headers={['Дата', 'Станок', 'Модель', 'Вид работ', 'Статус', 'Исполнитель', 'Описание', 'Запчасти', 'Стоимость, $']}
                rows={() => stats.journal.map(log => {
                  const machine = data.machineMap.get(log.machineId);
                  return [
                    formatDateKey(toLocalDateKey(log.date)),
                    machine?.name || '',
                    machine?.model || '',
                    LOG_TYPE_LABELS[log.type] || log.type,
                    isCompleted(log) ? 'Выполнено' : 'Запланировано',
                    log.technicianName || '',
                    log.notes || '',
                    (log.partsUsed || []).map(p => `${p.name} x${p.quantity}`).join(', '),
                    log.cost || 0,
                  ];
                })}
              />
            )}
          </>
        }
      >
        <div className="overflow-auto max-h-[560px] custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className={THEAD_ROW}>
                <th className="px-4 sm:px-6 py-3">Дата / Станок</th>
                <th className="px-4 py-3">Вид работ</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Запчасти</th>
                <th className="px-4 sm:px-6 py-3 text-right">Стоимость</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.journal.map(log => {
                const machine = data.machineMap.get(log.machineId);
                const done = isCompleted(log);
                return (
                  <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-4 sm:px-6 py-3">
                      <p className="text-xs font-mono text-slate-400 mb-0.5">{formatDateKey(toLocalDateKey(log.date))}</p>
                      <p className="font-bold text-slate-800 leading-tight min-w-40">{machine?.name || '—'}</p>
                      <p className="text-[10px] text-slate-400 font-mono uppercase">{machine?.model}</p>
                    </td>
                    <td className={TD}>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block mb-1 whitespace-nowrap ${LOG_TYPE_BADGE[log.type] || 'bg-slate-100 text-slate-600'}`}>
                        {LOG_TYPE_LABELS[log.type] || log.type}
                      </span>
                      {log.notes && <p className="text-xs text-slate-600 italic truncate w-44" title={log.notes}>"{log.notes}"</p>}
                    </td>
                    <td className={TD}>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase whitespace-nowrap ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {done ? 'Выполнено' : 'Запланировано'}
                      </span>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1 min-w-32">
                        {log.partsUsed?.length ? log.partsUsed.map((p, i) => (
                          <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                            {p.name} (x{p.quantity})
                          </span>
                        )) : <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className={`px-4 sm:px-6 py-3 text-right font-black whitespace-nowrap ${done ? 'text-slate-900' : 'text-slate-400'}`}>{formatMoney(log.cost || 0)}</td>
                  </tr>
                );
              })}
              {stats.journal.length === 0 && (
                <tr>
                  <td colSpan={5}><EmptyState /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
