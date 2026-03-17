import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, sendPasswordReset } = useAuth();
  const { colors } = useTheme();

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError('E-posta ve şifre giriniz.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(error.message);
    } catch (e: any) {
      setError(e?.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={[styles.logo, { color: colors.accent }]}>📈 BistLeague</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Borsa yarışmasına hoş geldin</Text>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="E-posta"
          placeholderTextColor={colors.subtext}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, marginBottom: 0, flex: 1 }]}
            placeholder="Şifre"
            placeholderTextColor={colors.subtext}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            <Text style={[styles.eyeIcon, { color: colors.subtext }]}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setShowReset(!showReset); setResetSent(false); }}>
          <Text style={[styles.link, { color: colors.subtext, marginBottom: 12 }]}>Şifreni mi unuttun? <Text style={[styles.linkBold, { color: colors.accent }]}>Sıfırla</Text></Text>
        </TouchableOpacity>

        {showReset && (
          <View style={[styles.resetBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {resetSent ? (
              <Text style={{ color: '#22c55e', textAlign: 'center', fontSize: 14 }}>Şifre sıfırlama linki e-postana gönderildi.</Text>
            ) : (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border, marginBottom: 10 }]}
                  placeholder="E-posta adresin"
                  placeholderTextColor={colors.subtext}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.accent }]}
                  disabled={resetLoading}
                  onPress={async () => {
                    if (!resetEmail) return;
                    setResetLoading(true);
                    const { error } = await sendPasswordReset(resetEmail.trim());
                    setResetLoading(false);
                    if (!error) setResetSent(true);
                    else setError(error.message);
                  }}
                >
                  {resetLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Link Gönder</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={[styles.link, { color: colors.subtext }]}>Hesabın yok mu? <Text style={[styles.linkBold, { color: colors.accent }]}>Kayıt Ol</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32 },
  errorBanner: { borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 14, textAlign: 'center' },
  input: { borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },
  eyeIcon: { fontSize: 18 },
  button: { borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { textAlign: 'center', fontSize: 14 },
  linkBold: { fontWeight: 'bold' },
  resetBox: { borderRadius: 10, padding: 16, marginBottom: 16, borderWidth: 1 },
});
