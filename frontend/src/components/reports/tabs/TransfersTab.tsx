import React, { useMemo } from 'react';
import { ArrowRight, ArrowRightLeft, Scale } from 'lucide-react';
import { machineService } from '../../../services/machineService';
import { ReportData, filterTransferRows, formatDateTime, formatPeriod, rangeToInstants, transferBalance } from '../reportUtils';
import { AsyncContent, XlsxButton, KpiCard, Panel, SCROLL_BOX, Skeleton, TD, TD_FIRST, THEAD_ROW } from '../ReportUi';
import { useAsyncData } from '../useAsyncData';

export function TransfersTab({ data, canExport }: { data: ReportData; canExport: boolean }) {
  const { branchId, machineId, start, end } = data.filters;
  const params = { ...rangeToInstants({ start, end }), branchId, machineId };
  const state = useAsyncData(`transfers:${JSON.stringify(params)}`, () => machineService.getAnalyticsTransfers(params));

  const stats = useMemo(() => {
    if (!state.data) return null;
    const rows = filterTransferRows(state.data, data.machineMap, data.filters);
    return {
      rows,
      machines: new Set(rows.map(r => r.machineId)).size,
      balance: transferBalance(rows, data.branches),
    };
  }, [state.data, data]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats ? (
          <>
            <KpiCard label="Перемещений" value={stats.rows.length} tone="dark" hint={formatPeriod(data.filters)} />
            <KpiCard label="Станков перемещено" value={stats.machines} />
            <KpiCard label="Филиалов затронуто" value={stats.balance.length} />
          </>
        ) : (
          <div className="sm:col-span-3 bg-white rounded-2xl border border-slate-200 p-4"><Skeleton rows={2} /></div>
        )}
      </div>

      <Panel
        title="Баланс станков по филиалам"
        icon={Scale}
        bodyClass=""
        actions={canExport && stats && (
          <XlsxButton filename="balans_peremescheniy" disabled={!stats.balance.length}
            headers={['Филиал', 'Поступило', 'Убыло', 'Баланс']}
            rows={() => stats.balance.map(r => [r.branchName, r.incoming, r.outgoing, r.balance])} />
        )}
        footer="Баланс = поступило − убыло за период. Филиалы вне вашего доступа не показываются."
      >
        <AsyncContent state={state} isEmpty={() => !stats?.balance.length} emptyText="Нет перемещений за выбранный период">
          {() => (
            <div className="report-scroll overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Филиал</th>
                    <th className="px-4 py-3 text-right">Поступило</th>
                    <th className="px-4 py-3 text-right">Убыло</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Баланс</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats!.balance.map(r => (
                    <tr key={r.branchId}>
                      <td className={`${TD_FIRST} font-bold text-slate-800 min-w-40`}>{r.branchName}</td>
                      <td className={`${TD} text-right font-mono ${r.incoming ? 'text-emerald-700' : 'text-slate-300'}`}>{r.incoming ? `+${r.incoming}` : 0}</td>
                      <td className={`${TD} text-right font-mono ${r.outgoing ? 'text-rose-700' : 'text-slate-300'}`}>{r.outgoing ? `−${r.outgoing}` : 0}</td>
                      <td className={`px-4 sm:px-6 py-3 text-right font-mono font-black ${r.balance > 0 ? 'text-emerald-700' : r.balance < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        {r.balance > 0 ? `+${r.balance}` : r.balance < 0 ? `−${Math.abs(r.balance)}` : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncContent>
      </Panel>

      <Panel
        title="Журнал перемещений"
        icon={ArrowRightLeft}
        bodyClass=""
        actions={canExport && stats && (
          <XlsxButton filename="peremescheniya" disabled={!stats.rows.length}
            headers={['Дата', 'Станок', 'Модель', 'Откуда', 'Куда', 'Кто переместил']}
            rows={() => stats.rows.map(r => [formatDateTime(r.date), r.machineName, r.machineModel, r.fromBranchName || '—', r.toBranchName, r.createdByName || ''])} />
        )}
      >
        <AsyncContent state={state} isEmpty={() => !stats?.rows.length} emptyText="Нет перемещений за выбранный период">
          {() => (
            <div className={SCROLL_BOX}>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Дата</th>
                    <th className="px-4 py-3">Станок</th>
                    <th className="px-4 py-3">Маршрут</th>
                    <th className="px-4 sm:px-6 py-3">Кто</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats!.rows.map(r => (
                    <tr key={r.id}>
                      <td className={`${TD_FIRST} font-mono text-xs text-slate-500 whitespace-nowrap`}>{formatDateTime(r.date)}</td>
                      <td className={`${TD} min-w-40`}>
                        <p className="font-bold text-slate-800">{r.machineName}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{r.machineModel}</p>
                      </td>
                      <td className={`${TD} min-w-56`}>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="text-slate-600">{r.fromBranchName || '—'}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800">{r.toBranchName}</span>
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-xs text-slate-600">{r.createdByName || '—'}</td>
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
