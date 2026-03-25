import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, {
  Path, Defs, LinearGradient, Stop,
  Text as SvgText, Line as SvgLine, Circle, G,
} from 'react-native-svg';
import { LeagueSnapshot } from '../services/dbService';

const LINE_COLORS = [
  '#00d084', '#58a6ff', '#f0883e', '#a371f7',
  '#ff7b72', '#e3b341', '#39d353', '#bc8cff',
  '#26a869', '#e05c4b', '#d4a017', '#2ea043',
  '#79c0ff', '#ffa657', '#d2a8ff', '#56d364',
  '#f85149', '#e3b341', '#89d185', '#ff9bce',
];

const PAD = { top: 16, right: 16, bottom: 28, left: 60 };
const HEIGHT = 210;
const TOP_N = 20;

interface UserSeries {
  userId: string;
  username: string;
  points: { date: string; value: number }[];
  color: string;
  latestValue: number;
}

function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

function formatDate(d: string): string {
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}` : d.slice(5);
}

interface Props {
  snapshots: LeagueSnapshot[];
  colors: any;
}

export default function LeagueChart({ snapshots, colors }: Props) {
  const { width: SCREEN_W } = useWindowDimensions();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (snapshots.length === 0) return null;

  const width = SCREEN_W - 32;
  const chartW = width - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;

  // Build per-user series
  const userMap = new Map<string, UserSeries>();
  for (const s of snapshots) {
    if (!userMap.has(s.user_id)) {
      userMap.set(s.user_id, {
        userId: s.user_id,
        username: s.username || s.user_id.slice(0, 6),
        points: [],
        color: '',
        latestValue: 0,
      });
    }
    const u = userMap.get(s.user_id)!;
    u.points.push({ date: s.snapshot_date, value: s.total_value });
    if (s.total_value > u.latestValue) u.latestValue = s.total_value;
  }

  // Top 10 by latest value
  const top10 = Array.from(userMap.values())
    .sort((a, b) => b.latestValue - a.latestValue)
    .slice(0, TOP_N)
    .map((s, i) => ({ ...s, color: LINE_COLORS[i % LINE_COLORS.length] }));

  // Visible series: if nothing selected show all top10, else show selected
  const visibleIds = selected.size === 0
    ? new Set(top10.map(s => s.userId))
    : selected;

  const visibleSeries = top10.filter(s => visibleIds.has(s.userId));

  // Dates from visible series only
  const allDates = [...new Set(
    snapshots
      .filter(s => visibleIds.has(s.user_id))
      .map(s => s.snapshot_date)
  )].sort();
  const n = allDates.length;

  // Y range from visible series
  const visibleValues = snapshots
    .filter(s => visibleIds.has(s.user_id))
    .map(s => s.total_value);
  const rawMin = Math.min(...visibleValues);
  const rawMax = Math.max(...visibleValues);
  const pad = (rawMax - rawMin) * 0.1 || rawMax * 0.05 || 1000;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const yRange = yMax - yMin || 1;

  const toX = (i: number) => PAD.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const toY = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * chartH;

  const xIndices = n <= 4
    ? allDates.map((_, i) => i)
    : [0, Math.round(n / 3), Math.round((2 * n) / 3), n - 1];

  const yTicks = [0, 1, 2, 3].map(i => {
    const v = yMin + (yRange * i) / 3;
    return { v, y: toY(v) };
  });

  function toggleUser(userId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  return (
    <View>
      {selected.size > 0 && (
        <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.resetBtn}>
          <Text style={[styles.resetText, { color: colors.subtext }]}>✕ Seçimi Temizle</Text>
        </TouchableOpacity>
      )}

      <Svg width={width} height={HEIGHT}>
        <Defs>
          {top10.map(s => (
            <LinearGradient key={s.userId} id={`g_${s.userId}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={s.color} stopOpacity="0.2" />
              <Stop offset="1" stopColor={s.color} stopOpacity="0" />
            </LinearGradient>
          ))}
        </Defs>

        {/* Grid + Y labels */}
        {yTicks.map(({ v, y }, i) => (
          <G key={i}>
            <SvgLine x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
              stroke={colors.border} strokeWidth="0.5" strokeDasharray="4,3" />
            <SvgText x={PAD.left - 6} y={y + 4} fontSize="9" fill={colors.subtext} textAnchor="end">
              {formatK(v)}
            </SvgText>
          </G>
        ))}

        {/* Series */}
        {top10.map(s => {
          const isVisible = visibleIds.has(s.userId);
          const isSelected = selected.has(s.userId);
          const pts = s.points
            .map(p => { const di = allDates.indexOf(p.date); return di >= 0 ? { x: toX(di), y: toY(p.value) } : null; })
            .filter(Boolean) as { x: number; y: number }[];
          if (pts.length < 1) return null;
          const linePath = catmullRomPath(pts);
          const lastPt = pts[pts.length - 1];
          return (
            <G key={s.userId} opacity={isVisible ? 1 : 0.08}>
              {pts.length > 1 && (
                <Path
                  d={linePath + ` L ${lastPt.x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`}
                  fill={`url(#g_${s.userId})`}
                />
              )}
              {pts.length > 1 && (
                <Path d={linePath} stroke={s.color} strokeWidth={isSelected ? 2.5 : 1.5} fill="none" />
              )}
              <Circle cx={lastPt.x} cy={lastPt.y} r={isSelected ? 5 : 3} fill={s.color} />
            </G>
          );
        })}

        {/* X labels */}
        {xIndices.map(i => (
          <SvgText key={i} x={toX(i)} y={PAD.top + chartH + 16} fontSize="9"
            fill={colors.subtext} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {formatDate(allDates[i])}
          </SvgText>
        ))}
      </Svg>

      {/* Legend — seçilebilir */}
      <Text style={[styles.hint, { color: colors.subtext }]}>
        {selected.size === 0 ? 'Karşılaştırmak için seç' : `${selected.size} kullanıcı seçili`}
      </Text>
      <View style={styles.legend}>
        {top10.map(s => {
          const isSelected = selected.has(s.userId);
          const isActive = selected.size === 0 || isSelected;
          return (
            <TouchableOpacity
              key={s.userId}
              style={[
                styles.legendItem,
                { borderColor: isSelected ? s.color : colors.border, borderWidth: 1 },
                isSelected && { backgroundColor: `${s.color}20` },
              ]}
              onPress={() => toggleUser(s.userId)}
            >
              <View style={[styles.legendDot, { backgroundColor: s.color, opacity: isActive ? 1 : 0.3 }]} />
              <Text style={[styles.legendText, { color: isActive ? colors.text : colors.subtext }]} numberOfLines={1}>
                {s.username}
              </Text>
              {isSelected && <Text style={[styles.checkmark, { color: s.color }]}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  resetBtn: { alignSelf: 'flex-end', marginBottom: 4 },
  resetText: { fontSize: 11 },
  hint: { fontSize: 10, marginBottom: 6, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600', maxWidth: 72 },
  checkmark: { fontSize: 11, fontWeight: 'bold' },
});
