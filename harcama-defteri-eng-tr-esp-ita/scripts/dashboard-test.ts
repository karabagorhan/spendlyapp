/**
 * Panel ve gelir mantığı testleri: `npx tsx scripts/dashboard-test.ts`
 * Gelir verisinin temizlenmesi, eski veri/yedek uyumu, bakiye ve değişim hesabı, kategori dilimleri, son işlemler,
 * para birimi dönüşümü ve kodda dinamik üretilen çeviri anahtarlarının tüm dillerde varlığı.
 */
import * as XLSX from 'xlsx';
import { buildExcel } from '../src/excel';
import { CATALOGS, LANGS, Lang, setLanguage } from '../src/i18n';
import { Cur, Rates, needsRates, setMainCurrency, viewData } from '../src/currency';
import { Expense, INCOME_CATS, Income, balanceFor, categorySlices, dayLabel, dayLabelShort, greetingKey, recentTransactions, shortDay, todayIso, addDays } from '../src/lib';
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
