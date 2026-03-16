import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserTransactions } from '../../services/dbService';
import { formatCurrency } from '../../services/stockService';
import { Transaction } from '../../types';

export default function HistoryScreen() {
  const { user } = useAuth();
  const { selectedLeague } = useLeague();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!user || !selectedLeague) { setLoading(false); return; }
    const data = await getUserTransactions(user.id, selectedLeague.id);
    setTransactions(data);
    setLoading(false);
    setRefreshing(false);
  }, [user, selectedLeague]);

  useFocusEffect(useCallback(() => { loadTransactions(); }, [loadTransactions]));

  if (!selectedLeague) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.noLeague, { color: colors.subtext }]}>İşlem geçmişi için bir lig seç</Text>
    </View>
  );

  if (loading) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.accent} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>İşlem Geçmişi</Text>
      <Text style={[styles.leagueName, { color: colors.subtext }]}>{selectedLeague.name}</Text>

      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTransactions(); }} tintColor={colors.accent} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>Henüz işlem yapılmadı.</Text>}
        renderItem={({ item }) => {
          const isBuy = item.type === 'buy';
          const date = new Date(item.created_at);
          const dateStr = date.toLocaleDateString('tr-TR');
          const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.typeBadge, { backgroundColor: isBuy ? colors.accentBg : colors.dangerBg }]}>
                <Text style={[styles.typeText, { color: isBuy ? colors.accent : colors.danger }]}>{isBuy ? 'AL' : 'SAT'}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardSymbol, { color: colors.text }]}>{item.stock_symbol} <Text style={[styles.cardName, { color: colors.subtext }]}>{item.stock_name}</Text></Text>
                <Text style={[styles.cardDetail, { color: colors.subtext }]}>{item.quantity} adet × {formatCurrency(item.price)}</Text>
                <Text style={[styles.cardCommission, { color: colors.subtext }]}>Komisyon: {formatCurrency(item.commission)}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardTotal, { color: isBuy ? colors.danger : colors.accent }]}>
                  {isBuy ? '-' : '+'}{formatCurrency(item.total_amount)}
                </Text>
                <Text style={[styles.cardDate, { color: colors.subtext }]}>{dateStr}</Text>
                <Text style={[styles.cardDate, { color: colors.subtext }]}>{timeStr}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  leagueName: { fontSize: 13, marginBottom: 16 },
  noLeague: { fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  card: { borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, gap: 12 },
  typeBadge: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  typeText: { fontWeight: 'bold', fontSize: 12 },
  cardInfo: { flex: 1 },
  cardSymbol: { fontWeight: 'bold', fontSize: 14 },
  cardName: { fontWeight: 'normal', fontSize: 12 },
  cardDetail: { fontSize: 12, marginTop: 2 },
  cardCommission: { fontSize: 11, marginTop: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardTotal: { fontWeight: 'bold', fontSize: 14 },
  cardDate: { fontSize: 11 },
});
