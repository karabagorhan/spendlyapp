/**
 * Yayın öncesi denetim: `npm run check:release` (çıkış kodu 1 = yayınlanamaz).
 * Kod değiştirmez; yalnızca unutulmuş ya da güvensiz yapılandırmayı bulur.
 *   - Yasal bilgiler ve yayınlanmış gizlilik/koşullar adresleri doldurulmuş mu (App Store / Google Play zorunlu kılar)
 *   - Hesap özellikleri için Supabase değişkenleri ayarlı mı; sahte hesap servisi KAPALI mı
 *   - Apple ile giriş yeteneği ve gerekli eklentiler app.json'da var mı
 *   - Hizmet anahtarı (service_role) uygulama koduna sızmış mı
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const fails: string[] = [];
const warns: string[] = [];
const read = (p: string) => readFileSync(join(root, p), 'utf8');

// 1) Yasal bilgiler
const legal = read('src/legal/config.ts');
for (const m of legal.matchAll(/^\s{2}(\w+): '(.*)',?$/gm)) if (m[2] === 'REPLACE_ME') fails.push(`src/legal/config.ts: "${m[1]}" doldurulmamış (REPLACE_ME)`);
for (const m of legal.matchAll(/^\s{2}(privacyUrl|termsUrl|deletionUrl): '(.*)',?$/gm)) if (m[2] !== 'REPLACE_ME' && !/^https:\/\//.test(m[2])) fails.push(`src/legal/config.ts: "${m[1]}" https:// ile başlamalı`);

// 2) Ortam
const env = (k: string) => process.env[k] ?? '';
if (!/^https:\/\/[^/\s]+/.test(env('EXPO_PUBLIC_SUPABASE_URL')) || env('EXPO_PUBLIC_SUPABASE_ANON_KEY').length < 20) warns.push('EXPO_PUBLIC_SUPABASE_URL / ANON_KEY ayarlı değil: bu derlemede hesap özellikleri KAPALI olur (uygulama yalnızca yerel çalışır)');
if (env('EXPO_PUBLIC_AUTH_MOCK') === '1') fails.push('EXPO_PUBLIC_AUTH_MOCK=1: sahte hesap servisi açık, her e-postayla "giriş" yapılabilir. Üretim derlemesinde tanımlanmamalı');
for (const k of Object.keys(process.env)) if (k.startsWith('EXPO_PUBLIC_') && /SERVICE_ROLE|SECRET|PRIVATE/i.test(k)) fails.push(`${k}: EXPO_PUBLIC_* değişkenleri uygulamaya gömülür ve herkese açıktır; gizli anahtar buraya konmaz`);

// 3) app.json
const app = JSON.parse(read('app.json')).expo;
if (app.ios?.usesAppleSignIn !== true) fails.push('app.json: ios.usesAppleSignIn true olmalı (Apple ile giriş)');
for (const p of ['expo-apple-authentication', 'expo-secure-store', 'expo-web-browser']) if (!app.plugins?.includes(p)) fails.push(`app.json: "${p}" eklentisi eksik`);
if (!app.scheme) fails.push('app.json: scheme yok (e-posta doğrulama bağlantıları uygulamayı açamaz)');

// 4) Kaynak kodda sızıntı
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { if (['node_modules', 'dist', 'supabase', 'scripts', '.git'].includes(f)) continue; const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|json)$/.test(f) && files.push(p); } };
walk(root);
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (/service_role/.test(src) && !f.endsWith('release-check.ts') && !/\.md$/.test(f) && !/\/\*\*?[\s\S]*service_role[\s\S]*\*\//.test(src.split('\n').slice(0, 12).join('\n'))) warns.push(`${f.replace(root + '/', '')}: "service_role" geçiyor, gizli anahtar sızmadığını elle doğrula`);
  if (/eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(src)) fails.push(`${f.replace(root + '/', '')}: kaynakta JWT benzeri anahtar var`);
}

warns.forEach((w) => console.log('UYARI ' + w));
fails.forEach((f) => console.log('HATA  ' + f));
console.log(fails.length ? `\nYayına hazır DEĞİL: ${fails.length} engel, ${warns.length} uyarı` : `\nEngel yok (${warns.length} uyarı)`);
process.exit(fails.length ? 1 : 0);
