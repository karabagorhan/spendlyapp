// Para birimleri, döviz kurları ve dönüşüm mantığı. React Native'e bağımlı değildir (Node'da test edilebilir).
//
// Kayıtlar her zaman GİRİLDİKLERİ para biriminde saklanır (`cur`); kur değişince saklanan veri değişmez.
// Ekranda gösterilirken kayıtlar o anki kurla ana para birimine çevrilir ("görünüm verisi", `viewData`).
// Kur yoksa ya da eski kayıt `cur` taşımıyorsa para birimi TRY sayılır (uygulama başlangıçta yalnızca ₺ idi).
import { fmtNumber, langInfo, t } from './i18n';
import type { Expense, Settings, Sub } from './lib';

export type Cur = 'TRY' | 'USD' | 'EUR' | 'GBP' | 'CNY';
export const CURRENCIES: { code: Cur; symbol: string }[] = [
  { code: 'TRY', symbol: '₺' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'CNY', symbol: '¥' },
];
export const CUR_CODES = CURRENCIES.map((c) => c.code);
export const isCur = (v: unknown): v is Cur => typeof v === 'string' && CUR_CODES.includes(v as Cur);
export const symbolOf = (c: Cur) => CURRENCIES.find((x) => x.code === c)!.symbol;
/** Para biriminin seçili dildeki adı ("Euro", "Dólar estadounidense"...). */
export const currencyName = (c: Cur) => t('currency.' + c);
/** Bütün simgeler: Amount bileşeni ve tutar okuma bunları tanır. */
export const SYMBOLS = CURRENCIES.map((c) => c.symbol);

export const round2 = (n: number) => Math.round((n + Number.EPSILON * Math.sign(n)) * 100) / 100;

/* ---------- Kurlar ---------- */

/** `rates[X]`: 1 ABD Doları kaç X eder (USD = 1). Çapraz kurlar USD üzerinden hesaplanır. */
export type Rates = {
  rates: Record<Cur, number>;
  /** Kurların cihaza çekildiği an (ms). */
  fetchedAt: number;
  /** Sağlayıcının kurlar için bildirdiği tarih (YYYY-MM-DD). */
  asOf: string;
  provider: string;
};

// Uygulamada uydurma/yerleşik kur yoktur: ilk başarılı çekimden önce kurlar `null`dır ve çevrim yapılamaz.

export const STALE_MS = 6 * 3600e3; // bu süreden eski kurlar açılışta/öne gelişte yenilenir
export const OLD_MS = 48 * 3600e3; // bu süreden eski kurlar "eski" diye işaretlenir (çevrimdışı uzun süre)

export const isStale = (r: Rates | null, now = Date.now()) => !r || now - r.fetchedAt > STALE_MS;

export function convert(amount: number, from: Cur, to: Cur, r: Rates) {
  if (from === to) return amount;
  return (amount / r.rates[from]) * r.rates[to];
}

/** Sağlayıcıdan gelen kurları doğrular; sayı olmayan, sıfır/negatif ya da akla uygun olmayan değerde null döner. */
export function validateRates(raw: any): Record<Cur, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out = { USD: 1 } as Record<Cur, number>;
  const range: Record<Cur, [number, number]> = { USD: [1, 1], EUR: [0.3, 3], GBP: [0.3, 3], TRY: [0.5, 5000], CNY: [1, 30] };
  for (const c of CUR_CODES) {
    if (c === 'USD') continue;
    const v = raw[c];
    if (typeof v !== 'number' || !isFinite(v) || v < range[c][0] || v > range[c][1]) return null;
    out[c] = v;
  }
  return out;
}

/** Kaydedilmiş kur nesnesini doğrular; bozuksa null (kur yok). */
export function normalizeRates(raw: any): Rates | null {
  const r = validateRates(raw?.rates);
  if (!r || typeof raw.fetchedAt !== 'number' || !isFinite(raw.fetchedAt)) return null;
  return { rates: r, fetchedAt: raw.fetchedAt, asOf: typeof raw.asOf === 'string' ? raw.asOf : '', provider: typeof raw.provider === 'string' ? raw.provider : '' };
}

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
type Provider = { name: string; url: string; parse: (j: any) => { rates: unknown; asOf: string } | null };

/** Sırayla denenen güvenilir, anahtarsız kur sağlayıcıları (ilki AB Merkez Bankası referans kurları). */
export const PROVIDERS: Provider[] = [
  {
    name: 'Frankfurter (ECB)',
    url: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR,GBP,CNY',
    parse: (j) => (j && j.base === 'USD' && j.rates ? { rates: j.rates, asOf: String(j.date ?? '') } : null),
  },
  {
    name: 'ExchangeRate-API',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (j) =>
      j && j.result === 'success' && j.rates
        ? { rates: j.rates, asOf: typeof j.time_last_update_unix === 'number' ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) : '' }
        : null,
  },
];

export class RatesError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const h = setTimeout(() => reject(new RatesError('timeout')), ms);
    p.then((v) => { clearTimeout(h); resolve(v); }, (e) => { clearTimeout(h); reject(e); });
  });
}

/** Güncel kurları çeker; bir sağlayıcı yanıt vermezse ya da geçersiz veri dönerse sıradakine geçer. Hepsi başarısızsa RatesError. */
export async function fetchRates(fetcher: FetchLike, now = Date.now(), timeoutMs = 8000): Promise<Rates> {
  for (const p of PROVIDERS) {
    try {
      const res = await withTimeout(fetcher(p.url), timeoutMs);
      if (!res.ok) continue;
      const parsed = p.parse(await withTimeout(res.json(), timeoutMs));
      const rates = parsed && validateRates(parsed.rates);
      if (parsed && rates) return { rates, fetchedAt: now, asOf: parsed.asOf, provider: p.name };
    } catch {
      // sıradaki sağlayıcıyı dene
    }
  }
  throw new RatesError('all providers failed');
}

/* ---------- Biçimleme ---------- */

/** Tutar, seçili dilin yazım kurallarıyla: tr/en "₺1.250,50" / "€1,250.50", es/it "1250,50 €". */
export function fmtMoney(n: number, cur: Cur, decimals = 2) {
  const li = langInfo();
  const body = fmtNumber(Math.abs(n), decimals).replace('−', '');
  const neg = n < 0 && Number(Math.abs(n).toFixed(decimals)) !== 0 ? '−' : '';
  const sym = symbolOf(cur);
  return li.symbolAfter ? `${neg}${body} ${sym}` : `${neg}${sym}${body}`;
}

/** Excel hücre biçimi: para biriminin simgesiyle (₺ $ € £). */
export const excelMoneyFormat = (c: Cur) => `#,##0.00 "${symbolOf(c)}"`;

// Ana para birimi: çizim sırasında ayarlanır (dil gibi); tüm ekranlar `money` ile bu birimde gösterir.
let main: Cur = 'TRY';
export function setMainCurrency(c: Cur) {
  main = c;
}
export const getMainCurrency = () => main;
export const money = (n: number, decimals = 2) => fmtMoney(n, main, decimals);
export const money0 = (n: number) => fmtMoney(n, main, 0);

/** Kurların güncellenme zamanı: "18 Eki 2026 14:32" / "Oct 18, 2026 2:32 PM". */
export function fmtStamp(ts: number, fmtTime: (d: Date) => string, monthShort: (i: number) => string) {
  const d = new Date(ts);
  return t('fmt.dateTime', { day: d.getDate(), month: monthShort(d.getMonth()), year: d.getFullYear(), time: fmtTime(d) });
}

/* ---------- Görünüm verisi: saklanan kayıtlar → ana para birimi ---------- */

type DataLike = { items: Expense[]; subs: Sub[]; settings: Settings };

/** Bir tutarı kendi para biriminden `to`ya çevirir (2 ondalığa yuvarlar). Kur yoksa ve birimler farklıysa null. */
export function toMain(amount: number, from: Cur, to: Cur, r: Rates | null) {
  if (from === to) return amount;
  return r ? round2(convert(amount, from, to, r)) : null;
}

/**
 * Ekranlarda kullanılacak veri: bütün tutarlar ana para biriminde. Çevrilen kayıtlarda `orig` özgün tutarı taşır.
 * Saklanan veriye dokunmaz (yeni nesneler döndürür).
 */
export function viewData(d: DataLike, mainCur: Cur, r: Rates | null): DataLike {
  // Kur yokken çevrilemeyen kayıtlar özgün tutar ve para birimiyle kalır (cur ≠ ana birim); arayüz bunu uyarıyla belirtir.
  const conv = <T extends { amount: number; cur?: Cur }>(x: T): T & { cur: Cur; orig?: { amount: number; cur: Cur } } => {
    const c = x.cur ?? 'TRY';
    const v = toMain(x.amount, c, mainCur, r);
    if (v === null) return { ...x, cur: c };
    return c === mainCur ? { ...x, cur: mainCur } : { ...x, amount: v, cur: mainCur, orig: { amount: x.amount, cur: c } };
  };
  const s = d.settings;
  const catBudgets: Record<string, number> = {};
  const catBudgetCur: Record<string, Cur> = {};
  for (const k of Object.keys(s.catBudgets)) {
    const c = s.catBudgetCur[k] ?? 'TRY';
    const v = toMain(s.catBudgets[k], c, mainCur, r);
    catBudgets[k] = v ?? s.catBudgets[k];
    catBudgetCur[k] = v === null ? c : mainCur;
  }
  const b = toMain(s.budget, s.budgetCur, mainCur, r);
  return {
    items: d.items.map(conv),
    subs: d.subs.map(conv),
    settings: { ...s, currency: mainCur, budget: b ?? s.budget, budgetCur: b === null ? s.budgetCur : mainCur, catBudgets, catBudgetCur },
  };
}

/**
 * Ekrandan (ana para biriminde) gelen ayarları saklanacak biçime geri çevirir. Kullanıcının dokunmadığı bütçe/limitler
 * özgün tutar ve para birimiyle kalır; böylece para birimini değiştirip geri almak tutarları kaydırmaz.
 */
export function fromViewSettings(next: Settings, stored: Settings, view: Settings): Settings {
  const keep = next.budget === view.budget;
  const catBudgets: Record<string, number> = {};
  const catBudgetCur: Record<string, Cur> = {};
  for (const k of Object.keys(next.catBudgets)) {
    const same = next.catBudgets[k] === view.catBudgets[k] && stored.catBudgets[k] !== undefined;
    catBudgets[k] = same ? stored.catBudgets[k] : next.catBudgets[k];
    catBudgetCur[k] = same ? stored.catBudgetCur[k] ?? 'TRY' : view.currency;
  }
  return {
    ...next,
    budget: keep ? stored.budget : next.budget,
    budgetCur: keep ? stored.budgetCur : view.currency,
    catBudgets,
    catBudgetCur,
  };
}

/** Giriş formundaki "≈ ₺…" ipucu ve benzerleri için: kaynak para biriminden ana birime çevrilmiş tutar. */
export const approx = (amount: number, from: Cur, r: Rates | null) => toMain(amount, from, main, r);

/** Saklanan veride ana birimden farklı para biriminde tutar var mı? (Varsa kur gerekir ve kur notu gösterilir.) */
export function needsRates(d: DataLike, mainCur: Cur) {
  const s = d.settings;
  return (
    d.items.some((x) => (x.cur ?? 'TRY') !== mainCur) || d.subs.some((x) => (x.cur ?? 'TRY') !== mainCur) ||
    (s.budget > 0 && s.budgetCur !== mainCur) || Object.keys(s.catBudgets).some((k) => (s.catBudgetCur[k] ?? 'TRY') !== mainCur)
  );
}
