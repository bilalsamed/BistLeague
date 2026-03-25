import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'bistleague_favorites';

interface FavoritesContextType {
  favorites: Set<string>;
  toggleFavorite: (symbol: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: new Set(),
  toggleFavorite: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(val => {
      if (val) setFavorites(new Set(JSON.parse(val)));
    });
  }, []);

  async function toggleFavorite(symbol: string) {
    const next = new Set(favorites);
    if (next.has(symbol)) {
      next.delete(symbol);
    } else {
      next.add(symbol);
    }
    setFavorites(next);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
  }

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
