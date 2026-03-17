import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { BIST_STOCKS, SECTORS, fetchStockQuotes, formatCurrency, StockSector } from '../../services/stockService';
import { Stock } from '../../types';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../hooks/useFavorites';
import { useAlertChecker } from '../../hooks/useAlertChecker';
import StockLogo from '../../components/StockLogo';

type SortKey = 'default' | 'az' | 'za' | 'gainers' | 'losers' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default',    label: 'Varsayılan' },
  { key: 'gainers',   label: '↑ Artış' },
  { key: 'losers',    label: '↓ Düşüş' },
  { key: 'price_desc',label: '₺ Yüksek' },
  { key: 'price_asc', label: '₺ Düşük' },
  { key: 'az',        label: 'A-Z' },
  { key: 'za',        label: 'Z-A' },
];

function applySortAndFilter(stocks: Stock[], search: string, sort: SortKey, sector: StockSector | 'Tümü' | 'Favoriler', favorites: Set<string>): Stock[] {
  let result = stocks;
  if (sector === 'Favoriler') {
    result = result.filter(s => favorites.has(s.symbol));
  } else if (sector !== 'Tümü') {
    const sectorSymbols = new Set(BIST_STOCKS.filter(b => b.sector === sector).map(b => b.symbol));
    result = result.filter(s => sectorSymbols.has(s.symbol));
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }
  switch (sort) {
    case 'gainers':    return [...result].sort((a, b) => b.change_percent - a.change_percent);
    case 'losers':     return [...result].sort((a, b) => a.change_percent - b.change_percent);
    case 'price_desc': return [...result].sort((a, b) => b.price - a.price);
    case 'price_asc':  return [...result].sort((a, b) => a.price - b.price);
    case 'az':         return [...result].sort((a, b) => a.symbol.localeCompare(b.symbol));
    case 'za':         return [...result].sort((a, b) => b.symbol.localeCompare(a.symbol));
    default:           return result;
  }
}

export default function MarketScreen({ navigation }: any) {
  const { selectedLeague, membership } = useLeague();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const { checkAlerts, sendBrowserNotification } = useAlertChecker();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const [sector, setSector] = useState<StockSector | 'Tümü' | 'Favoriler'>('Tümü');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStocks = useCallback(async () => {
    const symbols = BIST_STOCKS.map(s => s.symbol);
    const data = await fetchStockQuotes(symbols);
    const allStocks = BIST_STOCKS.map(s => {
      const found = data.find(d => d.symbol === s.symbol);
      return found || { symbol: s.symbol, name: s.name, price: 0, previous_close: 0, change: 0, change_percent: 0, volume: 0, last_updated: '' };
    });
    setStocks(allStocks);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);

    // Check price alerts
    if (user) {
      try {
        const triggered = await checkAlerts(user.id, allStocks);
        if (triggered.length > 0) {
          try { sendBrowserNotification(triggered, allStocks); } catch {}
          const msgs = triggered.map(a => {
            const s = allStocks.find(st => st.symbol === a.stock_symbol);
            return `${a.stock_symbol} alarmı tetiklendi! (₺${s?.price?.toFixed(2) || a.target_price})`;
          });
          setAlertBanner(msgs.join(' • '));
          setTimeout(() => setAlertBanner(null), 5000);
        }
      } catch (e) {
        console.warn('Alert check failed:', e);
      }
    }
  }, [user]);

  useEffect(() => {
    loadStocks();
    const interval = setInterval(() => {
      const now = new Date();
      const day = now.getUTCDay();
      const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
      if (day >= 1 && day <= 5 && mins >= 7 * 60 && mins < 15 * 60) loadStocks();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadStocks]);

  const filtered = applySortAndFilter(stocks, search, sort, sector, favorites);
  const sectorList: (StockSector | 'Tümü' | 'Favoriler')[] = ['Tümü', 'Favoriler', ...SECTORS];

  if (loading) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.loadingText, { color: colors.subtext }]}>Hisseler yükleniyor...</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Borsa İstanbul</Text>
          {lastUpdated && (
            <Text style={[styles.lastUpdated, { color: colors.subtext }]}>
              Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          )}
        </View>
        {selectedLeague && membership && (
          <View style={[styles.cashBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cashLabel, { color: colors.subtext }]}>Nakit</Text>
            <Text style={[styles.cashValue, { color: colors.accent }]}>{(membership.cash_balance || 0).toLocaleString('tr-TR')} ₺</Text>
          </View>
        )}
      </View>

      {alertBanner && (
        <View style={[styles.warningBanner, { backgroundColor: colors.accentBg }]}>
          <Text style={[styles.warningText, { color: colors.accent }]}>🔔 {alertBanner}</Text>
        </View>
      )}

      {!selectedLeague && (
        <View style={[styles.warningBanner, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.warningText, { color: colors.warning }]}>İşlem yapmak için önce bir lig seç</Text>
        </View>
      )}

      <TextInput
        style={[styles.search, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        placeholder="Hisse ara (THYAO, Garanti...)"
        placeholderTextColor={colors.subtext}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.symbol}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStocks(); }} tintColor={colors.accent} />}
        ListHeaderComponent={
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
              {sectorList.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterBtn, sector === s && { backgroundColor: colors.accent, borderColor: colors.accent }, sector !== s && { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setSector(s)}
                >
                  <Text style={[styles.filterBtnText, { color: sector === s ? '#fff' : colors.subtext }]}>{s === 'Favoriler' ? '⭐ ' + s : s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={styles.sortContent}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortBtn, sort === opt.key && { backgroundColor: colors.accent, borderColor: colors.accent }, sort !== opt.key && { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setSort(opt.key)}
                >
                  <Text style={[styles.sortBtnText, { color: sort === opt.key ? '#fff' : colors.subtext }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('StockDetail', { stock: item })}
          >
            <TouchableOpacity onPress={() => toggleFavorite(item.symbol)} style={styles.starBtn}>
              <Text style={styles.starIcon}>{favorites.has(item.symbol) ? '⭐' : '☆'}</Text>
            </TouchableOpacity>
            <StockLogo symbol={item.symbol} size={38} />
            <View style={styles.left}>
              <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
              <Text style={[styles.name, { color: colors.subtext }]} numberOfLines={1}>{item.name}</Text>
              {item.market_time ? (
                <Text style={[styles.stockTime, { color: colors.subtext }]}>
                  {new Date(item.market_time * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : null}
            </View>
            <View style={styles.right}>
              <Text style={[styles.price, { color: colors.text }]}>{item.price > 0 ? formatCurrency(item.price) : '—'}</Text>
              <View style={styles.rightBottom}>
                <View style={[styles.changeBadge, item.change_percent >= 0 ? { backgroundColor: colors.accentBg } : { backgroundColor: colors.dangerBg }]}>
                  <Text style={[styles.changeText, { color: item.change_percent >= 0 ? colors.accent : colors.danger }]}>
                    {item.change_percent >= 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
                  </Text>
                </View>
                {selectedLeague && item.price > 0 && (
                  <TouchableOpacity
                    style={[styles.buyBtn, { backgroundColor: colors.accent }]}
                    onPress={() => navigation.navigate('StockDetail', { stock: item })}
                  >
                    <Text style={styles.buyBtnText}>Al</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.surfaceAlt }]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold' },
  lastUpdated: { fontSize: 10, marginTop: 2 },
  cashBadge: { borderRadius: 10, padding: 8, alignItems: 'flex-end', borderWidth: 1 },
  cashLabel: { fontSize: 10 },
  cashValue: { fontWeight: 'bold', fontSize: 13 },
  warningBanner: { borderRadius: 8, padding: 10, marginBottom: 10 },
  warningText: { fontSize: 13, textAlign: 'center' },
  search: { borderRadius: 10, padding: 11, marginBottom: 8, fontSize: 14, borderWidth: 1 },
  filterRow: { marginBottom: 6, height: 36, flexShrink: 0 },
  filterContent: { gap: 6, paddingRight: 4, alignItems: 'center' },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  filterBtnText: { fontSize: 11, fontWeight: '600' },
  sortRow: { marginBottom: 8, height: 36, flexShrink: 0 },
  sortContent: { gap: 6, paddingRight: 4, alignItems: 'center' },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  sortBtnText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 8, borderRadius: 0 },
  starBtn: { padding: 2 },
  starIcon: { fontSize: 14 },
  left: { flex: 1 },
  right: { alignItems: 'flex-end' },
  rightBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  symbol: { fontWeight: 'bold', fontSize: 15 },
  name: { fontSize: 12, marginTop: 2 },
  stockTime: { fontSize: 10, marginTop: 1, opacity: 0.6 },
  price: { fontSize: 15, fontWeight: '600' },
  changeBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  changeText: { fontSize: 12, fontWeight: 'bold' },
  buyBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  buyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  sep: { height: 1 },
});
