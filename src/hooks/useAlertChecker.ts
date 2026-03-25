import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getUserAlerts, checkAndTriggerAlerts, PriceAlert } from '../services/dbService';
import { Stock } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useAlertChecker() {
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Notifications.requestPermissionsAsync();
    }
  }, []);

  async function checkAlerts(userId: string, stocks: Stock[]): Promise<PriceAlert[]> {
    try {
      const alerts = await getUserAlerts(userId);
      if (alerts.length === 0) return [];

      const allTriggered: PriceAlert[] = [];
      for (const alert of alerts) {
        const stock = stocks.find(s => s.symbol === alert.stock_symbol);
        if (!stock || stock.price <= 0) continue;
        const triggered = await checkAndTriggerAlerts(userId, alert.stock_symbol, stock.price);
        for (const t of triggered) {
          if (!triggeredRef.current.has(t.id)) {
            triggeredRef.current.add(t.id);
            allTriggered.push(t);
          }
        }
      }
      return allTriggered;
    } catch {
      return [];
    }
  }

  async function sendNotification(alerts: PriceAlert[], stocks: Stock[]) {
    for (const alert of alerts) {
      const stock = stocks.find(s => s.symbol === alert.stock_symbol);
      const price = stock?.price || alert.target_price;
      const dir = alert.direction === 'above' ? 'üzerine çıktı' : 'altına düştü';
      const title = `🔔 ${alert.stock_symbol} Fiyat Alarmı`;
      const body = `${alert.stock_symbol} ₺${price.toFixed(2)} ile ₺${alert.target_price.toFixed(2)} hedefinin ${dir}!`;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(perm => {
              if (perm === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
            });
          }
        }
      } else {
        await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true },
          trigger: null,
        });
      }
    }
  }

  // Geriye dönük uyumluluk için eski isim de çalışsın
  const sendBrowserNotification = sendNotification;

  return { checkAlerts, sendNotification, sendBrowserNotification };
}
