import { useColorScheme } from 'react-native';

/*
 * İki tema: "Noir" (varsayılan) — oniks siyahı zemin, şampanya altını vurgu, fildişi yazı;
 * "Fildişi" — sıcak kırık beyaz zemin, koyu altın vurgu, oniks yazı.
 * Altın yalnızca vurgu için kullanılır (seçili öğe, ana düğme, ince çerçeveler); her yere yayılmaz.
 * Kategori renkleri soluk mücevher tonlarıdır: zümrüt, kehribar, safir, arduvaz, yakut, ametist, gül, vizon.
 */
const noir = {
  name: 'noir' as 'noir' | 'ivory',
  bg: '#0b0b0d',
  surface: '#141416',
  raised: '#1b1b1e',
  fg: '#f2ede3',
  muted: '#968f84',
  line: '#26241f',
  accent: '#c9a86a',
  accentFg: '#0b0b0d',
  accentSoft: '#2a2419',
  bar: 'rgba(201,168,106,0.32)',
  gold: '#c9a86a',
  goldLine: 'rgba(201,168,106,0.35)',
  // Özet kartı: koyu metal kart
  heroGrad: ['#2a251c', '#16140f', '#0d0c0a'] as [string, string, string],
  heroFg: '#f4eee2',
  heroLabel: '#c9a86a',
  heroMuted: 'rgba(244,238,226,0.62)',
  heroTrack: 'rgba(201,168,106,0.18)',
  heroFill: '#c9a86a',
  warn: '#e0866b',
  warnSoft: '#33211b',
  good: '#9cc4a6',
  goodSoft: '#1a2a20',
  scrim: 'rgba(0,0,0,0.65)',
  cats: ['#5aa58b', '#d1a256', '#6f8fc9', '#8f98a6', '#c76b78', '#9a7cc4', '#c98fa2', '#a1978a'],
  statusBar: 'light' as 'dark' | 'light',
};

const ivory: typeof noir = {
  name: 'ivory',
  bg: '#f5f1e8',
  surface: '#fffdf8',
  raised: '#fbf7ee',
  fg: '#1a1813',
  muted: '#716a5e',
  line: '#e5ddcd',
  accent: '#86652b',
  accentFg: '#fffdf8',
  accentSoft: '#efe4cc',
  bar: 'rgba(154,119,55,0.28)',
  gold: '#86652b',
  goldLine: 'rgba(134,101,43,0.35)',
  heroGrad: ['#2a251c', '#1a1813', '#121110'],
  heroFg: '#f4eee2',
  heroLabel: '#d4b47a',
  heroMuted: 'rgba(244,238,226,0.62)',
  heroTrack: 'rgba(212,180,122,0.2)',
  heroFill: '#d4b47a',
  warn: '#b2502f',
  warnSoft: '#f5e2d9',
  good: '#3d7a57',
  goodSoft: '#dfeee4',
  scrim: 'rgba(20,18,14,0.45)',
  cats: ['#2f7d63', '#b07f2a', '#3f62a3', '#66707e', '#a7424f', '#75559f', '#a85f78', '#7d7367'],
  statusBar: 'dark',
};

export type Theme = typeof noir;
export type ThemeMode = 'noir' | 'ivory' | 'system';

// Başlıklar ve büyük tutarlar: Playfair Display (yüksek kontrastlı serif). Metinler sistem yazı tipinde.
export const FONTS = {
  display: 'PlayfairDisplay_700Bold',
  bold: 'PlayfairDisplay_600SemiBold',
  semi: 'PlayfairDisplay_600SemiBold',
};

export function useTheme(mode: ThemeMode = 'noir'): Theme {
  const scheme = useColorScheme();
  if (mode === 'system') return scheme === 'light' ? ivory : noir;
  return mode === 'ivory' ? ivory : noir;
}
