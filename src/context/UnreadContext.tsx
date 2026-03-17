import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useLeague } from './LeagueContext';
import { sendChatNotification } from '../services/notificationService';

interface UnreadContextType {
  chatUnread: number;
  resetChat: () => void;
  onChatBlur: () => void;
}

const UnreadContext = createContext<UnreadContextType>({ chatUnread: 0, resetChat: () => {}, onChatBlur: () => {} });

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { selectedLeague } = useLeague();
  const [chatUnread, setChatUnread] = useState(0);
  const chatFocusedRef = useRef(false);

  useEffect(() => {
    setChatUnread(0);
    if (!selectedLeague) return;

    const channel = supabase
      .channel(`unread_nav:${selectedLeague.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages', filter: `league_id=eq.${selectedLeague.id}` },
        (payload) => {
          if (!chatFocusedRef.current) {
            setChatUnread(prev => prev + 1);
            const msg = payload.new as { username?: string; content?: string };
            sendChatNotification(
              selectedLeague?.name || 'Lig',
              msg.username || 'Biri',
              msg.content || ''
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLeague?.id]);

  function resetChat() {
    chatFocusedRef.current = true;
    setChatUnread(0);
  }

  function onChatBlur() {
    chatFocusedRef.current = false;
  }

  return (
    <UnreadContext.Provider value={{ chatUnread, resetChat, onChatBlur }}>
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => useContext(UnreadContext);
