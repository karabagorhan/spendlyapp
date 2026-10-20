import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { t } from './i18n';
import { Expense, Sub, catName, iso, monthLabel, monthName, subLabel, sum } from './lib';
import { Data, normalize } from './store';

/** Seçilen dosya bir Harcama Defteri yedeği değilse. */
export class BackupFormatError extends Error {}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TL_FMT = '#,##0.00 "₺"';

/** Dosyayı geçici klasöre yazıp iOS paylaşım menüsünü açar (Dosyalar'a Kaydet, Mail, WhatsApp...). */
async function share(name: string, content: string | Uint8Array, mimeType: string, UTI: string) {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  await Sharing.shareAsync(f.uri, { mimeType, UTI, dialogTitle: name });
}

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

/** ym verilirse o ay, verilmezse tüm kayıtlar. Harcama yoksa false döner. */
export async function exportExcel(items: Expense[], subs: Sub[], ym: string | null) {
  const rows = items
    .filter((x) => !ym || x.date.slice(0, 7) === ym)
    .sort((p, q) => (p.date < q.date ? -1 : p.date > q.date ? 1 : p.ts - q.ts));
  if (!rows.length) return false;
  const wb = XLSX.utils.book_new();
  const total = sum(rows);

  const d1: unknown[][] = [[t('xl.date'), t('xl.category'), t('xl.note'), t('xl.amount'), t('xl.subscription')]];
  rows.forEach((x) => d1.push([xlDate(x.date), catName(x.cat), x.note, x.amount, x.sub ? t('xl.yes') : '']));
  d1.push([], ['', '', t('xl.total'), total]);
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

  if (subs.length) {
    const d4: unknown[][] = [[t('xl.name'), t('xl.type'), t('xl.amount'), t('xl.frequency'), t('xl.payDay'), t('xl.category'), t('xl.monthlyEquiv')]];
    subs.forEach((s) => {
      const yearly = s.freq === 'yearly';
      d4.push([s.name, subLabel(s.type), s.amount, t(yearly ? 'xl.yearly' : 'xl.monthly'), yearly ? t('xl.payYearly', { day: s.day, month: monthName(s.month - 1) }) : t('xl.payMonthly', { day: s.day }), catName(s.cat), yearly ? s.amount / 12 : s.amount]);
    });
    XLSX.utils.book_append_sheet(wb, sheet(d4, [22, 20, 14, 12, 18, 16, 18], { C: TL_FMT, G: TL_FMT }), t('xl.sheet.subscriptions'));
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const name = ym ? t('file.excelMonth', { ym }) : t('file.excelAll', { date: iso(new Date()) });
  await share(name, new Uint8Array(out), XLSX_MIME, 'org.openxmlformats.spreadsheetml.sheet');
  return true;
}

/** Tüm verinin yedeği (web sürümüyle aynı biçim). */
export async function exportBackup(data: Data) {
  const body = JSON.stringify({ app: 'harcama-defteri', version: 1, exportedAt: new Date().toISOString(), ...data }, null, 1);
  await share(t('file.backup', { date: iso(new Date()) }), body, 'application/json', 'public.json');
}

/** Kullanıcının seçtiği yedek dosyasını okur. İptal edilirse null. Geçersiz dosyada hata fırlatır. */
export async function pickBackup(): Promise<Data | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', 'text/plain'], copyToCacheDirectory: true });
  if (r.canceled) return null;
  const text = await new File(r.assets[0].uri).text();
  const raw = JSON.parse(text);
  if (!raw || (!Array.isArray(raw.items) && !Array.isArray(raw.subs))) throw new BackupFormatError();
  return normalize(raw);
}
