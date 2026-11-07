// Renk paleti: iki temel mod (Noir = koyu, Fildişi = açık), 10 vurgu rengi ve 4 zemin tonu.
// React Native'e bağımlı değildir; kontrast testleri Node'da bu dosyadan çalışır.
//
// "Noir" — oniks siyahı zemin, vurgu rengi (varsayılan şampanya altını), fildişi yazı;
// "Fildişi" — sıcak kırık beyaz zemin, koyu vurgu, oniks yazı.
// Vurgu yalnızca vurgu için kullanılır (seçili öğe, ana düğme, ince çerçeveler, özet kartı); her yere yayılmaz.
// Kategori renkleri ve hazır temalar Sanzo Wada'nın "A Dictionary of Color Combinations" kitabındaki renklerdendir
// (docs/DESIGN-2.md "Renk kombinasyonları"): her hazır tema kitaptaki bir kombinasyondur, numarası `wada` alanında.

export type Mode = 'noir' | 'ivory';
export type Accent = 'gold' | 'emerald' | 'sapphire' | 'amethyst' | 'rose' | 'copper' | 'coral' | 'ruby' | 'teal' | 'silver'
  | 'coralteal' | 'cobaltlime' | 'plumpeach' | 'indigoochre' | 'sagerust' | 'slaterose';
export type Tint = 'classic' | 'blue' | 'green' | 'plum' | 'midnight' | 'deepsea' | 'cobaltnight' | 'indigo' | 'sage' | 'slate';

export const ACCENTS: Accent[] = ['gold', 'emerald', 'sapphire', 'amethyst', 'rose', 'copper', 'coral', 'ruby', 'teal', 'silver', 'coralteal', 'cobaltlime', 'plumpeach', 'indigoochre', 'sagerust', 'slaterose'];
export const TINTS: Tint[] = ['classic', 'blue', 'green', 'plum', 'midnight', 'deepsea', 'cobaltnight', 'indigo', 'sage', 'slate'];
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
  copper:   { noir: '#df8f63', ivory: '#9a4821' },
  coral:    { noir: '#ff7f6a', ivory: '#a93425' },
  ruby:     { noir: '#fb7480', ivory: '#b3162d' },
  teal:     { noir: '#4cc0cc', ivory: '#1a6b75' },
  silver:   { noir: '#c0c4cd', ivory: '#555c69' },
  // Wada kombinasyonları: her modda zemine karşı kontrastı geçen renk (koyuda açık olan, açıkta koyu olan) vurgu olur.
  // Kitaptaki renkler aynen kullanılır; yalnızca kontrast için gerekirse açıklık (L*) ayarlanır (ΔE notu yanında).
  coralteal:   { noir: '#f48067', ivory: '#006f67' }, // No. 193: Grenadine Pink · Light Porcelain Green #00908a (L* −12)
  cobaltlime:  { noir: '#f8ed43', ivory: '#0065ae' }, // No. 333: Lemon Yellow · Blue #006eb8 (L* −3)
  plumpeach:   { noir: '#d8a37b', ivory: '#501345' }, // No. 238: Ochraceous Salmon · Cotinga Purple
  indigoochre: { noir: '#e2b540', ivory: '#1c4286' }, // No. 126: Yellow Ocher · Deep Lyons Blue
  sagerust:    { noir: '#da6558', ivory: '#ab3d34' }, // No. 137: Etruscan Red #c55347 (koyuda L* +7, açıkta L* −8)
  slaterose:   { noir: '#f8b6ba', ivory: '#34454c' }, // No. 27: Corinthian Pink · Slate Color
};

/**
 * Kombinasyonun öbür renkleri, yalnızca özet kartında: `color` kartın zemin rengi (gradyan; k = siyaha karışım oranları: üst, orta, alt),
 * `alt` geometrik motifin ikinci rengi, `label` (verilirse) kart üstündeki etiket/dolgu rengi; verilmezse vurgu renginin koyu moddaki tonu.
 */
export const SECONDARY: Partial<Record<Accent, { color: string; k: [number, number, number]; alt: string; label?: string }>> = {
  coralteal:   { color: '#00908a', k: [0.6, 0.74, 0.86], alt: '#fbe6a0' },          // Light Porcelain Green; Naples Yellow
  cobaltlime:  { color: '#006eb8', k: [0.38, 0.62, 0.8], alt: '#96d1aa' },          // Blue; Cobalt Green
  plumpeach:   { color: '#501345', k: [0, 0.42, 0.7], alt: '#a1a39a' },             // Cotinga Purple; Warm Gray
  indigoochre: { color: '#1c4286', k: [0.12, 0.48, 0.74], alt: '#ebd3a2' },         // Deep Lyons Blue; Ivory Buff
  sagerust:    { color: '#648f7b', k: [0.52, 0.7, 0.84], alt: '#c55347', label: '#fdc57e' }, // Pistachio Green; Etruscan Red; Cinnamon Buff
  slaterose:   { color: '#34454c', k: [0.06, 0.44, 0.72], alt: '#34454c' },         // Slate Color (motifte açılır: ton üstüne ton)
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
  // Hazır temaların zeminleri (Wada): tonu kombinasyonun bir renginden (koyuda zemin rengi, açıkta açık ya da zemin rengi) alınır,
  // açıklık ve doygunluk ise role göre sabittir (koyu: L* 3.6 / 7.4 / 11 / 16.5, C* ≈ 3–8; açık: L* 95 / 99 / 97 / 88, C* ≈ 2–8).
  // Böylece zemin renkli görünmez, yalnızca kombinasyonun sıcaklığını/soğukluğunu taşır.
  midnight: { // No. 238: Cotinga Purple / Ochraceous Salmon
    noir:  { bg: '#110b10', surface: '#1a1519', raised: '#221c20', line: '#2f262d' },
    ivory: { bg: '#f9f0ea', surface: '#fffcfa', raised: '#fef6f1', line: '#ebdcd2' },
  },
  deepsea: { // No. 193: Light Porcelain Green
    noir:  { bg: '#040f0e', surface: '#0f1817', raised: '#151f1f', line: '#1d2c2a' },
    ivory: { bg: '#e9f4f3', surface: '#f9fefd', raised: '#f0faf9', line: '#cfe2e0' },
  },
  cobaltnight: { // No. 333: Blue
    noir:  { bg: '#080d15', surface: '#12171f', raised: '#181e28', line: '#212937' },
    ivory: { bg: '#eef2fa', surface: '#fbfdff', raised: '#f4f8ff', line: '#d8dfed' },
  },
  indigo: { // No. 126: Deep Lyons Blue / Ivory Buff
    noir:  { bg: '#0c0c14', surface: '#15161d', raised: '#1c1d26', line: '#262834' },
    ivory: { bg: '#f8f0e4', surface: '#fffdf8', raised: '#fdf7ec', line: '#e8ddc9' },
  },
  sage: { // No. 137: Pistachio Green
    noir:  { bg: '#060f0b', surface: '#111814', raised: '#171f1b', line: '#202b26' },
    ivory: { bg: '#ebf4ef', surface: '#fafefc', raised: '#f2f9f5', line: '#d3e2da' },
  },
  slate: { // No. 27: Slate Color
    noir:  { bg: '#050e12', surface: '#10181b', raised: '#161f23', line: '#1e2b30' },
    ivory: { bg: '#ebf3f7', surface: '#fafeff', raised: '#f2f9fc', line: '#d2e1e7' },
  },
};

/**
 * Hazır temalar: vurgu + zemin tonu birlikte; açık/koyu mod seçimine dokunmaz. Her biri Wada'nın kitabındaki bir kombinasyondur:
 * `wada` = kombinasyon numarası, `colors` = kombinasyonun kitaptaki renkleri (değiştirilmemiş; kartta örnek olarak gösterilir).
 * Sıra: zemin (özet kartı) rengi, vurgu, motif rengi, varsa dördüncü renk.
 */
export type PresetId = 'coral' | 'cobalt' | 'plum' | 'indigo' | 'sage' | 'slate';
export const PRESETS: { id: PresetId; accent: Accent; tint: Tint; wada: number; colors: string[] }[] = [
  { id: 'coral', accent: 'coralteal', tint: 'deepsea', wada: 193, colors: ['#00908a', '#f48067', '#fbe6a0'] },
  { id: 'cobalt', accent: 'cobaltlime', tint: 'cobaltnight', wada: 333, colors: ['#006eb8', '#f8ed43', '#96d1aa', '#ae5224'] },
  { id: 'plum', accent: 'plumpeach', tint: 'midnight', wada: 238, colors: ['#501345', '#d8a37b', '#a1a39a'] },
  { id: 'indigo', accent: 'indigoochre', tint: 'indigo', wada: 126, colors: ['#1c4286', '#e2b540', '#ebd3a2'] },
  { id: 'sage', accent: 'sagerust', tint: 'sage', wada: 137, colors: ['#648f7b', '#c55347', '#fdc57e'] },
  { id: 'slate', accent: 'slaterose', tint: 'slate', wada: 27, colors: ['#34454c', '#f8b6ba'] },
];
/** Geçerli vurgu + ton bir hazır temayla birebir eşleşiyorsa onu verir. */
export const presetOf = (accent: Accent, tint: Tint): PresetId | null => PRESETS.find((p) => p.accent === accent && p.tint === tint)?.id ?? null;

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
  // Özet kartı geometrik motifinin ikinci rengi ve kart üstündeki gelir/gider renkleri (kart her iki modda da koyu).
  // Şampanya (Isabella Color'a çok yakın) + Dark Medici Blue: Wada No. 241
  heroAlt: '#547076',
  heroGood: '#9cc4a6',
  heroWarn: '#e0866b',
  warn: '#e0866b',
  warnSoft: '#33211b',
  good: '#9cc4a6',
  goodSoft: '#1a2a20',
  scrim: 'rgba(0,0,0,0.65)',
  // Kategori renkleri (Wada; sıra: Market, Yeme-İçme, Ulaşım, Fatura, Sağlık, Eğlence, Giyim, Diğer):
  // Green, Raw Sienna, Olympic Blue, Artemesia Green (No. 293, 324), Etruscan Red, Aconite Violet, Laelia Pink, Ecru (No. 275, 327, 280).
  // Yeme-İçme (Raw Sienna) aynı zamanda bütçede "dikkat" (%80+) rengidir.
  cats: ['#489b6e', '#bb7125', '#5a82b3', '#709390', '#c55347', '#a36aa5', '#ca92a8', '#c2ae93'],
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
  heroAlt: '#547076',
  heroGood: '#9cc4a6',
  heroWarn: '#e0866b',
  warn: '#b2502f',
  warnSoft: '#f5e2d9',
  good: '#3d7a57',
  goodSoft: '#dfeee4',
  scrim: 'rgba(20,18,14,0.45)',
  // Açık zeminde ≥ 3:1 olsun diye açık tonların yerine aynı aileden koyu Wada renkleri: Diamine Green, Dark Medici Blue,
  // Veronia Purple (No. 13, Raw Sienna ile), Dark Citrine (No. 274, Olympic Blue ile)
  cats: ['#1a7444', '#bb7125', '#5a82b3', '#547076', '#c55347', '#a36aa5', '#8c4c62', '#8b835b'],
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
  const sec = SECONDARY[accent];
  const heroL = sec?.label ?? heroA;
  return {
    ...base,
    ...surf,
    accent: a,
    gold: a,
    accentFg: dark ? '#0b0b0d' : '#ffffff',
    accentSoft: mix(a, surf.bg, dark ? 0.84 : 0.9),
    bar: rgba(a, dark ? 0.32 : 0.28),
    goldLine: rgba(a, 0.35),
    heroGrad: sec ? sec.k.map((k) => mix(sec.color, '#000000', k)) as [string, string, string]
      : accent === 'gold' ? base.heroGrad : [mix(heroA, '#000000', 0.8), mix(heroA, '#000000', 0.89), mix(heroA, '#000000', 0.94)],
    heroLabel: accent === 'gold' ? base.heroLabel : heroL,
    heroFill: accent === 'gold' ? base.heroFill : heroL,
    heroTrack: accent === 'gold' ? base.heroTrack : rgba(heroL, 0.18),
    heroAlt: heroAltFor(accent, sec?.alt),
    // Kırmızı/turuncu vurgularda uyarı rengi vurguyla karışmasın (aşılan bütçe ile normal çubuk ayırt edilsin): kehribar kullanılır
    ...(WARM_ACCENTS.includes(accent) ? warnFor(accent === 'copper' ? 'red' : 'amber', dark, surf.bg) : {}),
  };
}

/** Kehribar (kırmızı/pembe vurgular için) ya da kırmızı (bakır için) uyarı tonu. */
function warnFor(kind: 'amber' | 'red', dark: boolean, bg: string) {
  const c = kind === 'amber' ? (dark ? '#f2b84b' : '#8a5600') : (dark ? '#ff7a7a' : '#b3263a');
  return { warn: c, warnSoft: dark ? mix(c, bg, 0.84) : mix(c, '#ffffff', 0.88) };
}

/** Uyarı rengiyle (turuncu-kırmızı) karışabilecek sıcak vurgular. */
export const WARM_ACCENTS: Accent[] = ['copper', 'coral', 'ruby', 'rose', 'coralteal', 'sagerust', 'slaterose'];

/**
 * Motifin ikinci rengi: hazır temada kombinasyonun motif rengi; yoksa soğuk vurgularda Isabella Color (Wada No. 12, Green Blue ile),
 * ötekilerde Dark Medici Blue (No. 241, varsayılanla aynı). Koyu karta karşı seçilebilir olsun diye gerekirse açılır.
 */
function heroAltFor(accent: Accent, secondary?: string): string {
  const c = secondary ?? (['emerald', 'sapphire', 'teal', 'amethyst'].includes(accent) ? '#c5a56e' : '#547076');
  return contrast(c, '#000000') < 3 ? mix(c, '#ffffff', 0.35) : c;
}
