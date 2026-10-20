/**
 * Para birimi, kur ve veri bütünlüğü testleri: `npx tsx scripts/currency-test.ts`
 *
 * NOT: Bu dosyadaki kur değerleri ve sağlayıcı yanıtları yalnızca TEST VERİSİDİR (uygulamaya girmez).
 * Uygulamada yerleşik/uydurma kur yoktur; gerçek kurlar yalnızca canlı API'den gelir. Canlı API çağrısı bu testte yapılmaz
 * (CI/ortam ağı kapalı olabilir); sağlayıcı yanıtlarının biçimi belgelenmiş JSON örnekleriyle taklit edilir.
 */
import {
  CURRENCIES, Cur, PROVIDERS, RatesError, Rates, convert, excelMoneyFormat, fetchRates, fmtMoney, fromViewSettings, isStale, needsRates,
  normalizeRates, round2, setMainCurrency, toMain, validateRates, viewData,
} from '../src/currency';
import { LANGS, Lang, fmtNumber, parseAmount, setLanguage, t } from '../src/i18n';
import { Expense, Settings, Sub, analyse, insights, MIN_CHANGE, sum } from '../src/lib';
import { Data, defaultSettings, merge, normalize } from '../src/store';

let fail = 0, pass = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name}: beklenen ${JSON.stringify(want)}, bulunan ${JSON.stringify(got)}`); }
};
const truthy = (name: string, v: unknown) => { if (v) pass++; else { fail++; console.log(`FAIL ${name}`); } };
const near = (name: string, got: number, want: number, eps = 1e-9) => truthy(`${name}: ${got} ≈ ${want}`, Math.abs(got - want) <= eps);
const sorted = (o: unknown): string => JSON.stringify(o, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
const deepFreeze = <T>(o: T): T => { if (o && typeof o === 'object') { Object.values(o as any).forEach(deepFreeze); Object.freeze(o); } return o; };

/* ===== 1. Biçimleme: Intl (CLDR) ile karşılaştırma ===== */
const values = [0, 0.5, 5, 40, 999.99, 1250.5, 9999.99, 12500.5, 1234567.89, -40, -1250.5];
for (const li of LANGS) {
  setLanguage(li.code as Lang);
  for (const c of CURRENCIES) {
    for (const v of values) {
      const ref = new Intl.NumberFormat(li.locale, { style: 'currency', currency: c.code, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(v).replace('-', '−').replace(/ /g, ' ');
      eq(`${li.code} ${c.code} ${v} Intl ile aynı`, fmtMoney(v, c.code), ref);
    }
  }
  // Sayı (simgesiz) ve 0 ondalık
  for (const v of [0, 7, 1234.5, 12345.678, 1e6]) {
    const ref = new Intl.NumberFormat(li.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    eq(`${li.code} fmtNumber ${v}`, fmtNumber(v), ref);
  }
  eq(`${li.code} 0 ondalık`, fmtMoney(1250.4, 'EUR', 0).replace(/\D/g, ''), '1250');
  // -0,004 yuvarlanınca eksi işareti kalmamalı
  truthy(`${li.code} -0.004 → eksisiz`, !fmtMoney(-0.004, 'USD').includes('−'));
}
// Örnek çıktılar (göz ile de okunur)
const samples: [Lang, Cur, number, string][] = [
  ['tr', 'TRY', 1250.5, '₺1.250,50'], ['tr', 'USD', 1250.5, '$1.250,50'], ['en', 'EUR', 1250.5, '€1,250.50'], ['en', 'GBP', 12500.5, '£12,500.50'],
  ['es', 'EUR', 1250.5, '1250,50 €'], ['es', 'EUR', 12500.5, '12.500,50 €'], ['it', 'GBP', 12500.5, '12.500,50 £'], ['it', 'TRY', 40, '40,00 ₺'],
];
for (const [l, c, v, want] of samples) { setLanguage(l); eq(`örnek ${l} ${c} ${v}`, fmtMoney(v, c), want); }

/* ===== 2. Tutar okuma: biçimlenmiş tutar geri okununca aynı sayı (her dil) ===== */
for (const li of LANGS) {
  setLanguage(li.code as Lang);
  for (const v of [0.5, 5, 40.25, 999.99, 1250.5, 9999.99, 12500.5, 1234567.89]) {
    eq(`${li.code} gidiş-dönüş ${v}`, parseAmount(fmtNumber(v)), v);
    for (const c of CURRENCIES) eq(`${li.code} simgeli gidiş-dönüş ${c.code} ${v}`, parseAmount(fmtMoney(v, c.code)), v);
  }
}
setLanguage('es');
eq('es 1.250', parseAmount('1.250'), 1250);
eq('es 1250,5', parseAmount('1250,5'), 1250.5);
eq('es 12,5', parseAmount('12,5'), 12.5);
eq('es 1,250.50 (karışık)', parseAmount('1,250.50'), 1250.5);
setLanguage('zh');
eq('zh 1,250.50', parseAmount('1,250.50'), 1250.5);
eq('zh ¥ 99.9', parseAmount('¥ 99.9'), 99.9);
eq('zh ￥1,000', parseAmount('￥1,000'), 1000);
eq('zh 12.5', parseAmount('12.5'), 12.5);
setLanguage('it');
eq('it 1.250,50 €', parseAmount('1.250,50 €'), 1250.5);
eq('it € 99,9', parseAmount('€ 99,9'), 99.9);
eq('it £10', parseAmount('£10'), 10);
eq('it $ 5.5', parseAmount('$ 5.5'), 5.5);

/* ===== 3. Dönüşüm hesapları (TEST kurları: 1 USD = 0.9 EUR = 0.8 GBP = 40 TRY = 7 CNY) ===== */
const R: Rates = { rates: { USD: 1, EUR: 0.9, GBP: 0.8, TRY: 40, CNY: 7 }, fetchedAt: Date.UTC(2026, 9, 18, 11, 32), asOf: '2026-10-18', provider: 'test' };
for (const c of CURRENCIES) near(`${c.code}→${c.code} aynı`, convert(123.45, c.code, c.code, R), 123.45);
near('USD→TRY', convert(100, 'USD', 'TRY', R), 4000);
near('TRY→USD', convert(4000, 'TRY', 'USD', R), 100);
near('EUR→TRY', convert(90, 'EUR', 'TRY', R), 4000);
near('GBP→EUR', convert(80, 'GBP', 'EUR', R), 90);
near('TRY→GBP', convert(4000, 'TRY', 'GBP', R), 80);
near('USD→CNY', convert(100, 'USD', 'CNY', R), 700);
near('CNY→TRY', convert(700, 'CNY', 'TRY', R), 4000);
near('EUR→CNY', convert(90, 'EUR', 'CNY', R), 700);
for (const a of CURRENCIES) for (const b of CURRENCIES) {
  near(`gidiş-dönüş ${a.code}→${b.code}→${a.code}`, convert(convert(777.77, a.code, b.code, R), b.code, a.code, R), 777.77, 1e-9);
  for (const c of CURRENCIES) near(`üçgen ${a.code}→${b.code}→${c.code}`, convert(convert(500, a.code, b.code, R), b.code, c.code, R), convert(500, a.code, c.code, R), 1e-9);
}
eq('round2', [round2(1.005), round2(2.675), round2(-1.236), round2(0)], [1.01, 2.68, -1.24, 0]);
eq('toMain aynı birim', toMain(10.123, 'EUR', 'EUR', null), 10.123);
eq('toMain kur yok', toMain(10, 'EUR', 'TRY', null), null);
eq('toMain', toMain(90, 'EUR', 'TRY', R), 4000);

/* ===== 4. Kur doğrulama ve çekme ===== */
eq('validateRates geçerli', sorted(validateRates({ TRY: 40, EUR: 0.9, GBP: 0.8, CNY: 7 })), sorted({ USD: 1, TRY: 40, EUR: 0.9, GBP: 0.8, CNY: 7 }));
eq('validateRates CNY eksik (eski kayıt)', validateRates({ TRY: 40, EUR: 0.9, GBP: 0.8 }), null);
eq('validateRates akıl dışı CNY', validateRates({ TRY: 40, EUR: 0.9, GBP: 0.8, CNY: 700 }), null);
eq('validateRates eksik TRY', validateRates({ EUR: 0.9, GBP: 0.8, CNY: 7 }), null);
eq('validateRates sıfır', validateRates({ TRY: 0, EUR: 0.9, GBP: 0.8, CNY: 7 }), null);
eq('validateRates negatif', validateRates({ TRY: -4, EUR: 0.9, GBP: 0.8, CNY: 7 }), null);
eq('validateRates metin', validateRates({ TRY: '40', EUR: 0.9, GBP: 0.8, CNY: 7 }), null);
eq('validateRates NaN', validateRates({ TRY: NaN, EUR: 0.9, GBP: 0.8, CNY: 7 }), null);
eq('validateRates akıl dışı EUR', validateRates({ TRY: 40, EUR: 90, GBP: 0.8, CNY: 7 }), null);
eq('validateRates null', validateRates(null), null);
eq('normalizeRates bozuk', normalizeRates({ rates: { TRY: 'x' } }), null);
eq('normalizeRates yok', normalizeRates(undefined), null);
eq('normalizeRates geçerli', sorted(normalizeRates(JSON.parse(JSON.stringify(R)))), sorted(R));
truthy('kur yoksa eski sayılır', isStale(null));
truthy('taze kur eski değil', !isStale(R, R.fetchedAt + 3600e3));
truthy('6 saatten eski → yenilenir', isStale(R, R.fetchedAt + 7 * 3600e3));

const ok = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });
const frankfurter = { amount: 1, base: 'USD', date: '2026-10-16', rates: { CNY: 7, EUR: 0.9, GBP: 0.8, TRY: 40 } }; // api.frankfurter.dev/v1/latest biçimi
const erApi = { result: 'success', time_last_update_unix: 1792281600, rates: { USD: 1, EUR: 0.91, GBP: 0.81, TRY: 41, CNY: 7.1, JPY: 150 } }; // open.er-api.com/v6/latest/USD biçimi
const NOW = 1_800_000_000_000;
(async () => {
  const seen: string[] = [];
  let r = await fetchRates(async (u) => { seen.push(u); return ok(frankfurter)(); }, NOW);
  eq('frankfurter ilk sağlayıcı', [seen.length, r.provider, r.asOf, r.fetchedAt, r.rates.TRY], [1, 'Frankfurter (ECB)', '2026-10-16', NOW, 40]);
  truthy('ilk istek doğru adrese', seen[0].startsWith('https://api.frankfurter.dev/v1/latest?base=USD') && /TRY/.test(seen[0]) && /CNY/.test(seen[0]));
  r = await fetchRates(async (u) => (u.includes('frankfurter') ? Promise.reject(new Error('ağ yok')) : ok(erApi)()), NOW);
  eq('ilki ağ hatası → ikinci sağlayıcı', [r.provider, r.rates.TRY, r.rates.EUR, r.asOf], ['ExchangeRate-API', 41, 0.91, new Date(1792281600 * 1000).toISOString().slice(0, 10)]);
  r = await fetchRates(async (u) => (u.includes('frankfurter') ? { ok: false, status: 500, json: async () => ({}) } : ok(erApi)()), NOW);
  eq('ilki HTTP 500 → ikinci sağlayıcı', r.provider, 'ExchangeRate-API');
  r = await fetchRates(async (u) => (u.includes('frankfurter') ? ok({ ...frankfurter, rates: { EUR: 0.9, GBP: 0.8, CNY: 7 } })() : ok(erApi)()), NOW);
  eq('ilki eksik veri → ikinci sağlayıcı', r.provider, 'ExchangeRate-API');
  r = await fetchRates(async (u) => (u.includes('frankfurter') ? new Promise(() => {}) : ok(erApi)()), NOW, 50);
  eq('ilki zaman aşımı → ikinci sağlayıcı', r.provider, 'ExchangeRate-API');
  let threw: unknown = null;
  try { await fetchRates(async () => Promise.reject(new Error('offline')), NOW); } catch (e) { threw = e; }
  truthy('hepsi başarısız → RatesError', threw instanceof RatesError);
  threw = null;
  try { await fetchRates(ok({ result: 'error' }), NOW); } catch (e) { threw = e; }
  truthy('geçersiz yanıt → RatesError (uydurma kur üretilmez)', threw instanceof RatesError);
  truthy('iki sağlayıcı tanımlı', PROVIDERS.length === 2 && PROVIDERS.every((p) => p.url.startsWith('https://')));

  /* ===== 5. Veri bütünlüğü ===== */
  const ex = (id: string, amount: number, cat: string, date: string, cur?: Cur): Expense => ({ id, amount, cat, note: id, date, ts: 1, ...(cur ? { cur } : {}) });
  const sub = (id: string, amount: number, cur?: Cur): Sub => ({ id, name: id, amount, day: 5, freq: 'monthly', month: 0, cat: 'Eğlence', skip: '', type: 'yayin', ...(cur ? { cur } : {}) });
  const stored: Data = {
    items: [ex('a', 400, 'Market', '2026-10-02'), ex('b', 100, 'Market', '2026-10-03', 'USD'), ex('c', 90, 'Ulaşım', '2026-10-04', 'EUR'), ex('d', 80, 'Fatura', '2026-10-05', 'GBP'), ex('e', 12.34, 'Diğer', '2026-09-30', 'TRY')],
    subs: [sub('s1', 400), sub('s2', 9.99, 'USD')],
    settings: { ...defaultSettings, budget: 10000, budgetCur: 'TRY', catBudgets: { Market: 3000, Eğlence: 50 }, catBudgetCur: { Market: 'TRY', Eğlence: 'USD' }, language: 'es', currency: 'TRY' },
  };
  const snapshot = JSON.stringify(stored);
  deepFreeze(stored);

  // TRY görünümü: her şey ₺'ye çevrilir
  let v = viewData(stored, 'TRY', R);
  eq('TRY görünümü tutarlar', v.items.map((x) => x.amount), [400, 4000, 4000, 4000, 12.34]);
  eq('TRY görünümü orijinal tutar', v.items.map((x) => x.orig ?? null), [null, { amount: 100, cur: 'USD' }, { amount: 90, cur: 'EUR' }, { amount: 80, cur: 'GBP' }, null]);
  eq('TRY görünümü abonelikler', v.subs.map((x) => x.amount), [400, 399.6]);
  eq('TRY görünümü bütçe', [v.settings.budget, v.settings.catBudgets], [10000, { Market: 3000, Eğlence: 2000 }]);
  near('TRY toplamı = çevrilmiş toplam', sum(v.items), 400 + 4000 + 4000 + 4000 + 12.34);
  // EUR görünümü
  v = viewData(stored, 'EUR', R);
  eq('EUR görünümü', v.items.map((x) => x.amount), [9, 90, 90, 90, 0.28]);
  eq('CNY görünümü', viewData(stored, 'CNY', R).items.map((x) => x.amount), [70, 700, 700, 700, 2.16]);
  eq('EUR bütçe', v.settings.budget, 225);
  truthy('EUR görünümünde tüm kayıtların birimi EUR', v.items.every((x) => x.cur === 'EUR') && v.settings.currency === 'EUR');
  // Saklanan veri değişmedi
  eq('görünüm üretmek saklanan veriyi değiştirmez', JSON.stringify(stored), snapshot);
  // Ay analizi dönüştürülmüş veriyle tutarlı
  const a = analyse(viewData(stored, 'TRY', R).items, '2026-10');
  near('analiz: ay toplamı', a.total, 400 + 4000 * 3);
  // Kur yokken: ana birimdeki kayıtlar aynen, diğerleri özgün birimiyle işaretli kalır
  const nr = viewData(stored, 'TRY', null);
  eq('kur yok: ₺ kayıtlar aynı', [nr.items[0].amount, nr.items[4].amount, nr.items[0].cur], [400, 12.34, 'TRY']);
  eq('kur yok: USD kayıt çevrilmez, birimi korunur', [nr.items[1].amount, nr.items[1].cur, nr.items[1].orig ?? null], [100, 'USD', null]);
  truthy('kur gerekli mi: evet', needsRates(stored, 'TRY'));
  truthy('kur gerekli mi: yalnız ₺ veri → hayır', !needsRates({ items: [ex('x', 1, 'Market', '2026-10-01')], subs: [], settings: { ...defaultSettings } }, 'TRY'));
  truthy('kur gerekli mi: ₺ veri + EUR ana birim → evet', needsRates({ items: [ex('x', 1, 'Market', '2026-10-01')], subs: [], settings: { ...defaultSettings } }, 'EUR'));

  // Ayar yazma: dokunulmayan bütçe/limitler özgün birimiyle kalır
  const viewTry = viewData(stored, 'EUR', R).settings; // ana birim EUR'ya geçildi
  let next: Settings = { ...viewTry, currency: 'EUR' };
  let back = fromViewSettings(next, stored.settings, viewTry);
  eq('para birimi değişince bütçe özgün (₺10000) kalır', [back.budget, back.budgetCur, back.currency], [10000, 'TRY', 'EUR']);
  eq('limitler özgün birimiyle kalır', [back.catBudgets, back.catBudgetCur], [{ Market: 3000, Eğlence: 50 }, { Market: 'TRY', Eğlence: 'USD' }]);
  next = { ...viewTry, budget: 300 }; // kullanıcı bütçeyi 300 € yaptı
  back = fromViewSettings(next, stored.settings, viewTry);
  eq('bütçe değişince ana birimde yazılır', [back.budget, back.budgetCur], [300, 'EUR']);
  next = { ...viewTry, catBudgets: { ...viewTry.catBudgets, Market: 500 } };
  back = fromViewSettings(next, stored.settings, viewTry);
  eq('tek limit değişince yalnız o limit yeni birimde', [back.catBudgets, back.catBudgetCur], [{ Market: 500, Eğlence: 50 }, { Market: 'EUR', Eğlence: 'USD' }]);
  const { Market: _m, ...rest } = viewTry.catBudgets;
  back = fromViewSettings({ ...viewTry, catBudgets: rest }, stored.settings, viewTry);
  eq('limit silinince kalkar', [back.catBudgets, back.catBudgetCur], [{ Eğlence: 50 }, { Eğlence: 'USD' }]);
  back = fromViewSettings({ ...viewTry, budget: 0 }, stored.settings, viewTry);
  eq('bütçe kaldırılınca 0', back.budget, 0);

  // Para birimini ardışık değiştirip geri almak hiçbir şeyi kaydırmaz
  let cur: Settings = stored.settings;
  for (const c of ['USD', 'EUR', 'GBP', 'TRY', 'EUR', 'TRY'] as Cur[]) {
    const view = viewData({ ...stored, settings: cur }, cur.currency, R).settings;
    cur = fromViewSettings({ ...view, currency: c }, cur, view);
  }
  eq('6 ardışık para birimi değişikliği sonrası ayarlar aynı', cur, stored.settings);

  /* ===== 6. Eski veri / yedek uyumu ===== */
  // Eski sürümün (yalnızca ₺) kaydı: para birimi alanı yok
  const legacy = {
    app: 'harcama-defteri', version: 1,
    items: [{ id: 'l1', amount: 125.5, cat: 'Market', note: 'Migros', date: '2026-10-01', ts: 5 }, { id: 'l2', amount: 40, cat: 'Yeme-İçme', note: '', date: '2026-10-02', ts: 6 }],
    subs: [{ id: 'sub_x', name: 'Netflix', amount: 189.99, day: 1, freq: 'monthly', month: 0, cat: 'Eğlence', skip: '', type: 'yayin' }],
    settings: { budget: 9000, remind: true, remindHour: 20, subRemind: true, catBudgets: { Market: 2500 }, theme: 'ivory', name: 'Orhan', language: 'en' },
  };
  const n = normalize(JSON.parse(JSON.stringify(legacy)));
  eq('eski veri: kayıt sayısı', [n.items.length, n.subs.length], [2, 1]);
  eq('eski veri: tutarlar aynen', n.items.map((x) => x.amount), [125.5, 40]);
  eq('eski veri: para birimi TRY sayılır', [n.settings.currency, n.settings.budgetCur, n.settings.catBudgetCur], ['TRY', 'TRY', {}]);
  eq('eski veri: diğer ayarlar korunur', [n.settings.budget, n.settings.theme, n.settings.name, n.settings.language, n.settings.remindHour, n.settings.catBudgets], [9000, 'ivory', 'Orhan', 'en', 20, { Market: 2500 }]);
  const lv = viewData(n, 'TRY', null);
  eq('eski veri ₺ görünümünde kur olmadan birebir', [lv.items.map((x) => x.amount), lv.subs[0].amount, lv.settings.budget, lv.settings.catBudgets], [[125.5, 40], 189.99, 9000, { Market: 2500 }]);
  eq('eski veri her dilde kayıpsız', ['tr', 'en', 'es', 'it', 'zh'].map((l) => normalize({ ...legacy, settings: { ...legacy.settings, language: l } }).settings.language), ['tr', 'en', 'es', 'it', 'zh']);
  const bad = normalize({ items: [{ id: 'z', amount: 5, cat: 'Market', date: '2026-10-01', cur: 'XXX' }, { id: 'y', amount: 6, cat: 'Market', date: '2026-10-01', cur: 'EUR' }], settings: { currency: 'JPY', budgetCur: 'BTC', language: 'de' } });
  eq('geçersiz para birimleri TRY\'ye düşer', [bad.items.map((x) => x.cur ?? null), bad.settings.currency, bad.settings.budgetCur, bad.settings.language], [[null, 'EUR'], 'TRY', 'TRY', 'tr']);
  // Renk tercihleri: eski veride yok → varsayılan; geçersiz değer → varsayılan; geçerli değer korunur
  eq('eski veri: renk varsayılanı', [n.settings.accent, n.settings.tint], ['gold', 'classic']);
  const colors = normalize({ settings: { accent: 'teal', tint: 'plum' } }).settings;
  eq('renk tercihi saklanır', [colors.accent, colors.tint], ['teal', 'plum']);
  const badColors = normalize({ settings: { accent: 'neon', tint: 7 } }).settings;
  eq('geçersiz renk varsayılana düşer', [badColors.accent, badColors.tint], ['gold', 'classic']);
  eq('birleştirme renk tercihini ezmez', merge({ ...cur0b(), settings: { ...cur0b().settings, accent: 'rose', tint: 'blue' } }, n).data.settings.accent, 'rose');
  // Yeni sürümün kaydı yazıp geri okunca aynı
  function cur0b(): Data { return { items: [], subs: [], settings: { ...defaultSettings } }; }
  const once = normalize(JSON.parse(JSON.stringify(stored)));
  eq('yaz-oku: kayıtlar, abonelik tutarları, ayarlar aynen', [sorted(once.items), once.subs.map((x) => [x.amount, x.cur ?? null]), sorted(once.settings)], [sorted(stored.items), [[400, null], [9.99, 'USD']], sorted(stored.settings)]);
  eq('yaz-oku: ikinci tur değişmez', sorted(normalize(JSON.parse(JSON.stringify(once)))), sorted(once));
  // Yedekten birleştirme
  const cur0: Data = { items: [], subs: [], settings: { ...defaultSettings, currency: 'EUR' } };
  const m1 = merge(cur0, n);
  eq('birleştirme: kayıtlar eklenir', m1.added, 3);
  eq('birleştirme: eski yedeğin bütçesi ₺ olarak gelir', [m1.data.settings.budget, m1.data.settings.budgetCur, m1.data.settings.catBudgets, m1.data.settings.catBudgetCur], [9000, 'TRY', { Market: 2500 }, {}]);
  eq('birleştirme: mevcut ana para birimi korunur', m1.data.settings.currency, 'EUR');
  eq('birleştirme ikinci kez ekleme yapmaz', merge(m1.data, n).added, 0);
  const m2 = merge({ ...cur0, settings: { ...cur0.settings, budget: 500, budgetCur: 'EUR' } }, n);
  eq('birleştirme: mevcut bütçe yedekle ezilmez', [m2.data.settings.budget, m2.data.settings.budgetCur], [500, 'EUR']);

  /* ===== 7. Yorum eşikleri, bildirim ve Excel biçimi ===== */
  eq('yorum eşikleri her birim için tanımlı', CURRENCIES.every((c) => MIN_CHANGE[c.code] > 0), true);
  for (const l of ['tr', 'en', 'es', 'it', 'zh'] as Lang[]) {
    setLanguage(l);
    const body = t('notif.subBody', { amount: fmtMoney(9.99, 'USD') });
    truthy(`${l} bildirim metni tutarı içerir`, body.includes(fmtMoney(9.99, 'USD')) && !/\{\w+\}/.test(body));
  }
  eq('Excel biçimi', CURRENCIES.map((c) => excelMoneyFormat(c.code)), ['#,##0.00 "₺"', '#,##0.00 "$"', '#,##0.00 "€"', '#,##0.00 "£"', '#,##0.00 "¥"']);
  // Yorum eşiği: 10 birimlik artış ₺ ana biriminde (eşik 100) yorum üretmez, € ana biriminde (eşik 3) üretir
  setLanguage('en');
  const mk = (cur: Cur): Settings => ({ ...defaultSettings, currency: cur, budgetCur: cur });
  const pair = [ex('p1', 40, 'Market', '2026-09-02'), ex('p2', 50, 'Market', '2026-10-02')];
  const warns = (c: Cur) => insights(pair, '2026-10', mk(c)).filter((i) => i.kind === 'warn').length;
  eq('10 birim artış: TRY yorumsuz, EUR uyarılı', [warns('TRY'), warns('EUR')], [0, 1]);
  setMainCurrency('TRY');

  console.log(`${pass} geçti, ${fail} başarısız`);
  process.exit(fail ? 1 : 0);
})();
