import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useLeague } from './LeagueContext';

interface UnreadContextType {
  chatUnread: number;
  resetChat: () => void;
}

const UnreadContext = createContext<UnreadContextType>({ chatUnread: 0, resetChat: () => {} });

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
        () => {
          if (!chatFocusedRef.current) setChatUnread(prev => prev + 1);
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
    <UnreadContext.Provider value={{ chatUnread, resetChat }}>
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => useContext(UnreadContext);
