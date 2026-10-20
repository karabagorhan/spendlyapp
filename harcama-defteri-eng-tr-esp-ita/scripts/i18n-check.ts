/**
 * Çeviri denetimi: `npx tsx scripts/i18n-check.ts [dil ...]` (dil verilmezse tr dışındaki tüm diller).
 * Hata (çıkış kodu 1): kodda kullanılıp kataloğta olmayan anahtar, eksik anahtar, yer tutucu uyuşmazlığı,
 * geçersiz çoğul biçimi, boş metin. Uyarı: Türkçeyle birebir aynı kalan metinler.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { CATALOGS, LANGS, Entry, Lang } from '../src/i18n';

const root = join(__dirname, '..');
const sources: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (f === 'node_modules' || f === 'dist' || f === 'scripts' || f === 'i18n') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) sources.push(p);
  }
};
walk(root);

const tr = CATALOGS.tr;
const errors: string[] = [];
const warnings: string[] = [];

// 1) Kodda kullanılan anahtarlar (sabit olanlar) Türkçe kataloğta olmalı
const used = new Set<string>();
const dynamicPrefixes = new Set<string>();
for (const f of sources) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\b(?:tr|t)\(\s*'([a-zA-Z0-9_.\-]+)'/g)) (m[1].endsWith('.') ? dynamicPrefixes : used).add(m[1]);
  for (const m of src.matchAll(/'((?:sub|settings|insight|xl|title)\.[a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
}
for (const k of used) if (tr[k] === undefined) errors.push(`kodda kullanılan anahtar tr kataloğunda yok: ${k}`);

const forms = (e: Entry): string[] => (typeof e === 'string' ? [e] : Object.values(e));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const validForms = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

const langs = (process.argv.slice(2).length ? process.argv.slice(2) : LANGS.map((l) => l.code).filter((c) => c !== 'tr')) as Lang[];
for (const lang of langs) {
  const cat = CATALOGS[lang];
  if (!cat) { errors.push(`${lang}: katalog yok`); continue; }
  const info = LANGS.find((l) => l.code === lang)!;
  for (const key of Object.keys(tr)) {
    const e = cat[key];
    if (e === undefined) { errors.push(`${lang}: eksik anahtar ${key}`); continue; }
    if (typeof e !== 'string') {
      if (e.other === undefined) errors.push(`${lang}: ${key} çoğul biçiminde 'other' yok`);
      for (const f of Object.keys(e)) if (!validForms.has(f)) errors.push(`${lang}: ${key} geçersiz çoğul biçimi '${f}'`);
    }
    const want = placeholders(forms(tr[key])[0]);
    for (const s of forms(e)) {
      if (!s.trim()) errors.push(`${lang}: ${key} boş`);
      if (placeholders(s) !== want) errors.push(`${lang}: ${key} yer tutucu uyuşmazlığı (beklenen {${want}}, bulunan {${placeholders(s)}}) → ${s}`);
    }
    if (typeof e === 'string' && typeof tr[key] === 'string' && e === tr[key] && /[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(e) && !/^(xl\.dateFormat|settings\.excel|settings\.themeNoir)$/.test(key)) {
      warnings.push(`${lang}: ${key} Türkçeyle aynı kalmış: ${e}`);
    }
    if (info.code !== 'tr' && typeof e === 'string' && /[ğĞıİşŞ]/.test(e) && !/^(menu\.defaultName)$/.test(key) && lang !== 'tr') {
      warnings.push(`${lang}: ${key} Türkçe harf içeriyor: ${e}`);
    }
  }
  for (const key of Object.keys(cat)) if (tr[key] === undefined && !key.startsWith('subwords.')) warnings.push(`${lang}: tr'de olmayan fazla anahtar ${key}`);
}

console.log(`kontrol edilen diller: ${langs.join(', ')} · kodda kullanılan sabit anahtar: ${used.size} · dinamik önekler: ${[...dynamicPrefixes].join(' ')}`);
warnings.forEach((w) => console.log('UYARI ' + w));
errors.forEach((e) => console.log('HATA  ' + e));
console.log(`${errors.length} hata, ${warnings.length} uyarı`);
process.exit(errors.length ? 1 : 0);
