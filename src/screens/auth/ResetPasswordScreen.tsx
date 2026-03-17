import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { updatePassword } = useAuth();
  const { colors } = useTheme();

  async function handleUpdate() {
    setError(null);
    if (!password || password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) setError(error.message);
    else setSuccess(true);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.text }]}>Yeni Şifre Belirle</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Hesabın için yeni bir şifre oluştur</Text>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={[styles.successBanner, { backgroundColor: '#0d2e1a', borderColor: '#22c55e' }]}>
            <Text style={[styles.successText, { color: '#22c55e' }]}>Şifren güncellendi! Giriş yapabilirsin.</Text>
          </View>
        )}

        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, marginBottom: 0, flex: 1 }]}
            placeholder="Yeni şifre"
            placeholderTextColor={colors.subtext}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            <Text style={[styles.eyeIcon, { color: colors.subtext }]}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, marginBottom: 0, flex: 1 }]}
            placeholder="Şifreyi tekrarla"
            placeholderTextColor={colors.subtext}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
            <Text style={[styles.eyeIcon, { color: colors.subtext }]}>{showConfirm ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={handleUpdate}
          disabled={loading || success}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Şifreyi Güncelle</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32 },
  errorBanner: { borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 14, textAlign: 'center' },
  successBanner: { borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1 },
  successText: { fontSize: 14, textAlign: 'center' },
  input: { borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },
  eyeIcon: { fontSize: 18 },
  button: { borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
