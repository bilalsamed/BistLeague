import { useRef } from 'react';
import { getUserAlerts, checkAndTriggerAlerts, PriceAlert } from '../services/dbService';
import { Stock } from '../types';

export function useAlertChecker() {
  const triggeredRef = useRef<Set<string>>(new Set());

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

  function sendBrowserNotification(alerts: PriceAlert[], stocks: Stock[]) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    const send = () => {
      for (const alert of alerts) {
        const stock = stocks.find(s => s.symbol === alert.stock_symbol);
        const price = stock?.price || alert.target_price;
        const dir = alert.direction === 'above' ? 'üzerine çıktı' : 'altına düştü';
        new Notification(`🔔 ${alert.stock_symbol} Fiyat Alarmı`, {
          body: `${alert.stock_symbol} ₺${price.toFixed(2)} fiyatıyla ₺${alert.target_price.toFixed(2)} hedefinin ${dir}!`,
          icon: '/favicon.ico',
        });
      }
    };

    if (Notification.permission === 'granted') {
      send();
    } else {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') send();
      });
    }
  }

  return { checkAlerts, sendBrowserNotification };
}
