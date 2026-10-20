/**
 * Renk kartelası arayüz testi (tarayıcıda, iPhone boyutunda): `npx tsx scripts/theme-ui-test.ts <dil> [--shots dizin]`
 *   Önce web paketi alınmalı: npx expo export --platform web --output-dir /tmp/web-out   (dizin: WEB_DIR)
 * Kontroller: her mod (Noir/Fildişi/Telefona göre) × 4 zemin tonu × 8 vurgu rengi için ekranda gerçekten uygulanan renkler
 * (zemin ve seçili çip rengi), seçili kartelanın işaretlenmesi, kalıcılık, dil değişince renklerin korunması.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, createReadStream, statSync } from 'fs';
import { extname, join } from 'path';
import { ACCENTS, ACCENT_COLORS, Mode, TINTS, TINT_COLORS, makeTheme } from '../src/palette';

const lang = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'tr';
const shotsIdx = process.argv.indexOf('--shots');
const shots = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
const WEB_DIR = process.env.WEB_DIR || '/tmp/web-out';
const PORT = 9100 + Math.floor(Math.random() * 100);
const NATIVE: Record<string, string> = { tr: 'Türkçe', en: 'English', es: 'Español', it: 'Italiano', zh: '简体中文' };
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(WEB_DIR, p);
  if (!f.startsWith(WEB_DIR) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
});

const catalogSrc = readFileSync(join(__dirname, '..', 'src', 'i18n', lang + '.ts'), 'utf8');
const cat = (key: string): string => {
  const m = catalogSrc.match(new RegExp("^  '" + key.replace(/\./g, '\\.') + "': ('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"),$", 'm'));
  if (!m) throw new Error('katalogda yok: ' + key);
  return new Function('return ' + m[1])();
};
const rgbOf = (h: string) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;

const settings = (extra: Record<string, unknown> = {}) => ({ budget: 10000, remind: false, remindHour: 21, subRemind: false, catBudgets: { Market: 3000 }, theme: 'noir', name: 'Test User', language: lang, ...extra });
const today = new Date().toISOString().slice(0, 10);
const data = (extra: Record<string, unknown> = {}) => ({
  items: [{ id: 'i1', amount: 400, cat: 'Market', note: 'Alpha', date: today, ts: Date.now() - 1000 }, { id: 'i2', amount: 120, cat: 'Eğlence', note: 'Bravo', date: today, ts: Date.now() - 2000 }],
  subs: [], settings: settings(extra),
});

(async () => {
  await new Promise<void>((r) => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}/`;
  const exe = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let pass = 0; const errors: string[] = [];
  const ok = (name: string, cond: boolean, detail = '') => { if (cond) { pass++; if (process.argv.includes('-v')) console.log('OK    ' + name); } else { errors.push(name); console.log('HATA  ' + name + (detail ? ' — ' + detail : '')); } };

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (er) => pageErrors.push(er.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_|Access-Control|CORS/.test(m.text())) pageErrors.push(m.text()); });
  await page.route(/api\.frankfurter\.dev|open\.er-api\.com/, (r) => r.abort('internetdisconnected'));

  const load = async (d: unknown) => {
    await page.goto(base);
    await page.evaluate((x) => localStorage.setItem('harcama-defteri:v1', JSON.stringify(x)), d);
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.length > 50, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
  };
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('harcama-defteri:v1') as string));
  const menuBtn = () => page.locator('[role="button"][aria-label]').first();
  const goSettings = async () => { await menuBtn().click(); await page.waitForTimeout(450); await page.locator('[role="menuitem"]').nth(6).click(); await page.waitForTimeout(600); };
  // Ekranın arka plan rengi: en büyük (ekranı kaplayan) arka planlı öğe
  const pageBg = () => page.evaluate(() => {
    let best = '';
    document.querySelectorAll('#root div').forEach((el) => {
      const b = el.getBoundingClientRect(); const c = getComputedStyle(el).backgroundColor;
      if (b.width >= 389 && b.height >= 800 && c !== 'rgba(0, 0, 0, 0)') best = c;
    });
    return best;
  });
  // Seçili dil çipinin arka planı = vurgu rengi
  const accentNow = (native: string) => page.evaluate((txt) => {
    const el = Array.from(document.querySelectorAll('div,span')).find((e) => e.childNodes.length === 1 && e.firstChild?.nodeType === 3 && e.textContent === txt);
    for (let p: Element | null = el ?? null; p; p = p.parentElement) {
      const c = getComputedStyle(p).backgroundColor;
      if (c !== 'rgba(0, 0, 0, 0)') return c;
    }
    return '';
  }, native);
  const swatch = (label: string) => page.locator(`[role="button"][aria-label="${label}"]`).first();

  for (const mode of ['noir', 'ivory'] as Mode[]) {
    await load(data({ theme: mode }));
    await goSettings();
    const label = `${mode}`;
    ok(`[${label}] varsayılan zemin`, (await pageBg()) === rgbOf(TINT_COLORS.classic[mode].bg), await pageBg());
    ok(`[${label}] varsayılan vurgu`, (await accentNow(NATIVE[lang])) === rgbOf(makeTheme(mode).accent), await accentNow(NATIVE[lang]));
    // 8 vurgu rengi
    for (const a of ACCENTS) {
      await swatch(cat('accent.' + a)).click(); await page.waitForTimeout(350);
      const want = rgbOf(makeTheme(mode, 'classic', a).accent);
      const got = await accentNow(NATIVE[lang]);
      ok(`[${label}] vurgu ${a} uygulanıyor`, got === want, `${got} ≠ ${want}`);
      ok(`[${label}] vurgu ${a}: kartela seçili işaretli`, (await swatch(cat('accent.' + a)).getAttribute('aria-selected')) === 'true');
      if (shots && ['emerald', 'rose', 'sapphire'].includes(a)) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, `${lang}-tema-${mode}-${a}.png`) }); }
    }
    ok(`[${label}] seçim kalıcı`, (await stored()).settings.accent === 'silver');
    // 4 zemin tonu (vurgu = gümüş)
    for (const k of TINTS) {
      await swatch(cat('tint.' + k)).click(); await page.waitForTimeout(350);
      const want = rgbOf(TINT_COLORS[k][mode].bg);
      const got = await pageBg();
      ok(`[${label}] zemin tonu ${k} uygulanıyor`, got === want, `${got} ≠ ${want}`);
      ok(`[${label}] ton ${k}: vurgu rengi korunuyor`, (await accentNow(NATIVE[lang])) === rgbOf(makeTheme(mode, k, 'silver').accent));
      if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, `${lang}-ton-${mode}-${k}.png`) }); }
    }
    // Her ekran seçili renklerle açılıyor (çökme/boş ekran yok)
    for (const n of [0, 2, 3, 4, 5]) {
      await menuBtn().click(); await page.waitForTimeout(400);
      await page.locator('[role="menuitem"]').nth(n).click(); await page.waitForTimeout(500);
      ok(`[${label}] ekran ${n} seçili temada açılıyor`, (await pageBg()) === rgbOf(TINT_COLORS[TINTS[TINTS.length - 1]][mode].bg));
      if (shots && n === 0) await page.screenshot({ path: join(shots, `${lang}-ozet-${mode}-plum-silver.png`) });
    }
    // Yeniden açılış ve dil değişimi renkleri korur
    await page.reload(); await page.waitForTimeout(1500);
    ok(`[${label}] yeniden açılışta renkler kalıcı`, (await pageBg()) === rgbOf(TINT_COLORS.plum[mode].bg));
    const st = await stored();
    ok(`[${label}] saklanan tercihler`, st.settings.accent === 'silver' && st.settings.tint === 'plum' && st.settings.theme === mode, JSON.stringify([st.settings.accent, st.settings.tint, st.settings.theme]));
    ok(`[${label}] harcama verisi değişmedi`, st.items.length === 2 && st.items[0].amount === 400);
    await goSettings();
    const other = lang === 'tr' ? 'English' : 'Türkçe';
    await page.getByText(other, { exact: true }).first().click(); await page.waitForTimeout(600);
    ok(`[${label}] dil değişince renkler değişmez`, (await pageBg()) === rgbOf(TINT_COLORS.plum[mode].bg) && (await stored()).settings.accent === 'silver');
  }

  // "Telefona göre": cihaz açık/koyu ayarına uyar, seçili ton ve vurgu iki modda da geçerli
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await load(data({ theme: 'system', tint: 'green', accent: 'copper' }));
    const mode: Mode = scheme === 'dark' ? 'noir' : 'ivory';
    ok(`[sistem/${scheme}] zemin ${mode} + yeşil ton`, (await pageBg()) === rgbOf(TINT_COLORS.green[mode].bg), await pageBg());
    await goSettings();
    ok(`[sistem/${scheme}] bakır vurgu`, (await accentNow(NATIVE[lang])) === rgbOf(makeTheme(mode, 'green', 'copper').accent));
    if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, `${lang}-sistem-${scheme}.png`) }); }
  }

  // Eski kayıt (renk alanı yok) varsayılanla açılır
  await page.emulateMedia({ colorScheme: 'dark' });
  const legacy: any = data({ theme: 'noir' });
  await load(legacy);
  ok('[eski veri] renk alanı olmayan kayıt varsayılan temayla açılıyor', (await pageBg()) === rgbOf(TINT_COLORS.classic.noir.bg));

  ok('sayfa hatası yok', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`\n[${lang}] ${pass} kontrol geçti, ${errors.length} hata`);
  await browser.close(); server.close();
  process.exit(errors.length ? 1 : 0);
})().catch((er) => { console.error('TEST HATASI', er); try { server.close(); } catch {} process.exit(2); });
