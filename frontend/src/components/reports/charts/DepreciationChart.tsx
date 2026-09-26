import React from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatNumber } from '../reportUtils';
import { CHART_AXIS_TICK, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_STYLE, ChartFrame, SERIES_COLORS } from './ChartFrame';

/** Residual value by year; the current year is today's value (= the KPI) and is marked with a reference line. */
export function DepreciationChart({ data, currentYear, height = 260 }: { data: { year: string; value: number }[]; currentYear: string; height?: number }) {
  return (
    <ChartFrame height={height}>
      {() => (
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="reportDepreciationFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SERIES_COLORS.value} stopOpacity={0.2} />
              <stop offset="95%" stopColor={SERIES_COLORS.value} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} dy={6} />
          <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} width={64} tickFormatter={(v: number) => formatNumber(v, 0)} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            labelFormatter={label => (String(label) === currentYear ? `${label} (сейчас)` : `${label} (на 1 января)`)}
            formatter={(value: number) => [formatMoney(Number(value)), 'Стоимость']}
          />
          <ReferenceLine x={currentYear} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Сейчас', position: 'top', fontSize: 10, fill: '#475569' }} />
          <Area type="monotone" dataKey="value" stroke={SERIES_COLORS.value} strokeWidth={2} fill="url(#reportDepreciationFill)" dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} isAnimationActive={false} />
        </AreaChart>
      )}
    </ChartFrame>
  );
}
