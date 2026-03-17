import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { scheduleMarketNotifications, cancelMarketNotifications, requestNotificationPermission } from '../../services/notificationService';
import * as Notifications from 'expo-notifications';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const { selectedLeague, membership } = useLeague();
  const { colors, isDark, toggleTheme } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    checkNotifStatus();
  }, []);

  async function checkNotifStatus() {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    setNotifEnabled(scheduled.some(n => n.content.data?.type === 'market_open'));
  }

  async function toggleNotifications() {
    if (notifEnabled) {
      await cancelMarketNotifications();
      setNotifEnabled(false);
    } else {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      await scheduleMarketNotifications();
      setNotifEnabled(true);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
        <Text style={styles.avatarText}>{profile?.username?.[0]?.toUpperCase() || '?'}</Text>
      </View>
      <Text style={[styles.username, { color: colors.text }]}>{profile?.username}</Text>
      <Text style={[styles.email, { color: colors.subtext }]}>{profile?.email}</Text>

      {selectedLeague && membership && (
        <View style={[styles.leagueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.subtext }]}>Aktif Lig</Text>
          <Text style={[styles.cardLeague, { color: colors.accent }]}>{selectedLeague.name}</Text>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Nakit</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{membership.cash_balance?.toLocaleString('tr-TR')} ₺</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Lig Kodu</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{selectedLeague.code}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={[styles.info, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoLabel, { color: colors.subtext }]}>Üyelik Tarihi</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('tr-TR') : '—'}</Text>
      </View>

      {/* Theme Toggle */}
      <TouchableOpacity
        style={[styles.themeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={toggleTheme}
      >
        <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
        <Text style={[styles.themeLabel, { color: colors.text }]}>{isDark ? 'Açık Tema' : 'Koyu Tema'}</Text>
        <View style={[styles.themeToggle, { backgroundColor: isDark ? colors.surfaceAlt : colors.accent }]}>
          <View style={[styles.themeToggleThumb, { marginLeft: isDark ? 2 : 18 }]} />
        </View>
      </TouchableOpacity>

      {/* Notifications Toggle */}
      {Platform.OS !== 'web' && (
        <TouchableOpacity
          style={[styles.themeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={toggleNotifications}
        >
          <Text style={styles.themeIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.themeLabel, { color: colors.text }]}>Borsa Bildirimleri</Text>
            <Text style={[{ fontSize: 11, color: colors.subtext }]}>Açılış 10:00 • Kapanış 18:00</Text>
          </View>
          <View style={[styles.themeToggle, { backgroundColor: notifEnabled ? colors.accent : colors.surfaceAlt }]}>
            <View style={[styles.themeToggleThumb, { marginLeft: notifEnabled ? 18 : 2 }]} />
          </View>
        </TouchableOpacity>
      )}

      {confirming ? (
        <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.dangerBg }]}>
          <Text style={[styles.confirmText, { color: colors.text }]}>Çıkış yapmak istediğine emin misin?</Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => setConfirming(false)}>
              <Text style={[styles.cancelText, { color: colors.subtext }]}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.signOutConfirmBtn, { backgroundColor: colors.dangerBg }]} onPress={signOut}>
              <Text style={[styles.signOutText, { color: colors.danger }]}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.dangerBg }]} onPress={() => setConfirming(true)}>
          <Text style={[styles.signOutText, { color: colors.danger }]}>Çıkış Yap</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 24, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  username: { fontSize: 22, fontWeight: 'bold' },
  email: { fontSize: 14, marginBottom: 24 },
  leagueCard: { borderRadius: 14, padding: 16, width: '100%', marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 12, marginBottom: 4 },
  cardLeague: { fontWeight: 'bold', fontSize: 16, marginBottom: 12 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 12 },
  statValue: { fontWeight: 'bold', fontSize: 15, marginTop: 2 },
  info: { width: '100%', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14 },
  themeBtn: { width: '100%', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  themeIcon: { fontSize: 20 },
  themeLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  themeToggle: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center' },
  themeToggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  confirmBox: { marginTop: 'auto', marginBottom: 40, borderRadius: 12, padding: 16, width: '100%', borderWidth: 1 },
  confirmText: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  confirmButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  cancelText: { fontWeight: 'bold' },
  signOutConfirmBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  signOutBtn: { marginTop: 'auto', marginBottom: 40, borderRadius: 12, padding: 15, width: '100%', alignItems: 'center' },
  signOutText: { fontWeight: 'bold', fontSize: 15 },
});
