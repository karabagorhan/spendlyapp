/**
 * Çekirdek mantık testleri: `npx tsx scripts/core-test.ts`
 * Tutar okuma/biçimleme, tarih adları, çoğul biçimleri ve abonelik türü tahmini; her dil için çalışır.
 */
import * as XLSX from 'xlsx';
import { CATALOGS, LANGS, Lang, fmtPercent, parseAmount, setLanguage, t } from '../src/i18n';
import { setMainCurrency } from '../src/currency';
import { money as fmtTL, guessSubType, dayLabel, monthLabel, shortDay, todayIso, subLabel, catName, CATS, SUB_TYPES, compact, amountText } from '../src/lib';

setMainCurrency('TRY');
let fail = 0, pass = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name}: beklenen ${JSON.stringify(want)}, bulunan ${JSON.stringify(got)}`); }
};
const truthy = (name: string, v: unknown) => { if (v) pass++; else { fail++; console.log(`FAIL ${name}`); } };

// Tutar okuma
setLanguage('tr');
eq('tr 1.250,50', parseAmount('1.250,50'), 1250.5);
eq('tr 125,5', parseAmount('125,5'), 125.5);
eq('tr 1.250 (binlik)', parseAmount('1.250'), 1250);
eq('tr 125.5 (ondalık)', parseAmount('125.5'), 125.5);
eq('tr 1.250.000', parseAmount('1.250.000'), 1250000);
eq('tr ₺ 40', parseAmount('₺ 40'), 40);
eq('tr abc', parseAmount('abc'), 0);
eq('tr 0', parseAmount('0'), 0);
eq('tr boş', parseAmount(''), 0);
eq('tr -5', parseAmount('-5'), 0);
setLanguage('en');
eq('en 1,250.50', parseAmount('1,250.50'), 1250.5);
eq('en 1,250 (binlik)', parseAmount('1,250'), 1250);
eq('en 125,5 (ondalık)', parseAmount('125,5'), 125.5);
eq('en 125.50', parseAmount('125.50'), 125.5);
eq('en 1,250,000.75', parseAmount('1,250,000.75'), 1250000.75);
eq('en 1.250,50 (karışık)', parseAmount('1.250,50'), 1250.5);
eq('en fmt', fmtTL(1250.5), '₺1,250.50');
eq('en fmt0', fmtTL(1250, 0), '₺1,250');
eq('en neg', fmtTL(-40), '−₺40.00');
eq('en compact', compact(1500), '1.5K');
eq('en amountText', amountText(125.5), '125.5');
setLanguage('tr');
eq('tr fmt', fmtTL(1250.5), '₺1.250,50');
eq('tr compact', compact(1500), '1,5 B');
eq('tr amountText', amountText(125.5), '125,5');

for (const li of LANGS) {
  const lang = li.code as Lang;
  setLanguage(lang);
  const cat = CATALOGS[lang];
  // Ay / gün adları eksiksiz
  for (let i = 0; i < 12; i++) { truthy(`${lang} month.${i}`, cat['month.' + i]); truthy(`${lang} monthShort.${i}`, cat['monthShort.' + i]); }
  for (let i = 0; i < 7; i++) { truthy(`${lang} weekday.${i}`, cat['weekday.' + i]); truthy(`${lang} weekdayShort.${i}`, cat['weekdayShort.' + i]); }
  CATS.forEach((c) => truthy(`${lang} cat.${c}`, cat['cat.' + c]));
  SUB_TYPES.forEach((s) => truthy(`${lang} subtype.${s.key}`, cat['subtype.' + s.key]));
  // Biçimler
  truthy(`${lang} dayLabel bugün`, dayLabel(todayIso()) === t('date.today'));
  truthy(`${lang} monthLabel yıl içerir`, monthLabel('2026-10').includes('2026'));
  truthy(`${lang} shortDay`, shortDay('2026-10-05').includes('5'));
  // Çoğul: n=1 ve n=5 farklı/geçerli metin üretir, {n} yer tutucusu kalmaz
  for (const k of ['list.count', 'ago.min', 'sub.inDays', 'subs.countShare', 'toast.restored', 'insight.freeDays', 'search.results', 'tile.avgSub', 'subs.pendingCount', 'reports.catLine']) {
    for (const n of [0, 1, 2, 5, 21]) {
      const s = t(k, { n, pct: 10 });
      truthy(`${lang} ${k} n=${n} dolu`, s && !/\{\w+\}/.test(s) && s !== k);
    }
  }
  truthy(`${lang} subLabel`, subLabel('yayin') !== 'subtype.yayin');
  truthy(`${lang} catName`, catName('Market') !== 'cat.Market');
  // Abonelik türü tahmini (marka adları her dilde)
  eq(`${lang} Netflix`, guessSubType('Netflix'), 'yayin');
  eq(`${lang} Spotify Premium`, guessSubType('Spotify Premium'), 'yayin');
  eq(`${lang} iCloud+`, guessSubType('iCloud+'), 'yazilim');
  eq(`${lang} Bilinmeyen`, guessSubType('Zzzq'), null);
}
// Tutar okuma kenar durumları (her iki dil)
setLanguage('tr');
eq('tr 1,250 (ondalık)', parseAmount('1,250'), 1.25);
eq('tr 0,5', parseAmount('0,5'), 0.5);
eq('tr .5', parseAmount('.5'), 0.5);
eq('tr 1,2,3', parseAmount('1,2,3'), 123);
eq('tr boşluk+₺', parseAmount(' ₺ 1 250,75 '), 1250.75);
eq('tr nbsp binlik', parseAmount('1 250'), 1250);
eq('tr çok büyük', parseAmount('12.345.678.901,23'), 12345678901.23);
eq('tr 1e5 geçersiz', parseAmount('1e5'), 0);
eq('tr 0.250 (ondalık, baş 0)', parseAmount('0.250'), 0.25);
eq('tr fmt büyük', fmtTL(12345678901.23), '₺12.345.678.901,23');
eq('tr compact Mn', compact(2500000), '2,5 Mn');
setLanguage('en');
eq('en 1.250 (ondalık)', parseAmount('1.250'), 1.25);
eq('en 0,5', parseAmount('0,5'), 0.5);
eq('en .5', parseAmount('.5'), 0.5);
eq('en 1,2,3', parseAmount('1,2,3'), 123);
eq('en boşluk+₺', parseAmount(' ₺ 1,250.75 '), 1250.75);
eq('en çok büyük', parseAmount('12,345,678,901.23'), 12345678901.23);
eq('en fmt büyük', fmtTL(12345678901.23), '₺12,345,678,901.23');
eq('en compact M', compact(2500000), '2.5M');
eq('en compact <1000', compact(999), '999');
setLanguage('zh');
eq('zh compact <1万', compact(9999), '9999');
eq('zh compact 万', compact(25000), '2.5万');
eq('zh compact 亿', compact(250000000), '2.5亿');
eq('zh yüzde', fmtPercent(165), '165%');
eq('zh list.count', t('list.count', { n: 21 }), '21 笔');
eq('zh tarih biçimi', [shortDay('2026-10-05'), monthLabel('2026-10')], ['10月5日', '2026年10月']);
eq('zh amountText', amountText(125.5), '125.5');
setLanguage('en');
// Kestirme bağlantısı her zaman Türkçe kurallarla okunur (dil İngilizceyken de)
eq('en dilinde tutar=1.250 → tr kuralı', parseAmount('1.250', 'tr'), 1250);
eq('en dilinde tutar=125,50 → tr kuralı', parseAmount('125,50', 'tr'), 125.5);
// Yüzde sırası
eq('en yüzde', fmtPercent(165), '165%');
eq('en hero.used', t('hero.used', { pct: 80 }), '80% used');
// İngilizce çoğullar: 1 tekil, 2/5/21 çoğul
eq('en list.count 1', t('list.count', { n: 1 }), '1 transaction');
eq('en list.count 2', t('list.count', { n: 2 }), '2 transactions');
eq('en list.count 21', t('list.count', { n: 21 }), '21 transactions');
eq('en sub.inDays 1', t('sub.inDays', { n: 1 }), 'in 1 day');
eq('en sub.inDays 5', t('sub.inDays', { n: 5 }), 'in 5 days');
eq('en toast.restored 1', t('toast.restored', { n: 1 }), '1 record added.');
eq('en ago.day 21', t('ago.day', { n: 21 }), '21 days ago');
setLanguage('tr');
eq('tr yüzde', fmtPercent(165), '%165');
eq('tr list.count 1', t('list.count', { n: 1 }), '1 işlem');
eq('tr list.count 21', t('list.count', { n: 21 }), '21 işlem');

// Excel: sayfa adları ≤31 karakter, yasak karakter yok ve xlsx kütüphanesi kabul ediyor; dosya adları geçerli
for (const li of LANGS) {
  setLanguage(li.code as Lang);
  const wb = XLSX.utils.book_new();
  for (const k of ['xl.sheet.expenses', 'xl.sheet.categories', 'xl.sheet.months', 'xl.sheet.subscriptions']) {
    const name = t(k);
    truthy(`${li.code} ${k} geçerli sayfa adı (${name})`, name.length >= 1 && name.length <= 31 && !/[\\/?*[\]:]/.test(name));
    let okAppend = true;
    try { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[t('xl.date'), t('xl.amount')]]), name); } catch { okAppend = false; }
    truthy(`${li.code} ${k} xlsx kabul etti`, okAppend);
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  truthy(`${li.code} xlsx yazıldı`, buf.byteLength > 1000);
  for (const [k, p] of [['file.excelMonth', { ym: '2026-10' }], ['file.excelAll', { date: '2026-10-18' }], ['file.backup', { date: '2026-10-18' }]] as const) {
    const f = t(k, p);
    truthy(`${li.code} ${k} dosya adı geçerli (${f})`, /^[^\\/:*?"<>|\s]+$/.test(f) && f.length < 80);
  }
}

// Türkçe ek hâlleri
setLanguage('tr');
eq('tr Susam kursu', guessSubType('Susam kursu'), 'egitim');
eq('tr Su faturası', guessSubType('Su faturası'), 'ev');
eq('tr Site aidatı', guessSubType('Site aidatı'), 'kira');
eq('tr Turkcell faturası', guessSubType('Turkcell faturası'), 'iletisim');

console.log(`${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
