import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { LeagueProvider } from './src/context/LeagueContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { UnreadProvider } from './src/context/UnreadContext';
import Navigation from './src/navigation';

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Navigation />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
    <ThemeProvider>
      <AuthProvider>
        <LeagueProvider>
          <UnreadProvider>
            <AppContent />
          </UnreadProvider>
        </LeagueProvider>
      </AuthProvider>
    </ThemeProvider>
    </SafeAreaProvider>
  );
}
