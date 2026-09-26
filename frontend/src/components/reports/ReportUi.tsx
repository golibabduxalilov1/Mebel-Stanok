import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import { CsvCell, todayKey, toCsv } from './reportUtils';

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  fontSize: '12px',
};

export const CHART_AXIS_TICK = { fontSize: 10, fill: '#94a3b8' };

export const SERIES_COLORS = {
  planned: '#3b82f6',
  emergency: '#f43f5e',
  amps: '#3b82f6',
  value: '#8b5cf6',
  parts: '#3b82f6',
};

/** Measures the element so Recharts gets numeric sizes (avoids ResponsiveContainer's -1/-1 warning). */
function useMeasuredSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

export function ChartFrame({ height, children }: { height: number; children: (size: { width: number; height: number }) => React.ReactNode }) {
  const [ref, size] = useMeasuredSize<HTMLDivElement>();
  return (
    <div ref={ref} className="w-full min-w-0" style={{ height }}>
      {size.width > 0 && size.height > 0 && children(size)}
    </div>
  );
}

export function Panel({ title, icon: Icon, iconClass = 'text-blue-500', actions, children, bodyClass = 'p-4 sm:p-6' }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 min-w-0 break-words">
          {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />}
          {title}
        </h3>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

export function KpiCard({ label, value, hint, tone = 'default', children }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'dark' | 'warning' | 'danger';
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
  return (
    <div className={`p-4 sm:p-5 rounded-2xl border min-w-0 ${box}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>{label}</p>
      <p className={`text-xl sm:text-2xl font-mono font-black wrap-anywhere ${valueClass}`}>{value}</p>
      {hint && <div className={`text-[10px] mt-2 ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{hint}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ text = 'Нет данных за выбранный период', compact = false }: { text?: string; compact?: boolean }) {
  return (
    <div className={`${compact ? 'py-8' : 'py-14'} flex flex-col items-center justify-center text-center text-slate-400 gap-2`}>
      <AlertCircle className="w-7 h-7 opacity-30" />
      <p className="text-xs italic">{text}</p>
    </div>
  );
}

export function ProgressBar({ percent, colorClass = 'bg-blue-500', className = 'h-1.5' }: { percent: number; colorClass?: string; className?: string }) {
  const width = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
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
      onClick={() => downloadCsv(filename, headers, rows())}
      className="print:hidden flex items-center gap-1.5 min-h-8 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      title="Скачать CSV"
    >
      <FileSpreadsheet className="w-3.5 h-3.5" />
      CSV
    </button>
  );
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
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-widest cursor-pointer hover:text-slate-700 ${active ? 'text-slate-700' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? '' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

export const TH = 'px-4 py-3';
export const TD = 'px-4 py-3';
export const THEAD_ROW = 'text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30';
