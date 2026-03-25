import { Stock, StockHistory } from '../types';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const EDGE_PROXY = `${SUPABASE_URL}/functions/v1/yahoo-proxy`;

export type StockSector =
  | 'Bankacılık' | 'Holding' | 'Enerji' | 'Sanayi' | 'Havacılık'
  | 'Teknoloji' | 'Perakende' | 'GYO' | 'Madencilik' | 'Gıda'
  | 'Kimya' | 'İnşaat' | 'Otomotiv' | 'Sigorta' | 'Sağlık' | 'Diğer';

export const SECTORS: StockSector[] = [
  'Bankacılık', 'Holding', 'Enerji', 'Sanayi', 'Havacılık',
  'Teknoloji', 'Perakende', 'GYO', 'Madencilik', 'Gıda',
  'Kimya', 'İnşaat', 'Otomotiv', 'Sigorta', 'Sağlık', 'Diğer',
];

// BIST100 + seçili ek hisseler
export const BIST_STOCKS: { symbol: string; name: string; sector: StockSector }[] = [
  // BIST30
  { symbol: 'THYAO', name: 'Türk Hava Yolları',    sector: 'Havacılık' },
  { symbol: 'GARAN', name: 'Garanti BBVA',          sector: 'Bankacılık' },
  { symbol: 'ASELS', name: 'Aselsan',               sector: 'Sanayi' },
  { symbol: 'EREGL', name: 'Ereğli Demir Çelik',   sector: 'Sanayi' },
  { symbol: 'KCHOL', name: 'Koç Holding',           sector: 'Holding' },
  { symbol: 'AKBNK', name: 'Akbank',                sector: 'Bankacılık' },
  { symbol: 'YKBNK', name: 'Yapı Kredi Bankası',   sector: 'Bankacılık' },
  { symbol: 'SAHOL', name: 'Sabancı Holding',       sector: 'Holding' },
  { symbol: 'SISE',  name: 'Şişe Cam',              sector: 'Sanayi' },
  { symbol: 'BIMAS', name: 'BİM Mağazalar',         sector: 'Perakende' },
  { symbol: 'TUPRS', name: 'Tüpraş',                sector: 'Kimya' },
  { symbol: 'FROTO', name: 'Ford Otosan',           sector: 'Otomotiv' },
  { symbol: 'TOASO', name: 'Tofaş Oto',             sector: 'Otomotiv' },
  { symbol: 'ARCLK', name: 'Arçelik',               sector: 'Sanayi' },
  { symbol: 'PGSUS', name: 'Pegasus Hava Yolları', sector: 'Havacılık' },
  { symbol: 'TCELL', name: 'Turkcell',              sector: 'Teknoloji' },
  { symbol: 'TTKOM', name: 'Türk Telekom',          sector: 'Teknoloji' },
  { symbol: 'ENKAI', name: 'Enka İnşaat',           sector: 'İnşaat' },
  { symbol: 'TRALT', name: 'Türkiye Altın',          sector: 'Madencilik' },
  { symbol: 'MGROS', name: 'Migros',                sector: 'Perakende' },
  { symbol: 'ISCTR', name: 'İş Bankası C',          sector: 'Bankacılık' },
  { symbol: 'EKGYO', name: 'Emlak Konut GYO',       sector: 'GYO' },
  { symbol: 'PETKM', name: 'Petkim',                sector: 'Kimya' },
  { symbol: 'TAVHL', name: 'TAV Havalimanları',     sector: 'Havacılık' },
  { symbol: 'TKFEN', name: 'Tekfen Holding',        sector: 'Holding' },
  { symbol: 'SOKM',  name: 'Şok Marketler',         sector: 'Perakende' },
  { symbol: 'VESTL', name: 'Vestel',                sector: 'Sanayi' },
  { symbol: 'HALKB', name: 'Halkbank',              sector: 'Bankacılık' },
  { symbol: 'VAKBN', name: 'Vakıfbank',             sector: 'Bankacılık' },
  { symbol: 'DOHOL', name: 'Doğan Holding',         sector: 'Holding' },
  // BIST100 ek hisseler
  { symbol: 'AEFES', name: 'Anadolu Efes',          sector: 'Gıda' },
  { symbol: 'AKSA',  name: 'Aksa Akrilik',          sector: 'Kimya' },
  { symbol: 'AKSEN', name: 'Aksa Enerji',           sector: 'Enerji' },
  { symbol: 'ALARK', name: 'Alarko Holding',        sector: 'Holding' },
  { symbol: 'ANHYT', name: 'Anadolu Hayat Emeklilik', sector: 'Sigorta' },
  { symbol: 'ANSGR', name: 'Anadolu Sigorta',       sector: 'Sigorta' },
  { symbol: 'ASTOR', name: 'Astor Enerji',          sector: 'Enerji' },
  { symbol: 'AYDEM', name: 'Aydem Enerji',          sector: 'Enerji' },
  { symbol: 'BERA',  name: 'Bera Holding',          sector: 'Holding' },
  { symbol: 'BIENY', name: 'Bien Yapı',             sector: 'İnşaat' },
  { symbol: 'BIZIM', name: 'Bizim Toptan',          sector: 'Perakende' },
  { symbol: 'BRISA', name: 'Brisa',                 sector: 'Otomotiv' },
  { symbol: 'BRYAT', name: 'Borusan Yatırım',       sector: 'Holding' },
  { symbol: 'BUCIM', name: 'Bursa Çimento',         sector: 'İnşaat' },
  { symbol: 'CANTE', name: 'Çan Tarım',             sector: 'Gıda' },
  { symbol: 'CCOLA', name: 'Coca-Cola İçecek',      sector: 'Gıda' },
  { symbol: 'CELHA', name: 'Çelik Halat',           sector: 'Sanayi' },
  { symbol: 'CIMSA', name: 'Çimsa',                 sector: 'İnşaat' },
  { symbol: 'CLEBI', name: 'Celebi Hava Servisi',   sector: 'Havacılık' },
  { symbol: 'DEVA',  name: 'Deva Holding',          sector: 'Sağlık' },
  { symbol: 'DOAS',  name: 'Doğuş Otomotiv',        sector: 'Otomotiv' },
  { symbol: 'DYOBY', name: 'DYO Boya',              sector: 'Kimya' },
  { symbol: 'ECILC', name: 'Eczacıbaşı İlaç',       sector: 'Sağlık' },
  { symbol: 'EGEEN', name: 'Ege Endüstri',          sector: 'Sanayi' },
  { symbol: 'EMKEL', name: 'Emkel Elektrik',        sector: 'Enerji' },
  { symbol: 'EUPWR', name: 'Europower Enerji',      sector: 'Enerji' },
  { symbol: 'FENER', name: 'Fenerbahçe',            sector: 'Diğer' },
  { symbol: 'GENIL', name: 'Genişler İplik',        sector: 'Sanayi' },
  { symbol: 'GLYHO', name: 'Global Yatırım Holding', sector: 'Holding' },
  { symbol: 'GOLTS', name: 'Göltaş Çimento',        sector: 'İnşaat' },
  { symbol: 'GSRAY', name: 'Galatasaray',           sector: 'Diğer' },
  { symbol: 'GUBRF', name: 'Gübre Fabrikaları',     sector: 'Kimya' },
  { symbol: 'HEKTS', name: 'Hektaş',               sector: 'Kimya' },
  { symbol: 'ISFIN', name: 'İş Finansal Kiralama',  sector: 'Bankacılık' },
  { symbol: 'ISGYO', name: 'İş GYO',               sector: 'GYO' },
  { symbol: 'ISMEN', name: 'İş Yatırım',            sector: 'Bankacılık' },
  { symbol: 'KAREL', name: 'Karel Elektronik',      sector: 'Teknoloji' },
  { symbol: 'KARSN', name: 'Karsan Otomotiv',       sector: 'Otomotiv' },
  { symbol: 'KARTN', name: 'Kartonsan',             sector: 'Sanayi' },
  { symbol: 'KCAER', name: 'Koç Allianz Sigorta',   sector: 'Sigorta' },
  { symbol: 'KORDS', name: 'Kordsa',               sector: 'Sanayi' },
  { symbol: 'LOGO',  name: 'Logo Yazılım',          sector: 'Teknoloji' },
  { symbol: 'MAVI',  name: 'Mavi Giyim',            sector: 'Perakende' },
  { symbol: 'MPARK', name: 'Medical Park',          sector: 'Sağlık' },
  { symbol: 'NETAS', name: 'Netaş Telekomünikasyon', sector: 'Teknoloji' },
  { symbol: 'NTHOL', name: 'Net Holding',           sector: 'Holding' },
  { symbol: 'ODAS',  name: 'Odaş Elektrik',         sector: 'Enerji' },
  { symbol: 'OTKAR', name: 'Otokar',                sector: 'Otomotiv' },
  { symbol: 'OYAKC', name: 'Oyak Çimento',          sector: 'İnşaat' },
  { symbol: 'PARSN', name: 'Parsan',                sector: 'Otomotiv' },
  { symbol: 'PRKME', name: 'Park Elektrik',         sector: 'Madencilik' },
  { symbol: 'REEDR', name: 'Reeder Teknoloji',      sector: 'Teknoloji' },
  { symbol: 'SARKY', name: 'Sarkuysan',             sector: 'Sanayi' },
  { symbol: 'SELEC', name: 'Selçuk Ecza',           sector: 'Sağlık' },
  { symbol: 'SKBNK', name: 'Şekerbank',             sector: 'Bankacılık' },
  { symbol: 'SMRTG', name: 'Smart Güneş Enerjisi',  sector: 'Enerji' },
  { symbol: 'TATGD', name: 'Tat Gıda',              sector: 'Gıda' },
  { symbol: 'TKNSA', name: 'Teknosa',               sector: 'Perakende' },
  { symbol: 'TRGYO', name: 'Torunlar GYO',          sector: 'GYO' },
  { symbol: 'TSKB',  name: 'TSKB',                  sector: 'Bankacılık' },
  { symbol: 'TTRAK', name: 'Türk Traktör',          sector: 'Otomotiv' },
  { symbol: 'TURSG', name: 'Türkiye Sigorta',       sector: 'Sigorta' },
  { symbol: 'ULKER', name: 'Ülker Bisküvi',         sector: 'Gıda' },
  { symbol: 'VESBE', name: 'Vestel Beyaz Eşya',     sector: 'Sanayi' },
  { symbol: 'YATAS', name: 'Yataş',                 sector: 'Perakende' },
  { symbol: 'ZOREN', name: 'Zorlu Enerji',          sector: 'Enerji' },
  // Ek BIST100 / BIST250 hisseleri
  { symbol: 'SASA',  name: 'Sasa Polyester',        sector: 'Kimya' },
  { symbol: 'ENJSA', name: 'Enerjisa Enerji',       sector: 'Enerji' },
  { symbol: 'AGESA', name: 'Agesa Hayat Emeklilik', sector: 'Sigorta' },
  { symbol: 'AGHOL', name: 'AG Anadolu Grubu Holding', sector: 'Holding' },
  { symbol: 'ISDMR', name: 'İskenderun Demir Çelik', sector: 'Sanayi' },
  { symbol: 'KONTR', name: 'Kontrolmatik Teknoloji', sector: 'Teknoloji' },
  { symbol: 'GESAN', name: 'Genç Enerji Sanayii',   sector: 'Enerji' },
  { symbol: 'RYSAS', name: 'Reysaş Taşımacılık GYO', sector: 'GYO' },
  { symbol: 'AKMGY', name: 'Akiş GYO',              sector: 'GYO' },
  { symbol: 'HLGYO', name: 'Halk GYO',              sector: 'GYO' },
  { symbol: 'INDES', name: 'İndes Bilgisayar',      sector: 'Teknoloji' },
  { symbol: 'AYEN',  name: 'Ayen Enerji',           sector: 'Enerji' },
  { symbol: 'ERBOS', name: 'Erbosan',               sector: 'Sanayi' },
  { symbol: 'PNSUT', name: 'Pınar Süt',             sector: 'Gıda' },
  { symbol: 'PINSU', name: 'Pınar Su',              sector: 'Gıda' },
  { symbol: 'POLHO', name: 'Polisan Holding',        sector: 'Kimya' },
  { symbol: 'TSPOR', name: 'Trabzonspor',           sector: 'Diğer' },
  { symbol: 'BJKAS', name: 'Beşiktaş JK',           sector: 'Diğer' },
  { symbol: 'GSDHO', name: 'GSD Holding',           sector: 'Holding' },
  { symbol: 'MTRKS', name: 'Matriks Bilgi Dağıtım', sector: 'Teknoloji' },
  { symbol: 'ATAGY', name: 'Ata GYO',               sector: 'GYO' },
  { symbol: 'DENGE', name: 'Denge Yatırım Holding', sector: 'Holding' },
  { symbol: 'ISGSY', name: 'İş Girişim Sermayesi',  sector: 'Holding' },
  { symbol: 'KLNMA', name: 'Türkiye Kalkınma Bankası', sector: 'Bankacılık' },
  { symbol: 'FORTE', name: 'Forte Bilgi İletişim',  sector: 'Teknoloji' },
  { symbol: 'HATEK', name: 'Hateks Hatay Tekstil',  sector: 'Sanayi' },
  { symbol: 'TBORG', name: 'Türk Tuborg',           sector: 'Gıda' },
  { symbol: 'BURCE', name: 'Burçelik',              sector: 'Sanayi' },
  { symbol: 'CEMTS', name: 'Çemtaş Çelik Makina',  sector: 'Sanayi' },
  { symbol: 'LIDER', name: 'Lider Faktoring',       sector: 'Bankacılık' },
  { symbol: 'MIATK', name: 'MIA Teknoloji',         sector: 'Teknoloji' },
  { symbol: 'KFEIN', name: 'Kafein Yazılım',        sector: 'Teknoloji' },
  { symbol: 'NATEN', name: 'Naten Elektrik',        sector: 'Enerji' },
  { symbol: 'VKGYO', name: 'Vakıf GYO',             sector: 'GYO' },
  { symbol: 'GEDZA', name: 'Gediz Ambalaj',         sector: 'Sanayi' },
  // Piyasa değeri yüksek ek hisseler
  { symbol: 'AYGAZ', name: 'Aygaz',                 sector: 'Enerji' },
  { symbol: 'KRDMD', name: 'Kardemir D',            sector: 'Madencilik' },
  { symbol: 'AKCNS', name: 'Akcansa Çimento',       sector: 'İnşaat' },
  { symbol: 'ALBRK', name: 'Albaraka Türk',         sector: 'Bankacılık' },
  { symbol: 'NUHCM', name: 'Nuh Çimento',           sector: 'İnşaat' },
  { symbol: 'AKENR', name: 'Akenerji',              sector: 'Enerji' },
  { symbol: 'AKGRT', name: 'Aksigorta',             sector: 'Sigorta' },
  { symbol: 'ASUZU', name: 'Anadolu Isuzu',         sector: 'Otomotiv' },
  { symbol: 'KOTON', name: 'Koton',                 sector: 'Perakende' },
  { symbol: 'ARENA', name: 'Arena Bilgisayar',      sector: 'Teknoloji' },
  { symbol: 'ARZUM', name: 'Arzum Ev Aletleri',     sector: 'Sanayi' },
  { symbol: 'PRKAB', name: 'Türk Prysmian Kablo',   sector: 'Sanayi' },
  { symbol: 'ULUSE', name: 'Ulusoy Elektrik',       sector: 'Enerji' },
  { symbol: 'EBEBK', name: 'ebebek',                sector: 'Perakende' },
  { symbol: 'VAKKO', name: 'Vakko Tekstil',         sector: 'Sanayi' },
  { symbol: 'QNBFK', name: 'QNB Finansal Kiralama', sector: 'Bankacılık' },
  { symbol: 'BAGFS', name: 'Bağfaş Gübre',          sector: 'Kimya' },
  { symbol: 'ALKIM', name: 'Alkim Kimya',           sector: 'Kimya' },
  { symbol: 'CRFSA', name: 'CarrefourSA',           sector: 'Perakende' },
  { symbol: 'DESPC', name: 'Despec Bilgisayar',     sector: 'Teknoloji' },
];

async function fetchWithTimeout(url: string, options?: RequestInit, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Edge Function proxy (CORS-safe, works everywhere)
async function fetchViaEdge(symbols: string[]): Promise<Stock[]> {
  const yahooSymbols = symbols.map(s => `${s}.IS`).join(',');
  const path = `/v8/finance/spark?symbols=${yahooSymbols}&range=1d&interval=1d`;
  const response = await fetchWithTimeout(`${EDGE_PROXY}${path}`);
  if (!response.ok) throw new Error(`Edge error: ${response.status}`);
  const data = await response.json();
  return parseSparkData(data, symbols);
}

// Direct Yahoo Finance (fallback for native, no CORS)
async function fetchViaYahooDirectly(symbols: string[]): Promise<Stock[]> {
  const yahooSymbols = symbols.map(s => `${s}.IS`).join(',');
  const url = `https://query2.finance.yahoo.com/v8/finance/spark?symbols=${yahooSymbols}&range=1d&interval=1d`;
  const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error('Yahoo direct error');
  const data = await response.json();
  return parseSparkData(data, symbols);
}

function parseSparkData(data: any, symbols: string[]): Stock[] {
  return symbols.map(symbol => {
    const entry = data[`${symbol}.IS`];
    const price = entry?.close?.[entry.close.length - 1] || 0;
    const prevClose = entry?.chartPreviousClose || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const stockInfo = BIST_STOCKS.find(s => s.symbol === symbol);
    const timestamps: number[] = entry?.timestamp || [];
    const marketTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined;
    return {
      symbol,
      name: stockInfo?.name || symbol,
      price,
      previous_close: prevClose,
      change,
      change_percent: changePercent,
      volume: 0,
      last_updated: new Date().toISOString(),
      market_time: marketTime,
    };
  }).filter(s => s.price > 0);
}

export async function fetchStockQuotes(symbols: string[]): Promise<Stock[]> {
  // Spark endpoint supports max 20 symbols per request
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += 20) {
    batches.push(symbols.slice(i, i + 20));
  }

  const allStocks: Stock[] = [];

  for (const batch of batches) {
    try {
      let stocks: Stock[];
      try {
        // Try Edge Function first (works everywhere)
        stocks = await fetchViaEdge(batch);
      } catch {
        // Fallback to direct (works on native without CORS)
        stocks = await fetchViaYahooDirectly(batch);
      }
      allStocks.push(...stocks);
    } catch (err) {
      console.error('fetchStockQuotes batch error:', err);
    }
  }

  if (allStocks.length > 0) {
    updateStocksCache(allStocks).catch(() => {});
  } else {
    // All fetches failed, use cache
    return fetchStocksFromCache(symbols);
  }

  return allStocks;
}


export async function fetchStockPrice(symbol: string): Promise<number | null> {
  try {
    const stocks = await fetchStockQuotes([symbol]);
    return stocks[0]?.price ?? null;
  } catch {
    const { data } = await supabase.from('stocks_cache').select('price').eq('symbol', symbol).maybeSingle();
    return data?.price ?? null;
  }
}

export async function fetchStockHistory(symbol: string, range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' = '1mo'): Promise<StockHistory[]> {
  try {
    const interval = range === '1d' ? '5m' : range === '5d' ? '30m' : '1d';
    const path = `/v8/finance/chart/${symbol}.IS?interval=${interval}&range=${range}`;
    const yahooUrl = `https://query2.finance.yahoo.com${path}`;
    let response: Response;
    try {
      response = await fetch(`${EDGE_PROXY}${path}`);
      if (!response.ok) throw new Error('edge failed');
    } catch {
      response = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    }
    if (!response.ok) throw new Error('History fetch error');
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp || [];
    const ohlcv = result.indicators?.quote?.[0] || {};
    return timestamps.map((ts, i) => ({
      date: range === '1d'
        ? new Date(ts * 1000).toISOString()
        : new Date(ts * 1000).toISOString().split('T')[0],
      open: ohlcv.open?.[i] || 0,
      high: ohlcv.high?.[i] || 0,
      low: ohlcv.low?.[i] || 0,
      close: ohlcv.close?.[i] || 0,
      volume: ohlcv.volume?.[i] || 0,
    })).filter(d => d.close > 0);
  } catch (err) {
    console.error('fetchStockHistory error:', err);
    return [];
  }
}

async function updateStocksCache(stocks: Stock[]) {
  const rows = stocks.map(s => ({
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    previous_close: s.previous_close,
    change: s.change,
    change_percent: s.change_percent,
    volume: s.volume,
    last_updated: new Date().toISOString(),
  }));
  await supabase.from('stocks_cache').upsert(rows, { onConflict: 'symbol' });
}

async function fetchStocksFromCache(symbols: string[]): Promise<Stock[]> {
  const { data } = await supabase.from('stocks_cache').select('*').in('symbol', symbols);
  return (data || []).map(d => ({
    symbol: d.symbol,
    name: d.name,
    price: d.price || 0,
    previous_close: d.previous_close || 0,
    change: d.change || 0,
    change_percent: d.change_percent || 0,
    volume: d.volume || 0,
    last_updated: d.last_updated,
  }));
}


export function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}
