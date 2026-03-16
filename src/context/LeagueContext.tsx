import React, { createContext, useContext, useState, useEffect } from 'react';
import { League, LeagueMember } from '../types';
import { useAuth } from './AuthContext';
import { getUserLeagues, getLeagueMembership } from '../services/dbService';

interface LeagueContextType {
  selectedLeague: League | null;
  membership: LeagueMember | null;
  leagues: League[];
  loadingLeagues: boolean;
  setSelectedLeague: (league: League | null) => void;
  setMembership: (m: LeagueMember | null) => void;
  refreshLeagues: () => Promise<void>;
  selectLeague: (league: League) => Promise<void>;
}

const LeagueContext = createContext<LeagueContextType>({} as LeagueContextType);

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [membership, setMembership] = useState<LeagueMember | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);

  useEffect(() => {
    if (user) {
      refreshLeagues();
    } else {
      setLeagues([]);
      setSelectedLeague(null);
      setMembership(null);
    }
  }, [user?.id]);

  async function refreshLeagues() {
    if (!user) return;
    setLoadingLeagues(true);
    const userLeagues = await getUserLeagues(user.id);
    setLeagues(userLeagues);
    if (userLeagues.length > 0) {
      const mem = await getLeagueMembership(userLeagues[0].id, user.id);
      setSelectedLeague(userLeagues[0]);
      setMembership(mem);
    }
    setLoadingLeagues(false);
  }

  async function selectLeague(league: League) {
    if (!user) return;
    setSelectedLeague(league);
    const mem = await getLeagueMembership(league.id, user.id);
    setMembership(mem);
  }

  return (
    <LeagueContext.Provider value={{
      selectedLeague, membership, leagues, loadingLeagues,
      setSelectedLeague, setMembership, refreshLeagues, selectLeague,
    }}>
      {children}
    </LeagueContext.Provider>
  );
}

export const useLeague = () => useContext(LeagueContext);
