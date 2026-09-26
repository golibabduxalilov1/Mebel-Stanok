import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Boxes, Cog, ExternalLink, Factory, FileText, History as HistoryIcon, Hourglass, TrendingDown, X } from 'lucide-react';
import { machineService } from '../../../services/machineService';
import type { Machine, MachineStatus } from '../../../types';
import {
  MachineRankingRow, ReportData, ageGroups, assetSummary, formatAmps, formatBytes, formatDateKey, formatDateTime, formatMoney, formatNumber,
  formatPercent, isCompleted, isRetired, lastMaintenanceByMachine, LOG_TYPE_BADGE, LOG_TYPE_LABELS, MACHINE_STATUS_LABELS, MACHINE_STATUSES,
  machineAgeYears, machineRanking, manufacturerDistribution, monthlyCost, partsUsage, ratioLevel, searchMatches, sortLogsByDateDesc, statusDistribution,
  sumCompletedCost, toLocalDateKey,
} from '../reportUtils';
import {
  AsyncContent, BarList, CsvButton, EmptyState, KpiCard, Panel, SCROLL_BOX, SearchInput, SortTh, StatusBadge, TD, TD_FIRST, THEAD_ROW, useSorted,
} from '../ReportUi';
import { useAsyncData } from '../useAsyncData';
import { SERIES_COLORS, STATUS_COLORS } from '../charts/ChartFrame';
import { DonutChart } from '../charts/DonutChart';
import { DepreciationChart } from '../charts/DepreciationChart';
import { StackedBarChart } from '../charts/StackedBarChart';

const STATUS_BADGE: Record<MachineStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  maintenance: 'bg-amber-50 text-amber-700',
  repair: 'bg-rose-50 text-rose-700',
  retired: 'bg-slate-100 text-slate-600',
};

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  image: 'Изображения', video: 'Видео', pdf: 'PDF', document: 'Документы', archive: 'Архивы', other: 'Прочее',
};

const formatRatio = (ratio: number | null) => (ratio === null ? '—' : ratio === Infinity ? '> 100%' : formatPercent(ratio, 1));

const RANKING_SORT = {
  name: (r: MachineRankingRow) => r.name,
  branch: (r: MachineRankingRow) => r.branchName,
  status: (r: MachineRankingRow) => MACHINE_STATUSES.indexOf(r.status),
  age: (r: MachineRankingRow) => r.ageYears,
  residual: (r: MachineRankingRow) => r.residual,
  cost: (r: MachineRankingRow) => r.cost,
  ratio: (r: MachineRankingRow) => (r.ratio === Infinity ? Number.MAX_VALUE : r.ratio),
  emergencies: (r: MachineRankingRow) => r.emergencies,
  mtbf: (r: MachineRankingRow) => r.mtbfDays,
  last: (r: MachineRankingRow) => r.lastMaintenance || null,
};

export function EquipmentTab({ data, canExport, onSelectMachine, onOpenMachine }: {
  data: ReportData;
  canExport: boolean;
  onSelectMachine: (machineId: string) => void;
  onOpenMachine?: (machineId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const selectedMachine = data.filters.machineId !== 'all' ? data.machineMap.get(data.filters.machineId) : undefined;
  const currentYear = String(data.now.getFullYear());

  const stats = useMemo(() => {
    const inService = data.machines.filter(m => !isRetired(m));
    return {
      distribution: statusDistribution(data.machines),
      manufacturers: manufacturerDistribution(data.machines),
      ages: ageGroups(data.machines, data.now),
      assets: assetSummary(data.machines, data.now),
      depreciation: selectedMachine
        ? machineService.getDepreciationData(selectedMachine, data.now)
        : machineService.getTotalDepreciationData(inService, data.now),
      ranking: machineRanking(data.machines, data.logs, data.branchMap, lastMaintenanceByMachine(data.machines, data.allLogs), data.now),
    };
  }, [data, selectedMachine]);

  const filtered = useMemo(
    () => stats.ranking.filter(r => searchMatches(search, r.name, r.model, r.manufacturer, r.branchName, MACHINE_STATUS_LABELS[r.status])),
    [stats.ranking, search],
  );
  const { sorted, sort, toggle } = useSorted(filtered, RANKING_SORT, { key: 'cost', dir: 'desc' });
  const th = (label: string, key: string, align: 'left' | 'right' = 'right') => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} align={align} />;

  return (
    <div className="space-y-4 sm:space-y-6">
      {selectedMachine && <MachineCard machine={selectedMachine} data={data} canExport={canExport} onClose={() => onSelectMachine('all')} onOpenMachine={onOpenMachine} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Panel title="Состояние оборудования" icon={Cog}>
          {data.machines.length === 0 ? <EmptyState text="Нет оборудования по выбранным фильтрам" compact /> : (
            <DonutChart
              centerLabel="станков"
              data={stats.distribution.map(d => ({ key: d.status, label: d.label, value: d.count, color: STATUS_COLORS[d.status] }))}
            />
          )}
        </Panel>
        <Panel title="Производители" icon={Factory}>
          <BarList
            emptyText="Нет оборудования по выбранным фильтрам"
            items={stats.manufacturers.slice(0, 8).map(m => ({ key: m.key, label: m.label, value: m.count, hint: formatPercent(m.percent) }))}
          />
          {stats.manufacturers.length > 8 && <p className="text-[10px] text-slate-400 mt-3">И ещё {stats.manufacturers.length - 8} — полный список в фильтре «Производитель».</p>}
        </Panel>
        <Panel title="Возраст оборудования" icon={Hourglass}>
          <BarList
            colorClass="bg-indigo-500"
            emptyText="Нет оборудования по выбранным фильтрам"
            items={data.machines.length ? stats.ages.map(a => ({ key: a.id, label: a.label, value: a.count, hint: formatPercent(a.percent) })) : []}
          />
          <p className="text-[10px] text-slate-400 mt-3">По дате покупки, полных лет.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3 sm:gap-4 content-start">
          <KpiCard label="Амортизация покупки" value={formatMoney(stats.assets.purchaseTotal)} hint={`Учтено станков: ${stats.assets.counted} (без списанных)`} />
          <KpiCard label="Остаточная амортизация" value={formatMoney(stats.assets.total)} tone="dark"
            hint={stats.assets.missing > 0 ? <span className="text-amber-400 font-bold">Без данных: {stats.assets.missing}</span> : 'Линейная амортизация, полные месяцы'} />
          <KpiCard label="Накопленная амортизация" value={formatMoney(stats.assets.depreciation)}
            hint={stats.assets.purchaseTotal ? `${formatPercent((stats.assets.depreciation / stats.assets.purchaseTotal) * 100)} от амортизации покупки` : undefined} />
        </div>
        <div className="xl:col-span-2 min-w-0">
          <Panel title={selectedMachine ? `Амортизация: ${selectedMachine.name}` : 'Сводный прогноз амортизации'} icon={TrendingDown} iconClass="text-indigo-600">
            {stats.depreciation.length === 0
              ? <EmptyState text="Нет данных для расчёта амортизации: укажите цену и дату покупки" compact />
              : <DepreciationChart data={stats.depreciation} currentYear={currentYear} />}
          </Panel>
        </div>
      </div>

      <Panel
        title="Рейтинг станков"
        icon={AlertTriangle}
        iconClass="text-amber-500"
        bodyClass=""
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Станок, модель, филиал…" />
            {canExport && (
              <CsvButton
                filename="reiting_stankov"
                disabled={!sorted.length}
                headers={['Станок', 'Модель', 'Производитель', 'Филиал', 'Статус', 'Возраст, лет', 'Остаточная амортизация, $', 'Ремонт на ТО за период, $',
                  'Ремонт / амортизация, %', 'MTBF, дней', 'Последнее ТО']}
                rows={() => sorted.map(r => [r.name, r.model, r.manufacturer, r.branchName, MACHINE_STATUS_LABELS[r.status], r.ageYears, r.residual, r.cost,
                  r.ratio === Infinity ? '>100' : r.ratio, r.mtbfDays, r.lastMaintenance ? formatDateKey(r.lastMaintenance) : ''])}
              />
            )}
          </>
        }
        footer="Выше 50% — повышенный ремонт, выше 80% — рекомендуется рассмотреть замену. Нажмите на станок, чтобы открыть его карточку."
      >
        {sorted.length === 0 ? (
          <EmptyState text={search ? 'Ничего не найдено' : 'Нет оборудования по выбранным фильтрам'} />
        ) : (
          <div className={`${SCROLL_BOX} max-h-[600px]`}>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className={THEAD_ROW}>
                  <SortTh label="Станок" sortKey="name" sort={sort} onSort={toggle} className="sm:pl-6" />
                  {th('Филиал', 'branch', 'left')}
                  {th('Статус', 'status', 'left')}
                  {th('Возраст', 'age')}
                  {th('Ост. амортизация', 'residual')}
                  {th('Ремонт', 'cost')}
                  {th('Ремонт / стоим.', 'ratio')}
                  {th('MTBF', 'mtbf')}
                  {th('Посл. ТО', 'last')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map(r => {
                  const level = ratioLevel(r.ratio);
                  return (
                    <tr key={r.id} className={`cursor-pointer transition-colors ${level === 'critical' ? 'bg-rose-50/60 hover:bg-rose-50' : level === 'warn' ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-blue-50/30'}`}
                      onClick={() => onSelectMachine(r.id)}>
                      <td className={`${TD_FIRST} min-w-44`}>
                        <p className="font-bold text-slate-800 leading-tight">{r.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{[r.manufacturer, r.model].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className={`${TD} text-slate-600 min-w-32`}>{r.branchName}</td>
                      <td className={TD}><StatusBadge label={MACHINE_STATUS_LABELS[r.status]} className={STATUS_BADGE[r.status]} /></td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.ageYears === null ? 'text-slate-300' : ''}`}>{r.ageYears === null ? '—' : `${formatNumber(r.ageYears, 1)} г.`}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.residual === null ? 'text-slate-400' : ''}`}>{r.residual === null ? 'нет данных' : formatMoney(r.residual)}</td>
                      <td className={`${TD} text-right font-mono font-bold whitespace-nowrap`}>{formatMoney(r.cost)}</td>
                      <td className={`${TD} text-right whitespace-nowrap`}>
                        <span className={`font-mono font-black ${level === 'critical' ? 'text-rose-700' : level === 'warn' ? 'text-amber-700' : 'text-slate-600'}`}>{formatRatio(r.ratio)}</span>
                        {level === 'critical' && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase">
                            <AlertTriangle className="w-3 h-3" />рассмотреть замену
                          </span>
                        )}
                      </td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap ${r.mtbfDays === null ? 'text-slate-300' : ''}`}>{r.mtbfDays === null ? '—' : `${formatNumber(r.mtbfDays, 1)} дн.`}</td>
                      <td className={`${TD} text-right font-mono text-xs whitespace-nowrap text-slate-500`}>{r.lastMaintenance ? formatDateKey(r.lastMaintenance) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function MachineCard({ machine, data, canExport, onClose, onOpenMachine }: {
  machine: Machine;
  data: ReportData;
  canExport: boolean;
  onClose: () => void;
  onOpenMachine?: (machineId: string) => void;
}) {
  const transfers = useAsyncData(`transfers:${machine.id}`, () => machineService.getAnalyticsTransfers({ machineId: machine.id }));
  const card = useMemo(() => {
    const logs = sortLogsByDateDesc(data.logs.filter(l => l.machineId === machine.id));
    const files = new Map<string, { count: number; size: number }>();
    (machine.attachments || []).forEach(a => {
      const row = files.get(a.type) ?? { count: 0, size: 0 };
      row.count++;
      row.size += a.size || 0;
      files.set(a.type, row);
    });
    return {
      logs,
      cost: sumCompletedCost(logs),
      monthly: monthlyCost(logs, data.filters),
      parts: partsUsage(logs, data.partLookup),
      files: [...files.entries()].map(([type, f]) => ({ type, ...f })),
      residual: machine.purchasePrice > 0 ? machineService.calculateCurrentValue(machine, data.now) : null,
      age: machineAgeYears(machine, data.now),
    };
  }, [machine, data]);
  const hasMonthly = card.monthly.some(p => p.planned || p.emergency);

  return (
    <section className="rounded-2xl border-2 border-blue-200 bg-blue-50/30 p-3 sm:p-4 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Карточка станка</p>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 break-words">{machine.name}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {[machine.manufacturer, machine.model, machine.serialNumber && `S/N ${machine.serialNumber}`].filter(Boolean).join(' · ')}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusBadge label={MACHINE_STATUS_LABELS[machine.status]} className={STATUS_BADGE[machine.status]} />
            <span className="text-[11px] text-slate-600">{data.branchMap.get(machine.branchId)?.name || 'Без филиала'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {onOpenMachine && (
            <button type="button" onClick={() => onOpenMachine(machine.id)} className="inline-flex items-center gap-1.5 min-h-9 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer">
              <ExternalLink className="w-4 h-4" />Открыть карточку
            </button>
          )}
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 min-h-9 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
            <X className="w-4 h-4" />Все станки
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Возраст" value={card.age === null ? '—' : `${formatNumber(card.age, 1)} г.`} hint={machine.purchaseDate ? `Куплен ${formatDateKey(toLocalDateKey(machine.purchaseDate))}` : 'Дата покупки не указана'} />
        <KpiCard label="Остаточная амортизация" value={card.residual === null ? '—' : formatMoney(card.residual)} hint={machine.purchasePrice ? `Покупка ${formatMoney(machine.purchasePrice)}` : 'Цена не указана'} />
        <KpiCard label="Ток" value={Number(machine.amperage) > 0 ? formatAmps(Number(machine.amperage)) : '—'} tone={Number(machine.amperage) > 0 ? 'default' : 'warning'}
          hint={Number(machine.amperage) > 0 ? undefined : 'Ампераж не указан'} />
        <KpiCard label="Ремонт за период" value={formatMoney(card.cost)} hint={`${card.logs.filter(isCompleted).length} выполненных работ`} />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <Panel title="Динамика ремонта" icon={TrendingDown}>
          {hasMonthly ? (
            <StackedBarChart data={card.monthly} categoryKey="label" height={220} valueFormatter={formatMoney}
              series={[{ key: 'planned', label: 'Плановые', color: SERIES_COLORS.planned }, { key: 'emergency', label: 'Аварийные', color: SERIES_COLORS.emergency }]} />
          ) : <EmptyState compact />}
        </Panel>
        <Panel title="Израсходованные запчасти" icon={Boxes} bodyClass="">
          {card.parts.length === 0 ? <EmptyState compact /> : (
            <div className={SCROLL_BOX}>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white"><tr className={THEAD_ROW}><th className="px-4 sm:px-6 py-3">Запчасть</th><th className="px-4 py-3 text-right">Кол-во</th><th className="px-4 sm:px-6 py-3 text-right">Сумма</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {card.parts.map(p => (
                    <tr key={p.key}>
                      <td className={`${TD_FIRST} font-bold text-slate-800`}>{p.name}</td>
                      <td className={`${TD} text-right font-mono whitespace-nowrap`}>{formatNumber(p.qty)} {p.unit}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap">{p.totalCost > 0 ? formatMoney(p.totalCost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="История работ"
        icon={HistoryIcon}
        bodyClass=""
        actions={canExport && (
          <CsvButton filename={`istoriya_rabot_${machine.name}`} disabled={!card.logs.length}
            headers={['Дата', 'Вид работ', 'Статус', 'Исполнитель', 'Описание', 'Амортизация, $']}
            rows={() => card.logs.map(l => [formatDateKey(toLocalDateKey(l.date)), LOG_TYPE_LABELS[l.type], isCompleted(l) ? 'Выполнено' : 'Запланировано', l.technicianName, l.notes, l.cost || 0])} />
        )}
      >
        {card.logs.length === 0 ? <EmptyState compact /> : (
          <div className={SCROLL_BOX}>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white"><tr className={THEAD_ROW}><th className="px-4 sm:px-6 py-3">Дата</th><th className="px-4 py-3">Вид работ</th><th className="px-4 py-3">Исполнитель</th><th className="px-4 sm:px-6 py-3 text-right">Амортизация</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {card.logs.map(l => (
                  <tr key={l.id}>
                    <td className={`${TD_FIRST} font-mono text-xs text-slate-500 whitespace-nowrap`}>{formatDateKey(toLocalDateKey(l.date))}</td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge label={LOG_TYPE_LABELS[l.type] || l.type} className={LOG_TYPE_BADGE[l.type] || 'bg-slate-100 text-slate-600'} />
                        {!isCompleted(l) && <StatusBadge label="Запланировано" className="bg-amber-50 text-amber-700" />}
                      </div>
                      {l.notes && <p className="text-xs text-slate-500 italic truncate max-w-72 mt-0.5" title={l.notes}>{l.notes}</p>}
                    </td>
                    <td className={`${TD} text-slate-600 text-xs`}>{l.technicianName || '—'}</td>
                    <td className={`px-4 sm:px-6 py-3 text-right font-mono font-bold whitespace-nowrap ${isCompleted(l) ? '' : 'text-slate-400'}`}>{formatMoney(l.cost || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <Panel title="История перемещений" icon={ArrowRightLeft} bodyClass="">
          <AsyncContent state={transfers} isEmpty={rows => rows.length === 0} emptyText="Станок не перемещался">
            {rows => (
              <ul className="divide-y divide-slate-50">
                {rows.map(t => (
                  <li key={t.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-800">{t.fromBranchName || '—'} → {t.toBranchName}</span>
                    <span className="text-slate-500">{formatDateTime(t.date)}{t.createdByName ? ` · ${t.createdByName}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </AsyncContent>
        </Panel>
        <Panel title={`Файлы: ${(machine.attachments || []).length}`} icon={FileText}>
          <BarList
            emptyText="К станку не прикреплено ни одного файла"
            items={card.files.map(f => ({ key: f.type, label: ATTACHMENT_TYPE_LABELS[f.type] || f.type, value: f.count, hint: formatBytes(f.size) }))}
          />
        </Panel>
      </div>
    </section>
  );
}
