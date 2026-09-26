import React, { useMemo, useState } from 'react';
import { ClipboardCheck, ClipboardList, ExternalLink, FolderOpen } from 'lucide-react';
import { machineService } from '../../../services/machineService';
import { CompletenessField, IncompleteRecord, ReportData, dataQuality, formatBytes, formatNumber, formatPercent, searchMatches } from '../reportUtils';
import { AsyncContent, BarList, XlsxButton, EmptyState, KpiCard, Pagination, Panel, ProgressBar, SearchInput, TD, TD_FIRST, THEAD_ROW, usePaged } from '../ReportUi';
import { useAsyncData } from '../useAsyncData';

const KIND_LABELS: Record<IncompleteRecord['kind'], string> = { machine: 'Станок', part: 'Запчасть', schedule: 'Задача ТО' };
const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  image: 'Изображения', video: 'Видео', pdf: 'PDF', document: 'Документы', archive: 'Архивы', other: 'Прочее',
};

const XL_COLS = ['xl:grid-cols-1', 'xl:grid-cols-1', 'xl:grid-cols-2', 'xl:grid-cols-3', 'xl:grid-cols-4'];

const tone = (percent: number) => (percent >= 90 ? 'bg-emerald-500' : percent >= 60 ? 'bg-amber-500' : 'bg-rose-500');

function FieldList({ fields }: { fields: CompletenessField[] }) {
  if (!fields.length || !fields[0].total) return <EmptyState text="Нет записей по выбранным фильтрам" compact />;
  return (
    <ul className="space-y-3">
      {fields.map(f => (
        <li key={f.id}>
          <div className="flex justify-between items-baseline gap-2 text-xs mb-1">
            <span className="font-semibold text-slate-700">{f.label}</span>
            <span className="font-mono shrink-0">
              <strong className="text-slate-900">{formatPercent(f.percent)}</strong>
              <span className="text-[10px] text-slate-400 ml-1.5">{f.filled} / {f.total}</span>
            </span>
          </div>
          <ProgressBar percent={f.percent} colorClass={tone(f.percent)} />
        </li>
      ))}
    </ul>
  );
}

export function DataQualityTab({ data, canExport, canEquipment, canInventory, canToir, onOpenMachine }: {
  data: ReportData;
  canExport: boolean;
  canEquipment: boolean;
  canInventory: boolean;
  canToir: boolean;
  onOpenMachine?: (machineId: string) => void;
}) {
  const [kind, setKind] = useState<'all' | IncompleteRecord['kind']>('all');
  const [search, setSearch] = useState('');
  const branchParam = data.filters.branchId === 'all' ? undefined : data.filters.branchId;
  const files = useAsyncData(canEquipment ? `attachments:${branchParam ?? 'all'}` : null, () => machineService.getAnalyticsAttachmentsSummary({ branchId: branchParam }));

  const quality = useMemo(() => dataQuality(data), [data]);
  const allowedKinds = useMemo(
    () => (['machine', 'part', 'schedule'] as const).filter(k => (k === 'machine' ? canEquipment : k === 'part' ? canInventory : canToir)),
    [canEquipment, canInventory, canToir],
  );
  const records: IncompleteRecord[] = useMemo(
    () => quality.records.filter(r => allowedKinds.includes(r.kind) && (kind === 'all' || r.kind === kind) && searchMatches(search, r.name, r.branchName, ...r.missing)),
    [quality.records, allowedKinds, kind, search],
  );
  const paged = usePaged(records, 30);
  const visibleFields = [...(canEquipment ? quality.machines : []), ...(canInventory ? quality.parts : []), ...(canToir ? quality.schedules : [])];
  const filled = visibleFields.reduce((a, f) => a + f.filled, 0);
  const total = visibleFields.reduce((a, f) => a + f.total, 0);
  const overall = total ? (filled / total) * 100 : 100;
  // Files of the machines matching the report filters, not only the branch the endpoint knows about.
  const machineIds = useMemo(() => new Set(data.machines.map(m => m.id)), [data.machines]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${XL_COLS[1 + allowedKinds.length]} gap-3 sm:gap-4`}>
        <KpiCard label="Заполненность данных" value={formatPercent(overall)} tone="dark" hint={`${formatNumber(filled)} из ${formatNumber(total)} обязательных полей`}>
          <ProgressBar percent={overall} className="h-1.5 mt-2 bg-slate-700" colorClass={tone(overall)} />
        </KpiCard>
        {allowedKinds.map(k => {
          const count = quality.records.filter(r => r.kind === k).length;
          return (
            <React.Fragment key={k}>
              <KpiCard label={`${KIND_LABELS[k]}: с пробелами`} value={count} tone={count ? 'warning' : 'default'}
                onClick={() => { setKind(k); paged.setPage(0); }} hint="Нажмите, чтобы показать список" />
            </React.Fragment>
          );
        })}
      </div>

      <div className={`grid grid-cols-1 ${XL_COLS[allowedKinds.length]} gap-4 sm:gap-6`}>
        {canEquipment && <Panel title="Станки (без списанных)" icon={ClipboardCheck}><FieldList fields={quality.machines} /></Panel>}
        {canInventory && <Panel title="Запчасти (без архива)" icon={ClipboardCheck}><FieldList fields={quality.parts} /></Panel>}
        {canToir && <Panel title="Задачи графика ТО" icon={ClipboardCheck}><FieldList fields={quality.schedules} /></Panel>}
      </div>

      {canEquipment && (
        <Panel title="Документы и файлы" icon={FolderOpen}>
          <AsyncContent state={files}>
            {summary => {
              const rows = summary.machines.filter(m => machineIds.has(m.machineId));
              const count = rows.reduce((a, r) => a + r.files, 0);
              const size = rows.reduce((a, r) => a + r.size, 0);
              const without = rows.filter(r => r.files === 0 && r.status !== 'retired');
              const byType = new Map<string, { count: number; size: number }>();
              rows.forEach(r => Object.entries(r.byType).forEach(([type, t]) => {
                const acc = byType.get(type) ?? { count: 0, size: 0 };
                acc.count += t?.count || 0;
                acc.size += t?.size || 0;
                byType.set(type, acc);
              }));
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-3">
                    <KpiCard label="Файлов" value={formatNumber(count)} hint={`Общий объём ${formatBytes(size)}`} />
                    <KpiCard label="Станков без файлов" value={without.length} tone={without.length ? 'warning' : 'default'} hint="Кроме списанных" />
                  </div>
                  <div className="lg:col-span-2">
                    <BarList
                      emptyText="Файлы не загружены"
                      items={[...byType.entries()].sort((a, b) => b[1].count - a[1].count).map(([type, t]) => ({ key: type, label: ATTACHMENT_TYPE_LABELS[type] || type, value: t.count, hint: formatBytes(t.size) }))}
                    />
                  </div>
                </div>
              );
            }}
          </AsyncContent>
        </Panel>
      )}

      <Panel
        title="Незаполненные записи"
        icon={ClipboardList}
        iconClass="text-amber-500"
        bodyClass=""
        actions={
          <>
            <div className="print:hidden inline-flex rounded-lg border border-slate-200 overflow-hidden text-[10px] font-bold">
              {(['all', ...allowedKinds] as const).map(k => (
                <button key={k} type="button" onClick={() => { setKind(k); paged.setPage(0); }}
                  className={`px-3 py-1.5 cursor-pointer ${kind === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {k === 'all' ? 'Все' : KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <SearchInput value={search} onChange={v => { setSearch(v); paged.setPage(0); }} placeholder="Название, филиал, поле…" />
            {canExport && (
              <XlsxButton filename="nezapolnennye_zapisi" disabled={!records.length}
                headers={['Тип', 'Название', 'Филиал', 'Не заполнено']}
                rows={() => records.map(r => [KIND_LABELS[r.kind], r.name, r.branchName, r.missing.join(', ')])} />
            )}
          </>
        }
      >
        {records.length === 0 ? <EmptyState text={search ? 'Ничего не найдено' : 'Все обязательные поля заполнены'} /> : (
          <>
            <div className="report-scroll overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className="px-4 sm:px-6 py-3">Запись</th>
                    <th className="px-4 py-3">Филиал</th>
                    <th className="px-4 sm:px-6 py-3">Не заполнено</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.pageRows.map(r => (
                    <tr key={`${r.kind}:${r.id}`}>
                      <td className={`${TD_FIRST} min-w-48`}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{KIND_LABELS[r.kind]}</p>
                        {r.kind === 'machine' && onOpenMachine ? (
                          <button type="button" onClick={() => onOpenMachine(r.id)} className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline text-left cursor-pointer">
                            {r.name}<ExternalLink className="w-3 h-3 print:hidden" />
                          </button>
                        ) : <p className="font-bold text-slate-800">{r.name}</p>}
                      </td>
                      <td className={`${TD} text-slate-600 min-w-32`}>{r.branchName}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.missing.map(f => <span key={f} className="text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{f}</span>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={paged.page} pageCount={paged.pageCount} total={records.length} pageSize={paged.pageSize} onPage={paged.setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
