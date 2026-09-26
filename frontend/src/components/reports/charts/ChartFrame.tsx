import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';
import type { MachineStatus } from '../../../types';

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  fontSize: '12px',
};

export const CHART_TOOLTIP_LABEL_STYLE: React.CSSProperties = { fontWeight: 'bold', marginBottom: '4px' };

export const CHART_AXIS_TICK = { fontSize: 10, fill: '#94a3b8' };

export const SERIES_COLORS = {
  planned: '#3b82f6',
  emergency: '#f43f5e',
  amps: '#3b82f6',
  value: '#8b5cf6',
  parts: '#3b82f6',
  activity: '#3b82f6',
};

/** Validated for CVD separation; always paired with a legend and a 2px surface gap between segments. */
export const STATUS_COLORS: Record<MachineStatus, string> = {
  active: '#059669',
  maintenance: '#d97706',
  repair: '#e11d48',
  retired: '#94a3b8',
};

/** Tracks the element's pixel size (same pattern as App.tsx's charts) so ResponsiveContainer gets real numbers. */
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

export function ChartFrame({ height, children }: { height: number; children: (size: { width: number; height: number }) => React.ReactElement }) {
  const [ref, size] = useMeasuredSize<HTMLDivElement>();
  const ready = size.width > 0 && size.height > 0;
  return (
    <div ref={ref} className="w-full min-w-0" style={{ height }}>
      {ready && (
        <ResponsiveContainer width={size.width} height={size.height} debounce={150}>
          {children(size)}
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-600">
      {items.map(item => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
