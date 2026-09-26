import React from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { formatNumber, formatPercent } from '../reportUtils';
import { CHART_TOOLTIP_STYLE, ChartFrame } from './ChartFrame';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Donut with a centre total and a value/percent legend that doubles as the table view. */
export function DonutChart({ data, centerLabel, valueFormatter = v => formatNumber(v), size = 180 }: {
  data: DonutSlice[];
  centerLabel: string;
  valueFormatter?: (value: number) => string;
  size?: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const visible = data.filter(d => d.value > 0);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ChartFrame height={size}>
          {() => (
            <PieChart>
              <Pie
                data={visible}
                dataKey="value"
                nameKey="label"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={visible.length > 1 ? 1.5 : 0}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {visible.map(d => <Cell key={d.key} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [`${valueFormatter(Number(value))} (${formatPercent(total ? (Number(value) / total) * 100 : 0)})`, name]}
              />
            </PieChart>
          )}
        </ChartFrame>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-mono font-black text-slate-900">{valueFormatter(total)}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 min-w-0">
        {data.map(d => (
          <li key={d.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-slate-600 truncate flex-1">{d.label}</span>
            <span className="font-mono font-bold text-slate-900">{valueFormatter(d.value)}</span>
            <span className="font-mono text-[10px] text-slate-400 w-10 text-right">{formatPercent(total ? (d.value / total) * 100 : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
