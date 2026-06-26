import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';
import type { HistoryLinePoint } from '../utils/workoutHistoryChartData';

export type HistoryLineChartOptions = {
  emptyTitle: string;
  emptySub: string;
  lineColor: string;
  yDecimals: number;
  statUnit: string;
  yAxisCompact?: boolean;
};

type Props = {
  series: HistoryLinePoint[];
  options: HistoryLineChartOptions;
};

export default function HistoryLineChart({ series, options: opts }: Props) {
  const { width: windowWidth } = useWindowDimensions();

  if (series.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{opts.emptyTitle}</Text>
        <Text style={styles.emptySub}>{opts.emptySub}</Text>
      </View>
    );
  }

  const sortedEntries = [...series].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const values = sortedEntries.map((e) => e.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || Math.max(Math.abs(maxV) * 0.05, 1);
  const padding = span * 0.12;
  const graphMin = minV - padding;
  const graphMax = maxV + padding;
  const graphRange = graphMax - graphMin || 1;

  const chartGutterX = 40 + 20 + 30 + 58;
  const graphWidth = Math.max(120, windowWidth - chartGutterX);
  const graphHeight = 200;
  const padX = 12;
  const padY = 12;
  const innerW = Math.max(1, graphWidth - 2 * padX);
  const innerH = Math.max(1, graphHeight - 2 * padY);
  const pointRadius = 5;
  const numLabels = 5;

  const formatYTick = (value: number) => {
    if (opts.yAxisCompact && Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (opts.yAxisCompact && Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(Math.abs(value) >= 10_000 ? 0 : 1)}k`;
    }
    return value.toFixed(opts.yDecimals);
  };

  const n = sortedEntries.length;
  const denom = Math.max(1, n - 1);

  const points = sortedEntries.map((entry, index) => {
    const x = padX + (index / denom) * innerW;
    const yNorm = (entry.value - graphMin) / graphRange;
    const y = padY + (1 - yNorm) * innerH;
    return { x, y, value: entry.value, date: entry.date };
  });

  const lineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    lineSegments.push({
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y,
    });
  }

  const yAxisLabels: string[] = [];
  const yLabelSteps = Math.max(1, numLabels - 1);
  for (let i = 0; i < numLabels; i++) {
    const value = graphMax - (graphRange / yLabelSteps) * i;
    yAxisLabels.push(formatYTick(value));
  }

  const firstDate = sortedEntries[0].date;
  const lastDate = sortedEntries[sortedEntries.length - 1].date;
  const midDate = sortedEntries[Math.floor((sortedEntries.length - 1) / 2)].date;
  const fmtShortDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const fmt = (v: number) => `${v.toFixed(opts.yDecimals)}${opts.statUnit}`;
  const last = sortedEntries[sortedEntries.length - 1].value;
  const first = sortedEntries[0].value;
  const delta = last - first;

  return (
    <View style={styles.wrapper}>
      <View style={styles.content}>
      <View style={[styles.yAxis, { height: graphHeight }]}>
        {yAxisLabels.map((label, index) => (
          <Text key={index} style={styles.yLabel} numberOfLines={1}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.main}>
        <View style={[styles.svg, { width: graphWidth, height: graphHeight }]}>
          {yAxisLabels.map((_, index) => {
            const y = padY + (index / yLabelSteps) * innerH;
            return (
              <View
                key={`grid-${index}`}
                style={[styles.gridLine, { top: y, width: graphWidth }]}
              />
            );
          })}
          {lineSegments.map((segment, index) => {
            const length = Math.sqrt(
              Math.pow(segment.x2 - segment.x1, 2) + Math.pow(segment.y2 - segment.y1, 2)
            );
            const angle =
              Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) * (180 / Math.PI);
            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.line,
                  {
                    left: segment.x1,
                    top: segment.y1,
                    width: length,
                    backgroundColor: opts.lineColor,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}
          {points.map((point, index) => (
            <View
              key={`point-${index}`}
              style={[
                styles.point,
                {
                  left: point.x - pointRadius,
                  top: point.y - pointRadius,
                  width: pointRadius * 2,
                  height: pointRadius * 2,
                  backgroundColor: opts.lineColor,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.xAxisRow}>
          <Text style={styles.xLabelStart} numberOfLines={1}>
            {fmtShortDate(firstDate)}
          </Text>
          {sortedEntries.length > 2 ? (
            <Text style={styles.xLabelCenter} numberOfLines={1}>
              {fmtShortDate(midDate)}
            </Text>
          ) : (
            <View style={styles.xLabelSpacer} />
          )}
          {sortedEntries.length > 1 ? (
            <Text style={styles.xLabelEnd} numberOfLines={1}>
              {fmtShortDate(lastDate)}
            </Text>
          ) : (
            <View style={styles.xLabelSpacer} />
          )}
        </View>
      </View>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Latest</Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(last)}
          </Text>
        </View>
        {sortedEntries.length > 1 && (
          <>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Change</Text>
              <Text
                style={[styles.statValue, { color: delta >= 0 ? AppTheme.accent : '#ff6b6b' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(opts.yDecimals)}
                {opts.statUnit}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(opts.yDecimals)}
                {opts.statUnit}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: 8,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    color: AppTheme.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    color: AppTheme.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxis: {
    width: 48,
    justifyContent: 'space-between',
    paddingRight: 10,
    flexShrink: 0,
  },
  yLabel: {
    color: AppTheme.textMuted,
    fontSize: 11,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  main: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  svg: {
    position: 'relative',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    left: 0,
  },
  line: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  point: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  xAxisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  xLabelStart: {
    flex: 1,
    color: AppTheme.textMuted,
    fontSize: 11,
    textAlign: 'left',
  },
  xLabelCenter: {
    flex: 1,
    color: AppTheme.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  xLabelEnd: {
    flex: 1,
    color: AppTheme.textMuted,
    fontSize: 11,
    textAlign: 'right',
  },
  xLabelSpacer: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: AppTheme.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    color: AppTheme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
