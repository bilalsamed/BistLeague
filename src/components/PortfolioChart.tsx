import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path, Defs, LinearGradient, Stop,
  Text as SvgText, Line as SvgLine, Circle,
} from 'react-native-svg';

interface Props {
  data: number[];        // portfolio total values
  dates: string[];       // YYYY-MM-DD strings
  width: number;
  isUp: boolean;
  colors: any;
}

const PAD = { top: 20, right: 16, bottom: 30, left: 58 };
const HEIGHT = 180;

function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function formatLabel(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
  return dateStr.slice(5);
}

export default function PortfolioChart({ data, dates, width, isUp, colors }: Props) {
  if (data.length < 2) return null;

  const chartW = width - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;
  // Add 8% padding to min/max so line isn't flush with edges
  const padded = range * 0.08;
  const yMin = minVal - padded;
  const yMax = maxVal + padded;
  const yRange = yMax - yMin;

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * chartH;

  const pts = data.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const linePath = catmullRomPath(pts);

  // Close path for fill area
  const fillPath =
    linePath +
    ` L ${pts[pts.length - 1].x.toFixed(2)} ${(PAD.top + chartH).toFixed(2)}` +
    ` L ${pts[0].x.toFixed(2)} ${(PAD.top + chartH).toFixed(2)} Z`;

  const lineColor = isUp ? '#00d084' : '#f85149';
  const gradId = 'portGrad';

  // Y-axis: 4 evenly spaced labels
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    const v = yMin + (yRange * i) / (yTickCount - 1);
    return { v, y: toY(v) };
  });

  // X-axis: pick up to 4 evenly spaced labels
  const xIndices: number[] = [];
  const n = data.length;
  if (n <= 4) {
    for (let i = 0; i < n; i++) xIndices.push(i);
  } else {
    xIndices.push(0);
    xIndices.push(Math.round(n / 3));
    xIndices.push(Math.round((2 * n) / 3));
    xIndices.push(n - 1);
  }

  const lastPt = pts[pts.length - 1];
  const firstVal = data[0];
  const lastVal = data[data.length - 1];
  const changePct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;

  return (
    <View>
      {/* Top row: last value + change */}
      <View style={styles.topRow}>
        <Text style={[styles.currentValue, { color: colors.text }]}>
          {lastVal.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₺
        </Text>
        <View style={[styles.changePill, { backgroundColor: isUp ? 'rgba(0,208,132,0.15)' : 'rgba(248,81,73,0.15)' }]}>
          <Text style={[styles.changeText, { color: lineColor }]}>
            {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
          </Text>
        </View>
      </View>

      <Svg width={width} height={HEIGHT}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.35" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines + Y labels */}
        {yTicks.map(({ v, y }, i) => (
          <React.Fragment key={i}>
            <SvgLine
              x1={PAD.left}
              y1={y}
              x2={PAD.left + chartW}
              y2={y}
              stroke={colors.border}
              strokeWidth="0.5"
              strokeDasharray="4,4"
            />
            <SvgText
              x={PAD.left - 6}
              y={y + 4}
              fontSize="9"
              fill={colors.subtext}
              textAnchor="end"
            >
              {formatLabel(v)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Fill area */}
        <Path d={fillPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <Path d={linePath} stroke={lineColor} strokeWidth="2" fill="none" />

        {/* End dot */}
        <Circle cx={lastPt.x} cy={lastPt.y} r={4} fill={lineColor} />
        <Circle cx={lastPt.x} cy={lastPt.y} r={7} fill={lineColor} fillOpacity={0.25} />

        {/* X-axis labels */}
        {xIndices.map(i => (
          <SvgText
            key={i}
            x={toX(i)}
            y={PAD.top + chartH + 18}
            fontSize="9"
            fill={colors.subtext}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          >
            {formatDate(dates[i])}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  currentValue: { fontSize: 20, fontWeight: 'bold' },
  changePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  changeText: { fontSize: 13, fontWeight: 'bold' },
});
