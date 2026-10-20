/**
 * Kaydırma hareketleri testi (tarayıcıda, iPhone boyutunda): `node scripts/gesture-ui-test.js <dil>`
 *   Önce web paketi alınmalı: npx expo export --platform web --output-dir /tmp/web-out   (dizin: WEB_DIR)
 * Kontroller: yan menü sola kaydırarak (panelden ve karartılmış alandan) kapanır, kısa/dikey/yanlış yönde kaydırma kapatmaz;
 * sol kenardan sağa kaydırma önceki ekrana döner (ana ekranda menüyü açar); kenarda başlamayan ya da kısa kaydırma etkisizdir;
 * alt sayfa sol kenardan kaydırarak kapanır; veri değişmez, sayfa hatası yok.
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const lang = process.argv[2] || 'tr';
const WEB_DIR = process.env.WEB_DIR || '/tmp/web-out';
const PORT = 9200 + Math.floor(Math.random() * 100);
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(WEB_DIR, p);
  if (!f.startsWith(WEB_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const catalogSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', lang + '.ts'), 'utf8');
const cat = (key) => {
  const m = catalogSrc.match(new RegExp("^  '" + key.replace(/\./g, '\\.') + "': ('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"),$", 'm'));
  if (!m) throw new Error('katalogda yok: ' + key);
  return new Function('return ' + m[1])();
};
const today = new Date().toISOString().slice(0, 10);
const data = {
  items: [{ id: 'i1', amount: 400, cat: 'Market', note: 'Alpha', date: today, ts: Date.now() - 1000 }, { id: 'i2', amount: 120, cat: 'Eğlence', note: 'Bravo', date: today, ts: Date.now() - 2000 }],
  subs: [], settings: { budget: 10000, remind: false, remindHour: 21, subRemind: false, catBudgets: {}, theme: 'noir', name: 'Test User', language: lang },
};

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const exe = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', (er) => pageErrors.push(er.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_|Access-Control|CORS/.test(m.text())) pageErrors.push(m.text()); });
  await page.route(/api\.frankfurter\.dev|open\.er-api\.com/, (r) => r.abort('internetdisconnected'));
  let pass = 0; const errors = [];
  const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log('OK    ' + name); } else { errors.push(name); console.log('HATA  ' + name + (detail ? ' — ' + detail : '')); } };

  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.evaluate((d) => localStorage.setItem('harcama-defteri:v1', JSON.stringify(d)), data);
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.length > 50, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // Gerçek iPhone dokunuşu gibi: CDP ile touchStart / touchMove / touchEnd olayları
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const drag = async (x0, y0, x1, y1, steps = 14, delay = 12) => {
    await touch('touchStart', x0, y0);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); await page.waitForTimeout(delay); }
    await touch('touchEnd', x1, y1); await page.waitForTimeout(650);
  };
  const menuOpen = async () => (await page.locator('[role="menuitem"]').count()) > 0;
  const openMenu = async () => { if (!(await menuOpen())) { await page.locator('[role="button"][aria-label]').first().click(); await page.waitForTimeout(500); } };
  const closeMenuByTap = async () => { await page.mouse.click(370, 400); await page.waitForTimeout(500); };
  // Üst başlık (34 px yazı)
  const title = () => page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find((e) => getComputedStyle(e).fontSize === '34px' && e.childNodes.length === 1 && e.firstChild.nodeType === 3);
    return el ? el.textContent : '';
  });
  const goto = async (n) => { await openMenu(); await page.locator('[role="menuitem"]').nth(n).click(); await page.waitForTimeout(600); };
  const T = (k) => cat('title.' + k);

  /* ---- Yan menü ---- */
  await openMenu();
  ok('menü açılıyor', await menuOpen());
  await drag(40, 420, 300, 420);
  ok('sağa kaydırma menüyü kapatmaz', await menuOpen());
  await drag(250, 420, 215, 420);
  ok('kısa (35 px) sola kaydırma menüyü kapatmaz', await menuOpen());
  await drag(200, 560, 200, 300);
  ok('dikey kaydırma menüyü kapatmaz', await menuOpen());
  await drag(260, 420, 60, 420);
  ok('panelden sola kaydırma menüyü kapatır', !(await menuOpen()));
  await openMenu();
  await drag(370, 500, 150, 500);
  ok('karartılmış alandan sola kaydırma menüyü kapatır', !(await menuOpen()));
  await openMenu();
  await closeMenuByTap();
  ok('karartılmış alana dokunmak yine kapatır', !(await menuOpen()));

  /* ---- Geri (sol kenardan sağa kaydırma) ---- */
  ok('başlangıç: Özet', (await title()) === T('ozet'), await title());
  await drag(4, 400, 40, 400);
  ok('kısa kenar kaydırması bir şey yapmaz', !(await menuOpen()) && (await title()) === T('ozet'));
  await drag(100, 400, 280, 400);
  ok('kenarda başlamayan kaydırma bir şey yapmaz', !(await menuOpen()) && (await title()) === T('ozet'));
  await drag(4, 400, 200, 400);
  ok('ana ekranda kenar kaydırması yan menüyü açar', await menuOpen());
  await drag(260, 420, 60, 420);
  ok('menü yine kaydırarak kapanıyor', !(await menuOpen()));

  await goto(2);
  ok('Harcamalar ekranı', (await title()) === T('harcamalar'), await title());
  await goto(3);
  ok('Raporlar ekranı', (await title()) === T('raporlar'), await title());
  await goto(4);
  ok('Abonelikler ekranı', (await title()) === T('abonelikler'), await title());
  await drag(4, 400, 200, 400);
  ok('geri: Abonelikler → Raporlar', (await title()) === T('raporlar'), await title());
  await drag(100, 300, 260, 520);
  ok('çapraz (dikey baskın) kaydırma geri döndürmez', (await title()) === T('raporlar'), await title());
  await drag(150, 300, 320, 300);
  ok('geri: Raporlar → Harcamalar (ekranın ortasından kaydırarak)', (await title()) === T('harcamalar'), await title());
  await drag(4, 400, 200, 400);
  ok('geri: Harcamalar → Özet', (await title()) === T('ozet'), await title());
  await drag(4, 400, 200, 400);
  ok('Özet\'te geri: menü açılır (ekran değişmez)', (await menuOpen()) && (await title()) === T('ozet'));
  await drag(4, 400, 200, 400);
  ok('menü açıkken kenar kaydırması ekranı değiştirmez', await menuOpen() && (await title()) === T('ozet'));
  await drag(260, 420, 60, 420);

  // Yatay çip satırı kendi kaydırmasını korur; harcama satırından başlayan kaydırma satırı açmaz, geri döner
  await goto(2);
  const chipY = await page.evaluate((txt) => {
    const el = Array.from(document.querySelectorAll('div,span')).find((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 && e.textContent === txt);
    const b = el.getBoundingClientRect(); return b.top + b.height / 2;
  }, cat('cat.Market'));
  await drag(120, chipY, 330, chipY);
  ok('kategori çiplerinin üstünde kaydırma geri döndürmez', (await title()) === T('harcamalar'), await title());
  const rowY = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div,span')).find((e) => e.textContent === 'Alpha' && e.childNodes.length === 1);
    const b = el.getBoundingClientRect(); return b.top + b.height / 2;
  });
  await drag(140, rowY, 330, rowY);
  ok('harcama satırı üstünden kaydırma geri döndürür', (await title()) === T('ozet'), await title());
  ok('satır kaydırması harcama formunu açmaz', !(await page.evaluate(() => document.body.innerText)).includes(cat('expense.editTitle')));

  // Hızlı kısa hareket (fling) de geri döner
  await goto(5);
  ok('Bütçe ekranı', (await title()) === T('butce'), await title());
  await drag(4, 400, 110, 400, 5, 6);
  ok('hızlı kısa kaydırma (fling) geri döner', (await title()) === T('ozet'), await title());

  // Özet'ten Bütçe'ye doğrudan bağlantı: geri → Özet
  await page.getByText(new RegExp(cat('hero.budget').split('{amount}')[0].trim())).first().click();
  await page.waitForTimeout(700);
  ok('Özet kartından bütçeye gidildi', (await title()) === T('butce'), await title());
  await drag(4, 400, 200, 400);
  ok('geri: Bütçe → Özet', (await title()) === T('ozet'), await title());

  /* ---- Alt sayfa ---- */
  await page.getByText(/^\+\s+/).first().click(); await page.waitForTimeout(800);
  ok('yeni harcama sayfası açıldı', (await page.evaluate(() => document.body.innerText)).includes(cat('expense.newTitle')));
  await drag(4, 400, 200, 400);
  ok('alt sayfa sol kenardan kaydırarak kapanıyor', !(await page.evaluate(() => document.body.innerText)).includes(cat('expense.newTitle')));
  ok('alt sayfa kapanınca arkadaki ekran aynı (Özet)', (await title()) === T('ozet'));

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('harcama-defteri:v1')));
  ok('hareketler veriyi değiştirmedi', st.items.length === 2 && st.items[0].amount === 400 && st.settings.budget === 10000);
  ok('sayfa hatası yok', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`\n[${lang}] ${pass} kontrol geçti, ${errors.length} hata`);
  await browser.close(); server.close();
  process.exit(errors.length ? 1 : 0);
})().catch((er) => { console.error('TEST HATASI', er); try { server.close(); } catch {} process.exit(2); });
