import { createContext, useContext } from 'react';
import en from './en';
import es from './es';
import it from './it';
import tr from './tr';
import zh from './zh';

/**
 * Çoklu dil altyapısı.
 *
 * - Metinler `src/i18n/<dil>.ts` katalog dosyalarında tutulur; anahtarlar Türkçe katalogdan (tr.ts) gelir.
 * - `t('anahtar', { n: 3 })`: {ad} yer tutucuları doldurulur; değer nesneyse `n` ile çoğul biçim seçilir.
 * - Kategori ve abonelik türü kimlikleri veride Türkçe/İngilizce sabit anahtar olarak kalır (yedekler uyumlu);
 *   ekranda `cat.<kimlik>` / `subtype.<anahtar>` anahtarlarıyla çevrilmiş adı gösterilir.
 * - Seçili dil `Settings.language` içinde kalıcı saklanır; <LanguageProvider> değiştiğinde ağaç yeniden çizilir.
 */

export type Lang = 'tr' | 'en' | 'es' | 'it' | 'zh';
export type PluralForms = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
export type Entry = string | PluralForms;
export type Catalog = Record<string, Entry>;
type Params = Record<string, string | number>;

type Compact = { min: number; div: number; suffix: string };
export type LangInfo = {
  code: Lang;
  /** Dilin kendi yazısıyla adı (dil seçiminde gösterilir, çevrilmez). */
  native: string;
  /** BCP-47: büyük/küçük harf dönüşümü için. */
  locale: string;
  group: string;
  decimal: string;
  /** Binlik ayracı konması için tam kısmın en az kaç haneli olması gerektiği (CLDR: es/it'te 4 haneli sayılar gruplanmaz: "1250,50"). */
  minGroup: number;
  /** Para simgesinin yeri: tr/en'de önde ("₺1.250,50"), es/it'te sonda ("1.250,50 €"). */
  symbolAfter: boolean;
  /** Saat gösterimi: İngilizcede 12 saatli ("2:32 PM"), diğerlerinde 24 saatli. */
  hour12: boolean;
  plural: (n: number) => 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
  compact: Compact[];
};

export const LANGS: LangInfo[] = [
  { code: 'tr', native: 'Türkçe', locale: 'tr-TR', group: '.', decimal: ',', minGroup: 4, symbolAfter: false, hour12: false, plural: () => 'other', compact: [{ min: 1e6, div: 1e6, suffix: ' Mn' }, { min: 1e3, div: 1e3, suffix: ' B' }] },
  { code: 'en', native: 'English', locale: 'en-US', group: ',', decimal: '.', minGroup: 4, symbolAfter: false, hour12: true, plural: (n) => (n === 1 ? 'one' : 'other'), compact: [{ min: 1e6, div: 1e6, suffix: 'M' }, { min: 1e3, div: 1e3, suffix: 'K' }] },
  { code: 'es', native: 'Español', locale: 'es-ES', group: '.', decimal: ',', minGroup: 5, symbolAfter: true, hour12: false, plural: (n) => (n === 1 ? 'one' : 'other'), compact: [{ min: 1e6, div: 1e6, suffix: ' M' }, { min: 1e3, div: 1e3, suffix: ' mil' }] },
  { code: 'it', native: 'Italiano', locale: 'it-IT', group: '.', decimal: ',', minGroup: 5, symbolAfter: true, hour12: false, plural: (n) => (n === 1 ? 'one' : 'other'), compact: [{ min: 1e6, div: 1e6, suffix: ' Mln' }, { min: 1e3, div: 1e3, suffix: 'K' }] },
  // Çince: 4 haneli gruplama (万 = 10 bin, 亿 = 100 milyon) yerine CLDR'nin virgüllü biçimi; kısaltmalarda 万/亿
  { code: 'zh', native: '简体中文', locale: 'zh-CN', group: ',', decimal: '.', minGroup: 4, symbolAfter: false, hour12: false, plural: () => 'other', compact: [{ min: 1e8, div: 1e8, suffix: '亿' }, { min: 1e4, div: 1e4, suffix: '万' }] },
];

export const CATALOGS: Record<Lang, Catalog> = { tr, en, es, it, zh };
export const isLang = (v: unknown): v is Lang => typeof v === 'string' && LANGS.some((l) => l.code === v);

let current: Lang = 'tr';
export function setLanguage(l: Lang) {
  current = l;
}
export const getLanguage = () => current;
export const langInfo = (l: Lang = current) => LANGS.find((x) => x.code === l) ?? LANGS[0];

/** Çeviri; anahtar seçili dilde yoksa Türkçeye, o da yoksa anahtarın kendisine düşer (testlerde kolay fark edilsin diye). */
export function t(key: string, params?: Params): string {
  let e: Entry | undefined = CATALOGS[current][key];
  if (e === undefined) e = CATALOGS.tr[key];
  if (e === undefined) return key;
  let s: string;
  if (typeof e === 'string') s = e;
  else {
    const form = langInfo().plural(Number(params?.n ?? 0));
    s = e[form] ?? e.other;
  }
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? '' : String(params[k]))) : s;
}

export const has = (key: string) => CATALOGS[current][key] !== undefined;
export const upper = (s: string) => s.toLocaleUpperCase(langInfo().locale);
export const lower = (s: string) => s.toLocaleLowerCase(langInfo().locale);

/** Dil değişince tüm ekranların yeniden çizilmesi için. */
const LangContext = createContext<Lang>('tr');
export const LanguageProvider = LangContext.Provider;
export const useLanguage = () => useContext(LangContext);

/* ---------- Sayı biçimleri ---------- */
function group(intPart: string, sep: string, minDigits: number) {
  return intPart.length < minDigits ? intPart : intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
export function fmtNumber(n: number, decimals = 2) {
  const li = langInfo();
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(decimals).split('.');
  return `${neg ? '−' : ''}${group(int, li.group, li.minGroup)}${dec ? li.decimal + dec : ''}`;
}
export function fmtCompact(n: number) {
  const li = langInfo();
  for (const c of li.compact) {
    if (n >= c.min) return (n / c.div).toFixed(1).replace(/\.0$/, '').replace('.', li.decimal) + c.suffix;
  }
  return String(Math.round(n));
}
/** Saat: 24 saatli "14:32" ya da İngilizcede "2:32 PM". */
export function fmtTime(d: Date) {
  const m = String(d.getMinutes()).padStart(2, '0');
  if (!langInfo().hour12) return `${String(d.getHours()).padStart(2, '0')}:${m}`;
  return `${d.getHours() % 12 || 12}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
/** Ondalık ayracı seçili dile göre ("125,5" / "125.5"). */
export const decimalText = (n: number) => String(n).replace('.', langInfo().decimal);
/** Yüzde metni seçili dilin sırasıyla: Türkçe "%165", İngilizce "165%" (katalogdaki `fmt.percent`). */
export const fmtPercent = (n: number | string) => t('fmt.percent', { n });

/**
 * Kullanıcının yazdığı tutarı sayıya çevirir; geçersiz ya da sıfırsa 0.
 * İki ayraç da varsa sonuncusu ondalıktır ("1.250,50", "1,250.50").
 * Tek ayraç: birden çok kez geçiyorsa binliktir; bir kez geçiyorsa ve sonrasında tam 3 hane varsa
 * (yalnızca o dilin bin ayracıysa) binlik, aksi halde ondalıktır.
 * `lang` verilirse seçili dil yerine o dilin kuralları kullanılır (ör. kestirme bağlantıları her zaman 'tr').
 */
export function parseAmount(input: string, lang: Lang = current): number {
  const s = String(input).trim().replace(/[\s  ']/g, '').replace(/[₺$€£¥￥]/g, '');
  if (!/^[\d.,]+$/.test(s)) return 0;
  const li = langInfo(lang);
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    normalized = s.split(thou).join('').replace(dec, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = s.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length > 2) normalized = parts.join('');
    else if (tail.length === 3 && sep === li.group && parts[0] !== '' && parts[0] !== '0') normalized = parts.join('');
    else normalized = parts.join('.');
  } else normalized = s;
  const n = parseFloat(normalized);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
