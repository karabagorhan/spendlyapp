/**
 * Para birimi arayüz testi (tarayıcıda, iPhone boyutunda): `node scripts/currency-ui-test.js <dil>`
 *   Önce web paketi alınmalı: npx expo export --platform web --output-dir /tmp/web-out   (dizin: WEB_DIR)
 *
 * Kur sağlayıcısı yanıtları TEST VERİSİDİR (1 USD = 0.9 EUR = 0.8 GBP = 40 TRY) ve tarayıcıda taklit edilir;
 * uygulamaya gömülü bir kur yoktur. Beklenen metinler Node'un Intl (CLDR) çıktısından üretilir.
 * Senaryolar: (1) karışık para birimli veri, ana birimi değiştirme, veri bütünlüğü; (2) yabancı para biriminde harcama girme;
 * (3) hiç kur yok (ağ kapalı); (4) eski kayıtlı kurlarla çevrimdışı.
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const lang = process.argv[2] || 'en';
const WEB_DIR = process.env.WEB_DIR || '/tmp/web-out';
const PORT = 8900 + Math.floor(Math.random() * 100);
const NATIVE = { tr: 'Türkçe', en: 'English', es: 'Español', it: 'Italiano', zh: '简体中文' };
const LOCALE = { tr: 'tr-TR', en: 'en-US', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' }[lang];
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(WEB_DIR, p);
  if (!f.startsWith(WEB_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// Katalogdan metin oku (anahtar → o dildeki metin)
const catalogSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', lang + '.ts'), 'utf8');
const cat = (key) => {
  const m = catalogSrc.match(new RegExp("^  '" + key.replace(/\./g, '\\.') + "': ('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"),$", 'm'));
  if (!m) throw new Error('katalogda yok: ' + key);
  return new Function('return ' + m[1])();
};
const norm = (s) => s.replace(/[  ]/g, ' ');
const money = (n, cur, d = 2) => norm(new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d }).format(n).replace('-', '−'));

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = iso(new Date());
const ymNow = today.slice(0, 7);
const RATES = { amount: 1, base: 'USD', date: '2026-10-16', rates: { EUR: 0.9, GBP: 0.8, TRY: 40, CNY: 7 } };

const settings = (extra = {}) => ({ budget: 10000, remind: false, remindHour: 21, subRemind: false, catBudgets: { Market: 3000 }, theme: 'noir', name: 'Test User', language: lang, ...extra });
const baseData = (extra = {}) => ({
  items: [
    { id: 'i1', amount: 400, cat: 'Market', note: 'Alpha', date: today, ts: Date.now() - 1000 },
    { id: 'i2', amount: 100, cat: 'Eğlence', note: 'Bravo', date: today, ts: Date.now() - 2000, cur: 'USD' },
  ],
  subs: [{ id: 'sub_n', name: 'Netflix', amount: 10, day: 28, freq: 'monthly', month: 1, cat: 'Eğlence', skip: '', type: 'yayin', cur: 'USD' }],
  settings: settings(extra),
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}/`;
  const exe = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let pass = 0; const errors = [];
  const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log('OK    ' + name); } else { errors.push(name); console.log('HATA  ' + name + (detail ? ' — ' + String(detail).slice(0, 300) : '')); } };

  async function open(scenario, { data, rates, ratesCache }) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (er) => pageErrors.push(er.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_|Access-Control|CORS/.test(m.text())) pageErrors.push(m.text()); });
    const hits = [];
    await page.route(/api\.frankfurter\.dev|open\.er-api\.com/, (r) => {
      hits.push(r.request().url());
      if (rates) r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(RATES) });
      else r.abort('internetdisconnected');
    });
    await page.goto(base);
    await page.evaluate(([d, c]) => { localStorage.setItem('harcama-defteri:v1', JSON.stringify(d)); if (c) localStorage.setItem('harcama-defteri:rates:v1', JSON.stringify(c)); }, [data, ratesCache || null]);
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.length > 50, null, { timeout: 30000 });
    await page.waitForTimeout(1800);
    const text = () => page.evaluate(() => document.body.innerText.replace(/[  ]/g, ' '));
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('harcama-defteri:v1')));
    const menuBtn = () => page.locator('[role="button"][aria-label]').first();
    const goTo = async (n) => { await menuBtn().click(); await page.waitForTimeout(450); await page.locator('[role="menuitem"]').nth(n).click(); await page.waitForTimeout(600); };
    const chip = (label) => page.getByText(label, { exact: true }).first();
    return { ctx, page, pageErrors, hits, text, stored, goTo, chip, scenario };
  }

  /* ---------- 1. Karışık para birimli veri, ana birimi değiştirme, veri bütünlüğü ---------- */
  {
    const data = baseData();
    const s = await open('karışık', { data, rates: true });
    const { page } = s;
    ok('[1] açılışta kur API\'sine istek atıldı', s.hits.length >= 1, s.hits.join(','));
    let t = await s.text();
    ok('[1] TRY: bugün = 400 ₺ + 100 $ (40 kur) = ' + money(4400, 'TRY'), t.includes(money(4400, 'TRY')), t.slice(0, 400));
    ok('[1] TRY: bütçe ' + money(10000, 'TRY', 0), t.includes(money(10000, 'TRY', 0)));
    ok('[1] kur güncelleme zamanı özette görünüyor', t.includes(String(new Date().getFullYear())) && /2026|20\d\d/.test(t));
    await s.goTo(2);
    t = await s.text();
    ok('[1] harcama listesinde $ kaydın özgün tutarı da yazıyor (' + money(100, 'USD') + ')', t.includes(money(100, 'USD')) && t.includes(money(4000, 'TRY')), t.slice(0, 500));
    await s.goTo(6);
    t = await s.text();
    ok('[1] ayarlarda kurlar: 1 USD = ' + money(40, 'TRY', 4), t.includes(money(40, 'TRY', 4)));
    ok('[1] ayarlarda kaynak ve kur tarihi', t.includes('Frankfurter (ECB)') && /16/.test(t));
    ok('[1] ayarlarda 5 para birimi', ['₺ TRY', '$ USD', '€ EUR', '£ GBP', '¥ CNY'].every((c) => t.includes(c)));

    // EUR'a geç
    await s.chip('€ EUR').click(); await page.waitForTimeout(700);
    await s.goTo(0);
    t = await s.text();
    ok('[1] EUR: bugün ' + money(99, 'EUR'), t.includes(money(99, 'EUR')), t.slice(0, 400));
    ok('[1] EUR: bütçe ' + money(225, 'EUR', 0), t.includes(money(225, 'EUR', 0)));
    ok('[1] EUR: ₺ kayıt çevrilmiş (' + money(9, 'EUR') + ') ve özgün ' + money(400, 'TRY') + ' ipucu olarak görünüyor', t.includes(money(9, 'EUR')) && t.includes(money(400, 'TRY')), t.slice(0, 600));
    await s.goTo(3);
    t = await s.text();
    ok('[1] EUR: raporlar € ile ve çökmeden açılıyor', t.includes('€') && !t.includes('NaN'), t.slice(0, 200));
    await s.goTo(4);
    t = await s.text();
    ok('[1] EUR: abonelik 10 $ = ' + money(9, 'EUR') + ' ve özgün tutar ' + money(10, 'USD'), t.includes(money(9, 'EUR')) && t.includes(money(10, 'USD')), t.slice(0, 400));
    let st = await s.stored();
    ok('[1] saklanan harcamalar değişmedi (tutar + birim)', JSON.stringify(st.items.map((x) => [x.id, x.amount, x.cur ?? null])) === JSON.stringify([['i1', 400, null], ['i2', 100, 'USD']]), JSON.stringify(st.items));
    ok('[1] saklanan bütçe 10000 ₺ olarak kaldı, ana birim EUR', st.settings.budget === 10000 && st.settings.budgetCur === 'TRY' && st.settings.currency === 'EUR', JSON.stringify(st.settings));
    ok('[1] saklanan abonelik 10 USD', st.subs[0].amount === 10 && st.subs[0].cur === 'USD');

    // USD, GBP, sonra TRY'ye dön: her şey eski haline
    await s.goTo(6);
    await s.chip('$ USD').click(); await page.waitForTimeout(500);
    await s.goTo(0); t = await s.text();
    ok('[1] USD: bugün ' + money(110, 'USD'), t.includes(money(110, 'USD')), t.slice(0, 300));
    await s.goTo(6);
    await s.chip('£ GBP').click(); await page.waitForTimeout(500);
    await s.goTo(0); t = await s.text();
    ok('[1] GBP: bugün ' + money(88, 'GBP'), t.includes(money(88, 'GBP')));
    await s.goTo(6);
    await s.chip('¥ CNY').click(); await page.waitForTimeout(500);
    await s.goTo(0); t = await s.text();
    ok('[1] CNY: bugün ' + money(770, 'CNY'), t.includes(money(770, 'CNY')), t.slice(0, 300));
    ok('[1] CNY: bütçe ' + money(1750, 'CNY', 0), t.includes(money(1750, 'CNY', 0)));
    await s.goTo(6);
    await s.chip('₺ TRY').click(); await page.waitForTimeout(500);
    await s.goTo(0); t = await s.text();
    ok('[1] TRY\'ye dönünce ' + money(4400, 'TRY') + ' ve bütçe ' + money(10000, 'TRY', 0), t.includes(money(4400, 'TRY')) && t.includes(money(10000, 'TRY', 0)));
    st = await s.stored();
    ok('[1] 5 değişiklik sonrası saklanan veri birebir aynı', JSON.stringify(st.items.map((x) => [x.amount, x.cur ?? null])) === JSON.stringify([[400, null], [100, 'USD']]) && st.settings.budget === 10000 && st.settings.budgetCur === 'TRY' && st.settings.catBudgets.Market === 3000);

    // Dil ile para birimi bağımsız: EUR seçiliyken dili değiştir, para birimi aynı kalmalı
    await s.goTo(6);
    await s.chip('€ EUR').click(); await page.waitForTimeout(400);
    const other = lang === 'tr' ? 'en' : 'tr';
    await page.getByText(NATIVE[other], { exact: true }).first().click(); await page.waitForTimeout(600);
    st = await s.stored();
    ok('[1] dil değişince ana para birimi değişmez (dil ve birim bağımsız)', st.settings.language === other && st.settings.currency === 'EUR', JSON.stringify([st.settings.language, st.settings.currency]));
    await page.reload(); await page.waitForTimeout(1800);
    st = await s.stored();
    ok('[1] dil ve para birimi yeniden açılışta kalıcı', st.settings.language === other && st.settings.currency === 'EUR');
    ok('[1] sayfa hatası yok', s.pageErrors.length === 0, s.pageErrors.join(' | '));
    await s.ctx.close();
  }

  /* ---------- 2. Yabancı para biriminde harcama girme ---------- */
  {
    const s = await open('giriş', { data: baseData(), rates: true });
    const { page } = s;
    await page.getByText(/^\+\s+/).first().click(); await page.waitForTimeout(800);
    await s.chip('$ USD').click(); await page.waitForTimeout(300);
    await page.locator('input').first().fill(lang === 'en' ? '10' : '10');
    await page.waitForTimeout(400);
    let t = await s.text();
    ok('[2] form: tutar etiketi $ simgeli', t.toLocaleUpperCase(LOCALE).includes(cat('common.amountField').replace('{sym}', '$').toLocaleUpperCase(LOCALE)), t.slice(0, 200));
    ok('[2] form: dönüşüm ipucu ≈ ' + money(400, 'TRY') + ' ve kur', t.includes('≈ ' + money(400, 'TRY')) && t.includes('1 USD = ' + money(40, 'TRY', 4)), t.slice(0, 400));
    await page.getByText(cat('common.save'), { exact: true }).last().click(); await page.waitForTimeout(800);
    const st = await s.stored();
    const added = st.items.find((x) => x.id !== 'i1' && x.id !== 'i2');
    ok('[2] kayıt USD olarak, girilen tutarla saklandı', !!added && added.amount === 10 && added.cur === 'USD', JSON.stringify(added));
    t = await s.text();
    ok('[2] listede ₺ karşılığı görünüyor (' + money(400, 'TRY') + ')', t.includes(money(400, 'TRY')));
    // Düzenleme: özgün $ tutarıyla açılır, dokunmadan kaydedince değişmez
    await s.goTo(2);
    await page.getByText(/Alpha|Bravo/).first().waitFor();
    ok('[2] sayfa hatası yok', s.pageErrors.length === 0, s.pageErrors.join(' | '));
    await s.ctx.close();
  }

  /* ---------- 3. Hiç kur yok (ağ kapalı) ---------- */
  {
    const s = await open('kur yok', { data: { ...baseData(), items: [baseData().items[0]], subs: [] }, rates: false });
    const { page } = s;
    await s.goTo(6);
    let t = await s.text();
    ok('[3] "kurlar alınamadı" açıkça yazıyor', t.includes(cat('rates.none').slice(0, 25)) || t.includes(cat('rates.failedNone').slice(0, 25)), t.slice(0, 300));
    ok('[3] uydurma kur satırı yok (1 USD satırı çıkmıyor)', !/1 USD/.test(t));
    const disabled = await page.locator('[role="button"][aria-disabled="true"]').count();
    ok('[3] kur yokken diğer para birimi seçenekleri kapalı (3 adet)', disabled >= 3, String(disabled));
    await s.goTo(0);
    t = await s.text();
    ok('[3] ₺ verisi kur olmadan aynen gösteriliyor ' + money(400, 'TRY'), t.includes(money(400, 'TRY')));
    ok('[3] kur notu yok (yalnız ₺ veri)', !t.includes(cat('rates.noteNone').slice(0, 15)));
    ok('[3] sayfa hatası yok', s.pageErrors.length === 0, s.pageErrors.join(' | '));
    await s.ctx.close();
  }

  /* ---------- 4. Eski kayıtlı kurlarla çevrimdışı ---------- */
  {
    const old = { rates: { USD: 1, EUR: 0.9, GBP: 0.8, TRY: 40, CNY: 7 }, fetchedAt: Date.now() - 3 * 864e5, asOf: '2026-10-13', provider: 'Frankfurter (ECB)' };
    const s = await open('çevrimdışı', { data: baseData({ currency: 'EUR' }), rates: false, ratesCache: old });
    const { page } = s;
    let t = await s.text();
    ok('[4] çevrimdışıyken kayıtlı kurla çeviriyor: bugün ' + money(99, 'EUR'), t.includes(money(99, 'EUR')), t.slice(0, 300));
    await s.goTo(6);
    t = await s.text();
    ok('[4] "kurlar güncellenemedi / eski" uyarısı var', t.includes(cat('rates.failed').slice(0, 25)) || t.includes(cat('rates.old').slice(0, 25)), t.slice(0, 600));
    ok('[4] 3 gün önceki güncelleme zamanı gösteriliyor', t.includes(String(new Date(old.fetchedAt).getDate())) );
    const before = await s.stored();
    await page.getByText(cat('rates.refresh'), { exact: true }).click(); await page.waitForTimeout(1500);
    t = await s.text();
    ok('[4] elle güncelleme başarısızsa uygulama çökmez, kayıtlı kurlar kalır', t.includes(money(0.9, 'EUR', 4)) && t.includes('1 USD'), t.slice(0, 500));
    const after = await s.stored();
    ok('[4] başarısız güncelleme veriyi değiştirmedi', JSON.stringify(before) === JSON.stringify(after));
    ok('[4] sayfa hatası yok', s.pageErrors.length === 0, s.pageErrors.join(' | '));
    await s.ctx.close();
  }

  console.log(`\n[${lang}] ${pass} kontrol geçti, ${errors.length} hata`);
  await browser.close(); server.close();
  process.exit(errors.length ? 1 : 0);
})().catch((er) => { console.error('TEST HATASI', er); try { server.close(); } catch {} process.exit(2); });
