import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleMarketNotifications() {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Cancel existing market notifications before rescheduling
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.type === 'market_open' || n.content.data?.type === 'market_close') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  // Market open: 10:00 Turkey time (UTC+3). Schedule at local 10:00 assuming device is in Turkey.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📈 Borsa Açıldı!',
      body: 'BIST işlemlere başladı. Hisselerini kontrol et!',
      data: { type: 'market_open' },
    },
    trigger: {
      hour: 10,
      minute: 0,
      repeats: true,
    } as any,
  });

  // Market close: 18:00 Turkey time
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Borsa Kapandı',
      body: 'Günlük işlemler sona erdi. Portföyünü görüntüle!',
      data: { type: 'market_close' },
    },
    trigger: {
      hour: 18,
      minute: 0,
      repeats: true,
    } as any,
  });
}

export async function cancelMarketNotifications() {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.type === 'market_open' || n.content.data?.type === 'market_close') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function sendChatNotification(leagueName: string, senderName: string, message: string) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${leagueName}`,
      body: `${senderName}: ${message.length > 60 ? message.slice(0, 60) + '…' : message}`,
      data: { type: 'chat' },
    },
    trigger: null,
  });
}

export async function sendPriceAlertNotification(symbol: string, price: number, direction: 'above' | 'below') {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔔 Fiyat Alarmı: ${symbol}`,
      body: `${symbol} fiyatı ${direction === 'above' ? 'yükseldi' : 'düştü'}: ${price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`,
      data: { type: 'price_alert', symbol },
    },
    trigger: null,
  });
}
