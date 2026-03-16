import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { useTheme } from '../context/ThemeContext';
import { useUnread } from '../context/UnreadContext';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main screens
import MarketScreen from '../screens/main/MarketScreen';
import StockDetailScreen from '../screens/main/StockDetailScreen';
import PortfolioScreen from '../screens/main/PortfolioScreen';
import LeaguesScreen from '../screens/main/LeaguesScreen';
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ChatScreen from '../screens/main/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Market: '📊',
    Portfolio: '💼',
    Leagues: '🏆',
    Leaderboard: '📈',
    Chat: '💬',
    History: '📋',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name] || '•'}</Text>
  );
}

function MarketStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MarketList" component={MarketScreen} />
      <Stack.Screen name="StockDetail" component={StockDetailScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { chatUnread } = useUnread();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: 6 + insets.bottom,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtext,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Market" component={MarketStack} options={{ tabBarLabel: 'Piyasa' }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Portföy' }} />
      <Tab.Screen name="Leagues" component={LeaguesScreen} options={{ tabBarLabel: 'Ligler' }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ tabBarLabel: 'Sıralama' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Sohbet', tabBarBadge: chatUnread > 0 ? chatUnread : undefined }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'Geçmiş' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profil' }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

export default function Navigation() {
  const { session, loading } = useAuth();
  const { loadingLeagues } = useLeague();
  const { colors } = useTheme();

  if (loading || (session && loadingLeagues)) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <Text style={styles.logo}>📈</Text>
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 60 },
});
