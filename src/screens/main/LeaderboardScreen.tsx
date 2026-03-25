import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal, ScrollView, TextInput, Alert, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { getLeagueLeaderboard, getUserPortfolio, getLeagueRecentTransactions, createLeague, joinLeagueByCode, getLeagueSnapshots, saveLeagueSnapshots, LeagueSnapshot } from '../../services/dbService';
import { fetchStockQuotes, formatCurrency, BIST_STOCKS } from '../../services/stockService';
import { LeagueMember, League } from '../../types';
import LeagueChart from '../../components/LeagueChart';

type Tab = 'leaderboard' | 'trades' | 'chart';

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { selectedLeague, leagues, selectLeague, refreshLeagues } = useLeague();
  const { colors } = useTheme();
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [leagueSnapshots, setLeagueSnapshots] = useState<LeagueSnapshot[]>([]);
  const [yesterdayRanks, setYesterdayRanks] = useState<Record<string, number>>({});
  const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('leaderboard');

  // Member portfolio modal
  const [selectedMember, setSelectedMember] = useState<LeagueMember | null>(null);
  const [memberPortfolio, setMemberPortfolio] = useState<any[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // League modals
  const [leagueListModal, setLeagueListModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedLeague) { setLoading(false); return; }
    const [data, trades, snaps] = await Promise.all([
      getLeagueLeaderboard(selectedLeague.id),
      getLeagueRecentTransactions(selectedLeague.id),
      getLeagueSnapshots(selectedLeague.id, 30),
    ]);
    setMembers(data);
    setRecentTrades(trades);

    // Otomatik snapshot: liderboard açılınca tüm üyelerin bugünkü değeri kaydedilir
    if (data.length > 0) {
      saveLeagueSnapshots(selectedLeague.id, data.map(m => ({ user_id: m.user_id, total_value: m.total_value || 0 })));
    }

    // Enrich snapshots with usernames from members
    const enriched = snaps.map(s => ({
      ...s,
      username: data.find(m => m.user_id === s.user_id)?.profile?.username || s.user_id.slice(0, 6),
    }));
    setLeagueSnapshots(enriched);

    // Group each user's snapshots sorted by date
    const byUser = new Map<string, LeagueSnapshot[]>();
    for (const s of snaps) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    }
    byUser.forEach(arr => arr.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)));

    // Daily change: each user's last two snapshots
    const daily: Record<string, number> = {};
    byUser.forEach((arr, uid) => {
      if (arr.length >= 2) {
        const prev = arr[arr.length - 2].total_value;
        const curr = arr[arr.length - 1].total_value;
        if (prev > 0) daily[uid] = ((curr - prev) / prev) * 100;
      }
    });
    setDailyChanges(daily);

    // Yesterday's ranks: use second-to-last global date
    const sortedDates = [...new Set(snaps.map(s => s.snapshot_date))].sort();
    const ydDate = sortedDates[sortedDates.length - 2] || '';
    const ydSnaps = snaps.filter(s => s.snapshot_date === ydDate);
    const ydSorted = [...ydSnaps].sort((a, b) => b.total_value - a.total_value);
    const ranks: Record<string, number> = {};
    ydSorted.forEach((s, i) => { ranks[s.user_id] = i + 1; });
    setYesterdayRanks(ranks);

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

  async function handleCreate() {
    if (!newLeagueName.trim() || !user) return;
    setActionLoading(true);
    const league = await createLeague(newLeagueName.trim(), user.id);
    setActionLoading(false);
    if (league) {
      setCreateModal(false);
      setNewLeagueName('');
      await refreshLeagues();
      Alert.alert('Lig Oluşturuldu!', `Lig kodu: ${league.code}\nBu kodu arkadaşlarınla paylaş.`);
    } else {
      Alert.alert('Hata', 'Lig oluşturulamadı.');
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !user) return;
    setActionLoading(true);
    const result = await joinLeagueByCode(joinCode.trim(), user.id);
    setActionLoading(false);
    if (result.success) {
      setJoinModal(false);
      setJoinCode('');
      await refreshLeagues();
      Alert.alert('Başarılı!', `"${result.league?.name}" ligine katıldın!`);
    } else {
      Alert.alert('Hata', result.error);
    }
  }

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    Alert.alert('Kopyalandı!', `"${code}" panoya kopyalandı.`);
  }

  async function shareLeague(league: League) {
    try {
      await Share.share({
        message: `BistLeague'e katıl! "${league.name}" ligine katılmak için kod: ${league.code}`,
        title: `BistLeague — ${league.name}`,
      });
    } catch { }
  }

  const medalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Sıralama</Text>
        {/* Active league selector */}
        <View style={styles.leagueRow}>
          <Text style={[styles.leagueLabel, { color: colors.subtext }]}>Aktif Lig</Text>
          <TouchableOpacity
            style={[styles.leagueChip, { backgroundColor: colors.surface, borderColor: colors.accent }]}
            onPress={() => setLeagueListModal(true)}
          >
            <Text style={[styles.leagueChipText, { color: selectedLeague ? colors.accent : colors.subtext }]} numberOfLines={1}>
              {selectedLeague ? selectedLeague.name : 'Lig seçilmedi'}
            </Text>
            <Text style={[styles.leagueChipArrow, { color: colors.subtext }]}>▾</Text>
          </TouchableOpacity>
        </View>
        {/* Action buttons */}
        <View style={styles.headerBtns}>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.accent }]} onPress={() => setCreateModal(true)}>
            <Text style={styles.smallBtnText}>+ Lig Oluştur</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setJoinModal(true)}>
            <Text style={[styles.smallBtnText, { color: colors.text }]}>Lige Katıl</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Row */}
      <View style={[styles.tabRow, { borderColor: colors.border }]}>
        {(['leaderboard', 'trades', 'chart'] as Tab[]).map(t => {
          const labels: Record<Tab, string> = { leaderboard: '🏅 Sıralama', trades: '🔄 Son İşlemler', chart: '📈 Grafik' };
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, { color: tab === t ? colors.accent : colors.subtext }]}>{labels[t]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* No league */}
      {!selectedLeague ? (
        <View style={styles.center}>
          <Text style={[styles.noLeague, { color: colors.subtext }]}>Yukarıdan bir lig seç veya oluştur</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : tab === 'leaderboard' ? (
        <FlatList
          data={members}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
          renderItem={({ item, index }) => {
            const isMe = item.user_id === user?.id;
            const currentRank = index + 1;
            const prevRank = yesterdayRanks[item.user_id];
            const diff = prevRank != null ? prevRank - currentRank : null;
            const start = selectedLeague?.starting_balance || 100000;
            const total = item.total_value || 0;
            const totalPct = ((total - start) / start) * 100;
            const dayPct = dailyChanges[item.user_id];
            return (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: colors.surface, borderColor: isMe ? colors.accent : colors.border }]}
                onPress={() => viewMemberPortfolio(item)}
              >
                <View style={styles.rankCol}>
                  <Text style={[styles.rank, { color: colors.text }]}>{medalEmoji(currentRank)}</Text>
                  {diff != null && (
                    <Text style={[styles.rankBadge, { color: diff > 0 ? colors.accent : diff < 0 ? colors.danger : colors.subtext }]}>
                      {diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : '—'}
                    </Text>
                  )}
                </View>
                <View style={styles.info}>
                  <Text style={[styles.username, { color: colors.text }]}>
                    {item.profile?.username || 'Kullanıcı'}
                    {isMe && <Text style={[styles.meTag, { color: colors.accent }]}> (Sen)</Text>}
                  </Text>
                  <Text style={[styles.detail, { color: colors.subtext }]}>
                    {formatCurrency(total)} • {item.cash_balance?.toLocaleString('tr-TR')} ₺ nakit
                  </Text>
                </View>
                <View style={styles.pctCol}>
                  <Text style={[styles.totalVal, { color: colors.text }]}>{formatCurrency(total)}</Text>
                  <Text style={[styles.totalPct, { color: totalPct >= 0 ? colors.accent : colors.danger }]}>
                    {totalPct >= 0 ? '+' : ''}{totalPct.toFixed(2)}%
                  </Text>
                  {dayPct != null && (
                    <Text style={[styles.dayPct, { color: dayPct >= 0 ? colors.accent : colors.danger }]}>
                      Günlük {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>Ligde henüz kimse yok.</Text>}
        />
      ) : tab === 'chart' ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {leagueSnapshots.length < 2 ? (
            <View style={styles.center}>
              <Text style={[styles.noLeague, { color: colors.subtext }]}>Grafik için en az 2 günlük veri gerekli.</Text>
            </View>
          ) : (
            <View style={[styles.chartSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.chartSectionTitle, { color: colors.text }]}>Portföy Geçmişi</Text>
              <Text style={[styles.chartSectionSub, { color: colors.subtext }]}>Tüm lig üyeleri • Son 30 gün</Text>
              <LeagueChart snapshots={leagueSnapshots} colors={colors} />
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={recentTrades}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>Henüz işlem yapılmadı.</Text>}
          renderItem={({ item }) => {
            const isBuy = item.type === 'buy';
            const isMe = item.user_id === user?.id;
            const date = new Date(item.created_at);
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
                  <Text style={[styles.tradeDate, { color: colors.subtext }]}>
                    {date.toLocaleDateString('tr-TR')} {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* League List Modal */}
      <Modal visible={leagueListModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Liglerim</Text>
              <TouchableOpacity onPress={() => setLeagueListModal(false)}>
                <Text style={[styles.closeBtn, { color: colors.subtext }]}>✕</Text>
              </TouchableOpacity>
            </View>
            {leagues.length === 0 ? (
              <Text style={[styles.empty, { color: colors.subtext }]}>Henüz bir ligde değilsin.</Text>
            ) : (
              <ScrollView>
                {leagues.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.leagueListRow, { borderColor: selectedLeague?.id === item.id ? colors.accent : colors.border, backgroundColor: selectedLeague?.id === item.id ? colors.accentBg : colors.bg }]}
                    onPress={() => { selectLeague(item); setLeagueListModal(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lgName, { color: colors.text }]}>{item.name}</Text>
                      <View style={styles.codeRow}>
                        <Text style={[styles.lgCode, { color: colors.subtext }]}>Kod: {item.code}</Text>
                        <TouchableOpacity onPress={() => copyCode(item.code)}>
                          <Text style={[styles.copyBtnText, { color: colors.accent }]}>Kopyala</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => shareLeague(item)}>
                          <Text style={[styles.copyBtnText, { color: '#58a6ff' }]}>Paylaş</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {selectedLeague?.id === item.id && (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.badgeText}>Aktif</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
                {memberPortfolio.map(p => {
                  const pl = (p.current_price - p.avg_buy_price) * p.quantity;
                  const plPct = p.avg_buy_price > 0 ? ((p.current_price - p.avg_buy_price) / p.avg_buy_price) * 100 : 0;
                  const pos = pl >= 0;
                  return (
                    <View key={p.id} style={[styles.portfolioRow, { borderBottomColor: colors.surfaceAlt }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pSymbol, { color: colors.text }]}>{p.stock_symbol}</Text>
                        <Text style={[styles.pName, { color: colors.subtext }]}>{p.stock_name}</Text>
                      </View>
                      <View style={styles.pRight}>
                        <Text style={[styles.pQty, { color: colors.subtext }]}>{p.quantity} adet</Text>
                        <Text style={[styles.pValue, { color: colors.text }]}>{formatCurrency(p.current_value)}</Text>
                        <Text style={[styles.pPL, { color: pos ? colors.accent : colors.danger }]}>
                          {pos ? '+' : ''}{formatCurrency(pl)} ({pos ? '+' : ''}{plPct.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Lig Oluştur</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              placeholder="Lig adı" placeholderTextColor={colors.subtext}
              value={newLeagueName} onChangeText={setNewLeagueName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => { setCreateModal(false); setNewLeagueName(''); }}>
                <Text style={[styles.cancelText, { color: colors.subtext }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.accent }]} onPress={handleCreate} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Oluştur</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Modal */}
      <Modal visible={joinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Lige Katıl</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              placeholder="6 haneli lig kodu" placeholderTextColor={colors.subtext}
              value={joinCode} onChangeText={setJoinCode}
              autoCapitalize="characters" maxLength={6}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => { setJoinModal(false); setJoinCode(''); }}>
                <Text style={[styles.cancelText, { color: colors.subtext }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.accent }]} onPress={handleJoin} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Katıl</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 10 },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  leagueLabel: { fontSize: 11, fontWeight: '600' },
  headerBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  title: { fontSize: 22, fontWeight: 'bold' },
  leagueChip: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  leagueChipText: { flex: 1, fontSize: 13, fontWeight: '600' },
  leagueChipArrow: { fontSize: 11, marginLeft: 4 },
  smallBtn: { flex: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  smallBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 4 },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  noLeague: { fontSize: 15, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  row: { borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, gap: 10 },
  rankCol: { width: 36, alignItems: 'center' },
  rank: { fontSize: 18 },
  rankBadge: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  info: { flex: 1 },
  pctCol: { alignItems: 'flex-end' },
  totalVal: { fontWeight: 'bold', fontSize: 15 },
  totalPct: { fontSize: 11, marginTop: 2 },
  dayPct: { fontSize: 10, marginTop: 1 },
  chartSection: { borderRadius: 14, padding: 16, borderWidth: 1 },
  chartSectionTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  chartSectionSub: { fontSize: 11, marginBottom: 12 },
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
  // League list modal
  leagueListRow: { borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  lgName: { fontWeight: 'bold', fontSize: 15 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  lgCode: { fontSize: 12 },
  copyBtnText: { fontSize: 12, fontWeight: 'bold' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: 'bold' },
  closeBtn: { fontSize: 18, padding: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  modalInput: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  cancelText: { fontWeight: 'bold' },
  confirmBtn: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: 'bold' },
  portfolioList: { maxHeight: 320 },
  portfolioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  pSymbol: { fontWeight: 'bold' },
  pName: { fontSize: 12 },
  pRight: { alignItems: 'flex-end' },
  pQty: { fontSize: 12 },
  pValue: { fontWeight: 'bold' },
  pPL: { fontSize: 11, marginTop: 1 },
});
