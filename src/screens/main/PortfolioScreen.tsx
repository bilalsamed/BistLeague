import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserPortfolio, getLeagueMembership } from '../../services/dbService';
import { fetchStockQuotes, formatCurrency, BIST_STOCKS } from '../../services/stockService';
import { Portfolio, Stock } from '../../types';

interface PositionWithValue extends Portfolio {
  stock_name: string;
  current_price: number;
  current_value: number;
  profit_loss: number;
  profit_loss_pct: number;
  sector: string;
}

const SECTOR_COLORS = [
  '#1f6feb', '#00d084', '#f78166', '#e3b341', '#a371f7',
  '#39d353', '#ff7b72', '#58a6ff', '#f0883e', '#bc8cff',
  '#26a869', '#e05c4b', '#d4a017', '#8957e5', '#2ea043',
];

export default function PortfolioScreen({ navigation }: any) {
  const { user } = useAuth();
  const { selectedLeague, membership, setMembership } = useLeague();
  const { colors } = useTheme();
  const [positions, setPositions] = useState<PositionWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState(0);

  const loadPortfolio = useCallback(async () => {
    if (!user || !selectedLeague) { setLoading(false); return; }

    const portfolio = await getUserPortfolio(user.id, selectedLeague.id);
    const symbols = portfolio.map(p => p.stock_symbol);

    let prices: Stock[] = [];
    if (symbols.length > 0) {
      prices = await fetchStockQuotes(symbols);
    }

    const withValues: PositionWithValue[] = portfolio.map(p => {
      const priceData = prices.find(s => s.symbol === p.stock_symbol);
      const currentPrice = priceData?.price || p.avg_buy_price;
      const currentValue = currentPrice * p.quantity;
      const costBasis = p.avg_buy_price * p.quantity;
      const profitLoss = currentValue - costBasis;
      const profitLossPct = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
      const stockInfo = BIST_STOCKS.find(s => s.symbol === p.stock_symbol);

      return {
        ...p,
        stock_name: priceData?.name || stockInfo?.name || p.stock_symbol,
        current_price: currentPrice,
        current_value: currentValue,
        profit_loss: profitLoss,
        profit_loss_pct: profitLossPct,
        sector: stockInfo?.sector || 'Diğer',
      };
    });

    setPositions(withValues);
    const total = withValues.reduce((sum, p) => sum + p.current_value, 0);
    setPortfolioValue(total);

    const mem = await getLeagueMembership(selectedLeague.id, user.id);
    setMembership(mem);

    setLoading(false);
    setRefreshing(false);
  }, [user, selectedLeague]);

  useFocusEffect(useCallback(() => { loadPortfolio(); }, [loadPortfolio]));

  function goToStock(item: PositionWithValue) {
    navigation.navigate('Market', {
      screen: 'StockDetail',
      params: {
        stock: {
          symbol: item.stock_symbol,
          name: item.stock_name,
          price: item.current_price,
          previous_close: item.avg_buy_price,
          change: item.current_price - item.avg_buy_price,
          change_percent: item.profit_loss_pct,
          volume: 0,
          last_updated: '',
        },
      },
    });
  }

  if (!selectedLeague) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.noLeague, { color: colors.subtext }]}>Portföy görmek için bir lig seç</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Leagues')} style={[styles.selectBtn, { backgroundColor: colors.accent }]}>
        <Text style={styles.selectBtnText}>Lig Seç</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.accent} /></View>;

  const cashBalance = membership?.cash_balance || 0;
  const totalValue = cashBalance + portfolioValue;

  // Best/worst positions
  const sortedByPct = [...positions].sort((a, b) => b.profit_loss_pct - a.profit_loss_pct);
  const best = sortedByPct[0];
  const worst = sortedByPct[sortedByPct.length - 1];

  // Sector distribution
  const sectorMap: Record<string, number> = {};
  for (const p of positions) {
    sectorMap[p.sector] = (sectorMap[p.sector] || 0) + p.current_value;
  }
  const sectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.text }]}>Portföyüm</Text>
      <Text style={[styles.leagueName, { color: colors.subtext }]}>{selectedLeague.name}</Text>

      {/* Summary Cards */}
      <View style={styles.cards}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <Text style={[styles.cardLabel, { color: colors.subtext }]}>Toplam Değer</Text>
          <Text style={[styles.cardValue, { color: colors.accent }]}>{formatCurrency(totalValue)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.subtext }]}>Nakit</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{cashBalance.toLocaleString('tr-TR')} ₺</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.subtext }]}>Hisseler</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{formatCurrency(portfolioValue)}</Text>
        </View>
      </View>

      {/* Best / Worst */}
      {positions.length >= 2 && (
        <View style={styles.bestWorstRow}>
          <View style={[styles.bestWorstCard, { backgroundColor: colors.accentBg, borderColor: colors.accent }]}>
            <Text style={[styles.bwLabel, { color: colors.accent }]}>🏆 En İyi</Text>
            <Text style={[styles.bwSymbol, { color: colors.text }]}>{best.stock_symbol}</Text>
            <Text style={[styles.bwPct, { color: colors.accent }]}>+{best.profit_loss_pct.toFixed(2)}%</Text>
          </View>
          <View style={[styles.bestWorstCard, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <Text style={[styles.bwLabel, { color: colors.danger }]}>📉 En Kötü</Text>
            <Text style={[styles.bwSymbol, { color: colors.text }]}>{worst.stock_symbol}</Text>
            <Text style={[styles.bwPct, { color: colors.danger }]}>{worst.profit_loss_pct.toFixed(2)}%</Text>
          </View>
        </View>
      )}

      {/* Sector Distribution */}
      {sectors.length > 0 && portfolioValue > 0 && (
        <View style={[styles.sectorSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sektör Dağılımı</Text>
          {sectors.map(([name, value], i) => {
            const pct = portfolioValue > 0 ? (value / portfolioValue) * 100 : 0;
            const barColor = SECTOR_COLORS[i % SECTOR_COLORS.length];
            return (
              <View key={name} style={styles.sectorRow}>
                <Text style={[styles.sectorName, { color: colors.subtext }]} numberOfLines={1}>{name}</Text>
                <View style={[styles.sectorBarBg, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.sectorBar, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.sectorPct, { color: colors.text }]}>{pct.toFixed(1)}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Position List */}
      {positions.length === 0 ? (
        <Text style={[styles.empty, { color: colors.subtext }]}>Portföyünde hisse yok. Markete git ve satın al!</Text>
      ) : (
        positions.map(item => (
          <View key={item.id} style={[styles.positionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPortfolio(); }} tintColor={colors.accent} />
            <View style={styles.posMain}>
              <View style={styles.posLeft}>
                <Text style={[styles.posSymbol, { color: colors.text }]}>{item.stock_symbol}</Text>
                <Text style={[styles.posName, { color: colors.subtext }]}>{item.stock_name}</Text>
                <Text style={[styles.posDetail, { color: colors.subtext }]}>
                  {item.quantity} adet • Alış: {formatCurrency(item.avg_buy_price)} • Güncel: {formatCurrency(item.current_price)}
                </Text>
              </View>
              <View style={styles.posRight}>
                <Text style={[styles.posValue, { color: colors.text }]}>{formatCurrency(item.current_value)}</Text>
                <Text style={[styles.posPL, item.profit_loss >= 0 ? { color: colors.accent } : { color: colors.danger }]}>
                  {item.profit_loss >= 0 ? '+' : ''}{formatCurrency(item.profit_loss)} ({item.profit_loss_pct.toFixed(2)}%)
                </Text>
              </View>
            </View>
            <View style={styles.posActions}>
              <TouchableOpacity style={[styles.buyBtn, { backgroundColor: colors.accent }]} onPress={() => goToStock(item)}>
                <Text style={styles.buyBtnText}>Al</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sellBtn, { backgroundColor: colors.danger }]} onPress={() => goToStock(item)}>
                <Text style={styles.sellBtnText}>Sat</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  leagueName: { fontSize: 13, marginBottom: 16 },
  noLeague: { fontSize: 16 },
  selectBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  selectBtnText: { color: '#fff', fontWeight: 'bold' },
  cards: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  card: { flex: 1, borderRadius: 12, padding: 10, borderWidth: 1 },
  cardLabel: { fontSize: 10, marginBottom: 4 },
  cardValue: { fontWeight: 'bold', fontSize: 12 },
  bestWorstRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bestWorstCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  bwLabel: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  bwSymbol: { fontSize: 16, fontWeight: 'bold' },
  bwPct: { fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  sectorSection: { borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  sectorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  sectorName: { width: 72, fontSize: 11 },
  sectorBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  sectorBar: { height: 8, borderRadius: 4 },
  sectorPct: { width: 40, fontSize: 11, textAlign: 'right', fontWeight: 'bold' },
  positionCard: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  posMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  posLeft: { flex: 1, paddingRight: 8 },
  posRight: { alignItems: 'flex-end' },
  posSymbol: { fontWeight: 'bold', fontSize: 15 },
  posName: { fontSize: 12 },
  posDetail: { fontSize: 11, marginTop: 4 },
  posValue: { fontWeight: 'bold', fontSize: 15 },
  posPL: { fontSize: 12, marginTop: 3 },
  posActions: { flexDirection: 'row', gap: 8 },
  buyBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  buyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  sellBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  sellBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
});
