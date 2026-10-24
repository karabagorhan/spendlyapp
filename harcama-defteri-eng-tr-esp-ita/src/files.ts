import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Cur } from './currency';
import { buildExcel } from './excel';
import { t } from './i18n';
import { Expense, Income, Sub, iso } from './lib';
import { Data, normalize } from './store';
import { writeXlsx } from './xlsxWriter';

/** Seçilen dosya bir Spendly yedeği değilse. */
export class BackupFormatError extends Error {}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Dosyayı geçici klasöre yazıp iOS paylaşım menüsünü açar (Dosyalar'a Kaydet, Mail, WhatsApp...). */
async function share(name: string, content: string | Uint8Array, mimeType: string, UTI: string) {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  await Sharing.shareAsync(f.uri, { mimeType, UTI, dialogTitle: name });
}

/** ym verilirse o ay, verilmezse tüm kayıtlar. Hiç harcama ve gelir yoksa false döner. */
export async function exportExcel(items: Expense[], subs: Sub[], ym: string | null, cur: Cur, ratesNote: string | null, incomes: Income[] = []) {
  const wb = buildExcel(items, subs, ym, cur, ratesNote, incomes);
  if (!wb) return false;
  const name = ym ? t('file.excelMonth', { ym }) : t('file.excelAll', { date: iso(new Date()) });
  await share(name, writeXlsx(wb), XLSX_MIME, 'org.openxmlformats.spreadsheetml.sheet');
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
  if (!raw || (!Array.isArray(raw.items) && !Array.isArray(raw.subs) && !Array.isArray(raw.incomes))) throw new BackupFormatError();
  return normalize(raw);
}
