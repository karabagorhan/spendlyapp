// Renk paleti: iki temel mod (Noir = koyu, Fildişi = açık), 8 vurgu rengi ve 4 zemin tonu.
// React Native'e bağımlı değildir; kontrast testleri Node'da bu dosyadan çalışır.
//
// "Noir" — oniks siyahı zemin, vurgu rengi (varsayılan şampanya altını), fildişi yazı;
// "Fildişi" — sıcak kırık beyaz zemin, koyu vurgu, oniks yazı.
// Vurgu yalnızca vurgu için kullanılır (seçili öğe, ana düğme, ince çerçeveler, özet kartı); her yere yayılmaz.
// Kategori renkleri soluk mücevher tonlarıdır: zümrüt, kehribar, safir, arduvaz, yakut, ametist, gül, vizon.

export type Mode = 'noir' | 'ivory';
export type Accent = 'gold' | 'emerald' | 'sapphire' | 'amethyst' | 'rose' | 'copper' | 'teal' | 'silver';
export type Tint = 'classic' | 'blue' | 'green' | 'plum';

export const ACCENTS: Accent[] = ['gold', 'emerald', 'sapphire', 'amethyst', 'rose', 'copper', 'teal', 'silver'];
export const TINTS: Tint[] = ['classic', 'blue', 'green', 'plum'];
export const isAccent = (v: unknown): v is Accent => typeof v === 'string' && ACCENTS.includes(v as Accent);
export const isTint = (v: unknown): v is Tint => typeof v === 'string' && TINTS.includes(v as Tint);

/* ---------- Renk yardımcıları ---------- */
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** a rengine b rengini t oranında (0–1) karıştırır. */
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v * (1 - t) + y[i] * t));
};
export const rgba = (h: string, a: number) => `rgba(${rgb(h).join(',')},${a})`;
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG kontrast oranı (1–21). */
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

/* ---------- Vurgu renkleri: [koyu moddaki, açık moddaki] ---------- */
export const ACCENT_COLORS: Record<Accent, Record<Mode, string>> = {
  gold:     { noir: '#c9a86a', ivory: '#86652b' },
  emerald:  { noir: '#5fbf9a', ivory: '#1b6e53' },
  sapphire: { noir: '#7aa5e6', ivory: '#3158a0' },
  amethyst: { noir: '#ae93e6', ivory: '#6d4c9f' },
  rose:     { noir: '#e594aa', ivory: '#a3405f' },
  copper:   { noir: '#df8f63', ivory: '#a14d24' },
  teal:     { noir: '#4cc0cc', ivory: '#1a6b75' },
  silver:   { noir: '#c0c4cd', ivory: '#555c69' },
};

/* ---------- Zemin tonları ---------- */
type Surfaces = { bg: string; surface: string; raised: string; line: string };
export const TINT_COLORS: Record<Tint, Record<Mode, Surfaces>> = {
  classic: {
    noir:  { bg: '#0b0b0d', surface: '#141416', raised: '#1b1b1e', line: '#26241f' },
    ivory: { bg: '#f5f1e8', surface: '#fffdf8', raised: '#fbf7ee', line: '#e5ddcd' },
  },
  blue: {
    noir:  { bg: '#0a0d14', surface: '#10151f', raised: '#161c28', line: '#1f2736' },
    ivory: { bg: '#eef2f7', surface: '#fbfcfe', raised: '#f3f6fa', line: '#d9e0ea' },
  },
  green: {
    noir:  { bg: '#0a0e0c', surface: '#111613', raised: '#171d1a', line: '#222b26' },
    ivory: { bg: '#eef4ef', surface: '#fbfdfb', raised: '#f3f8f4', line: '#d8e4da' },
  },
  plum: {
    noir:  { bg: '#100b12', surface: '#171119', raised: '#1e1722', line: '#2c2231' },
    ivory: { bg: '#f6eff3', surface: '#fffbfd', raised: '#faf3f7', line: '#e8d9e1' },
  },
};

const noir = {
  name: 'noir' as Mode,
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
export type ThemeMode = Mode | 'system';
export const BASE: Record<Mode, Theme> = { noir, ivory };

/**
 * Temel mod + zemin tonu + vurgu rengi → tam tema. Varsayılan seçim (klasik + şampanya) özgün renkleri aynen verir.
 * Özet kartı her iki modda da koyudur; gradyanı ve ayrıntı rengi vurgunun koyu moddaki tonundan türetilir.
 */
export function makeTheme(mode: Mode, tint: Tint = 'classic', accent: Accent = 'gold'): Theme {
  const base = BASE[mode];
  const isDefault = tint === 'classic' && accent === 'gold';
  if (isDefault) return base;
  const surf = TINT_COLORS[tint][mode];
  // Şampanya altınının açık moddaki özgün tonu yumuşak zeminlerde 4.5:1'in altında kalır; farklı zemin tonlarında biraz koyusu kullanılır
  const a = accent === 'gold' && mode === 'ivory' ? '#7b5c22' : ACCENT_COLORS[accent][mode];
  const heroA = ACCENT_COLORS[accent].noir;
  const dark = mode === 'noir';
  return {
    ...base,
    ...surf,
    accent: a,
    gold: a,
    accentFg: dark ? '#0b0b0d' : '#ffffff',
    accentSoft: mix(a, surf.bg, dark ? 0.84 : 0.9),
    bar: rgba(a, dark ? 0.32 : 0.28),
    goldLine: rgba(a, 0.35),
    heroGrad: accent === 'gold' ? base.heroGrad : [mix(heroA, '#000000', 0.8), mix(heroA, '#000000', 0.89), mix(heroA, '#000000', 0.94)],
    heroLabel: accent === 'gold' ? base.heroLabel : heroA,
    heroFill: accent === 'gold' ? base.heroFill : heroA,
    heroTrack: accent === 'gold' ? base.heroTrack : rgba(heroA, 0.18),
  };
}
