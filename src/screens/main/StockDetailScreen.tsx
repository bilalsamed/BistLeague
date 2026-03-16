import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Modal, Dimensions,
} from 'react-native';
import { fetchStockHistory, formatCurrency } from '../../services/stockService';
import StockLogo from '../../components/StockLogo';
import { buyStock, sellStock, getUserPortfolio, getLeagueMembership, getUserAlerts, createPriceAlert, deletePriceAlert, PriceAlert } from '../../services/dbService';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { StockHistory, Stock } from '../../types';
import { LineChart } from 'react-native-chart-kit';

const SCREEN_W = Dimensions.get('window').width;

type Range = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y';

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: '1d',  label: '1G' },
  { key: '5d',  label: '1H' },
  { key: '1mo', label: '1A' },
  { key: '3mo', label: '3A' },
  { key: '6mo', label: '6A' },
  { key: '1y',  label: '1Y' },
];

export default function StockDetailScreen({ route, navigation }: any) {
  const { stock }: { stock: Stock } = route.params;
  const { user } = useAuth();
  const { selectedLeague, membership, setMembership } = useLeague();
  const { colors } = useTheme();

  const [history, setHistory] = useState<StockHistory[]>([]);
  const [range, setRange] = useState<Range>('1mo');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<'buy' | 'sell' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [ownedQty, setOwnedQty] = useState(0);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  // Price alert state
  const [alertModal, setAlertModal] = useState(false);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above');
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  const isPositive = stock.change >= 0;

  useEffect(() => { loadHistory(); }, [range]);
  useEffect(() => { loadOwnedQty(); }, [selectedLeague, user]);
  useEffect(() => { if (user) loadAlerts(); }, [user, stock.symbol]);

  async function loadHistory() {
    setHistoryLoading(true);
    const data = await fetchStockHistory(stock.symbol, range);
    setHistory(data);
    setHistoryLoading(false);
  }

  async function loadOwnedQty() {
    if (!user || !selectedLeague) return;
    const portfolio = await getUserPortfolio(user.id, selectedLeague.id);
    const pos = portfolio.find(p => p.stock_symbol === stock.symbol);
    setOwnedQty(pos?.quantity || 0);
  }

  async function loadAlerts() {
    if (!user) return;
    const data = await getUserAlerts(user.id);
    setAlerts(data.filter(a => a.stock_symbol === stock.symbol));
  }

  async function handleTrade() {
    setTradeError(null);
    setTradeSuccess(null);

    if (!user || !selectedLeague) {
      setTradeError('Aktif lig seçmelisin.');
      return;
    }
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      setTradeError('Geçerli bir miktar gir.');
      return;
    }
    if (stock.price <= 0) {
      setTradeError('Fiyat bilgisi alınamadı.');
      return;
    }

    setTradeLoading(true);
    let result;
    if (tradeModal === 'buy') {
      result = await buyStock(user.id, selectedLeague.id, stock.symbol, stock.name, qty, stock.price);
    } else {
      result = await sellStock(user.id, selectedLeague.id, stock.symbol, stock.name, qty, stock.price);
    }
    setTradeLoading(false);

    if (result.success) {
      setTradeSuccess(`${qty} adet ${stock.symbol} ${tradeModal === 'buy' ? 'satın alındı' : 'satıldı'}.`);
      setQuantity('');
      const mem = await getLeagueMembership(selectedLeague.id, user.id);
      setMembership(mem);
      await loadOwnedQty();
      setTimeout(() => { setTradeModal(null); setTradeSuccess(null); }, 1500);
    } else {
      setTradeError(result.error || 'Bir hata oluştu.');
    }
  }

  async function handleCreateAlert() {
    if (!user) return;
    setAlertError(null);
    setAlertSuccess(null);
    const price = parseFloat(alertPrice.replace(',', '.'));
    if (!price || price <= 0) {
      setAlertError('Geçerli bir fiyat gir.');
      return;
    }
    setAlertLoading(true);
    const result = await createPriceAlert(user.id, stock.symbol, price, alertDirection);
    setAlertLoading(false);
    if (result.success) {
      setAlertSuccess('Alarm oluşturuldu!');
      setAlertPrice('');
      await loadAlerts();
      setTimeout(() => { setAlertSuccess(null); }, 2000);
    } else {
      setAlertError(result.error || 'Alarm oluşturulamadı.');
    }
  }

  async function handleDeleteAlert(alertId: string) {
    await deletePriceAlert(alertId);
    await loadAlerts();
  }

  const chartSlice = history;
  const chartData = chartSlice.map(h => h.close);
  const chartMin = chartData.length > 0 ? Math.min(...chartData) : 0;
  const chartMax = chartData.length > 0 ? Math.max(...chartData) : 0;
  const chartStart = chartSlice[0]?.close || 0;
  const chartEnd = chartSlice[chartSlice.length - 1]?.close || 0;
  const periodChange = chartStart > 0 ? ((chartEnd - chartStart) / chartStart) * 100 : 0;
  const chartLabels = chartSlice.map((h, i) => {
    const n = chartSlice.length;
    if (i === 0 || i === Math.floor(n / 2) || i === n - 1) return h.date.slice(5);
    return '';
  });

  const totalCost = stock.price > 0 && quantity ? stock.price * parseInt(quantity || '0') : 0;
  const commission = Math.ceil(totalCost * 0.002);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.accent }]}>← Geri</Text>
        </TouchableOpacity>
        <StockLogo symbol={stock.symbol} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.symbol, { color: colors.text }]}>{stock.symbol}</Text>
          <Text style={[styles.stockName, { color: colors.subtext }]}>{stock.name}</Text>
        </View>
        {user && (
          <TouchableOpacity onPress={() => setAlertModal(true)} style={[styles.alertBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.alertBtnIcon}>🔔</Text>
            {alerts.length > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.alertBadgeText}>{alerts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Price */}
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.text }]}>{stock.price > 0 ? formatCurrency(stock.price) : 'Veri yok'}</Text>
        <View style={[styles.changeBadge, isPositive ? { backgroundColor: colors.accentBg } : { backgroundColor: colors.dangerBg }]}>
          <Text style={[styles.changeText, isPositive ? { color: colors.accent } : { color: colors.danger }]}>
            {isPositive ? '+' : ''}{stock.change.toFixed(2)} ({stock.change_percent.toFixed(2)}%)
          </Text>
        </View>
      </View>
      <Text style={[styles.prevClose, { color: colors.subtext }]}>
        Önceki kapanış: {formatCurrency(stock.previous_close)}
        {stock.last_updated ? `  •  ${new Date(stock.last_updated).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}
      </Text>

      {/* Portfolio info */}
      {selectedLeague && (
        <View style={[styles.infoRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.infoLabel, { color: colors.subtext }]}>Nakit: <Text style={[styles.infoVal, { color: colors.text }]}>{membership?.cash_balance?.toLocaleString('tr-TR')} ₺</Text></Text>
          <Text style={[styles.infoLabel, { color: colors.subtext }]}>Portföyde: <Text style={[styles.infoVal, { color: colors.text }]}>{ownedQty} adet</Text></Text>
        </View>
      )}

      {/* Chart */}
      <View style={styles.chartSection}>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity key={key} style={[styles.rangeBtn, { backgroundColor: colors.surface }, range === key && { backgroundColor: colors.accent }]} onPress={() => setRange(key)}>
              <Text style={[styles.rangeBtnText, { color: colors.subtext }, range === key && { color: '#fff', fontWeight: 'bold' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {historyLoading ? (
          <View style={[styles.chartPlaceholder, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.accent} /></View>
        ) : chartData.length > 1 ? (
          <>
            <LineChart
              data={{ labels: chartLabels, datasets: [{ data: chartData, strokeWidth: 2 }] }}
              width={SCREEN_W - 32}
              height={180}
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                color: (opacity = 1) => isPositive ? `rgba(0,208,132,${opacity})` : `rgba(248,81,73,${opacity})`,
                labelColor: () => colors.subtext,
                strokeWidth: 2,
                propsForDots: { r: '0' },
                fillShadowGradientOpacity: 0.2,
                fillShadowGradientToOpacity: 0,
                decimalPlaces: 2,
              }}
              bezier
              style={styles.chart}
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={false}
            />
            <View style={[styles.chartStats, { backgroundColor: colors.surface }]}>
              <View style={styles.chartStatItem}>
                <Text style={[styles.chartStatLabel, { color: colors.subtext }]}>En Düşük</Text>
                <Text style={[styles.chartStatVal, { color: colors.text }]}>{formatCurrency(chartMin)}</Text>
              </View>
              <View style={styles.chartStatItem}>
                <Text style={[styles.chartStatLabel, { color: colors.subtext }]}>Dönem Değ.</Text>
                <Text style={[styles.chartStatVal, { color: periodChange >= 0 ? colors.accent : colors.danger }]}>
                  {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.chartStatItem}>
                <Text style={[styles.chartStatLabel, { color: colors.subtext }]}>En Yüksek</Text>
                <Text style={[styles.chartStatVal, { color: colors.text }]}>{formatCurrency(chartMax)}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.chartPlaceholder, { backgroundColor: colors.surface }]}><Text style={[styles.noData, { color: colors.subtext }]}>Grafik verisi yok</Text></View>
        )}
      </View>

      {/* Trade Buttons */}
      {selectedLeague && stock.price > 0 && (
        <View style={styles.tradeButtons}>
          <TouchableOpacity style={[styles.buyBtn, { backgroundColor: colors.accent }]} onPress={() => setTradeModal('buy')}>
            <Text style={styles.tradeBtnText}>Al</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sellBtn, { backgroundColor: colors.danger }, ownedQty === 0 && styles.disabledBtn]} onPress={() => ownedQty > 0 && setTradeModal('sell')} disabled={ownedQty === 0}>
            <Text style={styles.tradeBtnText}>Sat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trade Modal */}
      <Modal visible={tradeModal !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{tradeModal === 'buy' ? 'Hisse Al' : 'Hisse Sat'} — {stock.symbol}</Text>
            <Text style={[styles.modalPrice, { color: colors.subtext }]}>Fiyat: {formatCurrency(stock.price)}</Text>
            {tradeModal === 'buy' && <Text style={[styles.modalPrice, { color: colors.subtext }]}>Nakit: {(membership?.cash_balance || 0).toLocaleString('tr-TR')} ₺</Text>}
            {tradeModal === 'sell' && <Text style={[styles.modalOwned, { color: colors.subtext }]}>Elinde: {ownedQty} adet</Text>}

            {tradeError && (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{tradeError}</Text>
              </View>
            )}
            {tradeSuccess && (
              <View style={[styles.successBox, { backgroundColor: colors.accentBg, borderColor: colors.accent }]}>
                <Text style={[styles.successText, { color: colors.accent }]}>{tradeSuccess}</Text>
              </View>
            )}

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              placeholder="Adet gir"
              placeholderTextColor={colors.subtext}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />

            {quantity.length > 0 && parseInt(quantity) > 0 && (
              <View style={[styles.summary, { backgroundColor: colors.bg }]}>
                <Text style={[styles.summaryLine, { color: colors.subtext }]}>İşlem tutarı: <Text style={[styles.summaryVal, { color: colors.text }]}>{formatCurrency(totalCost)}</Text></Text>
                <Text style={[styles.summaryLine, { color: colors.subtext }]}>Komisyon (%0.2): <Text style={[styles.summaryVal, { color: colors.text }]}>{formatCurrency(commission)}</Text></Text>
                <Text style={[styles.summaryLine, { color: colors.subtext }]}>
                  {tradeModal === 'buy' ? 'Toplam çıkış: ' : 'Net gelir: '}
                  <Text style={[styles.summaryVal, { color: colors.text }]}>{formatCurrency(tradeModal === 'buy' ? totalCost + commission : totalCost - commission)}</Text>
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => { setTradeModal(null); setQuantity(''); setTradeError(null); setTradeSuccess(null); }}>
                <Text style={[styles.cancelText, { color: colors.subtext }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, tradeModal === 'sell' && { backgroundColor: colors.danger }, tradeModal === 'buy' && { backgroundColor: colors.accent }]} onPress={handleTrade} disabled={tradeLoading}>
                {tradeLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>{tradeModal === 'buy' ? 'Satın Al' : 'Sat'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Price Alert Modal */}
      <Modal visible={alertModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>🔔 Fiyat Alarmı — {stock.symbol}</Text>
            <Text style={[styles.modalPrice, { color: colors.subtext }]}>Güncel: {formatCurrency(stock.price)}</Text>

            {alertError && (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{alertError}</Text>
              </View>
            )}
            {alertSuccess && (
              <View style={[styles.successBox, { backgroundColor: colors.accentBg, borderColor: colors.accent }]}>
                <Text style={[styles.successText, { color: colors.accent }]}>{alertSuccess}</Text>
              </View>
            )}

            {/* Direction toggle */}
            <View style={styles.directionRow}>
              <TouchableOpacity
                style={[styles.dirBtn, alertDirection === 'above' && { backgroundColor: colors.accent }]}
                onPress={() => setAlertDirection('above')}
              >
                <Text style={[styles.dirBtnText, { color: alertDirection === 'above' ? '#fff' : colors.subtext }]}>↑ Üzerine çıkınca</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dirBtn, alertDirection === 'below' && { backgroundColor: colors.danger }]}
                onPress={() => setAlertDirection('below')}
              >
                <Text style={[styles.dirBtnText, { color: alertDirection === 'below' ? '#fff' : colors.subtext }]}>↓ Altına düşünce</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              placeholder="Hedef fiyat (₺)"
              placeholderTextColor={colors.subtext}
              value={alertPrice}
              onChangeText={setAlertPrice}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => { setAlertModal(false); setAlertPrice(''); setAlertError(null); setAlertSuccess(null); }}>
                <Text style={[styles.cancelText, { color: colors.subtext }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.accent }]} onPress={handleCreateAlert} disabled={alertLoading}>
                {alertLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Alarm Kur</Text>}
              </TouchableOpacity>
            </View>

            {/* Existing alerts */}
            {alerts.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.summaryLine, { color: colors.subtext, marginBottom: 8 }]}>Aktif Alarmlar:</Text>
                {alerts.map(a => (
                  <View key={a.id} style={[styles.alertRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.alertRowText, { color: colors.text }]}>
                      {a.direction === 'above' ? '↑' : '↓'} {formatCurrency(a.target_price)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeleteAlert(a.id)}>
                      <Text style={[styles.alertRowDelete, { color: colors.danger }]}>Sil</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, marginBottom: 20, gap: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 15 },
  symbol: { fontSize: 22, fontWeight: 'bold' },
  stockName: { fontSize: 13 },
  alertBtn: { padding: 8, borderRadius: 10, borderWidth: 1, position: 'relative' },
  alertBtnIcon: { fontSize: 18 },
  alertBadge: { position: 'absolute', top: -4, right: -4, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  alertBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  price: { fontSize: 28, fontWeight: 'bold' },
  changeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  changeText: { fontWeight: 'bold', fontSize: 14 },
  prevClose: { fontSize: 13, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, padding: 12, marginBottom: 16 },
  infoLabel: { fontSize: 13 },
  infoVal: { fontWeight: 'bold' },
  chartSection: { marginBottom: 20 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  rangeBtnText: { fontSize: 13 },
  chart: { borderRadius: 12, marginLeft: -16 },
  chartPlaceholder: { height: 180, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  noData: {},
  chartStats: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, padding: 12, marginTop: 8 },
  chartStatItem: { alignItems: 'center', flex: 1 },
  chartStatLabel: { fontSize: 10, marginBottom: 3 },
  chartStatVal: { fontSize: 13, fontWeight: 'bold' },
  tradeButtons: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  buyBtn: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  sellBtn: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  disabledBtn: { opacity: 0.4 },
  tradeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modalPrice: { marginBottom: 4 },
  modalOwned: { marginBottom: 12 },
  errorBox: { borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1 },
  errorText: { fontSize: 13, textAlign: 'center' },
  successBox: { borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1 },
  successText: { fontSize: 13, textAlign: 'center' },
  modalInput: { borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, fontSize: 16 },
  summary: { borderRadius: 8, padding: 12, marginBottom: 16 },
  summaryLine: { fontSize: 13, marginBottom: 4 },
  summaryVal: { fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 8, padding: 13, alignItems: 'center' },
  cancelText: { fontWeight: 'bold' },
  confirmBtn: { flex: 1, borderRadius: 8, padding: 13, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: 'bold' },
  directionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dirBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: '#21262d' },
  dirBtnText: { fontSize: 12, fontWeight: 'bold' },
  alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1 },
  alertRowText: { fontSize: 13 },
  alertRowDelete: { fontSize: 12, fontWeight: 'bold' },
});
