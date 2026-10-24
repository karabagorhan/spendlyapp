// Excel çalışma kitabı üretimi (saf: cihaz modülü yok, Node'da test edilir). Paylaşım `files.ts` içinde.
import * as XLSX from 'xlsx';
import { Cur, excelMoneyFormat } from './currency';
import { t } from './i18n';
import { Expense, Income, Sub, catName, incomeCatName, monthLabel, monthName, subLabel, sum } from './lib';

// Excel tarih seri numarası (saat dilimi kaymasını önlemek için UTC ile)
function xlDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5;
}

function sheet(data: unknown[][], widths: number[], formats: Record<string, string>) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 1; r <= range.e.r; r++) {
    for (const col of Object.keys(formats)) {
      const c = ws[col + (r + 1)];
      if (c && typeof c.v === 'number') c.z = formats[col];
    }
  }
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

/** ym verilirse o ay, verilmezse tüm kayıtlar. Hiç harcama ve gelir yoksa null döner. */
export function buildExcel(items: Expense[], subs: Sub[], ym: string | null, cur: Cur, ratesNote: string | null, incomes: Income[] = []) {
  const TL_FMT = excelMoneyFormat(cur);
  const rows = items
    .filter((x) => !ym || x.date.slice(0, 7) === ym)
    .sort((p, q) => (p.date < q.date ? -1 : p.date > q.date ? 1 : p.ts - q.ts));
  const wb = XLSX.utils.book_new();
  const inc = incomes
    .filter((x) => !ym || x.date.slice(0, 7) === ym)
    .sort((p, q) => (p.date < q.date ? -1 : p.date > q.date ? 1 : p.ts - q.ts));
  if (!rows.length && !inc.length) return null;
  const total = sum(rows);

  if (rows.length) {
    const d1: unknown[][] = [[t('xl.date'), t('xl.category'), t('xl.note'), t('xl.amount'), t('xl.subscription')]];
    rows.forEach((x) => d1.push([xlDate(x.date), catName(x.cat), x.note, x.amount, x.sub ? t('xl.yes') : '']));
    d1.push([], ['', '', t('xl.total'), total]);
    if (ratesNote) d1.push([], [ratesNote]);
    XLSX.utils.book_append_sheet(wb, sheet(d1, [12, 16, 34, 14, 12], { A: t('xl.dateFormat'), D: TL_FMT }), t('xl.sheet.expenses'));

    const by: Record<string, number> = {};
    const cnt: Record<string, number> = {};
    rows.forEach((x) => {
      by[x.cat] = (by[x.cat] || 0) + x.amount;
      cnt[x.cat] = (cnt[x.cat] || 0) + 1;
    });
    const d2: unknown[][] = [[t('xl.category'), t('xl.amount'), t('xl.share'), t('xl.count')]];
    Object.keys(by)
      .sort((p, q) => by[q] - by[p])
      .forEach((c) => d2.push([catName(c), by[c], by[c] / total, cnt[c]]));
    d2.push([t('xl.total'), total, 1, rows.length]);
    XLSX.utils.book_append_sheet(wb, sheet(d2, [18, 14, 10, 10], { B: TL_FMT, C: '0.0%' }), t('xl.sheet.categories'));

    if (!ym) {
      const bm: Record<string, number> = {};
      rows.forEach((x) => (bm[x.date.slice(0, 7)] = (bm[x.date.slice(0, 7)] || 0) + x.amount));
      const d3: unknown[][] = [[t('xl.month'), t('xl.total')]];
      Object.keys(bm).sort().forEach((m) => d3.push([monthLabel(m), bm[m]]));
      XLSX.utils.book_append_sheet(wb, sheet(d3, [18, 14], { B: TL_FMT }), t('xl.sheet.months'));
    }
  }

  if (inc.length) {
    const d5: unknown[][] = [[t('xl.date'), t('xl.category'), t('xl.note'), t('xl.amount')]];
    inc.forEach((x) => d5.push([xlDate(x.date), incomeCatName(x.cat), x.note, x.amount]));
    d5.push([], ['', '', t('xl.total'), sum(inc)]);
    XLSX.utils.book_append_sheet(wb, sheet(d5, [12, 16, 34, 14], { A: t('xl.dateFormat'), D: TL_FMT }), t('xl.sheet.income'));
  }

  if (subs.length) {
    const d4: unknown[][] = [[t('xl.name'), t('xl.type'), t('xl.amount'), t('xl.frequency'), t('xl.payDay'), t('xl.category'), t('xl.monthlyEquiv')]];
    subs.forEach((s) => {
      const yearly = s.freq === 'yearly';
      d4.push([s.name, subLabel(s.type), s.amount, t(yearly ? 'xl.yearly' : 'xl.monthly'), yearly ? t('xl.payYearly', { day: s.day, month: monthName(s.month - 1) }) : t('xl.payMonthly', { day: s.day }), catName(s.cat), yearly ? s.amount / 12 : s.amount]);
    });
    XLSX.utils.book_append_sheet(wb, sheet(d4, [22, 20, 14, 12, 18, 16, 18], { C: TL_FMT, G: TL_FMT }), t('xl.sheet.subscriptions'));
  }

  return wb;
}
