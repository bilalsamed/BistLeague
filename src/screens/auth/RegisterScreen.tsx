import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const { signUp } = useAuth();
  const { colors } = useTheme();

  async function handleRegister() {
    setMessage(null);
    if (!username || !email || !password) {
      setMessage({ text: 'Tüm alanları doldurunuz.', type: 'error' });
      return;
    }
    if (password !== passwordConfirm) {
      setMessage({ text: 'Şifreler eşleşmiyor.', type: 'error' });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'Şifre en az 6 karakter olmalıdır.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email.trim(), password, username.trim());
      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else {
        setMessage({ text: 'Kayıt başarılı! Giriş yapabilirsin.', type: 'success' });
        setTimeout(() => navigation.navigate('Login'), 1500);
      }
    } catch (e: any) {
      setMessage({ text: e?.message || 'Bir hata oluştu.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={[styles.logo, { color: colors.accent }]}>📈 BistLeague</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Yeni hesap oluştur</Text>

        {message && (
          <View style={[
            styles.messageBanner,
            message.type === 'error'
              ? { backgroundColor: colors.dangerBg, borderColor: colors.danger }
              : { backgroundColor: colors.accentBg, borderColor: colors.accent },
            { borderWidth: 1 },
          ]}>
            <Text style={[styles.messageText, { color: message.type === 'error' ? colors.danger : colors.accent }]}>{message.text}</Text>
          </View>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Kullanıcı Adı"
          placeholderTextColor={colors.subtext}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="E-posta"
          placeholderTextColor={colors.subtext}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Şifre"
          placeholderTextColor={colors.subtext}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Şifre Tekrar"
          placeholderTextColor={colors.subtext}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Kayıt Ol</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.link, { color: colors.subtext }]}>Zaten hesabın var mı? <Text style={[styles.linkBold, { color: colors.accent }]}>Giriş Yap</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  logo: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  messageBanner: { borderRadius: 10, padding: 12, marginBottom: 16 },
  messageText: { fontSize: 14, textAlign: 'center' },
  input: { borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1 },
  button: { borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { textAlign: 'center', fontSize: 14 },
  linkBold: { fontWeight: 'bold' },
});
