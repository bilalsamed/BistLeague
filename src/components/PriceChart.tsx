import React, { useState, useRef } from 'react';
import { View, Text, PanResponder, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Rect, G } from 'react-native-svg';
import { StockHistory } from '../types';

interface Props {
  data: StockHistory[];
  width: number;
  height?: number;
  colors: any;
  isPositive: boolean;
  range: string;
}

function buildLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const cpx = ((p.x + c.x) / 2).toFixed(2);
    d += ` C ${cpx} ${p.y.toFixed(2)} ${cpx} ${c.y.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
  }
  return d;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2).replace('.', ',');
}

function formatLabel(dateStr: string, range: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(5);
  if (range === '1d') return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (range === '5d') return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

const CHART_PAD = { top: 20, right: 60, bottom: 32, left: 4 };
const VOLUME_H = 40;
const VOLUME_GAP = 8;

export default function PriceChart({ data, width, height = 220, colors, isPositive, range }: Props) {
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; index: number } | null>(null);
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');

  const accentColor = isPositive ? '#00d084' : '#f85149';
  const totalH = height + VOLUME_H + VOLUME_GAP;

  const chartW = width - CHART_PAD.left - CHART_PAD.right;
  const chartH = height - CHART_PAD.top - CHART_PAD.bottom;

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high || d.close);
  const lows = data.map(d => d.low || d.close);
  const volumes = data.map(d => d.volume || 0);

  const rawMin = Math.min(...lows.filter(v => v > 0));
  const rawMax = Math.max(...highs);
  const spread = rawMax - rawMin || rawMax * 0.01 || 1;
  const minP = rawMin - spread * 0.05;
  const maxP = rawMax + spread * 0.05;
  const priceRange = maxP - minP;

  const maxVol = Math.max(...volumes) || 1;

  const toX = (i: number) => CHART_PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
  const toY = (price: number) => CHART_PAD.top + (1 - (price - minP) / priceRange) * chartH;
  const barW = Math.max(1, (chartW / data.length) * 0.6);

  const linePoints = data.map((d, i) => ({ x: toX(i), y: toY(d.close) }));
  const linePath = buildLinePath(linePoints);
  const areaPath = linePath
    + ` L ${linePoints[linePoints.length - 1].x.toFixed(2)} ${(CHART_PAD.top + chartH).toFixed(2)}`
    + ` L ${linePoints[0].x.toFixed(2)} ${(CHART_PAD.top + chartH).toFixed(2)} Z`;

  const yLevels = [0, 0.33, 0.66, 1].map(t => minP + t * priceRange);
  const xLabels = data.length > 0
    ? [0, Math.floor((data.length - 1) / 2), data.length - 1].map(i => ({
        x: toX(i),
        label: formatLabel(data[i].date, range),
      }))
    : [];

  function updateCrosshair(locationX: number) {
    const relX = locationX - CHART_PAD.left;
    const ratio = Math.max(0, Math.min(1, relX / chartW));
    const index = Math.round(ratio * (data.length - 1));
    const pt = linePoints[index];
    if (pt) setCrosshair({ x: pt.x, y: pt.y, index });
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => updateCrosshair(e.nativeEvent.locationX),
    onPanResponderMove: e => updateCrosshair(e.nativeEvent.locationX),
    onPanResponderRelease: () => setCrosshair(null),
    onPanResponderTerminate: () => setCrosshair(null),
  });

  const hovered = crosshair ? data[crosshair.index] : null;
  const tooltipW = 120;
  const rawTipX = crosshair ? crosshair.x - tooltipW / 2 : 0;
  const tipX = Math.max(0, Math.min(rawTipX, width - CHART_PAD.right - tooltipW));

  // Volume bar top Y offset (below main chart)
  const volTopY = height + VOLUME_GAP;

  return (
    <View style={{ width }}>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, chartType === 'line' && { backgroundColor: colors.accent }]}
          onPress={() => setChartType('line')}
        >
          <Text style={[styles.toggleText, { color: chartType === 'line' ? '#fff' : colors.subtext }]}>Çizgi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, chartType === 'candle' && { backgroundColor: colors.accent }]}
          onPress={() => setChartType('candle')}
        >
          <Text style={[styles.toggleText, { color: chartType === 'candle' ? '#fff' : colors.subtext }]}>Mum</Text>
        </TouchableOpacity>
      </View>

      <View style={{ width, height: totalH }}>
        <Svg width={width} height={totalH}>
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {yLevels.map((price, i) => (
            <Line
              key={i}
              x1={CHART_PAD.left} y1={toY(price)}
              x2={CHART_PAD.left + chartW} y2={toY(price)}
              stroke={colors.border} strokeWidth={0.5} strokeDasharray="3 6"
            />
          ))}

          {/* Baseline */}
          <Line
            x1={CHART_PAD.left} y1={CHART_PAD.top + chartH}
            x2={CHART_PAD.left + chartW} y2={CHART_PAD.top + chartH}
            stroke={colors.border} strokeWidth={0.5}
          />

          {chartType === 'line' ? (
            <>
              <Path d={areaPath} fill="url(#areaGrad)" />
              <Path d={linePath} stroke={accentColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            /* Candlesticks */
            data.map((d, i) => {
              const x = toX(i);
              const open = d.open || d.close;
              const close = d.close;
              const high = d.high || d.close;
              const low = d.low || d.close;
              const bullish = close >= open;
              const color = bullish ? '#00d084' : '#f85149';
              const bodyTop = toY(Math.max(open, close));
              const bodyBot = toY(Math.min(open, close));
              const bodyH = Math.max(1, bodyBot - bodyTop);
              return (
                <G key={i}>
                  {/* Wick */}
                  <Line x1={x} y1={toY(high)} x2={x} y2={toY(low)} stroke={color} strokeWidth={1} />
                  {/* Body */}
                  <Rect
                    x={x - barW / 2} y={bodyTop}
                    width={barW} height={bodyH}
                    fill={bullish ? color : color}
                    fillOpacity={bullish ? 0.9 : 1}
                    stroke={color} strokeWidth={0.5}
                  />
                </G>
              );
            })
          )}

          {/* Crosshair */}
          {crosshair && (
            <>
              <Line
                x1={crosshair.x} y1={CHART_PAD.top}
                x2={crosshair.x} y2={CHART_PAD.top + chartH}
                stroke={colors.subtext} strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
              />
              <Circle cx={crosshair.x} cy={crosshair.y} r={5} fill={accentColor} stroke={colors.bg} strokeWidth={2} />
            </>
          )}

          {/* Volume bars */}
          {data.map((d, i) => {
            const x = toX(i);
            const vol = d.volume || 0;
            const volBarH = (vol / maxVol) * VOLUME_H;
            const bullish = (d.close || 0) >= (d.open || d.close);
            return (
              <Rect
                key={i}
                x={x - barW / 2}
                y={volTopY + VOLUME_H - volBarH}
                width={barW}
                height={Math.max(1, volBarH)}
                fill={bullish ? '#00d084' : '#f85149'}
                fillOpacity={0.4}
              />
            );
          })}

          {/* Volume label */}
          <Line
            x1={CHART_PAD.left} y1={volTopY}
            x2={CHART_PAD.left + chartW} y2={volTopY}
            stroke={colors.border} strokeWidth={0.5}
          />
        </Svg>

        {/* Y-axis price labels */}
        {yLevels.map((price, i) => (
          <View key={i} style={[styles.yLabel, { top: toY(price) - 8, right: 4 }]} pointerEvents="none">
            <Text style={[styles.yLabelText, { color: colors.subtext }]}>{formatPrice(price)}</Text>
          </View>
        ))}

        {/* Volume label */}
        <View style={[styles.yLabel, { top: volTopY + 2, right: 4 }]} pointerEvents="none">
          <Text style={[styles.yLabelText, { color: colors.subtext, fontSize: 9 }]}>Hacim</Text>
        </View>

        {/* X-axis labels */}
        {xLabels.map((item, i) => (
          <View key={i} style={[styles.xLabel, { left: item.x - 24, top: height - 28 }]} pointerEvents="none">
            <Text style={[styles.xLabelText, { color: colors.subtext }]}>{item.label}</Text>
          </View>
        ))}

        {/* Touch overlay — only over price chart */}
        <View style={[StyleSheet.absoluteFill, { bottom: VOLUME_H + VOLUME_GAP }]} {...panResponder.panHandlers} />

        {/* Tooltip */}
        {crosshair && hovered && (
          <View
            style={[styles.tooltip, { left: tipX, top: 0, backgroundColor: colors.surface, borderColor: colors.border }]}
            pointerEvents="none"
          >
            <Text style={[styles.tooltipPrice, { color: colors.text }]}>{formatPrice(hovered.close)}</Text>
            {chartType === 'candle' && hovered.open ? (
              <Text style={[styles.tooltipSub, { color: colors.subtext }]}>
                A:{formatPrice(hovered.open)} Y:{formatPrice(hovered.high || hovered.close)} D:{formatPrice(hovered.low || hovered.close)}
              </Text>
            ) : null}
            <Text style={[styles.tooltipDate, { color: colors.subtext }]}>{formatLabel(hovered.date, range)}</Text>
            {hovered.volume ? <Text style={[styles.tooltipDate, { color: colors.subtext }]}>Hacim: {formatVolLocal(hovered.volume)}</Text> : null}
          </View>
        )}
      </View>
    </View>
  );
}

function formatVolLocal(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}Mr`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: 'transparent' },
  toggleText: { fontSize: 12, fontWeight: '600' },
  yLabel: { position: 'absolute', right: 4, alignItems: 'flex-end' },
  yLabelText: { fontSize: 10 },
  xLabel: { position: 'absolute', width: 48, alignItems: 'center' },
  xLabelText: { fontSize: 10 },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 110,
  },
  tooltipPrice: { fontSize: 14, fontWeight: 'bold' },
  tooltipSub: { fontSize: 10, marginTop: 1 },
  tooltipDate: { fontSize: 11, marginTop: 1 },
});
