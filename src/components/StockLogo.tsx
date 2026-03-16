import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const DOMAIN_MAP: Record<string, string> = {
  THYAO: 'turkishairlines.com',
  GARAN: 'garantibbva.com.tr',
  ASELS: 'aselsan.com.tr',
  EREGL: 'erdemir.com.tr',
  KCHOL: 'koc.com.tr',
  AKBNK: 'akbank.com',
  YKBNK: 'yapikredi.com.tr',
  SAHOL: 'sabanci.com',
  SISE:  'sisecam.com',
  BIMAS: 'bim.com.tr',
  TUPRS: 'tupras.com.tr',
  FROTO: 'fordotosan.com.tr',
  TOASO: 'tofas.com.tr',
  ARCLK: 'arcelik.com',
  PGSUS: 'flypgs.com',
  TCELL: 'turkcell.com.tr',
  TTKOM: 'turktelekom.com.tr',
  ENKAI: 'enka.com',
  KOZAL: 'kozaaltin.com.tr',
  MGROS: 'migros.com.tr',
  ISCTR: 'isbank.com.tr',
  EKGYO: 'emlakkonut.com.tr',
  PETKM: 'petkim.com.tr',
  TAVHL: 'tav.aero',
  TKFEN: 'tekfen.com.tr',
  SOKM:  'sokmarket.com.tr',
  VESTL: 'vestel.com.tr',
  HALKB: 'halkbank.com.tr',
  VAKBN: 'vakifbank.com.tr',
  DOHOL: 'doganholding.com.tr',
  AEFES: 'anadoluefes.com',
  AKSA:  'aksa.com.tr',
  AKSEN: 'aksa.com.tr',
  CCOLA: 'cci.com.tr',
  BRISA: 'brisa.com.tr',
  DOAS:  'dogusotomotiv.com.tr',
  ECILC: 'eczacibasi.com',
  GSRAY: 'galatasaray.com.tr',
  FENER: 'fenerbahce.com.tr',
  KORDS: 'kordsa.com',
  LOGO:  'logo.com.tr',
  MAVI:  'mavi.com',
  OTKAR: 'otokar.com.tr',
  SODA:  'sodas.com.tr',
  TSKB:  'tskb.com.tr',
  TTRAK: 'turktractor.com.tr',
  ULKER: 'ulker.com.tr',
  CIMSA: 'cimsa.com.tr',
};

const COLOR_PAIRS: [string, string][] = [
  ['#1f6feb', '#388bfd'],
  ['#00d084', '#26a869'],
  ['#f78166', '#e05c4b'],
  ['#e3b341', '#d4a017'],
  ['#a371f7', '#8957e5'],
  ['#39d353', '#2ea043'],
  ['#ff7b72', '#da3633'],
  ['#58a6ff', '#1f6feb'],
  ['#f0883e', '#d18c2a'],
  ['#bc8cff', '#8957e5'],
];

function symbolColors(symbol: string): [string, string] {
  let hash = 0;
  for (const c of symbol) hash = (hash * 31 + c.charCodeAt(0)) % COLOR_PAIRS.length;
  return COLOR_PAIRS[hash];
}

interface Props {
  symbol: string;
  size?: number;
}

export default function StockLogo({ symbol, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  const domain = DOMAIN_MAP[symbol];
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256` : null;
  const [bg, border] = symbolColors(symbol);
  const initials = symbol.length >= 2 ? symbol.slice(0, 2) : symbol[0];
  const fontSize = size * 0.32;
  const borderRadius = size * 0.25;

  if (logoUrl && !failed) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[styles.logo, { width: size, height: size, borderRadius }]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius, backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.fallbackText, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { resizeMode: 'contain', backgroundColor: '#fff' },
  fallback: { justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  fallbackText: { color: '#fff', fontWeight: 'bold', letterSpacing: 0.5 },
});
