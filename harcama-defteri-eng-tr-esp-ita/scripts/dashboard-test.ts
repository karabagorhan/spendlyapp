/**
 * Panel ve gelir mantığı testleri: `npx tsx scripts/dashboard-test.ts`
 * Gelir verisinin temizlenmesi, eski veri/yedek uyumu, bakiye ve değişim hesabı, kategori dilimleri, son işlemler,
 * para birimi dönüşümü ve kodda dinamik üretilen çeviri anahtarlarının tüm dillerde varlığı.
 */
import * as XLSX from 'xlsx';
import { buildExcel as buildDesc } from '../src/excel';
import { XlWorkbook, writeXlsx } from '../src/xlsxWriter';
import { CATALOGS, LANGS, Lang, setLanguage } from '../src/i18n';
import { Cur, Rates, needsRates, setMainCurrency, viewData } from '../src/currency';
import { Expense, INCOME_CATS, Income, balanceFor, budgetProgress, categorySlices, dayLabel, dayLabelShort, greetingKey, recentTransactions, shortDay, todayIso, addDays } from '../src/lib';
import { Data, defaultSettings, merge, normalize } from '../src/store';

let pass = 0, fail = 0;
// JSON.stringify Infinity/NaN'ı "null" yazar ve sıfıra bölme hatalarını gizler: sonlu olmayan sayılar metne çevrilerek karşılaştırılır
const ser = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? `<${x}>` : x === undefined ? '<undefined>' : x));
const eq = (name: string, got: unknown, want: unknown) => {
  if (ser(got) === ser(want)) pass++;
  else { fail++; console.log(`FAIL ${name}: beklenen ${ser(want)}, bulunan ${ser(got)}`); }
};
const truthy = (name: string, v: unknown) => { if (v) pass++; else { fail++; console.log(`FAIL ${name}`); } };

setLanguage('en');
setMainCurrency('TRY');
const exp = (id: string, date: string, amount: number, cat = 'Market', extra: Partial<Expense> = {}): Expense => ({ id, amount, cat, note: '', date, ts: Date.parse(date + 'T10:00:00Z'), ...extra });
const inc = (id: string, date: string, amount: number, cat = 'salary', extra: Partial<Income> = {}): Income => ({ id, amount, cat, note: '', date, ts: Date.parse(date + 'T09:00:00Z'), ...extra });

/* ---------- Eski veri ve yedek uyumu ---------- */
const legacy = {
  items: [{ id: 'a', amount: 12.5, cat: 'Market', note: 'x', date: '2026-09-03', ts: 5 }],
  subs: [{ id: 's', name: 'Netflix', amount: 9, day: 1, freq: 'monthly', month: 1, cat: 'Eğlence', skip: '', type: 'yayin' }],
  settings: { budget: 5000, theme: 'ivory', accent: 'rose', tint: 'plum', name: 'Orhan', language: 'es', currency: 'EUR', budgetCur: 'EUR', remind: true, remindHour: 20 },
};
const n0 = normalize(legacy);
eq('eski veri: gelir listesi boş gelir', n0.incomes, []);
eq('eski veri: harcama korunur', n0.items.map((x) => [x.id, x.amount, x.note, x.date]), [['a', 12.5, 'x', '2026-09-03']]);
eq('eski veri: abonelik korunur', n0.subs.map((x) => [x.id, x.name, x.amount]), [['s', 'Netflix', 9]]);
eq('eski veri: ayarlar korunur (tema, vurgu, dil, para birimi, bütçe)', [n0.settings.theme, n0.settings.accent, n0.settings.tint, n0.settings.language, n0.settings.currency, n0.settings.budget, n0.settings.name], ['ivory', 'rose', 'plum', 'es', 'EUR', 5000, 'Orhan']);
eq('eski veri: gizleme varsayılan kapalı', n0.settings.hideBalance, false);
eq('çok eski kayıt (ayar alanları yok): eski varsayılanlar korunur, yenileri uygulanmaz', [normalize({ items: [] }).settings.theme, normalize({ items: [] }).settings.accent, normalize({ items: [] }).settings.tint], ['noir', 'gold', 'classic']);
eq('yeni kurulum varsayılanı: referans görünüm', [defaultSettings.theme, defaultSettings.accent, defaultSettings.tint, defaultSettings.name, defaultSettings.hideBalance], ['system', 'sapphire', 'blue', '', false]);
eq('eski yedek biçimi (yalnızca items + budget) içe aktarılır', normalize({ app: 'harcama-defteri', version: 1, items: legacy.items, subs: [], settings: { budget: 3000 } }).incomes, []);
eq('normalize idempotent', normalize(JSON.parse(JSON.stringify(n0))), n0);

/* ---------- Gelir verisinin temizlenmesi ---------- */
const dirty = normalize({
  items: [],
  incomes: [
    { id: 'ok', amount: 100, cat: 'salary', note: 'Maaş', date: '2026-10-01', ts: 1, cur: 'USD' },
    { id: 'neg', amount: -5, cat: 'salary', date: '2026-10-01' },
    { id: 'zero', amount: 0, cat: 'salary', date: '2026-10-01' },
    { id: 'nan', amount: NaN, cat: 'salary', date: '2026-10-01' },
    { id: 'inf', amount: Infinity, cat: 'salary', date: '2026-10-01' },
    { id: 'str', amount: '5', cat: 'salary', date: '2026-10-01' },
    { id: 'baddate', amount: 5, cat: 'salary', date: '1.10.2026' },
    { id: 'cat', amount: 7, cat: 'Market', date: '2026-10-02', cur: 'XXX', note: 'x'.repeat(200) },
    null, 5, 'x',
  ],
});
eq('gelir temizleme: yalnızca geçerli kayıtlar kalır', dirty.incomes.map((x) => x.id), ['ok', 'cat']);
eq('gelir temizleme: geçersiz kategori "other" olur', dirty.incomes[1].cat, 'other');
eq('gelir temizleme: not 80 karaktere kısaltılır', dirty.incomes[1].note.length, 80);
eq('gelir temizleme: geçersiz para birimi atılır, geçerli korunur', [dirty.incomes[0].cur, dirty.incomes[1].cur], ['USD', undefined]);
eq('gelir listesi dizi değilse boş', normalize({ items: [], incomes: 'x' }).incomes, []);
eq('gizleme yalnızca true ile açılır', [normalize({ items: [], settings: { hideBalance: true } }).settings.hideBalance, normalize({ items: [], settings: { hideBalance: 'true' } }).settings.hideBalance], [true, false]);

/* ---------- Yedekten birleştirme ---------- */
const base: Data = { items: [], subs: [], incomes: [inc('i1', '2026-10-01', 100)], settings: defaultSettings };
const incoming: Data = { items: [], subs: [], incomes: [inc('i1', '2026-10-01', 100), inc('i2', '2026-10-02', 200)], settings: defaultSettings };
const m = merge(base, incoming);
eq('birleştirme: aynı kimlikli gelir tekrar eklenmez', m.data.incomes.map((x) => x.id), ['i1', 'i2']);
eq('birleştirme: eklenen kayıt sayısı gelirleri de sayar', m.added, 1);
eq('birleştirme: eski biçimli (gelirsiz) veri çökmez', merge({ items: [], subs: [], settings: defaultSettings } as unknown as Data, incoming).data.incomes.length, 2);
eq('birleştirme: gelirsiz yedek mevcut gelirleri silmez', merge(base, { ...incoming, incomes: undefined } as unknown as Data).data.incomes.map((x) => x.id), ['i1']);

/* ---------- Para birimi dönüşümü ---------- */
const rates: Rates = { rates: { USD: 1, EUR: 0.9, GBP: 0.8, TRY: 40, CNY: 7 }, fetchedAt: 1, asOf: '2026-10-16', provider: 'test' };
const view = viewData({ items: [], subs: [], incomes: [inc('a', '2026-10-01', 400, 'salary', { cur: 'TRY' }), inc('b', '2026-10-02', 10, 'gift', { cur: 'USD' }), inc('c', '2026-10-03', 5, 'other')], settings: { ...defaultSettings, currency: 'USD', budgetCur: 'USD' } }, 'USD', rates);
eq('görünüm: ₺ geliri USD\'ye çevrilir (400/40)', view.incomes![0].amount, 10);
eq('görünüm: özgün tutar saklanır', view.incomes![0].orig, { amount: 400, cur: 'TRY' });
eq('görünüm: aynı birimdeki gelir değişmez', [view.incomes![1].amount, view.incomes![1].orig], [10, undefined]);
eq('görünüm: para birimi yok = TRY sayılır', view.incomes![2].amount, 0.13);
const noRates = viewData({ items: [], subs: [], incomes: [inc('a', '2026-10-01', 400, 'salary', { cur: 'TRY' })], settings: { ...defaultSettings, currency: 'USD', budgetCur: 'USD' } }, 'USD', null);
// F-06: kur yokken çevrilemeyen gelir toplamlara girmez; özgün tutar/birimle `unconverted` altında kalır
eq('kur yokken çevrilemeyen gelir incomes listesinde yok, unconverted altında özgün tutar/birimle', [noRates.incomes!.length, noRates.unconverted.incomes.map((x) => [x.amount, x.cur, x.unconv]), noRates.unconverted.count], [0, [[400, 'TRY', true]], 1]);
eq('gelirsiz görünüm verisi gelir alanı üretmez', 'incomes' in viewData({ items: [], subs: [], settings: defaultSettings }, 'TRY', null), false);
eq('needsRates: yabancı para birimli gelir kur ister', needsRates({ items: [], subs: [], incomes: [inc('a', '2026-10-01', 1, 'salary', { cur: 'EUR' })], settings: defaultSettings }, 'TRY'), true);
eq('needsRates: aynı birimde gelir kur istemez', needsRates({ items: [], subs: [], incomes: [inc('a', '2026-10-01', 1, 'salary', { cur: 'TRY' })], settings: defaultSettings }, 'TRY'), false);
// Para birimini değiştirip geri almak saklanan tutarı kaydırmaz
const stored = [inc('a', '2026-10-01', 123.45, 'salary', { cur: 'TRY' })];
const roundTrip = viewData({ items: [], subs: [], incomes: stored, settings: defaultSettings }, 'EUR', rates);
eq('dönüşüm saklanan veriyi değiştirmez', stored[0].amount, 123.45);
truthy('dönüşüm yeni nesne üretir', roundTrip.incomes![0] !== stored[0]);
for (const c of ['TRY', 'USD', 'EUR', 'GBP', 'CNY'] as Cur[]) {
  const v = viewData({ items: [], subs: [], incomes: [inc('a', '2026-10-01', 1000, 'salary', { cur: c })], settings: { ...defaultSettings, currency: c } }, c, rates);
  eq(`aynı birim (${c}) dönüşümsüz`, [v.incomes![0].amount, v.incomes![0].orig], [1000, undefined]);
}

/* ---------- Bakiye ve değişim ---------- */
// Geçmiş bir ay seçilir: ay tamamdır, geçen ayla karşılaştırma gün kesitine dayanır (Şubat 28 gün)
const items1: Expense[] = [exp('e1', '2026-02-10', 400), exp('e2', '2026-03-05', 300), exp('e3', '2026-03-30', 50)];
const incomes1: Income[] = [inc('i1', '2026-02-01', 1000), inc('i2', '2026-03-01', 1500)];
const b1 = balanceFor(items1, incomes1, '2026-03');
eq('bakiye: gider (ayın tamamı)', b1.spent, 350);
eq('bakiye: gelir', b1.income, 1500);
eq('bakiye: net = gelir − gider', b1.net, 1150);
eq('bakiye: bu ay gelir var', b1.hasIncome, true);
eq('bakiye: değişim geçen ayın aynı gün kesitine göre (+%100, 30 Mart harcaması kesite girmez)', b1.deltaPct, 100);
const b2 = balanceFor([exp('e', '2026-03-05', 300)], [], '2026-03');
eq('gelir yoksa: hasIncome false, net = −gider, değişim yok (uydurma net gösterilmez)', [b2.hasIncome, b2.net, b2.deltaPct], [false, -300, null]);
eq('boş veri: hepsi sıfır, değişim yok', balanceFor([], [], '2026-03'), { spent: 0, income: 0, hasIncome: false, net: 0, deltaPct: null, deltaAmount: null, deltaKind: null });
eq('geçen ay kayıt yoksa değişim yok', balanceFor([], [inc('i', '2026-03-01', 100)], '2026-03').deltaPct, null);
eq('geçen ayın neti sıfırsa değişim yok (sıfıra bölme yok)', balanceFor([exp('e', '2026-02-10', 100)], [inc('i', '2026-02-02', 100), inc('j', '2026-03-02', 50)], '2026-03').deltaPct, null);
// F-08: geçen ay gelir yoksa yüzde anlamsız (+%999 gibi) → tutar farkı
const noPrevInc = balanceFor([exp('e', '2026-02-10', 100)], [inc('j', '2026-03-02', 50)], '2026-03');
eq('geçen ay gelir yok bu ay var: yüzde değil tutar farkı (−100 → +50 = +150)', [noPrevInc.deltaKind, noPrevInc.deltaPct, noPrevInc.deltaAmount], ['amount', null, 150]);
eq('bu ay gelir yok ama geçen ayın verisi var: net değişim gösterilmez (uydurma karşılaştırma yok)', balanceFor([exp('e', '2026-02-10', 100), exp('f', '2026-03-05', 40)], [inc('i', '2026-02-02', 200)], '2026-03').deltaPct, null);
const negPrev = balanceFor([exp('e', '2026-02-10', 100)], [inc('j', '2026-03-02', 50)], '2026-03');
eq('negatif önceki net (geçen ay gelir yok): iyileşme pozitif tutar farkı', [negPrev.deltaKind, negPrev.deltaAmount! > 0], ['amount', true]);
const b3 = balanceFor([exp('e', '2026-03-05', 100)], [inc('j', '2026-03-02', 50)], '2026-03');
eq('negatif net desteklenir', b3.net, -50);
truthy('değişim her zaman sonlu', [b1, b2, b3, negPrev, noPrevInc].every((b) => (b.deltaPct === null || Number.isFinite(b.deltaPct)) && (b.deltaAmount === null || Number.isFinite(b.deltaAmount))));
eq('normal karşılaştırılabilir durum yüzde kalır', [b1.deltaKind, b1.deltaAmount], ['pct', null]);
// Geçen ay gelir var ama net negatif ve bu ay net pozitif (işaret değişti): yüzde değil tutar
const flip = balanceFor([exp('e', '2026-02-10', 300)], [inc('i', '2026-02-02', 100), inc('j', '2026-03-02', 500)], '2026-03');
eq('işaret değişimi: tutar farkı (−200 → +500 = +700)', [flip.deltaKind, flip.deltaPct, flip.deltaAmount], ['amount', null, 700]);
// Kullanıcının bildirdiği durum: geçen ay gelirsiz büyük gider, bu ay gelir var → "+%999+" yerine tutar
const big = balanceFor([exp('e', '2026-02-10', 44629)], [inc('j', '2026-03-02', 50)], '2026-03');
eq('+%999+ yerine tutar farkı', [big.deltaKind, big.deltaAmount], ['amount', 44679]);
// İkisi de negatif ve gelir var: yüzde sürer
const bothNeg = balanceFor([exp('e', '2026-02-10', 400), exp('f', '2026-03-10', 100)], [inc('i', '2026-02-02', 100), inc('j', '2026-03-02', 50)], '2026-03');
eq('iki net de negatif ve geçen ay gelir var: yüzde (−300 → −50 = +%83)', [bothNeg.deltaKind, bothNeg.deltaPct], ['pct', 83]);

/* ---------- Kategori dilimleri ---------- */
const sl = categorySlices([exp('1', '2026-10-01', 50, 'Market'), exp('2', '2026-10-02', 30, 'Fatura'), exp('3', '2026-10-03', 20, 'Ulaşım')], 4);
eq('dilimler: azsa hepsi, "diğer" yok', [sl.rows.map((r) => r.cat), sl.other, sl.total], [['Market', 'Fatura', 'Ulaşım'], null, 100]);
eq('dilimler: büyükten küçüğe sıralı yüzdeler', sl.rows.map((r) => Math.round(r.pct * 100)), [50, 30, 20]);
const many = categorySlices(['Market', 'Fatura', 'Ulaşım', 'Sağlık', 'Eğlence', 'Giyim', 'Diğer'].map((c, i) => exp('x' + i, '2026-10-01', 100 - i * 10, c)), 4);
eq('dilimler: üst 4 + kalanı "diğer"', [many.rows.length, many.other !== null], [4, true]);
truthy('dilimler: yüzdeler toplamı 1', Math.abs(many.rows.reduce((p, r) => p + r.pct, 0) + (many.other?.pct ?? 0) - 1) < 1e-9);
eq('dilimler: üst+1 kategoride birleştirme yok (tek kalan "diğer" olmaz)', categorySlices(['Market', 'Fatura', 'Ulaşım', 'Sağlık', 'Eğlence'].map((c, i) => exp('y' + i, '2026-10-01', 10, c)), 4).other, null);
eq('dilimler: boş', categorySlices([], 4), { total: 0, rows: [], other: null });

/* ---------- Bütçe ilerlemesi (Bütçe ekranı) ---------- */
const bset = (budget: number, catBudgets: Record<string, number> = {}) => ({ ...defaultSettings, budget, catBudgets });
const bItems: Expense[] = [exp('b1', '2026-10-03', 200, 'Market'), exp('b2', '2026-10-20', 50, 'Eğlence'), exp('b3', '2026-09-30', 999, 'Market')];
const bp = budgetProgress(bItems, bset(1000, { Market: 300, Eğlence: 100, Ulaşım: 0 }), '2026-10', '2026-10-24');
eq('bütçe: harcama yalnızca seçili ayda (eylül kaydı yok)', [bp.spent, bp.budget], [250, 1000]);
eq('bütçe: oran yüzde 25', Math.round(bp.ratio * 100), 25);
eq('bütçe: kalan = bütçe − harcama', bp.remaining, 750);
eq('bütçe: 24 Ekim, ay sonuna 8 gün (bugün dahil): günde 750/8 = 93,75', [bp.daysLeft, bp.perDay], [8, 93.75]);
const bOver = budgetProgress(bItems, bset(200), '2026-10', '2026-10-24');
eq('bütçe aşımı: kalan negatif, günlük kalan yok', [bOver.remaining, bOver.perDay], [-50, null]);
eq('bütçe tam tükendi: kalan 0, günlük kalan yok', [budgetProgress(bItems, bset(250), '2026-10', '2026-10-24').perDay], [null]);
eq('bütçe son gün (31 Ekim): kalan gün 1, günlük = kalan', [budgetProgress(bItems, bset(1000), '2026-10', '2026-10-31').daysLeft, budgetProgress(bItems, bset(1000), '2026-10', '2026-10-31').perDay], [1, 750]);
eq('bütçe ayın ilk günü: kalan gün 31', budgetProgress(bItems, bset(1000), '2026-10', '2026-10-01').daysLeft, 31);
eq('bütçe geçmiş ay: kalan gün 0, günlük yok', [budgetProgress(bItems, bset(1000), '2026-09', '2026-10-24').daysLeft, budgetProgress(bItems, bset(1000), '2026-09', '2026-10-24').perDay], [0, null]);
eq('bütçe gelecek ay: tüm ay kalan', budgetProgress([], bset(1000), '2026-11', '2026-10-24').daysLeft, 30);
const bNo = budgetProgress(bItems, bset(0), '2026-10', '2026-10-24');
eq('bütçe yok: oran 0, kalan 0, günlük yok (sıfıra bölme yok)', [bNo.ratio, bNo.remaining, bNo.perDay], [0, 0, null]);
eq('kategori limiti yok: liste boş (limit 0 olanlar da girmez)', [budgetProgress(bItems, bset(1000), '2026-10', '2026-10-24').limits, budgetProgress(bItems, bset(1000, { Market: 0 }), '2026-10', '2026-10-24').limits], [[], []]);
eq('kategori limitleri: yüzde ve harcama, yalnızca limiti olanlar', bp.limits.map((r) => [r.cat, r.spent, r.limit, Math.round(r.ratio * 100)]), [['Market', 200, 300, 67], ['Eğlence', 50, 100, 50]]);
const bSorted = budgetProgress([exp('s1', '2026-10-02', 90, 'Fatura'), exp('s2', '2026-10-02', 30, 'Market'), exp('s3', '2026-10-02', 150, 'Sağlık')], bset(0, { Market: 100, Fatura: 100, Sağlık: 100 }), '2026-10', '2026-10-24');
eq('kategori limitleri: kullanım yüzdesine göre azalan sıra (%150, %90, %30)', bSorted.limits.map((r) => r.cat), ['Sağlık', 'Fatura', 'Market']);
eq('kategori limitleri: aşan kategori aşım oranını gösterir', Math.round(bSorted.limits[0].ratio * 100), 150);
eq('bütçe boş veri: sıfırlar', budgetProgress([], bset(500), '2026-10', '2026-10-24'), { budget: 500, spent: 0, remaining: 500, ratio: 0, daysLeft: 8, perDay: 62.5, limits: [] });

/* ---------- Son işlemler ---------- */
const rt = recentTransactions(
  [exp('e1', '2026-10-10', 5, 'Market', { ts: 2 }), exp('e2', '2026-10-12', 6, 'Market', { ts: 1 })],
  [inc('i1', '2026-10-12', 7, 'salary', { ts: 9 }), inc('i2', '2026-10-01', 8, 'gift', { ts: 3 })], 3);
eq('son işlemler: tarihe sonra zamana göre, gelir+gider karışık', rt.map((r) => r.kind + ':' + r.x.id), ['income:i1', 'expense:e2', 'expense:e1']);
eq('son işlemler: sınır', recentTransactions([], [], 4), []);
eq('son işlemler: yalnızca gelir', recentTransactions([], [inc('i', '2026-10-01', 1)], 4).map((r) => r.kind), ['income']);

/* ---------- Selamlama ve tarih ---------- */
const g: Record<number, string> = { 0: 'night', 4: 'night', 5: 'morning', 11: 'morning', 12: 'afternoon', 17: 'afternoon', 18: 'evening', 21: 'evening', 22: 'night', 23: 'night' };
for (const h of Object.keys(g)) eq(`selamlama ${h}:00`, greetingKey(+h), g[+h]);
eq('kompakt tarih: bugün adıyla', dayLabelShort(todayIso()), dayLabel(todayIso()));
eq('kompakt tarih: dün adıyla', dayLabelShort(addDays(todayIso(), -1)), dayLabel(addDays(todayIso(), -1)));
eq('kompakt tarih: eski tarih kısa biçimde', dayLabelShort('2026-01-05'), shortDay('2026-01-05'));

/* ---------- Excel çalışma kitabı (gelir sayfası, yalnızca gelir olan ay) ---------- */
// Çalışma kitabı tarifi yazıcıdan geçirilip xlsx kütüphanesiyle GERİ OKUNUR (kendi çıktımızı okumak güvenlidir)
const readBack = (d: XlWorkbook | null) => (d ? XLSX.read(writeXlsx(d), { type: 'array', cellNF: true, cellStyles: true }) : null);
const buildExcel = (...a: Parameters<typeof buildDesc>) => readBack(buildDesc(...a));
const rowsOf = (wb: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 });
// Kayıt satırları: ilk hücre tarih seri numarasıdır (toplam satırında yoktur)
const records = (wb: XLSX.WorkBook, name: string) => rowsOf(wb, name).filter((r) => typeof r[0] === 'number');
const xe = [exp('x1', '2026-10-05', 100, 'Market', { note: 'Alpha' }), exp('x2', '2026-09-10', 40, 'Fatura')];
const xi = [inc('y1', '2026-10-01', 1000, 'salary', { note: 'Pay' }), inc('y2', '2026-09-15', 300, 'gift')];
const wbAll = buildExcel(xe, [], '2026-10', 'TRY', null, xi)!;
eq('excel: ay filtresi: harcama + kategori + gelir sayfaları', wbAll.SheetNames, [CATALOGS.en['xl.sheet.expenses'], CATALOGS.en['xl.sheet.categories'], CATALOGS.en['xl.sheet.income']]);
eq('excel: gelir sayfası yalnızca seçili ayın gelirini içerir', records(wbAll, 'Income').map((r) => [r[1], r[2], r[3]]), [['Salary', 'Pay', 1000]]);
eq('excel: gelir sayfası toplam satırı', rowsOf(wbAll, 'Income').some((r) => r[2] === 'Total' && r[3] === 1000), true);
eq('excel: harcama sayfası eskisi gibi', records(wbAll, 'Expenses').map((r) => r[3]), [100]);
const wbOnlyInc = buildExcel([], [], '2026-10', 'TRY', null, xi);
eq('excel: yalnızca gelir olan ay dışa aktarılır (eskiden "veri yok" denirdi)', wbOnlyInc?.SheetNames, ['Income']);
eq('excel: hiç kayıt yoksa null', buildExcel([], [], '2026-10', 'TRY', null, []), null);
eq('excel: o ay ne harcama ne gelir varsa null', buildExcel(xe, [], '2026-01', 'TRY', null, xi), null);
eq('excel: gelir parametresi verilmezse eski davranış (gelir sayfası yok)', buildExcel(xe, [], '2026-10', 'TRY', null)!.SheetNames, ['Expenses', 'Categories']);
const wbEvery = buildExcel(xe, [], null, 'TRY', null, xi)!;
eq('excel: tüm kayıtlar: aylar sayfası + gelir (2 kayıt)', [wbEvery.SheetNames.includes('Months'), records(wbEvery, 'Income').length], [true, 2]);

// Sayı biçimleri (cell.z) yazıcıdan sonra da korunur
eq('excel: tarih biçimi korunur', wbAll.Sheets['Expenses'].A2.z, CATALOGS.en['xl.dateFormat']);
eq('excel: para biçimi korunur', wbAll.Sheets['Expenses'].D2.z, '#,##0.00 "₺"');
eq('excel: yüzde biçimi korunur', wbAll.Sheets['Categories'].C2.z, '0.0%');
eq('excel: başlık hücresi biçimsiz', wbAll.Sheets['Expenses'].A1.z, 'General');
eq('excel: sütun genişlikleri', wbAll.Sheets['Expenses']['!cols']?.slice(0, 3).map((c) => Math.round(c.width ?? 0)), [13, 17, 35]);
// Not: <&>"' ve XML'de geçersiz kontrol karakteri
const nasty = `<&>"' ünï 😀`;
const wbNasty = buildExcel([exp('n1', '2026-10-05', 5, 'Market', { note: nasty + '\u0001\u0008' })], [], '2026-10', 'TRY', null)!;
eq('excel: özel karakterli not gidiş-dönüş', records(wbNasty, 'Expenses').map((r) => r[2]), [nasty]);
// Yazıcı: sayfa adı temizliği ve benzersizlik, boş/sonlu olmayan hücreler
const wbNames = readBack({ sheets: [
  { name: 'A[1]:b*?/\\', rows: [['x', 1]] }, { name: 'a[1]:b*?/\\', rows: [['y']] }, { name: 'x'.repeat(40), rows: [] }, { name: '', rows: [[null, 'a', undefined, NaN, 2]] },
] })!;
eq('yazıcı: sayfa adları temiz, ≤31 ve benzersiz', wbNames.SheetNames.every((n) => n.length <= 31 && !/[[\]:*?/\\]/.test(n)) && new Set(wbNames.SheetNames.map((n) => n.toLowerCase())).size === 4, true);
const sh4 = wbNames.Sheets[wbNames.SheetNames[3]];
eq('yazıcı: boş ve sonlu olmayan hücreler atlanır', [sh4.A1, sh4.B1?.v, sh4.C1, sh4.D1, sh4.E1?.v], [undefined, 'a', undefined, undefined, 2]);

/* ---------- Kilit ve bildirim gizliliği ayarları ---------- */
eq('varsayılan ayar: lock=false, notifAmounts=true', [defaultSettings.lock, defaultSettings.notifAmounts], [false, true]);
eq('eski veri (alanlar yok): lock=false, notifAmounts=true', [normalize(legacy).settings.lock, normalize(legacy).settings.notifAmounts], [false, true]);
eq('boş veri: lock=false, notifAmounts=true', [normalize({}).settings.lock, normalize({}).settings.notifAmounts], [false, true]);
eq('lock yalnızca true ise açık', [normalize({ settings: { lock: true } }).settings.lock, normalize({ settings: { lock: 'true' } }).settings.lock, normalize({ settings: { lock: 1 } }).settings.lock], [true, false, false]);
eq('notifAmounts yalnızca false ise kapalı', [normalize({ settings: { notifAmounts: false } }).settings.notifAmounts, normalize({ settings: { notifAmounts: 0 } }).settings.notifAmounts, normalize({ settings: { notifAmounts: 'x' } }).settings.notifAmounts], [false, true, true]);
eq('yedekte lock/notifAmounts korunur', (({ lock, notifAmounts }) => [lock, notifAmounts])(normalize(JSON.parse(JSON.stringify({ settings: { lock: true, notifAmounts: false } }))).settings), [true, false]);

/* ---------- Dinamik çeviri anahtarları her dilde var ---------- */
const dyn = [
  ...['morning', 'afternoon', 'evening', 'night'].map((k) => 'dash.greeting.' + k),
  ...INCOME_CATS.map((c) => 'incat.' + c),
  'xl.sheet.income', 'txn.expenses', 'txn.income', 'tab.home', 'tab.transactions', 'tab.budget', 'tab.reports', 'tab.settings',
];
for (const l of LANGS.map((x) => x.code) as Lang[]) {
  const missing = dyn.filter((k) => CATALOGS[l][k] === undefined);
  eq(`dinamik anahtarlar ${l}`, missing, []);
  eq(`marka adı ${l}`, CATALOGS[l]['app.name'], 'Spendly');
  truthy(`dosya adları markalı ${l}`, ['file.backup', 'file.excelMonth', 'file.excelAll'].every((k) => String(CATALOGS[l][k]).startsWith('spendly-')));
  truthy(`yedek hata iletileri markalı ${l}`, ['toast.restoreBadFile', 'toast.restoreReadFail'].every((k) => String(CATALOGS[l][k]).includes('Spendly')));
}
truthy('hiçbir dilde eski ürün adı kalmadı', LANGS.every((l) => !Object.values(CATALOGS[l.code]).some((v) => typeof v === 'string' && /Harcama Defteri|Expense Ledger|Libro de Gastos|Registro Spese|支出账本/.test(v))));

console.log(`${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
