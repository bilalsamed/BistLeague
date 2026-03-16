import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  subtext: string;
  accent: string;
  accentBg: string;
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  tabBg: string;
}

const dark: ThemeColors = {
  bg: '#0d1117',
  surface: '#161b22',
  surfaceAlt: '#21262d',
  border: '#30363d',
  text: '#e6edf3',
  subtext: '#8b949e',
  accent: '#00d084',
  accentBg: '#1a3a27',
  danger: '#f85149',
  dangerBg: '#3a1a1a',
  warning: '#e3b341',
  warningBg: '#2d1f00',
  tabBg: '#161b22',
};

const light: ThemeColors = {
  bg: '#f6f8fa',
  surface: '#ffffff',
  surfaceAlt: '#f0f0f0',
  border: '#d0d7de',
  text: '#24292f',
  subtext: '#57606a',
  accent: '#1a7f37',
  accentBg: '#d1f7e0',
  danger: '#cf222e',
  dangerBg: '#ffebe9',
  warning: '#9a6700',
  warningBg: '#fff8c5',
  tabBg: '#ffffff',
};

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: dark,
  isDark: true,
  toggleTheme: () => {},
});

const THEME_KEY = 'bistleague_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  async function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }

  return (
    <ThemeContext.Provider value={{ colors: isDark ? dark : light, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
