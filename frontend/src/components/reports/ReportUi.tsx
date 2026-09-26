import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet, RefreshCw, Search, ServerCrash } from 'lucide-react';
import { CsvCell, formatNumber, formatPercent, todayKey, toCsv } from './reportUtils';

function toExcel(headers: string[], rows: CsvCell[][]): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (v: CsvCell, tag: 'th' | 'td') =>
    `<${tag} style="mso-number-format:'\\@'">${esc(String(v ?? ''))}</${tag}>`;
  const headerRow = `<tr>${headers.map(h => cell(h, 'th')).join('')}</tr>`;
  const dataRows = rows.map(r => `<tr>${r.map(v => cell(v, 'td')).join('')}</tr>`).join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>th{background:#e2e8f0;font-weight:bold}td,th{border:1px solid #cbd5e1;padding:4px 8px;white-space:nowrap}</style></head><body><table>${headerRow}${dataRows}</table></body></html>`;
}

export function downloadExcel(filename: string, headers: string[], rows: CsvCell[][]) {
  const blob = new Blob(['﻿' + toExcel(headers, rows)], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${todayKey()}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function Panel({ title, icon: Icon, iconClass = 'text-blue-500', actions, children, bodyClass = 'p-4 sm:p-6', footer }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
  footer?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0 print:shadow-none print:break-inside-avoid">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 min-w-0 break-words">
          {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />}
          {title}
        </h3>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      <div className={bodyClass}>{children}</div>
      {footer && <div className="px-4 sm:px-6 py-3 text-[10px] text-slate-400 border-t border-slate-100">{footer}</div>}
    </section>
  );
}

export function KpiCard({ label, value, hint, tone = 'default', onClick, children }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'dark' | 'warning' | 'danger';
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const box = {
    default: 'bg-white border-slate-200 shadow-sm',
    dark: 'bg-slate-900 text-white border-slate-800 shadow-xl',
    warning: 'bg-amber-50 border-amber-200 shadow-sm',
    danger: 'bg-rose-50 border-rose-200 shadow-sm',
  }[tone];
  const labelClass = tone === 'dark' ? 'text-blue-400' : tone === 'warning' ? 'text-amber-700' : tone === 'danger' ? 'text-rose-700' : 'text-slate-400';
  const valueClass = tone === 'dark' ? 'text-white' : tone === 'warning' ? 'text-amber-800' : tone === 'danger' ? 'text-rose-700' : 'text-slate-900';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl border min-w-0 text-left print:shadow-none ${box} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all' : ''}`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>{label}</p>
      <p className={`text-xl sm:text-2xl font-mono font-black wrap-anywhere ${valueClass}`}>{value}</p>
      {hint && <div className={`text-[10px] mt-2 ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{hint}</div>}
      {children}
    </Tag>
  );
}

export const KPI_GRID = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4';

export function EmptyState({ text = 'Нет данных за выбранный период', compact = false }: { text?: string; compact?: boolean }) {
  return (
    <div className={`${compact ? 'py-8' : 'py-14'} flex flex-col items-center justify-center text-center text-slate-400 gap-2`}>
      <AlertCircle className="w-7 h-7 opacity-30" />
      <p className="text-xs italic">{text}</p>
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 rounded-lg bg-slate-100" style={{ width: `${100 - (i % 3) * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
      <ServerCrash className="w-7 h-7 text-rose-300" />
      <p className="text-xs font-bold text-rose-600">{error}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="print:hidden mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
          Повторить
        </button>
      )}
    </div>
  );
}

/** Loading / error / empty / content switch for blocks backed by a backend request. */
export function AsyncContent<T>({ state, isEmpty, emptyText, children }: {
  state: { data: T | null; loading: boolean; error: string | null; reload: () => void };
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  children: (data: T) => React.ReactNode;
}) {
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading || state.data === null) return <div className="p-4 sm:p-6"><Skeleton /></div>;
  if (isEmpty?.(state.data)) return <EmptyState text={emptyText} compact />;
  return <>{children(state.data)}</>;
}

export function ProgressBar({ percent, colorClass = 'bg-blue-500', className = 'h-1.5' }: { percent: number; colorClass?: string; className?: string }) {
  const width = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Label + value + share bar rows; a readable alternative to a chart for short distributions. */
export function BarList({ items, colorClass = 'bg-blue-500', valueFormatter = v => formatNumber(v), emptyText }: {
  items: { key: string; label: string; value: number; hint?: string }[];
  colorClass?: string;
  valueFormatter?: (value: number) => string;
  emptyText?: string;
}) {
  if (!items.length) return <EmptyState text={emptyText} compact />;
  const max = Math.max(...items.map(i => i.value), 1);
  const total = items.reduce((a, i) => a + i.value, 0);
  return (
    <ul className="space-y-2.5">
      {items.map(item => (
        <li key={item.key}>
          <div className="flex justify-between items-baseline gap-2 text-xs mb-1">
            <span className="text-slate-700 font-semibold truncate" title={item.label}>{item.label}</span>
            <span className="shrink-0 font-mono">
              <strong className="text-slate-900">{valueFormatter(item.value)}</strong>
              <span className="text-[10px] text-slate-400 ml-1.5">{item.hint ?? formatPercent(total ? (item.value / total) * 100 : 0)}</span>
            </span>
          </div>
          <ProgressBar percent={(item.value / max) * 100} colorClass={colorClass} />
        </li>
      ))}
    </ul>
  );
}

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${todayKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function CsvButton({ filename, headers, rows, disabled }: { filename: string; headers: string[]; rows: () => CsvCell[][]; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => downloadExcel(filename, headers, rows())}
      className="print:hidden flex items-center gap-1.5 min-h-8 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      title="Скачать таблицу в Excel"
    >
      <FileSpreadsheet className="w-3.5 h-3.5" />
      Экспорт Excel
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Поиск…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="print:hidden relative flex items-center">
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-44 sm:w-56 min-h-8 pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}

export function Pagination({ page, pageCount, total, pageSize, onPage }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = 'p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';
  return (
    <div className="print:hidden flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 text-[11px] text-slate-500">
      <span>{from}–{to} из {total}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Предыдущая страница"><ChevronLeft className="w-4 h-4" /></button>
        <span className="font-mono font-bold text-slate-700 px-1">{page + 1} / {pageCount}</span>
        <button type="button" className={btn} disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} aria-label="Следующая страница"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function usePaged<T>(rows: T[], pageSize = 25) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  return {
    pageRows: rows.slice(current * pageSize, (current + 1) * pageSize),
    page: current,
    pageCount,
    setPage,
    pageSize,
  };
}

export type SortDir = 'asc' | 'desc';
type SortValue = string | number | null | undefined;

/** Client-side sorting; nulls always go last. */
export function useSorted<T>(rows: T[], getters: Record<string, (row: T) => SortValue>, initial: { key: string; dir: SortDir }) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const get = getters[sort.key];
    if (!get) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb), 'ru') * factor;
    });
    // getters are recreated each render; the sort key identifies them
  }, [rows, sort]);
  const toggle = (key: string) =>
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: rows.length && typeof getters[key]?.(rows[0]) === 'number' ? 'desc' : 'asc' }));
  return { sorted, sort, toggle };
}

export function SortTh({ label, sortKey, sort, onSort, align = 'left', className = '' }: {
  label: string;
  sortKey: string;
  sort: { key: string; dir: SortDir };
  onSort: (key: string) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`px-4 py-3 whitespace-nowrap ${align === 'right' ? 'text-right' : ''} ${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-widest cursor-pointer hover:text-slate-700 ${active ? 'text-slate-700' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon className={`w-3 h-3 print:hidden ${active ? '' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

export function StatusBadge({ label, className }: { label: string; className: string }) {
  return <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase whitespace-nowrap ${className}`}>{label}</span>;
}

export const TD = 'px-4 py-3';
export const TD_FIRST = 'px-4 sm:px-6 py-3';
export const THEAD_ROW = 'text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30';
export const TFOOT_ROW = 'bg-slate-50 border-t-2 border-slate-200 font-black text-slate-900';
/** Scroll box for long tables; the print stylesheet lifts the height limit. */
export const SCROLL_BOX = 'report-scroll overflow-auto max-h-[480px] custom-scrollbar';
