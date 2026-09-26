import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Archive, BarChart3, Boxes, Building2 } from 'lucide-react';
import {
  ReportData, deadStock, formatMoney, formatNumber, isLowStock, monthlyPartsCost, partAvailable, partsUsage, partValue, pluralRu,
  stockByBranch, stockSummary, sumPartsUsage,
} from './reportUtils';
import { CHART_AXIS_TICK, CHART_TOOLTIP_STYLE, ChartFrame, CsvButton, EmptyState, KpiCard, Panel, ProgressBar, SERIES_COLORS, TD, THEAD_ROW } from './ReportUi';

export function InventoryTab({ data, canExport }: { data: ReportData; canExport: boolean }) {
  const stats = useMemo(() => {
    const usage = partsUsage(data.logs, data.partLookup);
    const dead = deadStock(data.parts, data.logs, data.partLookup);
    return {
      stock: stockSummary(data.parts),
      byBranch: stockByBranch(data.parts, data.branches, data.machineMap, data.filters.branchId),
      low: data.parts.filter(isLowStock).sort((a, b) => partAvailable(a) - (a.minQuantity || 0) - (partAvailable(b) - (b.minQuantity || 0))),
      usage: usage.slice(0, 10),
      usageTotals: sumPartsUsage(usage),
      monthly: monthlyPartsCost(data.logs, data.partLookup, data.filters),
      dead,
      deadValue: dead.reduce((a, p) => a + partValue(p), 0),
    };
  }, [data]);

  const usageMax = Math.max(...stats.usage.map(u => u.totalCost), 1);
  const hasMonthly = stats.monthly.some(p => p.cost > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label={`Баланс склада${data.filters.branchId === 'all' ? ' (общий)' : ''}`} value={formatMoney(stats.stock.value)} tone="dark"
          hint={`${stats.stock.items} ${pluralRu(stats.stock.items, ['наименование', 'наименования', 'наименований'])}, без архивных`} />
        <KpiCard label="Мало на складе" value={formatNumber(stats.stock.lowCount)} tone={stats.stock.lowCount > 0 ? 'warning' : 'default'}
          hint="Доступно ≤ минимального остатка" />
        <KpiCard label="Расход за период" value={formatMoney(stats.usageTotals.cost)}
          hint={`Использовано ${formatNumber(stats.usageTotals.qty)} ед. в выполненных работах`} />
        <KpiCard label="Неликвид" value={formatMoney(stats.deadValue)} tone={stats.dead.length > 0 ? 'warning' : 'default'}
          hint={`${stats.dead.length} ${pluralRu(stats.dead.length, ['позиция', 'позиции', 'позиций'])} без расхода за период`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel
          title="Остатки по филиалам"
          icon={Building2}
          bodyClass=""
          actions={canExport && (
            <CsvButton
              filename="ostatki_po_filialam"
              disabled={stats.byBranch.length === 0}
              headers={['Филиал', 'Наименований', 'Стоимость, $']}
              rows={() => [...stats.byBranch.map(r => [r.branchName, r.items, r.value]), ['Итого', stats.stock.items, stats.stock.value]]}
            />
          )}
        >
          {stats.byBranch.length === 0 ? (
            <EmptyState text="На складе нет запчастей" compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Филиал</th>
                    <th className="px-4 py-3 text-right">Наименований</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byBranch.map(r => (
                    <tr key={r.branchId}>
                      <td className="px-4 sm:px-6 py-3 font-bold text-slate-800 min-w-40">{r.branchName}</td>
                      <td className={`${TD} text-right font-mono text-slate-600`}>{r.items}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap">{formatMoney(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-900">
                    <td className="px-4 sm:px-6 py-3 text-[11px] uppercase tracking-widest">Итого</td>
                    <td className={`${TD} text-right font-mono`}>{stats.stock.items}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-mono whitespace-nowrap">{formatMoney(stats.stock.value)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Расход запчастей по месяцам" icon={BarChart3}>
          {hasMonthly ? (
            <ChartFrame height={240}>
              {({ width, height }) => (
                <BarChart width={width} height={height} data={stats.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} dy={6} />
                  <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} width={56} tickFormatter={(v: number) => formatNumber(v, 0)} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                    formatter={(val: number, _name: string, item: { payload?: { qty: number } }) => [`${formatMoney(val)} · ${formatNumber(item.payload?.qty ?? 0)} ед.`, 'Расход']}
                  />
                  <Bar dataKey="cost" name="Расход" fill={SERIES_COLORS.parts} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              )}
            </ChartFrame>
          ) : (
            <EmptyState compact />
          )}
        </Panel>
      </div>

      <Panel
        title="Заканчиваются на складе"
        icon={AlertTriangle}
        iconClass="text-amber-500"
        bodyClass=""
        actions={canExport && (
          <CsvButton
            filename="malo_na_sklade"
            disabled={stats.low.length === 0}
            headers={['Наименование', 'Артикул', 'Доступно', 'В брони', 'Минимум', 'Ед.']}
            rows={() => stats.low.map(p => [p.name, p.sku, partAvailable(p), p.reservedQuantity || 0, p.minQuantity || 0, p.unit || 'шт'])}
          />
        )}
      >
        {stats.low.length === 0 ? (
          <EmptyState text="Все позиции выше минимального остатка" compact />
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Наименование</th>
                  <th className="px-4 py-3">Артикул</th>
                  <th className="px-4 py-3 text-right">Доступно</th>
                  <th className="px-4 py-3 text-right">В брони</th>
                  <th className="px-4 py-3 text-right">Минимум</th>
                  <th className="px-4 sm:px-6 py-3">Ед.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.low.map(p => (
                  <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3 font-bold text-slate-800 min-w-44">{p.name}</td>
                    <td className={`${TD} font-mono text-xs text-slate-500`}>{p.sku || '—'}</td>
                    <td className={`${TD} text-right font-mono font-black ${partAvailable(p) <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>{formatNumber(partAvailable(p))}</td>
                    <td className={`${TD} text-right font-mono text-slate-500`}>{formatNumber(p.reservedQuantity || 0)}</td>
                    <td className={`${TD} text-right font-mono text-slate-700`}>{formatNumber(p.minQuantity || 0)}</td>
                    <td className="px-4 sm:px-6 py-3 text-slate-500">{p.unit || 'шт'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel
          title="Расход запчастей (ТОП-10)"
          icon={Boxes}
          actions={canExport && (
            <CsvButton
              filename="rashod_zapchastey"
              disabled={stats.usage.length === 0}
              headers={['Наименование', 'Артикул', 'Расход', 'Ед.', 'Цена, $', 'Сумма, $']}
              rows={() => stats.usage.map(u => [u.name, u.sku, u.qty, u.unit, u.unitPrice, u.totalCost])}
            />
          )}
        >
          {stats.usage.length === 0 ? (
            <EmptyState compact />
          ) : (
            <div className="space-y-3">
              {stats.usage.map(u => (
                <div key={u.key} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate" title={u.name}>{u.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Расход: <strong className="text-slate-800">{formatNumber(u.qty)} {u.unit}</strong>
                        {u.unitPrice > 0 && <> · Цена: <strong className="text-slate-700">{formatMoney(u.unitPrice)}/{u.unit}</strong></>}
                      </p>
                    </div>
                    <p className="text-xs font-mono font-black text-blue-600 shrink-0">{u.totalCost > 0 ? formatMoney(u.totalCost) : '—'}</p>
                  </div>
                  {u.totalCost > 0 && <ProgressBar percent={Math.max(5, (u.totalCost / usageMax) * 100)} className="h-1" />}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Неликвид: без расхода за период"
          icon={Archive}
          iconClass="text-slate-500"
          bodyClass=""
          actions={canExport && (
            <CsvButton
              filename="nelikvid"
              disabled={stats.dead.length === 0}
              headers={['Наименование', 'Артикул', 'Количество', 'Ед.', 'Стоимость, $']}
              rows={() => stats.dead.map(p => [p.name, p.sku, p.quantity, p.unit || 'шт', partValue(p)])}
            />
          )}
        >
          {stats.dead.length === 0 ? (
            <EmptyState text="Все позиции в наличии использовались за период" compact />
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Наименование</th>
                    <th className="px-4 py-3 text-right">Кол-во</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.dead.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 sm:px-6 py-3 min-w-44">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        {p.sku && <p className="text-[10px] font-mono text-slate-400">{p.sku}</p>}
                      </td>
                      <td className={`${TD} text-right font-mono text-slate-600 whitespace-nowrap`}>{formatNumber(p.quantity)} {p.unit || 'шт'}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap">{formatMoney(partValue(p))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 sm:px-6 py-3 text-[10px] text-slate-400 border-t border-slate-100">
            Учитываются выполненные работы с текущими фильтрами (филиал, станок, тип работ, период).
          </p>
        </Panel>
      </div>
    </div>
  );
}
