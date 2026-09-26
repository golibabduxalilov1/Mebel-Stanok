import React from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '../reportUtils';
import { CHART_AXIS_TICK, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_STYLE, ChartFrame, ChartLegend } from './ChartFrame';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

/**
 * Vertical (columns over time) or horizontal (categories compared) bars. Several series are
 * stacked; a 1px surface stroke separates the segments and the last one gets rounded ends.
 */
export function StackedBarChart({
  data,
  categoryKey,
  series,
  height = 260,
  horizontal = false,
  valueFormatter = v => formatNumber(v),
  axisFormatter = v => formatNumber(v, 0),
}: {
  data: Record<string, any>[];
  categoryKey: string;
  series: BarSeries[];
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (value: number) => string;
  axisFormatter?: (value: number) => string;
}) {
  const stacked = series.length > 1;
  const lastIndex = series.length - 1;
  const radius = (i: number): [number, number, number, number] =>
    i !== lastIndex ? [0, 0, 0, 0] : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];

  return (
    <div>
      <ChartFrame height={height}>
        {({ width }) => (
          <BarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: horizontal ? 24 : 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} stroke="#f1f5f9" />
            {horizontal ? (
              <>
                <XAxis type="number" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} tickFormatter={axisFormatter} />
                <YAxis
                  type="category"
                  dataKey={categoryKey}
                  axisLine={false}
                  tickLine={false}
                  tick={{ ...CHART_AXIS_TICK, fill: '#475569' }}
                  width={Math.min(150, Math.max(80, width * 0.3))}
                />
              </>
            ) : (
              <>
                <XAxis dataKey={categoryKey} axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} dy={6} minTickGap={8} />
                <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} width={56} tickFormatter={axisFormatter} />
              </>
            )}
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              formatter={(value: number, name: string) => [valueFormatter(Number(value)), name]}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                stackId={stacked ? 'stack' : undefined}
                stroke="#fff"
                strokeWidth={stacked ? 1 : 0}
                radius={radius(i)}
                maxBarSize={horizontal ? 26 : 40}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </ChartFrame>
      {stacked && <ChartLegend items={series.map(s => ({ label: s.label, color: s.color }))} />}
    </div>
  );
}
