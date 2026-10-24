// Küçük XLSX (Office Open XML SpreadsheetML) yazıcısı. Saf: cihaz modülü yok, Node'da test edilir.
// Yalnızca dışa aktarım içindir; ZIP için `fflate` (saf JS, RN/Hermes ve web'de çalışır).
import { strToU8, zipSync } from 'fflate';

export type XlCell = string | number | null | undefined;
export type XlSheet = {
  name: string;
  rows: XlCell[][];
  widths?: number[]; // sütun genişlikleri (karakter)
  formats?: Record<string, string>; // sütun harfi -> sayı biçimi (yalnızca sayısal hücreler; ilk satır başlıktır, atlanır)
};
export type XlWorkbook = { sheets: XlSheet[] };

// XML 1.0'da geçersiz kontrol karakterleri (TAB, LF, CR hariç); eşleşmemiş vekil çiftler ayrıca elenir (lookbehind kullanılmaz: eski motorlarda yok)
// eslint-disable-next-line no-control-regex
const BAD_CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function stripBad(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) { out += s[i] + s[i + 1]; i++; }
    } else if (c < 0xdc00 || c > 0xdfff) out += s[i];
  }
  return out.replace(BAD_CTRL, '');
}

/** XML metin/öznitelik değeri için kaçışlar; geçersiz karakterleri siler. */
export function xmlEscape(s: string): string {
  return stripBad(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Excel sayfa adı: ≤31 karakter, `[]:*?/\` yok, kenarlarda kesme işareti yok, boş olamaz. */
export function cleanSheetName(raw: string): string {
  let n = stripBad(raw).replace(/[[\]:*?/\\]/g, ' ').trim().replace(/^'+|'+$/g, '');
  n = stripBad(n.slice(0, 31)); // Excel sınırı UTF-16 birimiyle sayılır
  return n || 'Sheet';
}

/** Adları temizler ve büyük/küçük harf duyarsız benzersiz yapar (Excel böyle karşılaştırır). */
export function uniqueSheetNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((raw) => {
    const base = cleanSheetName(raw);
    let n = base;
    for (let i = 2; seen.has(n.toLowerCase()); i++) {
      const suf = ` (${i})`;
      n = stripBad(base.slice(0, 31 - suf.length)) + suf;
    }
    seen.add(n.toLowerCase());
    return n;
  });
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const colIndex = (letters: string) => letters.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

function sheetXml(s: XlSheet, styleOf: (fmt: string) => number): string {
  const fmtByCol = new Map<number, string>();
  for (const [letters, f] of Object.entries(s.formats ?? {})) fmtByCol.set(colIndex(letters), f);
  let out = `${HEAD}<worksheet xmlns="${NS_MAIN}">`;
  if (s.widths?.length) {
    out += '<cols>' + s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(1, w) + 1}" customWidth="1"/>`).join('') + '</cols>';
  }
  out += '<sheetData>';
  s.rows.forEach((row, r) => {
    const cells: string[] = [];
    row.forEach((v, c) => {
      const ref = colName(c) + (r + 1);
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) return; // NaN/Infinity geçerli bir sayı değildir: boş bırak
        const f = r > 0 ? fmtByCol.get(c) : undefined;
        cells.push(`<c r="${ref}"${f ? ` s="${styleOf(f)}"` : ''}><v>${v}</v></c>`);
      } else if (typeof v === 'string' && v !== '') {
        cells.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`);
      }
    });
    out += cells.length ? `<row r="${r + 1}">${cells.join('')}</row>` : '';
  });
  return out + '</sheetData></worksheet>';
}

/** Çalışma kitabını .xlsx baytlarına çevirir. */
export function writeXlsx(wb: XlWorkbook): Uint8Array {
  const sheets = wb.sheets.length ? wb.sheets : [{ name: 'Sheet', rows: [] }];
  const names = uniqueSheetNames(sheets.map((s) => s.name));

  // Özel sayı biçimleri: kimlikler 164'ten başlar; xf 0 = varsayılan
  const fmts: string[] = [];
  const styleOf = (f: string) => {
    let i = fmts.indexOf(f);
    if (i < 0) i = fmts.push(f) - 1;
    return i + 1;
  };
  const sheetFiles = sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, strToU8(sheetXml(s, styleOf))] as const);

  const styles =
    `${HEAD}<styleSheet xmlns="${NS_MAIN}">` +
    (fmts.length ? `<numFmts count="${fmts.length}">${fmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xmlEscape(f)}"/>`).join('')}</numFmts>` : '') +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${fmts.length + 1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    fmts.map((_, i) => `<xf numFmtId="${164 + i}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`).join('') +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${HEAD}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
        names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(styles),
  };
  for (const [p, b] of sheetFiles) files[p] = b;
  return zipSync(files);
}
