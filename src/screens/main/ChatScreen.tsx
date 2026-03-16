import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnread } from '../../context/UnreadContext';
import { getLeagueMessages, sendLeagueMessage, LeagueMessage } from '../../services/dbService';
import { supabase } from '../../services/supabase';

export default function ChatScreen() {
  const { user, profile } = useAuth();
  const { selectedLeague } = useLeague();
  const { colors } = useTheme();
  const { resetChat } = useUnread();
  const [messages, setMessages] = useState<LeagueMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    if (!selectedLeague) { setLoading(false); return; }
    const data = await getLeagueMessages(selectedLeague.id);
    setMessages(data);
    setLoading(false);
  }, [selectedLeague]);

  useFocusEffect(useCallback(() => {
    resetChat();
    loadMessages();
  }, [loadMessages]));

  // Realtime subscription
  useEffect(() => {
    if (!selectedLeague) return;

    const channel = supabase
      .channel(`chat:${selectedLeague.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages', filter: `league_id=eq.${selectedLeague.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as LeagueMessage]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLeague?.id]);

  async function handleSend() {
    if (!text.trim() || !user || !selectedLeague || sending) return;
    const username = profile?.username || 'Kullanıcı';
    setSending(true);
    const result = await sendLeagueMessage(selectedLeague.id, user.id, username, text.trim());
    setSending(false);
    if (result.success) {
      setText('');
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  if (!selectedLeague) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.noLeague, { color: colors.subtext }]}>Sohbet için bir lig seç</Text>
    </View>
  );

  if (loading) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Sohbet</Text>
        <Text style={[styles.leagueName, { color: colors.subtext }]}>{selectedLeague.name}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>Henüz mesaj yok. İlk mesajı sen gönder!</Text>
        }
        renderItem={({ item, index }) => {
          const isMe = item.user_id === user?.id;
          const prevItem = index > 0 ? messages[index - 1] : null;
          const showDate = !prevItem || formatDate(item.created_at) !== formatDate(prevItem.created_at);
          const showName = !prevItem || prevItem.user_id !== item.user_id;

          return (
            <>
              {showDate && (
                <View style={styles.dateSep}>
                  <Text style={[styles.dateLabel, { color: colors.subtext, backgroundColor: colors.surface }]}>{formatDate(item.created_at)}</Text>
                </View>
              )}
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && showName && (
                  <Text style={[styles.msgSender, { color: colors.accent }]}>{item.username}</Text>
                )}
                <View style={[
                  styles.bubble,
                  isMe ? { backgroundColor: colors.accent } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}>
                  <Text style={[styles.bubbleText, { color: isMe ? '#fff' : colors.text }]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.subtext }]}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            </>
          );
        }}
      />

      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
          placeholder="Mesaj yaz..."
          placeholderTextColor={colors.subtext}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.accent : colors.surfaceAlt }]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noLeague: { fontSize: 16 },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: 'bold' },
  leagueName: { fontSize: 13, marginTop: 2 },
  list: { padding: 12, paddingBottom: 8 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  dateSep: { alignItems: 'center', marginVertical: 12 },
  dateLabel: { fontSize: 11, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  msgRow: { marginBottom: 4, maxWidth: '80%' },
  msgRowMe: { alignSelf: 'flex-end' },
  msgSender: { fontSize: 11, fontWeight: 'bold', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 3, textAlign: 'right' },
  inputRow: { flexDirection: 'row', padding: 10, alignItems: 'flex-end', gap: 8, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
