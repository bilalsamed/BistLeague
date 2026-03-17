import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { getLeagueLeaderboard, getUserPortfolio, getLeagueRecentTransactions } from '../../services/dbService';
import { fetchStockQuotes, formatCurrency, BIST_STOCKS } from '../../services/stockService';
import { LeagueMember } from '../../types';

type Tab = 'leaderboard' | 'trades';

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { selectedLeague } = useLeague();
  const { colors } = useTheme();
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LeagueMember | null>(null);
  const [memberPortfolio, setMemberPortfolio] = useState<any[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('leaderboard');

  const loadData = useCallback(async () => {
    if (!selectedLeague) { setLoading(false); return; }
    const [data, trades] = await Promise.all([
      getLeagueLeaderboard(selectedLeague.id),
      getLeagueRecentTransactions(selectedLeague.id),
    ]);
    setMembers(data);
    setRecentTrades(trades);
    setLoading(false);
    setRefreshing(false);
  }, [selectedLeague]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function viewMemberPortfolio(member: LeagueMember) {
    if (!selectedLeague) return;
    setSelectedMember(member);
    setPortfolioLoading(true);
    const portfolio = await getUserPortfolio(member.user_id, selectedLeague.id);
    const symbols = portfolio.map(p => p.stock_symbol);
    let prices: any[] = [];
    if (symbols.length > 0) prices = await fetchStockQuotes(symbols);

    const enriched = portfolio.map(p => {
      const priceData = prices.find(s => s.symbol === p.stock_symbol);
      const currentPrice = priceData?.price || p.avg_buy_price;
      const stockInfo = BIST_STOCKS.find(s => s.symbol === p.stock_symbol);
      return {
        ...p,
        stock_name: priceData?.name || stockInfo?.name || p.stock_symbol,
        current_price: currentPrice,
        current_value: currentPrice * p.quantity,
      };
    });
    setMemberPortfolio(enriched);
    setPortfolioLoading(false);
  }

  const medalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  };

  if (!selectedLeague) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.noLeague, { color: colors.subtext }]}>Sıralama için bir lig seç</Text>
    </View>
  );

  if (loading) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.accent} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Sıralama</Text>
      <Text style={[styles.leagueName, { color: colors.subtext }]}>{selectedLeague.name}</Text>

      {/* Tab toggle */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'leaderboard' && { backgroundColor: colors.accent }]}
          onPress={() => setTab('leaderboard')}
        >
          <Text style={[styles.tabBtnText, { color: tab === 'leaderboard' ? '#fff' : colors.subtext }]}>Sıralama</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'trades' && { backgroundColor: colors.accent }]}
          onPress={() => setTab('trades')}
        >
          <Text style={[styles.tabBtnText, { color: tab === 'trades' ? '#fff' : colors.subtext }]}>Son İşlemler</Text>
        </TouchableOpacity>
      </View>

      {tab === 'leaderboard' ? (
        <FlatList
          data={members}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
          renderItem={({ item, index }) => {
            const isMe = item.user_id === user?.id;
            return (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: colors.surface, borderColor: isMe ? colors.accent : colors.border }]}
                onPress={() => viewMemberPortfolio(item)}
              >
                <Text style={styles.rank}>{medalEmoji(index + 1)}</Text>
                <View style={styles.info}>
                  <Text style={[styles.username, { color: colors.text }]}>{item.profile?.username || 'Kullanıcı'} {isMe && <Text style={[styles.meTag, { color: colors.accent }]}>(Sen)</Text>}</Text>
                  <Text style={[styles.detail, { color: colors.subtext }]}>
                    Nakit: {item.cash_balance?.toLocaleString('tr-TR')} ₺ • Portföy: {formatCurrency(item.portfolio_value || 0)}
                  </Text>
                </View>
                <Text style={[styles.total, { color: colors.text }]}>{formatCurrency(item.total_value || 0)}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>Ligde henüz kimse yok.</Text>}
        />
      ) : (
        <FlatList
          data={recentTrades}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>Henüz işlem yapılmadı.</Text>}
          renderItem={({ item }) => {
            const isBuy = item.type === 'buy';
            const isMe = item.user_id === user?.id;
            const date = new Date(item.created_at);
            const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('tr-TR');
            return (
              <View style={[styles.tradeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.typeBadge, { backgroundColor: isBuy ? colors.accentBg : colors.dangerBg }]}>
                  <Text style={[styles.typeText, { color: isBuy ? colors.accent : colors.danger }]}>{isBuy ? 'AL' : 'SAT'}</Text>
                </View>
                <View style={styles.tradeInfo}>
                  <Text style={[styles.tradeUser, { color: isMe ? colors.accent : colors.text }]}>
                    {item.profile?.username || 'Kullanıcı'}{isMe ? ' (Sen)' : ''}
                  </Text>
                  <Text style={[styles.tradeDetail, { color: colors.subtext }]}>
                    {item.stock_symbol} • {item.quantity} adet × {formatCurrency(item.price)}
                  </Text>
                </View>
                <View style={styles.tradeRight}>
                  <Text style={[styles.tradeTotal, { color: isBuy ? colors.danger : colors.accent }]}>
                    {isBuy ? '-' : '+'}{formatCurrency(item.total_amount)}
                  </Text>
                  <Text style={[styles.tradeDate, { color: colors.subtext }]}>{dateStr} {timeStr}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Member Portfolio Modal */}
      <Modal visible={selectedMember !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedMember?.profile?.username || 'Kullanıcı'}'nin Portföyü</Text>
              <TouchableOpacity onPress={() => setSelectedMember(null)}>
                <Text style={[styles.closeBtn, { color: colors.subtext }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { color: colors.subtext }]}>Nakit: {selectedMember?.cash_balance?.toLocaleString('tr-TR')} ₺</Text>

            {portfolioLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
            ) : memberPortfolio.length === 0 ? (
              <Text style={[styles.empty, { color: colors.subtext }]}>Portföy boş.</Text>
            ) : (
              <ScrollView style={styles.portfolioList}>
                {memberPortfolio.map(p => (
                  <View key={p.id} style={[styles.portfolioRow, { borderBottomColor: colors.surfaceAlt }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pSymbol, { color: colors.text }]}>{p.stock_symbol}</Text>
                      <Text style={[styles.pName, { color: colors.subtext }]}>{p.stock_name}</Text>
                    </View>
                    <View style={styles.pRight}>
                      <Text style={[styles.pQty, { color: colors.subtext }]}>{p.quantity} adet</Text>
                      <Text style={[styles.pValue, { color: colors.text }]}>{formatCurrency(p.current_value)}</Text>
                      {(() => {
                        const pl = (p.current_price - p.avg_buy_price) * p.quantity;
                        const plPct = p.avg_buy_price > 0 ? ((p.current_price - p.avg_buy_price) / p.avg_buy_price) * 100 : 0;
                        const pos = pl >= 0;
                        return (
                          <Text style={[styles.pPL, { color: pos ? colors.accent : colors.danger }]}>
                            {pos ? '+' : ''}{formatCurrency(pl)} ({pos ? '+' : ''}{plPct.toFixed(2)}%)
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  leagueName: { fontSize: 13, marginBottom: 12 },
  noLeague: { fontSize: 16 },
  tabRow: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  tabBtn: { flex: 1, padding: 10, alignItems: 'center' },
  tabBtnText: { fontWeight: 'bold', fontSize: 13 },
  row: { borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  rank: { fontSize: 20, width: 40 },
  info: { flex: 1 },
  username: { fontWeight: 'bold', fontSize: 15 },
  meTag: { fontSize: 12 },
  detail: { fontSize: 11, marginTop: 2 },
  total: { fontWeight: 'bold', fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  tradeRow: { borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, gap: 10 },
  typeBadge: { width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  typeText: { fontWeight: 'bold', fontSize: 11 },
  tradeInfo: { flex: 1 },
  tradeUser: { fontWeight: 'bold', fontSize: 13 },
  tradeDetail: { fontSize: 12, marginTop: 2 },
  tradeRight: { alignItems: 'flex-end' },
  tradeTotal: { fontWeight: 'bold', fontSize: 13 },
  tradeDate: { fontSize: 10, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: 'bold' },
  closeBtn: { fontSize: 18, padding: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  portfolioList: { maxHeight: 300 },
  portfolioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  pSymbol: { fontWeight: 'bold' },
  pName: { fontSize: 12 },
  pRight: { alignItems: 'flex-end' },
  pQty: { fontSize: 12 },
  pValue: { fontWeight: 'bold' },
  pPL: { fontSize: 11, marginTop: 1 },
});
