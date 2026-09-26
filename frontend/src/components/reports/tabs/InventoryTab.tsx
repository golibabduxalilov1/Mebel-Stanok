import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, BarChart3, Boxes, Building2, Cog, Lock, Ruler } from 'lucide-react';
import { machineService } from '../../../services/machineService';
import {
  NO_BRANCH_ID, ReportData, deadStock, formatDateKey, formatMoney, formatNumber, lowStockRows, monthlyPartsCost, partHomeBranch, partsUsage,
  partValue, pluralRu, stockByBranch, stockByUnit, stockSummary, sumPartsUsage, toLocalDateKey, usageByMachine,
} from '../reportUtils';
import { AsyncContent, CsvButton, EmptyState, KpiCard, Panel, ProgressBar, SCROLL_BOX, StatusBadge, TD, TD_FIRST, TFOOT_ROW, THEAD_ROW } from '../ReportUi';
import { useAsyncData } from '../useAsyncData';
import { SERIES_COLORS } from '../charts/ChartFrame';
import { StackedBarChart } from '../charts/StackedBarChart';

const positions = (n: number) => `${n} ${pluralRu(n, ['позиция', 'позиции', 'позиций'])}`;

export function InventoryTab({ data, canExport }: { data: ReportData; canExport: boolean }) {
  const [topBy, setTopBy] = useState<'qty' | 'value'>('qty');
  const branchParam = data.filters.branchId === 'all' ? undefined : data.filters.branchId;
  const reservations = useAsyncData(`reservations:${branchParam ?? 'all'}`, () => machineService.getAnalyticsReservations({ branchId: branchParam }));

  const stats = useMemo(() => {
    const usage = partsUsage(data.logs, data.partLookup);
    const dead = deadStock(data.parts, data.logs, data.partLookup);
    const archivedByBranch = new Map<string, number>();
    data.archivedParts.forEach(p => {
      const home = data.filters.branchId !== 'all' ? data.filters.branchId : partHomeBranch(p, data.machineMap);
      const key = home && data.branchMap.has(home) ? home : NO_BRANCH_ID;
      archivedByBranch.set(key, (archivedByBranch.get(key) || 0) + partValue(p));
    });
    return {
      stock: stockSummary(data.parts),
      archived: stockSummary(data.archivedParts),
      byBranch: stockByBranch(data.parts, data.branches, data.machineMap, data.filters.branchId),
      archivedByBranch,
      low: lowStockRows(data.parts),
      usage,
      usageTotals: sumPartsUsage(usage),
      monthly: monthlyPartsCost(data.logs, data.partLookup, data.filters),
      byMachine: usageByMachine(data.logs, data.partLookup, data.machineMap),
      dead,
      deadValue: dead.reduce((a, p) => a + partValue(p), 0),
      units: stockByUnit(data.parts, data.units),
    };
  }, [data]);

  const top = useMemo(
    () => [...stats.usage].sort((a, b) => (topBy === 'qty' ? b.qty - a.qty || b.totalCost - a.totalCost : b.totalCost - a.totalCost || b.qty - a.qty)).slice(0, 10),
    [stats.usage, topBy],
  );
  const topMax = Math.max(...top.map(u => (topBy === 'qty' ? u.qty : u.totalCost)), 1);
  const reservedValue = reservations.data?.reduce((a, r) => a + r.value, 0) ?? null;
  const archivedTotal = [...stats.archivedByBranch.values()].reduce((a, v) => a + v, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard label={`Склад${data.filters.branchId === 'all' ? ' (общий)' : ''}`} value={formatMoney(stats.stock.value)} tone="dark"
          hint={`${stats.stock.items} ${pluralRu(stats.stock.items, ['наименование', 'наименования', 'наименований'])}, без архива`} />
        <KpiCard label="В архиве" value={formatMoney(stats.archived.value)} hint={`${positions(stats.archived.items)} — не входят в итоги`} />
        <KpiCard label="Мало на складе" value={formatNumber(stats.stock.lowCount)} tone={stats.stock.lowCount > 0 ? 'warning' : 'default'} hint="Доступно ≤ минимального остатка" />
        <KpiCard label="В брони" value={reservedValue === null ? (reservations.error ? '—' : '…') : formatMoney(reservedValue)}
          hint={reservations.data ? positions(reservations.data.length) : reservations.error ? 'Не удалось загрузить' : 'Загрузка…'} />
        <KpiCard label="Расход за период" value={formatMoney(stats.usageTotals.cost)} hint={`${formatNumber(stats.usageTotals.qty)} ед. в выполненных работах`} />
        <KpiCard label="Неликвид" value={formatMoney(stats.deadValue)} tone={stats.dead.length > 0 ? 'warning' : 'default'} hint={`${positions(stats.dead.length)} без расхода за период`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel
          title="Стоимость склада по филиалам"
          icon={Building2}
          bodyClass=""
          actions={canExport && (
            <CsvButton filename="sklad_po_filialam" disabled={!stats.byBranch.length}
              headers={['Филиал', 'Наименований', 'Стоимость, $', 'В архиве, $']}
              rows={() => [...stats.byBranch.map(r => [r.branchName, r.items, r.value, stats.archivedByBranch.get(r.branchId) || 0]),
                ['Итого', stats.stock.items, stats.stock.value, archivedTotal]]} />
          )}
          footer="Стоимость = количество × цена. Архивные позиции показаны отдельно и в итог не входят."
        >
          {stats.byBranch.length === 0 ? <EmptyState text="На складе нет запчастей" compact /> : (
            <div className="report-scroll overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Филиал</th>
                    <th className="px-4 py-3 text-right">Позиций</th>
                    <th className="px-4 py-3 text-right">Стоимость</th>
                    <th className="px-4 sm:px-6 py-3 text-right">В архиве</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byBranch.map(r => (
                    <tr key={r.branchId}>
                      <td className={`${TD_FIRST} font-bold text-slate-800 min-w-40`}>{r.branchName}</td>
                      <td className={`${TD} text-right font-mono text-slate-600`}>{r.items}</td>
                      <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatMoney(r.value)}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono whitespace-nowrap text-slate-400">{formatMoney(stats.archivedByBranch.get(r.branchId) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={TFOOT_ROW}>
                    <td className={`${TD_FIRST} text-[11px] uppercase tracking-widest`}>Итого</td>
                    <td className={`${TD} text-right font-mono`}>{stats.stock.items}</td>
                    <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatMoney(stats.stock.value)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-mono whitespace-nowrap text-slate-500">{formatMoney(archivedTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Расход запчастей по месяцам" icon={BarChart3}>
          {stats.monthly.some(p => p.cost > 0) ? (
            <StackedBarChart data={stats.monthly} categoryKey="label" height={240} valueFormatter={formatMoney}
              series={[{ key: 'cost', label: 'Расход', color: SERIES_COLORS.parts }]} />
          ) : <EmptyState compact />}
        </Panel>
      </div>

      <Panel
        title="Заканчиваются на складе"
        icon={AlertTriangle}
        iconClass="text-amber-500"
        bodyClass=""
        actions={canExport && (
          <CsvButton filename="malo_na_sklade" disabled={!stats.low.length}
            headers={['Наименование', 'Артикул', 'Доступно', 'В брони', 'Минимум', 'Дефицит', 'Ед.']}
            rows={() => stats.low.map(r => [r.part.name, r.part.sku, r.available, r.reserved, r.min, r.deficit, r.part.unit || 'шт'])} />
        )}
      >
        {stats.low.length === 0 ? <EmptyState text="Все позиции выше минимального остатка" compact /> : (
          <div className={SCROLL_BOX}>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <th className="px-4 sm:px-6 py-3">Наименование</th>
                  <th className="px-4 py-3">Артикул</th>
                  <th className="px-4 py-3 text-right">Доступно</th>
                  <th className="px-4 py-3 text-right">В брони</th>
                  <th className="px-4 py-3 text-right">Минимум</th>
                  <th className="px-4 py-3 text-right">Дефицит</th>
                  <th className="px-4 sm:px-6 py-3">Ед.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.low.map(r => (
                  <tr key={r.part.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className={`${TD_FIRST} font-bold text-slate-800 min-w-44`}>{r.part.name}</td>
                    <td className={`${TD} font-mono text-xs text-slate-500`}>{r.part.sku || '—'}</td>
                    <td className={`${TD} text-right font-mono font-black ${r.available <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>{formatNumber(r.available)}</td>
                    <td className={`${TD} text-right font-mono text-slate-500`}>{formatNumber(r.reserved)}</td>
                    <td className={`${TD} text-right font-mono text-slate-700`}>{formatNumber(r.min)}</td>
                    <td className={`${TD} text-right font-mono font-bold ${r.deficit > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{formatNumber(r.deficit)}</td>
                    <td className="px-4 sm:px-6 py-3 text-slate-500">{r.part.unit || 'шт'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Забронированные запчасти"
        icon={Lock}
        iconClass="text-indigo-500"
        bodyClass=""
        actions={canExport && reservations.data && (
          <CsvButton filename="bron_zapchastey" disabled={!reservations.data.length}
            headers={['Запчасть', 'Артикул', 'Количество', 'Ед.', 'Стоимость, $', 'Источник', 'Задача / работа', 'Станок', 'Срок / дата', 'Забронировано']}
            rows={() => reservations.data!.map(r => [r.partName, r.sku, r.quantity, r.unit || 'шт', r.value,
              r.sourceType === 'toir_schedule' ? 'График ТО' : 'Журнал работ', r.isForeign ? 'Другой филиал' : r.sourceName, r.machineName,
              r.sourceDate ? formatDateKey(toLocalDateKey(r.sourceDate)) : '', formatDateKey(toLocalDateKey(r.createdAt))])} />
        )}
      >
        <AsyncContent state={reservations} isEmpty={rows => rows.length === 0} emptyText="Нет забронированных запчастей">
          {rows => (
            <div className={SCROLL_BOX}>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Запчасть</th>
                    <th className="px-4 py-3 text-right">Кол-во</th>
                    <th className="px-4 py-3 text-right">Стоимость</th>
                    <th className="px-4 py-3">Для чего</th>
                    <th className="px-4 sm:px-6 py-3">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className={`${TD_FIRST} min-w-44`}>
                        <p className="font-bold text-slate-800">{r.partName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{r.sku}{r.isArchived ? ' · в архиве' : ''}</p>
                      </td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatNumber(r.quantity)} {r.unit || 'шт'}</td>
                      <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatMoney(r.value)}</td>
                      <td className={`${TD} min-w-48`}>
                        <StatusBadge label={r.sourceType === 'toir_schedule' ? 'График ТО' : 'Журнал работ'} className={r.sourceType === 'toir_schedule' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'} />
                        <p className="text-xs text-slate-700 mt-1">{r.isForeign ? 'Станок другого филиала' : [r.machineName, r.sourceName].filter(Boolean).join(': ') || '—'}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {r.sourceDate && <p>Срок: {formatDateKey(toLocalDateKey(r.sourceDate))}</p>}
                        <p className="text-[10px]">Бронь: {formatDateKey(toLocalDateKey(r.createdAt))}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncContent>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel
          title="Расход запчастей: ТОП-10"
          icon={Boxes}
          actions={
            <>
              <div className="print:hidden inline-flex rounded-lg border border-slate-200 overflow-hidden text-[10px] font-bold">
                {(['qty', 'value'] as const).map(k => (
                  <button key={k} type="button" onClick={() => setTopBy(k)}
                    className={`px-3 py-1.5 cursor-pointer ${topBy === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {k === 'qty' ? 'По количеству' : 'По сумме'}
                  </button>
                ))}
              </div>
              {canExport && (
                <CsvButton filename="rashod_zapchastey" disabled={!stats.usage.length}
                  headers={['Наименование', 'Артикул', 'Расход', 'Ед.', 'Цена, $', 'Сумма, $']}
                  rows={() => stats.usage.map(u => [u.name, u.sku, u.qty, u.unit, u.unitPrice, u.totalCost])} />
              )}
            </>
          }
        >
          {top.length === 0 ? <EmptyState compact /> : (
            <div className="space-y-2.5">
              {top.map(u => (
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
                  <ProgressBar percent={((topBy === 'qty' ? u.qty : u.totalCost) / topMax) * 100} className="h-1" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Расход по станкам"
          icon={Cog}
          bodyClass=""
          actions={canExport && (
            <CsvButton filename="rashod_po_stankam" disabled={!stats.byMachine.length}
              headers={['Станок', 'Работ с запчастями', 'Количество', 'Сумма, $']}
              rows={() => stats.byMachine.map(r => [r.name, r.works, r.qty, r.cost])} />
          )}
        >
          {stats.byMachine.length === 0 ? <EmptyState compact /> : (
            <div className={SCROLL_BOX}>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Станок</th>
                    <th className="px-4 py-3 text-right">Работ</th>
                    <th className="px-4 py-3 text-right">Кол-во</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.byMachine.map(r => (
                    <tr key={r.machineId}>
                      <td className={`${TD_FIRST} font-bold text-slate-800 min-w-40`}>{r.name}</td>
                      <td className={`${TD} text-right font-mono`}>{r.works}</td>
                      <td className={`${TD} text-right font-mono`}>{formatNumber(r.qty)}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap">{formatMoney(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Panel
          title="Неликвид: без расхода за период"
          icon={Archive}
          iconClass="text-slate-500"
          bodyClass=""
          actions={canExport && (
            <CsvButton filename="nelikvid" disabled={!stats.dead.length}
              headers={['Наименование', 'Артикул', 'Количество', 'Ед.', 'Стоимость, $']}
              rows={() => stats.dead.map(p => [p.name, p.sku, p.quantity, p.unit || 'шт', partValue(p)])} />
          )}
          footer="Учитываются выполненные работы с текущими фильтрами (станок, тип работ, период)."
        >
          {stats.dead.length === 0 ? <EmptyState text="Все позиции в наличии использовались за период" compact /> : (
            <div className={SCROLL_BOX}>
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
                      <td className={`${TD_FIRST} min-w-44`}>
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
        </Panel>

        <Panel
          title="По единицам измерения"
          icon={Ruler}
          bodyClass=""
          actions={canExport && (
            <CsvButton filename="sklad_po_edinicam" disabled={!stats.units.length}
              headers={['Код', 'Единица', 'Позиций', 'Количество', 'Стоимость, $']}
              rows={() => stats.units.map(u => [u.code, u.name, u.items, u.qty, u.value])} />
          )}
        >
          {stats.units.length === 0 ? <EmptyState text="На складе нет запчастей" compact /> : (
            <div className="report-scroll overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Единица</th>
                    <th className="px-4 py-3 text-right">Позиций</th>
                    <th className="px-4 py-3 text-right">Количество</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.units.map(u => (
                    <tr key={u.code}>
                      <td className={TD_FIRST}><span className="font-bold text-slate-800">{u.name}</span> <span className="text-[10px] font-mono text-slate-400">{u.code}</span></td>
                      <td className={`${TD} text-right font-mono`}>{u.items}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatNumber(u.qty)} {u.code}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap">{formatMoney(u.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
