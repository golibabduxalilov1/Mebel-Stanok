import React, { useMemo } from 'react';
import { AlertTriangle, BarChart3, ChevronRight, Cog, Package, TrendingDown } from 'lucide-react';
import {
  AttentionTab, ReportData, attentionGroups, formatAmps, formatMoney, formatNumber, formatPercent, isCompleted, isEmergencyType,
  isRetired, monthlyCost, overdueSchedules, percentChange, plannedSummary, pluralRu, powerSummary, stockSummary, sumCompletedCost,
  uptimePercent, WORKS_FORMS,
} from '../reportUtils';
import { CsvButton, EmptyState, KpiCard, KPI_GRID, Panel, ProgressBar } from '../ReportUi';
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={KPI_GRID}>
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
    </div>
  );
}
