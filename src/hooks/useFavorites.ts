import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'bistleague_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(val => {
      if (val) setFavorites(new Set(JSON.parse(val)));
      setLoaded(true);
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

  return { favorites, toggleFavorite, loaded };
}
