import React, { useEffect, useState, useRef } from 'react';
import { useFavorites } from '../../hooks/useFavorites';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Modal, useWindowDimensions,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { fetchStockHistory, formatCurrency, formatVolume } from '../../services/stockService';
import StockLogo from '../../components/StockLogo';
import { buyStock, sellStock, getUserPortfolio, getLeagueMembership, getUserAlerts, createPriceAlert, deletePriceAlert, PriceAlert } from '../../services/dbService';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';
import { useTheme } from '../../context/ThemeContext';
import { StockHistory, Stock } from '../../types';
import PriceChart from '../../components/PriceChart';

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
  const { width: SCREEN_W } = useWindowDimensions();
  const { favorites, toggleFavorite } = useFavorites();
  const isFav = favorites.has(stock.symbol);

  const [history, setHistory] = useState<StockHistory[]>([]);
  const [range, setRange] = useState<Range>('1mo');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState<'buy' | 'sell' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [inputMode, setInputMode] = useState<'qty' | 'amount'>('qty');
  const [amountInput, setAmountInput] = useState('');
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
  const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  useEffect(() => { loadHistory(); }, [range]);
  useEffect(() => { loadOwnedQty(); }, [selectedLeague, user]);
  useEffect(() => { if (user) loadAlerts(); }, [user, stock.symbol]);

  async function loadHistory() {
    setHistoryLoading(true);
    const data = await fetchStockHistory(stock.symbol, range);
    if (!isMounted.current) return;
    setHistory(data);
    setHistoryLoading(false);
  }

  async function loadOwnedQty() {
    if (!user || !selectedLeague) return;
    const portfolio = await getUserPortfolio(user.id, selectedLeague.id);
    if (!isMounted.current) return;
    const pos = portfolio.find(p => p.stock_symbol === stock.symbol);
    setOwnedQty(pos?.quantity || 0);
  }

  async function loadAlerts() {
    if (!user) return;
    const data = await getUserAlerts(user.id);
    if (!isMounted.current) return;
    setAlerts(data.filter(a => a.stock_symbol === stock.symbol));
  }

  function isMarketOpen(): boolean {
    if (__DEV__) return true;
    // Türkiye UTC+3 sabit (2016'dan beri yaz saati yok)
    const ist = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const day = ist.getUTCDay();
    if (day === 0 || day === 6) return false;
    const total = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return total >= 10 * 60 + 15 && total <= 18 * 60 + 10;
  }

  async function handleTrade() {
    setTradeError(null);
    setTradeSuccess(null);

    if (!isMarketOpen()) {
      const now = new Date();
      const day = now.getDay();
      if (day === 0 || day === 6) {
        setTradeError('Hafta sonu işlem yapılamaz. Piyasa Pazartesi 10:15\'te açılır.');
      } else {
        setTradeError('Piyasa kapalı. İşlem saatleri: Hafta içi 10:15 – 18:10.');
      }
      return;
    }

    if (!user || !selectedLeague) {
      setTradeError('Aktif lig seçmelisin.');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
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

  const chartData = history.map(h => h.close);
  const chartMin = chartData.length > 0 ? Math.min(...chartData) : 0;
  const chartMax = chartData.length > 0 ? Math.max(...chartData) : 0;
  const chartStart = history[0]?.close || 0;
  const chartEnd = history[history.length - 1]?.close || 0;
  const periodChange = chartStart > 0 ? ((chartEnd - chartStart) / chartStart) * 100 : 0;

  const parsedQty = parseInt(quantity, 10);
  const totalCost = stock.price > 0 && !isNaN(parsedQty) && parsedQty > 0 ? stock.price * parsedQty : 0;
  const commission = Math.round(totalCost * 0.002 * 100) / 100;

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
        <TouchableOpacity
          onPress={() => toggleFavorite(stock.symbol)}
          style={[styles.headerIconBtn, isFav ? { backgroundColor: 'rgba(255,200,0,0.18)', borderColor: 'rgba(255,200,0,0.4)' } : { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.headerIconText, { color: isFav ? '#f5c518' : colors.subtext }]}>{isFav ? '★' : '☆'}</Text>
        </TouchableOpacity>
        {user && (
          <TouchableOpacity onPress={() => setAlertModal(true)} style={[styles.headerIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.headerIconText}>🔔</Text>
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
      <View style={[styles.infoRow, { backgroundColor: colors.surface }]}>
        {selectedLeague && (
          <>
            <Text style={[styles.infoLabel, { color: colors.subtext }]}>Nakit: <Text style={[styles.infoVal, { color: colors.text }]}>{membership?.cash_balance?.toLocaleString('tr-TR')} ₺</Text></Text>
            <Text style={[styles.infoLabel, { color: colors.subtext }]}>Portföyde: <Text style={[styles.infoVal, { color: colors.text }]}>{ownedQty} adet</Text></Text>
          </>
        )}
        {(stock.volume ?? 0) > 0 && (
          <Text style={[styles.infoLabel, { color: colors.subtext }]}>Hacim: <Text style={[styles.infoVal, { color: colors.text }]}>{formatVolume(stock.volume ?? 0)}</Text></Text>
        )}
      </View>

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
            <PriceChart
              data={history}
              width={SCREEN_W - 32}
              height={220}
              colors={colors}
              isPositive={periodChange >= 0}
              range={range}
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
          {!isMarketOpen() && (
            <Text style={[styles.marketClosed, { color: colors.subtext }]}>
              🔴 Piyasa kapalı • 10:15–18:10 Hafta içi
            </Text>
          )}
          <View style={styles.tradeBtnRow}>
            <TouchableOpacity
              style={[styles.buyBtn, { backgroundColor: colors.accent }, !isMarketOpen() && styles.disabledBtn]}
              onPress={() => setTradeModal('buy')}
              disabled={!isMarketOpen()}
            >
              <Text style={styles.tradeBtnText}>Al</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sellBtn, { backgroundColor: colors.danger }, (ownedQty === 0 || !isMarketOpen()) && styles.disabledBtn]}
              onPress={() => ownedQty > 0 && setTradeModal('sell')}
              disabled={ownedQty === 0 || !isMarketOpen()}
            >
              <Text style={styles.tradeBtnText}>Sat</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trade Modal */}
      <Modal visible={tradeModal !== null} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
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

            {/* Adet / Tutar toggle — sadece alırken */}
            {tradeModal === 'buy' && (
              <View style={[styles.modeToggle, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.modeBtn, inputMode === 'qty' && { backgroundColor: colors.accent }]}
                  onPress={() => { setInputMode('qty'); setAmountInput(''); }}
                >
                  <Text style={[styles.modeBtnText, { color: inputMode === 'qty' ? '#fff' : colors.subtext }]}>Adet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, inputMode === 'amount' && { backgroundColor: colors.accent }]}
                  onPress={() => { setInputMode('amount'); setQuantity(''); }}
                >
                  <Text style={[styles.modeBtnText, { color: inputMode === 'amount' ? '#fff' : colors.subtext }]}>Tutar (₺)</Text>
                </TouchableOpacity>
              </View>
            )}

            {inputMode === 'qty' || tradeModal === 'sell' ? (
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                placeholder="Adet gir"
                placeholderTextColor={colors.subtext}
                value={quantity}
                onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            ) : (
              <>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Tutar gir (₺)"
                  placeholderTextColor={colors.subtext}
                  value={amountInput}
                  onChangeText={v => {
                    setAmountInput(v.replace(/[^0-9]/g, ''));
                    const qty = stock.price > 0 ? Math.floor(parseInt(v || '0') / stock.price) : 0;
                    setQuantity(qty > 0 ? String(qty) : '');
                  }}
                  keyboardType="number-pad"
                />
                {amountInput.length > 0 && stock.price > 0 && (
                  <Text style={[styles.amountHint, { color: colors.subtext }]}>
                    ≈ {Math.floor(parseInt(amountInput || '0') / stock.price)} adet
                  </Text>
                )}
              </>
            )}

            {tradeModal === 'sell' && ownedQty > 0 && (
              <TouchableOpacity
                style={[styles.sellAllBtn, { borderColor: colors.danger }]}
                onPress={() => setQuantity(String(ownedQty))}
              >
                <Text style={[styles.sellAllText, { color: colors.danger }]}>Tümünü Sat ({ownedQty} adet)</Text>
              </TouchableOpacity>
            )}

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
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => { setTradeModal(null); setQuantity(''); setAmountInput(''); setInputMode('qty'); setTradeError(null); setTradeSuccess(null); }}>
                <Text style={[styles.cancelText, { color: colors.subtext }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, tradeModal === 'sell' && { backgroundColor: colors.danger }, tradeModal === 'buy' && { backgroundColor: colors.accent }]} onPress={handleTrade} disabled={tradeLoading}>
                {tradeLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>{tradeModal === 'buy' ? 'Satın Al' : 'Sat'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Price Alert Modal */}
      <Modal visible={alertModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
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
          </ScrollView>
        </KeyboardAvoidingView>
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
  headerIconBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headerIconText: { fontSize: 18 },
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
  tradeButtons: { marginBottom: 20 },
  marketClosed: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
  tradeBtnRow: { flexDirection: 'row', gap: 12 },
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
  modalInput: { borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, fontSize: 16 },
  sellAllBtn: { borderRadius: 8, borderWidth: 1, paddingVertical: 8, alignItems: 'center', marginBottom: 12 },
  modeToggle: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  amountHint: { fontSize: 12, marginTop: -8, marginBottom: 10, marginLeft: 4 },
  sellAllText: { fontSize: 13, fontWeight: '600' },
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
