import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { createLeague, joinLeagueByCode } from '../../services/dbService';
import { League } from '../../types';

export default function LeaguesScreen({ navigation }: any) {
  const { user } = useAuth();
  const { selectedLeague, leagues, loadingLeagues, selectLeague, refreshLeagues } = useLeague();
  const { colors } = useTheme();
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
    Alert.alert('Kopyalandı!', `Lig kodu "${code}" panoya kopyalandı.`);
  }

  async function shareLeague(league: League) {
    try {
      await Share.share({
        message: `BistLeague'e katıl! "${league.name}" ligine katılmak için lig kodunu kullan: ${league.code}\n\nApp'i indir ve hemen oyna!`,
        title: `BistLeague — ${league.name}`,
      });
    } catch {
      // user cancelled
    }
  }

  async function handleSelectLeague(league: League) {
    await selectLeague(league);
  }

  if (loadingLeagues) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Liglerim</Text>

      {selectedLeague && (
        <View style={[styles.activeLeague, { backgroundColor: colors.accentBg, borderLeftColor: colors.accent }]}>
          <Text style={[styles.activeText, { color: colors.subtext }]}>Aktif Lig: <Text style={[styles.activeName, { color: colors.accent }]}>{selectedLeague.name}</Text></Text>
          <Text style={[styles.activeCode, { color: colors.subtext }]}>Kod: {selectedLeague.code}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={() => setCreateModal(true)}>
          <Text style={styles.actionBtnText}>+ Lig Oluştur</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.joinBtn]} onPress={() => setJoinModal(true)}>
          <Text style={styles.actionBtnText}>Lige Katıl</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={leagues}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshLeagues} tintColor={colors.accent} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>Henüz bir ligde değilsin. Lig oluştur veya katıl!</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.leagueCard, { backgroundColor: colors.surface, borderColor: selectedLeague?.id === item.id ? colors.accent : colors.border }]}
            onPress={() => handleSelectLeague(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.leagueName, { color: colors.text }]}>{item.name}</Text>
              <View style={styles.codeRow}>
                <Text style={[styles.leagueCode, { color: colors.subtext }]}>Kod: {item.code}</Text>
                <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => copyCode(item.code)}>
                  <Text style={[styles.copyBtnText, { color: colors.accent }]}>Kopyala</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn} onPress={() => shareLeague(item)}>
                  <Text style={styles.shareBtnText}>Paylaş</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.leagueBalance, { color: colors.subtext }]}>Başlangıç: {item.starting_balance.toLocaleString('tr-TR')} ₺</Text>
            </View>
            {selectedLeague?.id === item.id && (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text style={styles.badgeText}>Aktif</Text></View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Create League Modal */}
      <Modal visible={createModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Lig Oluştur</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              placeholder="Lig adı"
              placeholderTextColor={colors.subtext}
              value={newLeagueName}
              onChangeText={setNewLeagueName}
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

      {/* Join League Modal */}
      <Modal visible={joinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Lige Katıl</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              placeholder="6 haneli lig kodu"
              placeholderTextColor={colors.subtext}
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              maxLength={6}
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
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  activeLeague: { borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3 },
  activeText: { fontSize: 13 },
  activeName: { fontWeight: 'bold' },
  activeCode: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  joinBtn: { backgroundColor: '#1f6feb' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  leagueCard: { borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },
  leagueName: { fontWeight: 'bold', fontSize: 16 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  leagueCode: { fontSize: 13 },
  copyBtn: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  copyBtnText: { fontSize: 11, fontWeight: 'bold' },
  shareBtn: { backgroundColor: '#1f3a5f', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  shareBtnText: { color: '#58a6ff', fontSize: 11, fontWeight: 'bold' },
  leagueBalance: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 32 },
  modal: { borderRadius: 14, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalInput: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  cancelText: { fontWeight: 'bold' },
  confirmBtn: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: 'bold' },
});
