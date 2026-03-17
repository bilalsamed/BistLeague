import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { createLeague, joinLeagueByCode } from '../../services/dbService';

type Step = 'welcome' | 'create' | 'join';

export default function OnboardingScreen() {
  const { user } = useAuth();
  const { refreshLeagues } = useLeague();
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  const [leagueName, setLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!leagueName.trim() || !user) return;
    setError(null);
    setLoading(true);
    const league = await createLeague(leagueName.trim(), user.id);
    setLoading(false);
    if (league) {
      await refreshLeagues();
    } else {
      setError('Lig oluşturulamadı. Tekrar dene.');
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !user) return;
    setError(null);
    setLoading(true);
    const result = await joinLeagueByCode(joinCode.trim(), user.id);
    setLoading(false);
    if (result.success) {
      await refreshLeagues();
    } else {
      setError(result.error || 'Geçersiz kod.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>📈</Text>
        <Text style={[styles.title, { color: colors.text }]}>BistLeague'e Hoş Geldin!</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          BIST hisselerini takip et, sanal portföy oluştur ve arkadaşlarınla yarış.
        </Text>

        {step === 'welcome' && (
          <View style={styles.stepContainer}>
            <View style={[styles.featureList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FeatureRow icon="💹" text="Gerçek zamanlı BIST hisse fiyatları" colors={colors} />
              <FeatureRow icon="💼" text="100.000 ₺ sanal bütçeyle başla" colors={colors} />
              <FeatureRow icon="🏆" text="Lig oluştur, arkadaşlarını davet et" colors={colors} />
              <FeatureRow icon="📊" text="Sıralama tablosu ve portföy analizi" colors={colors} />
              <FeatureRow icon="💬" text="Lig içi sohbet" colors={colors} last />
            </View>

            <Text style={[styles.stepLabel, { color: colors.subtext }]}>Başlamak için bir lig oluştur veya mevcut bir lige katıl:</Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              onPress={() => setStep('create')}
            >
              <Text style={styles.primaryBtnText}>+ Yeni Lig Oluştur</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setStep('join')}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Lig Kodumu Var</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'create' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Yeni Lig Oluştur</Text>
            <Text style={[styles.stepDesc, { color: colors.subtext }]}>
              Ligin için bir isim seç. Oluşturulduktan sonra arkadaşlarını davet edebilirsin.
            </Text>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Lig adı (örn: Okul Arkadaşları)"
              placeholderTextColor={colors.subtext}
              value={leagueName}
              onChangeText={setLeagueName}
              maxLength={40}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: !leagueName.trim() ? 0.5 : 1 }]}
              onPress={handleCreate}
              disabled={loading || !leagueName.trim()}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Oluştur</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLink} onPress={() => { setStep('welcome'); setError(null); setLeagueName(''); }}>
              <Text style={[styles.backLinkText, { color: colors.subtext }]}>← Geri</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'join' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Lige Katıl</Text>
            <Text style={[styles.stepDesc, { color: colors.subtext }]}>
              Arkadaşından aldığın 6 haneli lig kodunu gir.
            </Text>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="6 haneli kod (örn: AB12CD)"
              placeholderTextColor={colors.subtext}
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: joinCode.length < 6 ? 0.5 : 1 }]}
              onPress={handleJoin}
              disabled={loading || joinCode.length < 6}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Katıl</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLink} onPress={() => { setStep('welcome'); setError(null); setJoinCode(''); }}>
              <Text style={[styles.backLinkText, { color: colors.subtext }]}>← Geri</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FeatureRow({ icon, text, colors, last }: { icon: string; text: string; colors: any; last?: boolean }) {
  return (
    <View style={[styles.featureRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingTop: 80, paddingHorizontal: 28, paddingBottom: 40, alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  stepContainer: { width: '100%' },
  featureList: { borderRadius: 14, borderWidth: 1, marginBottom: 28, overflow: 'hidden' },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  featureIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  featureText: { fontSize: 14, flex: 1 },
  stepLabel: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  primaryBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1 },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  stepTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  stepDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  errorBox: { borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1 },
  errorText: { fontSize: 14, textAlign: 'center' },
  input: { borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 16, borderWidth: 1 },
  backLink: { alignItems: 'center', marginTop: 8, padding: 8 },
  backLinkText: { fontSize: 14 },
});
