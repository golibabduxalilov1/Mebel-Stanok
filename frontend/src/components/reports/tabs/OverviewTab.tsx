import React, { useMemo } from 'react';
import { AlertTriangle, BarChart3, ChevronRight } from 'lucide-react';
import {
  AttentionTab, COST_KIND_LABELS, ReportData, attentionGroups, costBreakdown, formatAmps, formatMoney, formatNumber, formatPercent, isCompleted, isEmergencyType,
  isRetired, monthlyCost, overdueSchedules, percentChange, plannedSummary, pluralRu, powerSummary, stockSummary, sumCompletedCost,
  uptimePercent, WORKS_FORMS,
} from '../reportUtils';
import { CsvButton, EmptyState, KpiCard, Panel, ProgressBar } from '../ReportUi';
import { SERIES_COLORS } from '../charts/ChartFrame';
import { StackedBarChart } from '../charts/StackedBarChart';

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

export function OverviewTab({ data, canExport, canEquipment, canToir, canInventory, onNavigate }: {
  data: ReportData;
  canExport: boolean;
  canEquipment: boolean;
  canToir: boolean;
  canInventory: boolean;
  onNavigate: (tab: AttentionTab) => void;
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
      breakdown: costBreakdown(data.logs),
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Станков" value={formatNumber(stats.total)} tone="dark"
          hint={`В работе ${stats.byStatus.active} · ТО ${stats.byStatus.maintenance} · ремонт ${stats.byStatus.repair} · списано ${stats.byStatus.retired}`} />
        <KpiCard label="В работе" value={formatPercent(stats.uptime)} hint={`Активные из ${stats.inService} не списанных`}>
          <ProgressBar percent={stats.uptime} className="h-1.5 mt-2" colorClass={stats.uptime > 90 ? 'bg-emerald-500' : stats.uptime > 70 ? 'bg-amber-500' : 'bg-rose-500'} />
        </KpiCard>
        <KpiCard
          label={`Затраты за период${data.filters.costKind && data.filters.costKind !== 'total' ? ` (${COST_KIND_LABELS[data.filters.costKind].toLowerCase()})` : ''}`}
          value={formatMoney(stats.cost)}
          hint={
            <>
              <ChangeBadge change={stats.costChange} />
              <p className="mt-1">Работы {formatMoney(stats.breakdown.labor)} · запчасти {formatMoney(stats.breakdown.parts)}</p>
              {stats.planned.count > 0 && (
                <p className="text-amber-600 font-bold mt-1">
                  Запланировано: {stats.planned.count} {pluralRu(stats.planned.count, WORKS_FORMS)}, ожидаемые затраты {formatMoney(stats.planned.cost)}
                </p>
              )}
            </>
          } />
        <KpiCard label="Выполнено работ" value={formatNumber(stats.completed)} hint={<ChangeBadge change={stats.completedChange} invert />} />
        <KpiCard label="Аварий" value={formatNumber(stats.emergencies)} tone={stats.emergencies > 0 ? 'danger' : 'default'}
          hint={<ChangeBadge change={stats.emergenciesChange} />} />
        {canToir && (
          <KpiCard label="Просроченные ТО" value={formatNumber(stats.overdue)} tone={stats.overdue > 0 ? 'danger' : 'default'}
            hint="Задачи графика с истёкшим сроком" onClick={() => onNavigate('maintenance')} />
        )}
        {canInventory && (
          <KpiCard label="Мало на складе" value={formatNumber(stats.lowStock)} tone={stats.lowStock > 0 ? 'warning' : 'default'}
            hint="Доступно ≤ минимального остатка" onClick={() => onNavigate('inventory')} />
        )}
        {canEquipment && (
          <KpiCard label={`Суммарный ток (${branchLabel})`} value={formatAmps(stats.power.totalAmps)} onClick={() => onNavigate('power')}
            hint={
              <>
                В работе {formatAmps(stats.power.activeAmps)}
                {stats.power.missingCount > 0 && <span> · без ампеража (0 А): {stats.power.missingCount}</span>}
              </>
            } />
        )}
      </div>

      <Panel
        title="Затраты по месяцам: плановые и аварийные"
        icon={BarChart3}
        actions={canExport && (
          <CsvButton
            filename="zatraty_po_mesyacam"
            disabled={!hasMonthly}
            headers={['Месяц', 'Плановые, $', 'Аварийные, $', 'Всего, $']}
            rows={() => stats.monthly.map(p => [p.label, p.planned, p.emergency, p.planned + p.emergency])}
          />
        )}
        footer="Плановые: ТО, ППР, инспекция, диагностика. Аварийные: ремонт и аварийный ремонт. Только выполненные работы."
      >
        {hasMonthly ? (
          <StackedBarChart
            data={stats.monthly}
            categoryKey="label"
            height={280}
            valueFormatter={formatMoney}
            series={[
              { key: 'planned', label: 'Плановые', color: SERIES_COLORS.planned },
              { key: 'emergency', label: 'Аварийные', color: SERIES_COLORS.emergency },
            ]}
          />
        ) : (
          <EmptyState />
        )}
      </Panel>

      <Panel title="Требует внимания" icon={AlertTriangle} iconClass="text-amber-500">
        {stats.attention.length === 0 ? (
          <EmptyState text="Проблем не найдено: нет станков в ремонте, просрочек, дефицита и станков без цены" compact />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
            {stats.attention.map(group => (
              <div key={group.id} className={`rounded-xl border ${group.tone === 'danger' ? 'border-rose-200 bg-rose-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                <button
                  type="button"
                  onClick={() => onNavigate(group.tab)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-white/60 rounded-t-xl"
                >
                  <span className={`text-[11px] font-black uppercase tracking-widest ${group.tone === 'danger' ? 'text-rose-700' : 'text-amber-700'}`}>{group.title}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${group.tone === 'danger' ? 'bg-rose-500' : 'bg-amber-500'}`}>{group.items.length}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </span>
                </button>
                <ul className="divide-y divide-white/80 border-t border-white/80">
                  {group.items.slice(0, 5).map(item => (
                    <li key={item.id}>
                      <button type="button" onClick={() => onNavigate(group.tab)} className="w-full text-left px-4 py-2 hover:bg-white/60 cursor-pointer">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{item.subtitle}</p>
                      </button>
                    </li>
                  ))}
                </ul>
                {group.items.length > 5 && (
                  <button type="button" onClick={() => onNavigate(group.tab)} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:bg-white/60 cursor-pointer rounded-b-xl">
                    Показать все ({group.items.length})
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
