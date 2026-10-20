// Veri tipleri, tarih/para yardımcıları ve analiz hesapları.
// Web sürümüyle (harcama-defteri.html) aynı veri biçimini kullanır; yedekler iki yönde de taşınabilir.
import { Cur, money, money0 } from './currency';
import type { Accent, Tint } from './palette';
import { Lang, decimalText, fmtCompact, has, lower, parseAmount as parseAmountI18n, t } from './i18n';

export type Expense = {
  id: string;
  amount: number;
  cat: string;
  note: string;
  date: string; // YYYY-MM-DD
  ts: number;
  sub?: string; // abonelik ödemesiyse aboneliğin id'si
  period?: string; // abonelik dönemi: "2026-10" (aylık) ya da "2026" (yıllık)
  cur?: Cur; // girildiği para birimi (yoksa TRY: eski kayıtlar)
  orig?: { amount: number; cur: Cur }; // yalnızca ekran verisinde: çevrilmeden önceki özgün tutar
};

export type Sub = {
  id: string;
  name: string;
  amount: number;
  day: number;
  freq: 'monthly' | 'yearly';
  month: number; // yıllık aboneliklerde 1-12
  cat: string; // ödendiğinde harcamaya yazılacak kategori
  skip: string; // atlanan son dönem
  type: string; // abonelik türü (SUB_TYPES anahtarı)
  cur?: Cur; // girildiği para birimi (yoksa TRY)
  orig?: { amount: number; cur: Cur }; // yalnızca ekran verisinde
};

export type Settings = {
  budget: number;
  remind: boolean;
  remindHour: number;
  subRemind: boolean;
  catBudgets: Record<string, number>; // kategori başına aylık limit (0 / yok = limitsiz)
  theme: 'noir' | 'ivory' | 'system';
  accent: Accent; // vurgu rengi (renk kartelası)
  tint: Tint; // zemin tonu
  name: string; // menüdeki profil satırında görünen ad
  language: Lang; // arayüz dili
  currency: Cur; // ana para birimi: tüm ekranlar bu birimde gösterir (dilden bağımsız)
  budgetCur: Cur; // `budget` tutarının para birimi
  catBudgetCur: Record<string, Cur>; // kategori limitlerinin para birimleri (yoksa TRY)
};

/** Kategori kimlikleri veride bu sabit adlarla saklanır (yedekler uyumlu kalsın); ekranda `catName` ile çevrilir. */
export const CATS = ['Market', 'Yeme-İçme', 'Ulaşım', 'Fatura', 'Sağlık', 'Eğlence', 'Giyim', 'Diğer'];
/** Kategorinin seçili dildeki adı; bilinmeyen kimlik olduğu gibi gösterilir. */
export const catName = (c: string) => (has('cat.' + c) ? t('cat.' + c) : c);
export const monthName = (i: number) => t('month.' + i); // i: 0-11
export const monthShortName = (i: number) => t('monthShort.' + i);
export const weekdayName = (i: number) => t('weekday.' + i); // i: 0 = Pazar (Date.getDay)
export const weekdayShortName = (i: number) => t('weekdayShort.' + i);

export function catIndex(c: string) {
  const i = CATS.indexOf(c);
  return i < 0 ? CATS.length - 1 : i;
}

/* ---------- Tarih ---------- */
export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseIso(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const todayIso = () => iso(new Date());
export const today0 = () => parseIso(todayIso());
export function daysIn(ym: string) {
  const d = parseIso(ym + '-01');
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
export function addMonths(ym: string, n: number) {
  const d = parseIso(ym + '-01');
  d.setMonth(d.getMonth() + n);
  return iso(d).slice(0, 7);
}
export function addDays(s: string, n: number) {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function monthLabel(ym: string) {
  const d = parseIso(ym + '-01');
  return t('fmt.monthYear', { month: monthName(d.getMonth()), year: d.getFullYear() });
}
/** Yalnızca ay adı ("Ekim", "October"). */
export function monthOnly(ym: string) {
  return monthName(parseIso(ym + '-01').getMonth());
}
export function shortDay(s: string) {
  const d = parseIso(s);
  return t('fmt.dayShort', { day: d.getDate(), month: monthShortName(d.getMonth()) });
}
export function dayLabel(s: string) {
  if (s === todayIso()) return t('date.today');
  if (s === addDays(todayIso(), -1)) return t('date.yesterday');
  const d = parseIso(s);
  return t('fmt.dayLong', { day: d.getDate(), month: monthName(d.getMonth()), weekday: weekdayName(d.getDay()) });
}

/* ---------- Para ---------- */
export { money, money0 };
export const compact = fmtCompact;
/** "1.250,50", "1,250.50", "125.5", "₺ 40" gibi girdileri sayıya çevirir; geçersizse 0. */
export const parseAmount = parseAmountI18n;
/** Giriş alanına yazılacak tutar metni (seçili dilin ondalık ayracıyla). */
export const amountText = decimalText;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const sum = (arr: { amount: number }[]) => arr.reduce((s, x) => s + x.amount, 0);

/* ---------- Ay analizi ---------- */
export type Analysis = {
  isCur: boolean;
  dim: number;
  elapsed: number;
  total: number;
  perDay: Record<string, number>;
  topDay: string | null;
  avg: number;
  prevSame: number;
  curSame: number;
  cutoff: number;
  projection: number;
};

export function analyse(items: Expense[], ym: string): Analysis {
  const now = new Date();
  const isCur = ym === todayIso().slice(0, 7);
  const dim = daysIn(ym);
  const elapsed = isCur ? now.getDate() : dim;
  const monthItems = items.filter((x) => x.date.slice(0, 7) === ym);
  const total = sum(monthItems);
  const perDay: Record<string, number> = {};
  monthItems.forEach((x) => (perDay[x.date] = (perDay[x.date] || 0) + x.amount));
  let topDay: string | null = null;
  Object.keys(perDay).forEach((k) => {
    if (!topDay || perDay[k] > perDay[topDay]) topDay = k;
  });
  // Geçen ayın aynı günleriyle karşılaştırma (ör. 1–16 Ekim ile 1–16 Eylül)
  const prevYm = addMonths(ym, -1);
  const cutoff = Math.min(elapsed, daysIn(prevYm));
  const prevSame = sum(items.filter((x) => x.date.slice(0, 7) === prevYm && +x.date.slice(8) <= cutoff));
  const curSame = sum(monthItems.filter((x) => +x.date.slice(8) <= cutoff));
  return {
    isCur, dim, elapsed, total, perDay, topDay,
    avg: elapsed ? total / elapsed : 0,
    prevSame, curSame, cutoff,
    projection: isCur && elapsed ? (total / elapsed) * dim : total,
  };
}

/* ---------- Abonelikler ---------- */
export type SubState =
  | { state: 'pending'; due: Date; period: string }
  | { state: 'upcoming'; due: Date; period: string; days: number }
  | { state: 'paid' | 'skipped'; due: Date; next: Date; period: string };

export function subPeriod(s: Sub, ref: Date) {
  return s.freq === 'yearly' ? String(ref.getFullYear()) : iso(ref).slice(0, 7);
}
export function dueDate(s: Sub, y: number, m: number) {
  const mm = s.freq === 'yearly' ? s.month - 1 : m;
  const last = new Date(y, mm + 1, 0).getDate();
  return new Date(y, mm, Math.min(s.day, last));
}
export function subStatus(s: Sub, items: Expense[]): SubState {
  const now = today0();
  const period = subPeriod(s, now);
  const due = dueDate(s, now.getFullYear(), now.getMonth());
  const paid = items.some((x) => x.sub === s.id && x.period === period);
  const skipped = s.skip === period;
  if (paid || skipped) {
    const next = s.freq === 'yearly' ? dueDate(s, now.getFullYear() + 1, 0) : dueDate(s, now.getFullYear(), now.getMonth() + 1);
    return { state: paid ? 'paid' : 'skipped', due, next, period };
  }
  if (due <= now) return { state: 'pending', due, period };
  return { state: 'upcoming', due, period, days: Math.round((due.getTime() - now.getTime()) / 864e5) };
}
export const monthlyCost = (s: Sub) => (s.freq === 'yearly' ? s.amount / 12 : s.amount);

/* ---------- Raporlar ---------- */
/** Haftanın her günü için gün başına ortalama harcama (Pazartesi'den başlar). */
export function weekdayAverages(items: Expense[], ym: string) {
  const a = analyse(items, ym);
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let d = 1; d <= a.elapsed; d++) counts[(parseIso(`${ym}-${pad(d)}`).getDay() + 6) % 7]++;
  items.filter((x) => x.date.slice(0, 7) === ym).forEach((x) => (totals[(parseIso(x.date).getDay() + 6) % 7] += x.amount));
  // Pazartesi'den başlar: i=0 → Date.getDay() 1
  return counts.map((c, i) => ({ key: String(i), label: weekdayShortName((i + 1) % 7), value: c ? totals[i] / c : 0 }));
}

/** Kategori bazında bu ay ile geçen ayın aynı dönemi. */
export function categoryCompare(items: Expense[], ym: string) {
  const a = analyse(items, ym);
  const prevYm = addMonths(ym, -1);
  const cur: Record<string, number> = {};
  const prev: Record<string, number> = {};
  items.forEach((x) => {
    const day = +x.date.slice(8);
    if (x.date.slice(0, 7) === ym && day <= a.cutoff) cur[x.cat] = (cur[x.cat] || 0) + x.amount;
    if (x.date.slice(0, 7) === prevYm && day <= a.cutoff) prev[x.cat] = (prev[x.cat] || 0) + x.amount;
  });
  return { cur, prev };
}

/** Son 90 günde en sık girilen (kategori + not) ikilileri, son tutarlarıyla. */
export function frequentEntries(items: Expense[], limit = 6) {
  const since = addDays(todayIso(), -90);
  const map: Record<string, { cat: string; note: string; amount: number; count: number; ts: number }> = {};
  items.forEach((x) => {
    if (!x.note || x.sub || x.date < since) return;
    const k = x.cat + '|' + lower(x.note);
    const m = map[k];
    if (!m) map[k] = { cat: x.cat, note: x.note, amount: x.amount, count: 1, ts: x.ts };
    else {
      m.count++;
      if (x.ts > m.ts) { m.amount = x.amount; m.ts = x.ts; }
    }
  });
  return Object.values(map).filter((m) => m.count >= 2).sort((p, q) => q.count - p.count || q.ts - p.ts).slice(0, limit);
}

export type Insight = { kind: 'warn' | 'good' | 'info'; text: string };

/** Seçili ay için kısa, otomatik yorumlar. En önemlisi başta. */
/** "Geçen aya göre en çok değişen kategori" yorumu için en az fark (ana para biriminde; ≈ 100 ₺). */
export const MIN_CHANGE: Record<Cur, number> = { TRY: 100, USD: 3, EUR: 3, GBP: 3, CNY: 20 };

export function insights(items: Expense[], ym: string, settings: Settings): Insight[] {
  const a = analyse(items, ym);
  const out: Insight[] = [];
  const month = items.filter((x) => x.date.slice(0, 7) === ym);
  if (!month.length) return out;
  const by: Record<string, number> = {};
  month.forEach((x) => (by[x.cat] = (by[x.cat] || 0) + x.amount));

  // Kategori limitleri
  Object.keys(settings.catBudgets).forEach((c) => {
    const lim = settings.catBudgets[c];
    const v = by[c] || 0;
    if (!lim) return;
    if (v > lim) out.push({ kind: 'warn', text: t('insight.catOver', { cat: catName(c), over: money0(v - lim), spent: money0(v), limit: money0(lim) }) });
    else if (v >= lim * 0.8) out.push({ kind: 'warn', text: t('insight.catNear', { cat: catName(c), pct: Math.round((v / lim) * 100), left: money0(lim - v) }) });
  });

  // Bütçe gidişatı
  if (a.isCur && settings.budget && a.elapsed >= 3) {
    const diff = a.projection - settings.budget;
    if (diff > 0) out.push({ kind: 'warn', text: t('insight.projOver', { amount: money0(diff) }) });
    else out.push({ kind: 'good', text: t('insight.projUnder', { amount: money0(-diff) }) });
  }

  // En çok harcanan kategori
  const top = Object.keys(by).sort((p, q) => by[q] - by[p])[0];
  out.push({ kind: 'info', text: t('insight.topCat', { cat: catName(top), amount: money0(by[top]), pct: Math.round((by[top] / a.total) * 100) }) });

  // Geçen aya göre en çok değişen kategori
  const { cur, prev } = categoryCompare(items, ym);
  let best: { c: string; d: number } | null = null;
  Object.keys({ ...cur, ...prev }).forEach((c) => {
    const d = (cur[c] || 0) - (prev[c] || 0);
    if ((prev[c] || 0) > 0 && Math.abs(d) >= MIN_CHANGE[settings.currency] && (!best || Math.abs(d) > Math.abs(best.d))) best = { c, d };
  });
  if (best) {
    const b = best as { c: string; d: number };
    out.push({ kind: b.d > 0 ? 'warn' : 'good', text: t(b.d > 0 ? 'insight.catUp' : 'insight.catDown', { cat: catName(b.c), amount: money0(Math.abs(b.d)) }) });
  }

  // Hafta sonu / hafta içi
  const wd = weekdayAverages(items, ym);
  const weekday = (wd[0].value + wd[1].value + wd[2].value + wd[3].value + wd[4].value) / 5;
  const weekend = (wd[5].value + wd[6].value) / 2;
  if (weekday > 0 && weekend > weekday * 1.4) {
    out.push({ kind: 'info', text: t('insight.weekend', { amount: money0(weekend), ratio: decimalText(+(weekend / weekday).toFixed(1)) }) });
  }

  // Harcamasız günler
  const spentDays = new Set(month.map((x) => x.date)).size;
  const free = a.elapsed - spentDays;
  if (free >= 3) out.push({ kind: 'good', text: t('insight.freeDays', { n: free }) });

  return out;
}

/* ---------- Abonelik türleri ---------- */
export type SubType = { key: string; icon: string; cat: string; words: string[] };

/** Abonelik türleri; her biri ödendiğinde harcamalara yazılacak varsayılan kategoriyi ve ad tahmini için anahtar kelimeleri taşır. */
export const SUB_TYPES: SubType[] = [
  { key: 'yayin', icon: 'tv-outline', cat: 'Eğlence',
    words: ['netflix', 'spotify', 'youtube', 'disney', 'exxen', 'blutv', 'blu tv', 'prime video', 'apple music', 'apple tv', 'tabii', 'gain', 'mubi', 'deezer', 'tidal', 'tod', 'hbo', 'max', 'twitch'] },
  { key: 'iletisim', icon: 'wifi-outline', cat: 'Fatura',
    words: ['turkcell', 'vodafone', 'türk telekom', 'turk telekom', 'superonline', 'türknet', 'turknet', 'internet', 'telefon', 'hat', 'fiber', 'mobil', 'gsm'] },
  { key: 'ev', icon: 'flash-outline', cat: 'Fatura',
    words: ['elektrik', 'su', 'doğalgaz', 'dogalgaz', 'doğal gaz', 'igdaş', 'igdas', 'enerjisa', 'ck enerji', 'iski', 'aski', 'başkentgaz', 'isınma'] },
  { key: 'kira', icon: 'home-outline', cat: 'Fatura', words: ['kira', 'aidat', 'site', 'yönetim'] },
  { key: 'spor', icon: 'barbell-outline', cat: 'Sağlık',
    words: ['spor', 'gym', 'fitness', 'macfit', 'mac fit', 'pilates', 'yoga', 'salon', 'diyetisyen', 'eczane'] },
  { key: 'yazilim', icon: 'cloud-outline', cat: 'Diğer',
    words: ['icloud', 'google one', 'chatgpt', 'claude', 'openai', 'office', 'microsoft', 'adobe', 'dropbox', 'canva', 'notion', 'apple one', 'github', 'vpn'] },
  { key: 'sigorta', icon: 'shield-checkmark-outline', cat: 'Diğer', words: ['sigorta', 'kasko', 'dask', 'trafik sigortası'] },
  { key: 'egitim', icon: 'school-outline', cat: 'Diğer', words: ['kurs', 'okul', 'udemy', 'duolingo', 'eğitim', 'egitim', 'dershane', 'babbel', 'kitap'] },
  { key: 'ulasim', icon: 'car-outline', cat: 'Ulaşım', words: ['otopark', 'istanbulkart', 'hgs', 'ogs', 'araç', 'leasing', 'kiralık araç', 'akbil'] },
  { key: 'uyelik', icon: 'pricetag-outline', cat: 'Market',
    words: ['amazon prime', 'amazon', 'migros', 'trendyol', 'hepsiburada', 'getir', 'yemeksepeti', 'prime', 'premium'] },
  { key: 'diger', icon: 'ellipsis-horizontal', cat: 'Diğer', words: [] },
];

export function subType(key: string | undefined) {
  return SUB_TYPES.find((x) => x.key === key) ?? SUB_TYPES[SUB_TYPES.length - 1];
}
/** Abonelik türünün seçili dildeki adı. */
export const subLabel = (key: string | undefined) => t('subtype.' + subType(key).key);
export const subTypeIndex = (key: string | undefined) => Math.max(0, SUB_TYPES.findIndex((x) => x.key === key));

/** Abonelik adından tür tahmini ("Netflix" → Dijital yayın). Marka adları ortak; ek kelimeler Türkçe listeden ve seçili dilin kataloğundan (`subwords.<tür>`) gelir. */
export function guessSubType(name: string): string | null {
  const n = lower(name);
  const tokens = n.split(/[\s\-_.,;:!?()+&/]+/).filter(Boolean);
  for (const tp of SUB_TYPES) {
    const extra = has('subwords.' + tp.key) ? t('subwords.' + tp.key).split(',').map((w) => lower(w.trim())).filter(Boolean) : [];
    for (const w of tp.words.concat(extra)) {
      // Çince gibi boşluksuz yazılan diller: içerme. Kısa kelimelerde ek alan dillerde (kursu, hattı, kirası) kelime başı aranır; iki harfliler tam eşleşmeli ("su" ≠ "susam")
      const cjk = /[\u2e80-\u9fff]/.test(w);
      const hit = cjk || w.includes(' ') ? n.includes(w)
        : w.length <= 2 ? tokens.includes(w)
        : w.length <= 4 ? tokens.some((tk) => tk.startsWith(w))
        : n.includes(w);
      if (hit) return tp.key;
    }
  }
  return null;
}
