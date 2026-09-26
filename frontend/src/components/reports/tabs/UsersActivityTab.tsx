import React, { useMemo } from 'react';
import { Activity, BarChart3, Building2, Clock, History as HistoryIcon, Shield, Trophy, Users } from 'lucide-react';
import type { ActivityLog } from '../../../types';
import { machineService } from '../../../services/machineService';
import {
  ACTION_TYPE_LABELS, ENTITY_TYPE_LABELS, ReportData, fillDaily, formatDateTime, formatNumber, formatPeriod, inactiveUsers, pluralRu,
  inDateRange, rangeToInstants, toLocalDateKey, userStats,
} from '../reportUtils';
import { AsyncContent, BarList, XlsxButton, EmptyState, ErrorState, KpiCard, Panel, SCROLL_BOX, Skeleton, StatusBadge, TD, TD_FIRST, THEAD_ROW } from '../ReportUi';
import { useAsyncData } from '../useAsyncData';
import { SERIES_COLORS } from '../charts/ChartFrame';
import { StackedBarChart } from '../charts/StackedBarChart';

const ACTION_KEYS = ['create', 'update', 'delete', 'transfer', 'other'] as const;

export function UsersActivityTab({ data, canExport, recentActivity = [] }: { data: ReportData; canExport: boolean; recentActivity?: ActivityLog[] }) {
  const params = {
    ...rangeToInstants(data.filters),
    branchId: data.filters.branchId,
    tzOffset: -data.now.getTimezoneOffset(),
  };
  const state = useAsyncData(`users-activity:${JSON.stringify(params)}`, () => machineService.getAnalyticsUsersActivity(params));

  const stats = useMemo(() => {
    if (!state.data) return null;
    const { users } = state.data;
    return {
      summary: userStats(users, data.branches),
      top: [...users].filter(u => u.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
      inactive: inactiveUsers(users, data.now, 30),
      daily: fillDaily(state.data.daily, data.filters),
      // The app keeps only the latest activity page in memory; show its events from the period and these users.
      recent: recentActivity
        .filter(a => inDateRange(toLocalDateKey(a.timestamp), data.filters) && (!a.userId || users.some(u => u.id === a.userId)))
        .slice(0, 10),
      userNames: new Map(users.map(u => [u.id, u.fullName || u.username])),
    };
  }, [state.data, data, recentActivity]);

  if (state.error) return <Panel title="Пользователи и активность" icon={Users}><ErrorState error={state.error} onRetry={state.reload} /></Panel>;
  if (!state.data || !stats) return <Panel title="Пользователи и активность" icon={Users}><Skeleton rows={6} /></Panel>;
  const activity = state.data;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard label="Пользователей" value={stats.summary.total} tone="dark"
          hint={data.filters.branchId === 'all' ? 'В доступных вам филиалах' : 'Привязанных к филиалу'} />
        <KpiCard label="Активные" value={stats.summary.active} />
        <KpiCard label="Заблокированные" value={stats.summary.blocked} tone={stats.summary.blocked ? 'warning' : 'default'} />
        <KpiCard label="Действий за период" value={formatNumber(activity.total)} hint={formatPeriod(data.filters)} />
        <KpiCard label="Не входили 30+ дней" value={stats.inactive.length} tone={stats.inactive.length ? 'warning' : 'default'} hint="Активные учётные записи" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel title="По ролям" icon={Shield}>
          <BarList items={stats.summary.byRole.map(r => ({ key: r.name, label: r.name, value: r.count }))} emptyText="Нет пользователей" />
        </Panel>
        <Panel title="Привязка к филиалам" icon={Building2}
          footer={stats.summary.unassigned ? `Без привязки (доступ ко всем филиалам): ${stats.summary.unassigned}` : undefined}>
          <BarList colorClass="bg-indigo-500" items={stats.summary.byBranch.map(b => ({ key: b.branchId, label: b.branchName, value: b.count }))} emptyText="Нет привязок к филиалам" />
        </Panel>
      </div>

      <Panel
        title="Активность по дням"
        icon={BarChart3}
        actions={canExport && (
          <XlsxButton filename="aktivnost_po_dnyam" disabled={!stats.daily.length}
            headers={['Дата', 'Действий']} rows={() => stats.daily.map(d => [d.date, d.count])} />
        )}
      >
        {activity.total === 0 ? <EmptyState /> : (
          <StackedBarChart data={stats.daily} categoryKey="label" height={220} series={[{ key: 'count', label: 'Действий', color: SERIES_COLORS.activity }]} />
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel title="По типу действия" icon={Activity}>
          <BarList
            items={ACTION_KEYS.filter(k => activity.byActionType[k]).map(k => ({ key: k, label: ACTION_TYPE_LABELS[k], value: activity.byActionType[k] }))}
          />
        </Panel>
        <Panel title="По разделам" icon={Activity}>
          <BarList
            colorClass="bg-indigo-500"
            items={Object.entries(activity.byEntityType)
              .filter(([, v]) => v)
              .sort((a, b) => (b[1] || 0) - (a[1] || 0))
              .map(([k, v]) => ({ key: k, label: ENTITY_TYPE_LABELS[k] || k, value: v || 0 }))}
          />
        </Panel>
      </div>

      <Panel
        title="Самые активные: ТОП-10"
        icon={Trophy}
        iconClass="text-amber-500"
        bodyClass=""
        actions={canExport && (
          <XlsxButton filename="aktivnye_polzovateli" disabled={!stats.top.length}
            headers={['Пользователь', 'Логин', 'Роль', ...ACTION_KEYS.map(k => ACTION_TYPE_LABELS[k]), 'Всего', 'Последний вход']}
            rows={() => stats.top.map(u => [u.fullName, u.username, u.roleName, ...ACTION_KEYS.map(k => u.actions[k]), u.total, formatDateTime(u.lastLogin)])} />
        )}
      >
        {stats.top.length === 0 ? <EmptyState /> : (
          <div className="report-scroll overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Пользователь</th>
                  {ACTION_KEYS.map(k => <th key={k} className="px-3 py-3 text-right">{ACTION_TYPE_LABELS[k]}</th>)}
                  <th className="px-4 py-3 text-right">Всего</th>
                  <th className="px-4 sm:px-6 py-3">Последний вход</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.top.map(u => (
                  <tr key={u.id}>
                    <td className={`${TD_FIRST} min-w-44`}>
                      <p className="font-bold text-slate-800">{u.fullName}</p>
                      <p className="text-[10px] text-slate-400">{u.username}{u.roleName ? ` · ${u.roleName}` : ''}</p>
                    </td>
                    {ACTION_KEYS.map(k => <td key={k} className={`px-3 py-3 text-right font-mono ${u.actions[k] ? '' : 'text-slate-300'}`}>{u.actions[k]}</td>)}
                    <td className={`${TD} text-right font-mono font-black`}>{u.total}</td>
                    <td className="px-4 sm:px-6 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(u.lastLogin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {stats.recent.length > 0 && (
        <Panel title="Последние действия" icon={HistoryIcon} bodyClass="">
          <ul className="divide-y divide-slate-50">
            {stats.recent.map(a => (
              <li key={a.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{a.entityName || ENTITY_TYPE_LABELS[a.entityType] || a.entityType}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{a.details}</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge label={ACTION_TYPE_LABELS[a.actionType] || a.actionType} className="bg-slate-100 text-slate-600" />
                  <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(a.timestamp)} · {(a.userId && stats.userNames.get(a.userId)) || a.userEmail || '—'}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Не входили в систему более 30 дней"
        icon={Clock}
        iconClass="text-amber-500"
        bodyClass=""
        actions={canExport && (
          <XlsxButton filename="neaktivnye_polzovateli" disabled={!stats.inactive.length}
            headers={['Пользователь', 'Логин', 'Роль', 'Должность', 'Последний вход', 'Дней без входа']}
            rows={() => stats.inactive.map(u => [u.fullName, u.username, u.roleName, u.position, formatDateTime(u.lastLogin), u.daysSince ?? 'никогда'])} />
        )}
      >
        <AsyncContent state={state} isEmpty={() => stats.inactive.length === 0} emptyText="Все активные пользователи заходили за последние 30 дней">
          {() => (
            <div className={SCROLL_BOX}>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Пользователь</th>
                    <th className="px-4 py-3">Роль</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Последний вход</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.inactive.map(u => (
                    <tr key={u.id}>
                      <td className={`${TD_FIRST} min-w-44`}>
                        <p className="font-bold text-slate-800">{u.fullName}</p>
                        <p className="text-[10px] text-slate-400">{u.username}{u.position ? ` · ${u.position}` : ''}</p>
                      </td>
                      <td className={TD}>{u.roleName ? <StatusBadge label={u.roleName} className="bg-slate-100 text-slate-600" /> : '—'}</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-xs whitespace-nowrap">
                        {u.daysSince === null
                          ? <span className="font-bold text-amber-600">Ни разу не входил</span>
                          : <><span className="font-bold text-slate-700">{u.daysSince} {pluralRu(u.daysSince, ['день', 'дня', 'дней'])} назад</span><p className="text-[10px] text-slate-400">{formatDateTime(u.lastLogin)}</p></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncContent>
      </Panel>
    </div>
  );
}
