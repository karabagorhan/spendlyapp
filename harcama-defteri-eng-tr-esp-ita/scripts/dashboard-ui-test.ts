/**
 * Spendly paneli arayüz testi (tarayıcıda, gerçek veriyle): `npx tsx scripts/dashboard-ui-test.ts <tr|en|es|it|zh>`
 *   Önce web paketi: npx expo export --platform web --output-dir /tmp/web-dash   (dizin: WEB_DIR)
 * Kapsam: hesapların doğruluğu, gelir ekleme/düzenleme/silme (geri al), gizleme, para birimi geçişi ve veri bütünlüğü,
 * sekmeler ve gezinme, boş/yalnız-gider durumları, bozuk veri kurtarma, okuma/yazma hatası, yüklenme durumu, temalar ve
 * kontrast, duyarlı yerleşim (320 → 1280 px). Beklenen metinler uygulamanın kendi biçimlendiricisiyle üretilir.
 * Çıkış kodu 1: en az bir HATA.
 */
import { chromium, Page, BrowserContext } from 'playwright-core';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { CATALOGS, Lang, fmtPercent, setLanguage, t as tr } from '../src/i18n';
import { fmtMoney, setMainCurrency } from '../src/currency';
import { catName, greetingKey } from '../src/lib';

const lang = (process.argv[2] || 'en') as Lang;
const WEB_DIR = process.env.WEB_DIR || '/tmp/web-dash';
const PORT = 9000 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${PORT}/`;
const LOCALE: Record<Lang, string> = { tr: 'tr-TR', en: 'en-US', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };
setLanguage(lang);
setMainCurrency('TRY');
// es/it/fr gibi dillerde tutar ile simge arasında bölünmez boşluk (NBSP) vardır; hem beklenen hem görünen metin düz boşluğa çevrilerek karşılaştırılır
const sp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');
const T = (k: string, p: Record<string, string | number> = {}) => sp(tr(k, p));
const mny = (n: number, cur: 'TRY' | 'USD' = 'TRY', d = 2) => sp(fmtMoney(n, cur, d));
const pc = (n: number | string) => sp(fmtPercent(n));

const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(WEB_DIR, p === '/' ? '/index.html' : p);
  if (!f.startsWith(WEB_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WEB_DIR, 'index.html');
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let pass = 0;
const errors: string[] = [];
const warnings: string[] = [];
const ok = (name: string, cond: unknown, detail = '') => {
  if (cond) { pass++; console.log('OK    ' + name); } else { errors.push(name + (detail ? ' — ' + detail : '')); console.log('HATA  ' + name + (detail ? ' — ' + detail : '')); }
};
const KEY_LEAK = /\b(?:app|common|title|menu|dash|bal|qa|card|tab|income|incat|txn|state|toast|sub|subs|settings|auth|acct|legal|del|ob|hero|tile|section|recent|rates|xl|file)\.[A-Za-z0-9_.\-]+\b/;
const TR_WORDS = /\b(Bugün|Dün|Kaydet|Harcama|Harcamalar|Bütçe|Abonelik|Abonelikler|Ayarlar|Özet|Raporlar|Kategori|Tümü|işlem|aylık|yıllık|Vazgeç|Sil|Geri al|kaldı|aşıldı|Gelir|Gider)\b/;
const BAD_NUM = /\b(NaN|undefined|Infinity|null)\b/;

/* ---------- Test verisi (bugüne göre; tarihler her zaman bu ayda / geçen ayın 1'inde) ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = isoOf(new Date());
const prevFirst = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return isoOf(d); })();
const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
const NOW = Date.now();
const E = (id: string, date: string, amount: number, cat: string, note = '', ts = NOW - 1000) => ({ id, amount, cat, note, date, ts });
const I = (id: string, date: string, amount: number, cat: string, note = '', ts = NOW) => ({ id, amount, cat, note, date, ts });
// Bu ay: gider 100 + 50 + 25 = 175, gelir 1000 → net 825. Geçen ay (1'i): gider 200, gelir 500 → net 300 → değişim +%175
const items = [E('e1', today, 100, 'Market', 'Alpha'), E('e2', today, 50, 'Yeme-İçme', 'Bravo'), E('e3', today, 25, 'Market', 'Charlie'), E('e0', prevFirst, 200, 'Fatura', 'Old')];
const incomes = [I('i1', today, 1000, 'salary', 'Pay'), I('i0', prevFirst, 500, 'salary', 'OldPay')];
const subs = [
  { id: 's1', name: 'Netflix', amount: 189.99, day: 28, freq: 'monthly', month: 1, cat: 'Eğlence', skip: '', type: 'yayin' },
  { id: 's2', name: 'Spotify', amount: 99, day: 28, freq: 'monthly', month: 1, cat: 'Eğlence', skip: '', type: 'yayin' },
];
const settings = (o: object = {}) => ({ budget: 1000, budgetCur: 'TRY', remind: false, remindHour: 21, subRemind: false, catBudgets: {}, theme: 'ivory', accent: 'sapphire', tint: 'blue', name: 'Orhan', language: lang, currency: 'TRY', ...o });
const full = (o: object = {}) => ({ items, subs, incomes, settings: settings(o) });
const NET = 825, SPENT = 175, INCOME = 1000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// Uygulama her kaydı ayrı çevirip yuvarlar (eski tasarım); beklenen değer de aynı yolla hesaplanır
const usdIncome = r2(1000 / 40), usdSpent = r2(100 / 40) + r2(50 / 40) + r2(25 / 40), usdNet = r2(usdIncome - usdSpent);

let browser: Awaited<ReturnType<typeof chromium.launch>>;
const contexts: BrowserContext[] = [];
type Opts = { data?: unknown; raw?: string; viewport?: { width: number; height: number }; scheme?: 'light' | 'dark'; rates?: boolean; init?: string; ratesCache?: object };

async function open(o: Opts = {}): Promise<Page> {
  const vp = o.viewport ?? { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: vp.width < 700, hasTouch: vp.width < 700, locale: LOCALE[lang], colorScheme: o.scheme ?? 'light' });
  contexts.push(ctx);
  const seed = o.raw ?? (o.data === undefined ? null : JSON.stringify(o.data));
  const cache = o.ratesCache ? JSON.stringify(o.ratesCache) : null;
  await ctx.addInitScript(([raw, once, init, cache]: [string | null, string, string, string | null]) => {
    // tsx (esbuild) sayfa içinde çalışan işlevlere __name yardımcısını ekler; tarayıcıda tanımlı olmalı
    (window as any).__name = (f: unknown) => f;
    if (!sessionStorage.getItem(once)) {
      sessionStorage.setItem(once, '1');
      // Tanıtım/giriş kapısı devreye girmesin: eski kullanıcı gibi davranılır (kayıtlı veri varsa tanıtım yok)
      if (cache) localStorage.setItem('harcama-defteri:rates:v1', cache);
      if (raw !== null) localStorage.setItem('harcama-defteri:v1', raw);
      else localStorage.setItem('harcama-defteri:auth:v1', JSON.stringify({ onboarded: true, guest: true, lang: null, consent: null }));
    }
    if (init) new Function(init)();
  }, [seed, 'seeded', o.init ?? '', cache] as [string | null, string, string, string | null]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ok('sayfa hatası yok', false, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_FAILED|net::/.test(m.text())) ok('konsol hatası yok', false, m.text().slice(0, 160)); });
  const rateBody = JSON.stringify({ amount: 1, base: 'USD', date: '2026-10-16', rates: { EUR: 0.9, GBP: 0.8, TRY: 40, CNY: 7 } });
  await page.route('**/api.frankfurter.dev/**', (r) => (o.rates === false ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: rateBody })));
  await page.route('**/open.er-api.com/**', (r) => r.abort());
  await page.goto(base);
  await page.waitForFunction(() => document.body.innerText.length > 20, null, { timeout: 30000 });
  await page.waitForTimeout(900);
  return page;
}

const id = (p: Page, t: string) => p.getByTestId(t);
const text = (p: Page) => p.evaluate(() => document.body.innerText.replace(/[\u00a0\u202f]/g, ' '));
const has = async (p: Page, s: string) => (await text(p)).includes(s);
const tid = async (p: Page, t: string) => (await id(p, t).first().innerText().catch(() => '')).replace(/[\s\u00a0\u202f]+/g, ' ').trim();
const wait = async (p: Page, s: string, ms = 6000) => { try { await p.waitForFunction((x) => document.body.innerText.replace(/[\u00a0\u202f]/g, ' ').includes(x), s, { timeout: ms }); return true; } catch { return false; } };
// Form etiketleri büyük harfle çizilir (Label): büyük/küçük harfe duyarsız bekleme
const waitI = async (p: Page, s: string, ms = 6000) => { try { await p.waitForFunction((x) => document.body.innerText.toLocaleLowerCase().includes(x.toLocaleLowerCase()), s, { timeout: ms }); return true; } catch { return false; } };
const waitId = async (p: Page, t: string, ms = 6000) => { try { await p.getByTestId(t).first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
const stored = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('harcama-defteri:v1') || 'null'));
const goMenu = async (p: Page, n: number) => { await id(p, 'menu-open').click(); await p.waitForTimeout(450); await p.locator('[role="menuitem"]').nth(n).click(); await p.waitForTimeout(500); };
const money0 = (n: number) => mny(n, 'TRY', 0);

async function audit(p: Page, name: string) {
  await p.waitForTimeout(350);
  const r = await p.evaluate(() => {
    const W = window.innerWidth;
    const outside: string[] = [];
    document.querySelectorAll('div,span,h1,h2').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      const txt = el.childNodes.length === 1 && el.firstChild!.nodeType === 3 ? el.textContent!.trim() : '';
      let inScroller = false;
      for (let q = el.parentElement; q; q = q.parentElement) { const cs = getComputedStyle(q); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && q.scrollWidth > q.clientWidth) { inScroller = true; break; } }
      if (txt && !inScroller && (b.right > W + 1 || b.left < -1)) outside.push(txt.slice(0, 40));
    });
    return { overflowX: document.documentElement.scrollWidth > W + 1, outside, text: document.body.innerText };
  });
  ok(`[${name}] yatay taşma yok`, !r.overflowX);
  ok(`[${name}] ekran dışına taşan metin yok`, r.outside.length === 0, r.outside.slice(0, 3).join(' | '));
  const leak = r.text.match(KEY_LEAK);
  ok(`[${name}] çevrilmemiş anahtar sızmıyor`, !leak, leak?.[0]);
  const bad = r.text.match(BAD_NUM);
  ok(`[${name}] NaN/undefined/Infinity yok`, !bad, bad?.[0]);
  const pctBad = lang === 'tr' ? r.text.match(/\d%(?!\w)/) : r.text.match(/%\d/);
  ok(`[${name}] yüzde biçimi dile uygun`, !pctBad, pctBad?.[0]);
  if (lang !== 'tr') { const m = r.text.match(TR_WORDS); ok(`[${name}] Türkçe kelime kalmamış`, !m, m?.[0]); }
}

/** WCAG kontrast: önplan rengi, en yakın saydam olmayan arka plana karşı. Her metin düğümü için (yalnızca görünür, kart içi). */
const contrastReport = (p: Page, selector: string) => p.evaluate((sel) => {
  const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = (c: { r: number; g: number; b: number }) => { const f = (x: number) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.95) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const root = document.querySelector(sel);
  const bad: string[] = []; let n = 0;
  root?.querySelectorAll('div,span,h1,h2').forEach((el) => {
    if (!(el.childNodes.length === 1 && el.firstChild!.nodeType === 3) || !el.textContent!.trim()) return;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
    const fg = parse(getComputedStyle(el).color); if (!fg) return;
    const bg = bgOf(el); const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); n++;
    if (ratio < 4.5) bad.push(`${el.textContent!.trim().slice(0, 24)} ${ratio.toFixed(2)}`);
  });
  return { n, bad };
}, selector);

(async () => {
  await new Promise<void>((r) => server.listen(PORT, r));
  const exe = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((x) => fs.existsSync(x));
  browser = await chromium.launch(exe ? { executablePath: exe } : {});

  /* 1) Panel: gerçek veri üzerinde hesaplar */
  {
    const p = await open({ data: full() });
    const t0 = await text(p);
    ok('marka adı Spendly', t0.includes('Spendly'));
    ok('selamlama saate uygun ve adı içerir', (await tid(p, 'dash-greeting')) === T('dash.greetName', { greeting: T('dash.greeting.' + greetingKey(new Date().getHours())), name: 'Orhan' }), await tid(p, 'dash-greeting'));
    const card = await tid(p, 'balance-card');
    ok('net durum = gelir − gider', card.includes(mny(NET)), card);
    ok('aylık gelir kutusu', (await tid(p, 'bal-income')).includes(mny(INCOME)), await tid(p, 'bal-income'));
    ok('aylık gider kutusu', (await tid(p, 'bal-expenses')).includes(mny(SPENT)), await tid(p, 'bal-expenses'));
    ok('geçen aya göre değişim (+%175)', (await tid(p, 'bal-delta')) === `+${pc(175)}`, await tid(p, 'bal-delta'));
    ok('hızlı eylemler (4)', (await Promise.all(['expense', 'income', 'reports', 'budgets'].map((k) => id(p, 'qa-' + k).count()))).every((c) => c === 1));
    ok('günlük çubuklar: ayın gün sayısı kadar', (await p.locator('[data-testid^="bar-"]').count()) === daysInMonth, String(await p.locator('[data-testid^="bar-"]').count()));
    const cats = await tid(p, 'card-categories');
    ok('kategori halkası: en büyük kategori ve yüzdesi (Market %71)', cats.includes(catName('Market')) && cats.includes(pc(71)), cats);
    ok('kategori halkası: toplam gider', cats.includes(money0(SPENT)), cats);
    ok('bütçe halkası: %18 kullanıldı', (await tid(p, 'budget-pct')) === pc(18), await tid(p, 'budget-pct'));
    ok('bütçe: kalan tutar', (await tid(p, 'card-budget')).includes(money0(825)), await tid(p, 'card-budget'));
    ok('abonelik kartı: abonelikler listelenir', (await tid(p, 'card-subs')).includes('Netflix') && (await tid(p, 'card-subs')).includes('Spotify'));
    const r0 = await tid(p, 'recent-0');
    ok('son işlemler: en yeni gelir + işaretiyle başta', r0.includes('+') && r0.includes(mny(1000)), r0);
    ok('son işlemler: gider − işaretiyle', (await tid(p, 'recent-1')).includes('−'), await tid(p, 'recent-1'));
    ok('sekme çubuğu: 5 sekme, Ana sayfa seçili', (await p.locator('[data-testid^="tab-"][role="tab"]').count()) === 5 && (await id(p, 'tab-ozet').getAttribute('aria-selected')) === 'true');
    await audit(p, 'panel');
    const rep = await contrastReport(p, '[data-testid="card-spending"], [data-testid="card-categories"], [data-testid="card-budget"], [data-testid="card-subs"], [data-testid="card-recent"]');
    ok(`[panel/açık] kart metinleri WCAG AA kontrastlı (${rep.n} metin)`, rep.bad.length === 0, rep.bad.slice(0, 5).join(' | '));
    // çubuğa dokununca ipucu
    await id(p, 'bar-' + new Date().getDate()).click();
    ok('çubuğa dokununca gün ve tutar ipucu', (await tid(p, 'spending-tip')).includes(money0(SPENT)), await tid(p, 'spending-tip'));
    // yüklemede veri yeniden yazılmadı
    ok('açılış saklanan veriyi değiştirmez (yazma yok)', (await p.evaluate(() => localStorage.getItem('harcama-defteri:v1'))) === JSON.stringify(full()));
  }

  /* 2) Tutarları gizle */
  {
    const p = await open({ data: full() });
    await id(p, 'bal-eye').click();
    ok('gizle: bakiye ••••••', (await tid(p, 'bal-amount')) === '••••••');
    ok('gizle: gelir/gider kutuları gizli, gerçek tutar görünmez', !(await tid(p, 'balance-card')).includes(mny(NET)) && !(await tid(p, 'balance-card')).includes(mny(INCOME)));
    ok('gizle: kalıcı kaydedildi', (await stored(p)).settings.hideBalance === true);
    ok('gizle: veri değişmedi', JSON.stringify((await stored(p)).items) === JSON.stringify(items) && JSON.stringify((await stored(p)).incomes) === JSON.stringify(incomes));
    await p.reload(); await p.waitForTimeout(1200);
    ok('gizle: yenilemeden sonra da gizli', (await tid(p, 'bal-amount')) === '••••••');
    await id(p, 'bal-eye').click();
    ok('göster: tutar geri gelir', (await tid(p, 'balance-card')).includes(mny(NET)));
  }

  /* 3) Gelir ekle / düzenle / sil (geri al) */
  {
    const p = await open({ data: full() });
    await id(p, 'qa-income').click();
    ok('gelir formu açılır', await wait(p, T('income.newTitle')));
    await id(p, 'income-amount').fill(lang === 'tr' || lang === 'es' || lang === 'it' ? '250,50' : '250.50');
    ok('form: kaydet düğmesi tutarı gösterir', await has(p, T('income.saveAmount', { amount: mny(250.5) })));
    await p.getByText(T('incat.gift'), { exact: true }).first().click();
    await p.getByText(T('common.save'), { exact: true }).last().click();
    ok('gelir eklendi bildirimi', await wait(p, T('toast.incomeAdded', { amount: mny(250.5) })));
    const s1 = await stored(p);
    ok('gelir kalıcı kaydedildi (2 → 3)', s1.incomes.length === 3 && s1.incomes.some((x: any) => x.amount === 250.5 && x.cat === 'gift' && x.cur === 'TRY'), JSON.stringify(s1.incomes));
    ok('mevcut gelir ve harcamalar bozulmadı', JSON.stringify(s1.items) === JSON.stringify(items) && s1.incomes.filter((x: any) => x.id === 'i1' || x.id === 'i0').length === 2);
    ok('net durum güncellendi (825 + 250,50)', (await tid(p, 'balance-card')).includes(mny(NET + 250.5)), await tid(p, 'balance-card'));
    ok('gelir kutusu güncellendi', (await tid(p, 'bal-income')).includes(mny(INCOME + 250.5)));
    // Düzenle
    await id(p, 'recent-0').click();
    ok('düzenleme formu açılır', await wait(p, T('income.editTitle')));
    await p.getByText(T('common.delete'), { exact: true }).first().click();
    await p.getByText(T('common.confirmDelete'), { exact: true }).first().click();
    ok('silme bildirimi + geri al', await wait(p, T('toast.incomeDeleted')) && await has(p, T('toast.undo')));
    ok('silinince kayıttan çıkar', (await stored(p)).incomes.length === 2);
    ok('silinince net durum eski değerine döner', (await tid(p, 'balance-card')).includes(mny(NET)));
    await p.getByText(T('toast.undo'), { exact: true }).first().click(); await p.waitForTimeout(500);
    ok('geri al kaydı özgün haliyle döndürür', (await stored(p)).incomes.length === 3 && (await stored(p)).incomes.some((x: any) => x.amount === 250.5));
    await audit(p, 'gelir-eklendi');
  }

  /* 3b) Gelir formu: geçersiz tutar kaydedilmez */
  {
    const p = await open({ data: full() });
    await id(p, 'qa-income').click(); await wait(p, T('income.newTitle'));
    await id(p, 'income-amount').fill('0');
    await p.getByText(T('common.save'), { exact: true }).last().click({ force: true }).catch(() => {});
    await p.waitForTimeout(400);
    ok('sıfır tutar kaydedilmez', (await stored(p)).incomes.length === 2);
    await id(p, 'income-amount').fill('abc');
    await p.getByText(T('common.save'), { exact: true }).last().click({ force: true }).catch(() => {});
    await p.waitForTimeout(400);
    ok('harf girişi kaydedilmez', (await stored(p)).incomes.length === 2);
    await audit(p, 'gelir-formu');
  }

  /* 4) Harcama ekle (hızlı eylem) */
  {
    const p = await open({ data: full() });
    await id(p, 'qa-expense').click();
    ok('harcama formu açılır', await wait(p, T('expense.newTitle')));
    await p.locator('input').first().fill('40');
    await p.getByText(T('common.save'), { exact: true }).last().click();
    ok('harcama eklendi', (await stored(p)).items.length === 5);
    ok('gider ve net durum güncellendi', (await tid(p, 'bal-expenses')).includes(mny(SPENT + 40)) && (await tid(p, 'balance-card')).includes(mny(NET - 40)));
  }

  /* 5) Para birimi: geçiş, doğruluk, veri bütünlüğü */
  {
    const p = await open({ data: full() });
    const before = await p.evaluate(() => localStorage.getItem('harcama-defteri:v1'));
    await id(p, 'cur-pill').click();
    ok('para birimi menüsü: 5 seçenek', (await p.locator('[data-testid^="cur-opt-"]').count()) === 5);
    await audit(p, 'para-birimi-menüsü');
    await id(p, 'cur-opt-USD').click(); await p.waitForTimeout(900);
    ok('USD: net durum (kayıt bazlı çevrilmiş gelir − gider)', (await tid(p, 'balance-card')).includes(mny(usdNet, 'USD')), await tid(p, 'balance-card'));
    ok('USD: gelir ve gider dönüştürüldü', (await tid(p, 'bal-income')).includes(mny(usdIncome, 'USD')) && (await tid(p, 'bal-expenses')).includes(mny(usdSpent, 'USD')));
    ok('USD: bütçe halkası aynı oran (%18)', (await tid(p, 'budget-pct')) === pc(18));
    ok('USD: başlıktaki seçici güncellendi', (await tid(p, 'cur-pill')).includes('USD'));
    const s = await stored(p);
    ok('USD: saklanan kayıtlar DEĞİŞMEDİ (yalnızca ana birim)', JSON.stringify(s.items) === JSON.stringify(items) && JSON.stringify(s.incomes) === JSON.stringify(incomes) && s.settings.currency === 'USD');
    await id(p, 'recent-0').click(); await wait(p, T('income.editTitle')); await p.waitForTimeout(600);
    await p.getByText(T('common.cancel'), { exact: true }).first().click(); await p.waitForTimeout(500);
    await id(p, 'cur-pill').click(); await id(p, 'cur-opt-TRY').click(); await p.waitForTimeout(900);
    ok('TRY\'ye dönünce tutarlar aynen eski (kayma yok)', (await tid(p, 'balance-card')).includes(mny(NET)) && (await tid(p, 'bal-expenses')).includes(mny(SPENT)));
    const after = await stored(p);
    const b0 = JSON.parse(before!);
    ok('gidiş-dönüşte harcama/gelir/abonelik verisi bayt bayt aynı', JSON.stringify([after.items, after.subs, after.incomes]) === JSON.stringify([b0.items, b0.subs, b0.incomes]));
    ok('gidiş-dönüşte ayarlar aynı (bütçe, tema, vurgu, dil, ad, para birimi)', ['budget', 'budgetCur', 'theme', 'accent', 'tint', 'language', 'name', 'currency'].every((k) => after.settings[k] === b0.settings[k]), JSON.stringify(after.settings));
    // menü dışına dokunma değiştirmez
    await id(p, 'cur-pill').click(); await id(p, 'cur-scrim').click({ position: { x: 5, y: 5 } }); await p.waitForTimeout(400);
    ok('menü dışına dokunmak seçimi değiştirmez', (await stored(p)).settings.currency === 'TRY' && (await p.locator('[data-testid^="cur-opt-"]').count()) === 0);
  }
  {
    // Kur yokken: diğer birimler kapalı ve açıklama var
    const p = await open({ data: full(), rates: false });
    await id(p, 'cur-pill').click(); await p.waitForTimeout(400);
    ok('kur yokken diğer para birimleri kapalı', await id(p, 'cur-opt-USD').isDisabled() && !(await id(p, 'cur-opt-TRY').isDisabled()));
    ok('kur yokken açıklama gösterilir', await has(p, T('dash.currencyNeedRates')));
  }
  {
    // Hiç kur yok + yabancı para birimli kayıt: kayıt toplamlara dahil edilmedi uyarısı (kaç kayıt olduğuyla), "son kayıtlı kurlar" denmez
    const foreign = { ...full(), items: [{ ...E('f1', today, 10, 'Market', 'Euro', NOW - 500), cur: 'EUR' }, ...items] };
    const p = await open({ data: foreign, rates: false });
    ok('kur hiç yok: uyarı bandı doğru metinle görünür', await waitId(p, 'inline-notice') && (await tid(p, 'inline-notice')).includes(T('dash.unconverted', { n: 1 })), await tid(p, 'inline-notice'));
    ok('kur hiç yok: "son kayıtlı kurlar" yanlış bilgisi verilmez', !(await has(p, T('dash.ratesFailed'))));
    ok('kur hiç yok: yeniden dene eylemi', (await id(p, 'notice-action').count()) === 1);
    await audit(p, 'kur-yok');
  }
  {
    // Kayıtlı (eski) kur var ama yenileme başarısız: kayıtlı kurla çevrilir, özgün tutar görünür, uyarı doğru
    const cache = { rates: { USD: 1, EUR: 0.9, GBP: 0.8, TRY: 40, CNY: 7 }, fetchedAt: 1, asOf: '2026-10-01', provider: 'test' };
    const foreign = { ...full(), items: [{ ...E('f1', today, 10, 'Market', 'Euro', NOW - 500), cur: 'EUR' }, ...items] };
    const p = await open({ data: foreign, rates: false, ratesCache: cache });
    ok('eski kur + yenileme hatası: uyarı "son kayıtlı kurlar" der', await waitId(p, 'inline-notice') && (await tid(p, 'inline-notice')).includes(T('dash.ratesFailed')), await tid(p, 'inline-notice'));
    const r1 = await tid(p, 'recent-1');
    ok('€10 kayıt kayıtlı kurla çevrilir (€10/0,9×40 ₺)', r1.includes(mny(r2(10 / 0.9 * 40))), r1);
    ok('çevrilen kayıtta özgün tutar (€10,00) görünür', r1.includes(sp(fmtMoney(10, 'EUR'))), r1);
    ok('yeniden dene eylemi var', (await id(p, 'notice-action').count()) === 1);
    await audit(p, 'kur-eski');
  }

  /* 6) Gezinme: sekmeler, hızlı eylemler, menü */
  {
    const p = await open({ data: full() });
    const title = () => p.evaluate(() => { const el = Array.from(document.querySelectorAll('div,h1,h2')).find((e) => getComputedStyle(e).fontSize === '34px' && e.childNodes.length === 1 && e.firstChild!.nodeType === 3); return el ? el.textContent : ''; });
    await id(p, 'tab-harcamalar').click(); await p.waitForTimeout(500);
    ok('sekme: İşlemler → Harcamalar ekranı', (await title()) === T('title.harcamalar'), String(await title()));
    ok('İşlemler: Harcamalar | Gelirler anahtarı', (await id(p, 'txn-tab-expenses').count()) === 1 && (await id(p, 'txn-tab-income').count()) === 1);
    ok('İşlemler: harcama listesi eski haliyle (not görünür)', await has(p, 'Alpha'));
    await id(p, 'txn-tab-income').click(); await p.waitForTimeout(400);
    ok('Gelirler sekmesi: bu ayın geliri listelenir', await has(p, 'Pay') && await has(p, '+' + mny(1000)) && !(await has(p, 'OldPay')));
    ok('Gelirler: ay toplamı', (await text(p)).includes(mny(1000)));
    ok('Gelirler sekmesinde ekran başlığı "Gelirler"', (await title()) === T('txn.income'), String(await title()));
    ok('Gelirler sekmesinde hızlı düğme gelir ekler', await has(p, '+  ' + T('qa.income')));
    await audit(p, 'işlemler-gelir');
    await p.getByText('+  ' + T('qa.income'), { exact: true }).first().click();
    ok('hızlı düğme gelir formunu açar', await wait(p, T('income.newTitle')));
    await p.waitForTimeout(600);
    await p.getByText(T('common.cancel'), { exact: true }).first().click(); await p.waitForTimeout(500);
    await id(p, 'txn-tab-expenses').click();
    await id(p, 'tab-butce').click(); await p.waitForTimeout(500);
    ok('sekme: Bütçe', (await title()) === T('title.butce'), String(await title()));
    await id(p, 'tab-raporlar').click(); await p.waitForTimeout(500);
    ok('sekme: Raporlar', (await title()) === T('title.raporlar'), String(await title()));
    await id(p, 'tab-ayarlar').click(); await p.waitForTimeout(500);
    ok('sekme: Ayarlar', (await title()) === T('title.ayarlar'), String(await title()));
    ok('Ayarlar: yasal bağlantılar korunmuş', (await id(p, 'legal-privacy').count()) === 1);
    await audit(p, 'ayarlar');
    await id(p, 'tab-ozet').click(); await p.waitForTimeout(500);
    ok('sekme: Ana sayfa', (await title()) === 'Spendly', String(await title()));
    await id(p, 'qa-reports').click(); await p.waitForTimeout(500);
    ok('hızlı eylem: Raporlar', (await title()) === T('title.raporlar'));
    await id(p, 'tab-ozet').click(); await id(p, 'qa-budgets').click(); await p.waitForTimeout(500);
    ok('hızlı eylem: Bütçe', (await title()) === T('title.butce'));
    await id(p, 'tab-ozet').click(); await id(p, 'subs-all').click(); await p.waitForTimeout(500);
    ok('"Tümü": Abonelikler ekranı', (await title()) === T('title.abonelikler'));
    ok('Abonelikler ekranında sekme çubuğu görünür', (await id(p, 'tab-bar').count()) === 1);
    await id(p, 'tab-ozet').click(); await id(p, 'budget-pct').click().catch(() => {}); await p.waitForTimeout(400);
    await id(p, 'tab-ozet').click().catch(() => {});
    await id(p, 'menu-open').click(); await p.waitForTimeout(450);
    ok('profil düğmesi yan menüyü açar (7 öğe)', (await p.locator('[role="menuitem"]').count()) === 7);
  }

  /* 6b) Büyük tutarlar: tek satırda kalır, taşmaz */
  for (const w of [320, 360, 390]) {
    const bigData = { items: [E('b1', today, 98765.43, 'Market')], subs: [], incomes: [I('bi', today, 1234567.89, 'salary')], settings: settings({ budget: 5000000 }) };
    const p = await open({ data: bigData, viewport: { width: w, height: 800 } });
    // Tutar metnini içeren en iç öğenin satır sayısı (yükseklik / satır yüksekliği)
    const lines = (needle: string) => p.evaluate((n) => {
      const el = Array.from(document.querySelectorAll('div,span')).filter((e) => (e.textContent || '').replace(/[\u00a0\u202f\s]/g, '').includes(n.replace(/[\u00a0\u202f\s]/g, '')) && e.children.length <= 3).sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0] as HTMLElement | undefined;
      if (!el) return -1;
      const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
      return Math.round(el.getBoundingClientRect().height / lh);
    }, needle);
    const netText = mny(1234567.89 - 98765.43);
    ok(`[${w}px] büyük net tutar tek satır (${netText})`, (await lines(netText)) === 1, String(await lines(netText)));
    ok(`[${w}px] büyük gelir kutusu tek satır`, (await lines(mny(1234567.89))) === 1, String(await lines(mny(1234567.89))));
    ok(`[${w}px] halka ortası toplam tek satır`, (await lines(money0(98765.43))) <= 1, String(await lines(money0(98765.43))));
    await audit(p, `büyük-tutar-${w}px`);
  }

  /* 7) Boş durum */
  {
    const p = await open({ data: { items: [], subs: [], incomes: [], settings: settings({ budget: 0, name: '' }) } });
    ok('boş: net/uydurma tutar yok; "Harcanan" gösterilir', (await tid(p, 'balance-card')).startsWith(T('bal.spentTitle')), await tid(p, 'balance-card'));
    ok('boş: gelir kutusunda tutar yerine ekle çağrısı', (await tid(p, 'bal-income')).includes(T('bal.addShort')) && (await id(p, 'bal-add-income').count()) === 1);
    ok('boş: gelir ekle ipucu', await has(p, T('bal.noIncomeHint')));
    ok('boş: harcama grafiği boş durumu', (await tid(p, 'spending-empty')) === T('dash.emptySpending'));
    ok('boş: kategori boş durumu', (await tid(p, 'categories-empty')) === T('dash.emptySpending'));
    ok('boş: bütçe belirleme çağrısı', await has(p, T('dash.budgetEmpty')) && await has(p, T('dash.budgetSet')));
    ok('boş: abonelik boş durumu + ekle', await has(p, T('dash.subsEmpty')) && await has(p, T('dash.subsAdd')));
    ok('boş: son işlemler boş durumu', (await tid(p, 'recent-empty')) === T('dash.recentEmpty'));
    ok('boş: selamlama adsız', !(await tid(p, 'dash-greeting')).includes(','));
    ok('boş: değişim yüzdesi yok', (await id(p, 'bal-delta').count()) === 0);
    await audit(p, 'boş');
    await p.getByText(T('dash.budgetSet'), { exact: true }).first().click(); await p.waitForTimeout(500);
    ok('boş: "Bütçe belirle" bütçe ekranına götürür', await waitI(p, T('budget.field', { sym: '₺' })));
    await id(p, 'tab-ozet').click(); await p.waitForTimeout(400);
    await p.getByText(T('dash.subsAdd'), { exact: true }).first().click();
    ok('boş: "Abonelik ekle" formu açar', await waitI(p, T('sub.name')));
  }

  /* 8) Yalnızca gider var, gelir yok: uydurma net gösterilmez */
  {
    const p = await open({ data: { items, subs: [], incomes: [], settings: settings() } });
    const c = await tid(p, 'balance-card');
    ok('gelirsiz: büyük tutar harcanan toplamıdır, net değil', c.startsWith(T('bal.spentTitle')) && c.includes(mny(SPENT)), c);
    ok('gelirsiz: değişim yüzdesi gösterilmez', (await id(p, 'bal-delta').count()) === 0);
    ok('gelirsiz: gelir kutusu ekle çağrısı, sahte tutar yok', (await id(p, 'bal-add-income').count()) === 1 && !(await tid(p, 'bal-income')).match(/\d/));
    await id(p, 'bal-add-income').click();
    ok('gelirsiz: çağrı gelir formunu açar', await wait(p, T('income.newTitle')));
  }

  /* 9) Temalar ve kontrast */
  {
    const dark = await open({ data: full({ theme: 'noir' }), scheme: 'dark' });
    const light = await open({ data: full({ theme: 'ivory' }), scheme: 'light' });
    const bg = (p: Page) => p.evaluate(() => { for (const e of Array.from(document.querySelectorAll('div'))) { const c = getComputedStyle(e).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') return c; } return ''; });
    ok('koyu ve açık tema farklı zemin kullanır', (await bg(dark)) !== (await bg(light)));
    const rd = await contrastReport(dark, '[data-testid="card-spending"], [data-testid="card-categories"], [data-testid="card-budget"], [data-testid="card-subs"], [data-testid="card-recent"]');
    ok(`[panel/koyu] kart metinleri WCAG AA kontrastlı (${rd.n} metin)`, rd.bad.length === 0, rd.bad.slice(0, 5).join(' | '));
    await audit(dark, 'panel-koyu');
    const sysDark = await open({ data: full({ theme: 'system' }), scheme: 'dark' });
    const sysLight = await open({ data: full({ theme: 'system' }), scheme: 'light' });
    ok('"Telefona göre": cihazın koyu/açık ayarını izler', (await bg(sysDark)) === (await bg(dark)) && (await bg(sysLight)) === (await bg(light)));
    for (const accent of ['gold', 'emerald', 'rose', 'silver']) {
      const p = await open({ data: full({ accent, tint: 'classic' }), scheme: 'light' });
      const r = await contrastReport(p, '[data-testid="card-spending"], [data-testid="card-categories"], [data-testid="card-budget"], [data-testid="card-subs"], [data-testid="card-recent"]');
      ok(`[panel/açık/${accent}] kontrast`, r.bad.length === 0, r.bad.slice(0, 4).join(' | '));
    }
  }

  /* 10) Duyarlı yerleşim */
  for (const [w, h] of [[320, 640], [360, 740], [390, 844], [768, 1024], [1280, 800]] as [number, number][]) {
    const p = await open({ data: full(), viewport: { width: w, height: h } });
    const a = await id(p, 'card-spending').boundingBox();
    const b = await id(p, 'card-categories').boundingBox();
    const wrap = await id(p, 'balance-card').boundingBox();
    const sideBySide = !!a && !!b && Math.abs(a.y - b.y) < 4;
    ok(`[${w}px] ikili kartlar ${w < 340 ? 'alt alta' : 'yan yana'}`, w < 340 ? !!a && !!b && b.y > a.y + a.height - 2 : sideBySide, JSON.stringify({ a, b }));
    ok(`[${w}px] içerik sütunu ≤ 920 px ve ortalı`, !!wrap && wrap.width <= 921 && Math.abs(wrap.x + wrap.width / 2 - w / 2) < 14, JSON.stringify(wrap));
    const tb = await id(p, 'tab-bar').boundingBox();
    ok(`[${w}px] sekme çubuğu ekranın altında`, !!tb && Math.abs(tb.y + tb.height - h) < 3, JSON.stringify(tb));
    await audit(p, `${w}px`);
  }

  /* 11) Veri güvenliği: bozuk kayıt, okuma hatası, yazma hatası, yüklenme */
  {
    const p = await open({ raw: '{bozuk json' });
    ok('bozuk kayıt: uygulama açılır (boş veriyle)', await waitId(p, 'balance-card'));
    ok('bozuk kayıt: kalıcı uyarı bandıyla bildirilir', await waitId(p, 'inline-notice') && (await tid(p, 'inline-notice')).includes(T('state.recovered')), await tid(p, 'inline-notice'));
    await p.waitForTimeout(3200);
    ok('bozuk kayıt: uyarı kısa sürede kaybolmaz (toast gibi değil)', (await id(p, 'inline-notice').count()) === 1);
    await id(p, 'notice-action').click(); await p.waitForTimeout(300);
    ok('bozuk kayıt: "Tamam" ile kapatılır', (await id(p, 'inline-notice').count()) === 0);
    const kept = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('harcama-defteri:v1:corrupt:')).map((k) => localStorage.getItem(k)));
    ok('bozuk kayıt: özgün metin yedeklendi', kept.length === 1 && kept[0] === '{bozuk json', JSON.stringify(kept));
  }
  {
    const initFail = `window.__failRead = true; window.__writes = 0; var g = Storage.prototype.getItem; var s = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) { if (window.__failRead && k === 'harcama-defteri:v1') throw new Error('okuma hatası'); return g.apply(this, arguments); };
      Storage.prototype.setItem = function (k) { if (k === 'harcama-defteri:v1') window.__writes++; return s.apply(this, arguments); };`;
    const p = await open({ data: full(), init: initFail });
    ok('okuma hatası: hata ekranı (veri açılamadı)', await waitId(p, 'data-error') && await has(p, T('state.errorTitle')));
    ok('okuma hatası: "kayıtların silinmedi" güvencesi', await has(p, T('state.errorBody')));
    await audit(p, 'okuma-hatası');
    ok('okuma hatasında gerçek veriye hiçbir şey YAZILMADI', (await p.evaluate(() => (window as any).__writes)) === 0);
    await p.evaluate(() => { (window as any).__failRead = false; });
    await p.getByText(T('state.retry'), { exact: true }).click(); await p.waitForTimeout(1200);
    ok('okuma hatası: tekrar dene → panel açılır', await waitId(p, 'balance-card'));
    ok('okuma hatası: veri eksiksiz geri geldi', (await tid(p, 'balance-card')).includes(mny(NET)));
    ok('okuma hatası sonrası da kayıt değişmedi', (await p.evaluate(() => localStorage.getItem('harcama-defteri:v1'))) === JSON.stringify(full()));
  }
  {
    const initFailWrite = `var s = Storage.prototype.setItem; Storage.prototype.setItem = function (k) { if (k === 'harcama-defteri:v1' && window.__failWrite) throw new Error('depolama dolu'); return s.apply(this, arguments); };`;
    const p = await open({ data: full(), init: initFailWrite });
    await p.evaluate(() => { (window as any).__failWrite = true; });
    await id(p, 'qa-expense').click(); await wait(p, T('expense.newTitle'));
    await p.locator('input').first().fill('15');
    await p.getByText(T('common.save'), { exact: true }).last().click();
    ok('yazma hatası: kalıcı uyarı bandıyla bildirilir', await waitId(p, 'inline-notice') && (await tid(p, 'inline-notice')).includes(T('state.saveFailed')), await tid(p, 'inline-notice'));
    await p.evaluate(() => { (window as any).__failWrite = false; });
    await p.getByText(T('qa.expense'), { exact: true }).first().click(); await wait(p, T('expense.newTitle'));
    await p.locator('input').first().fill('16');
    await p.getByText(T('common.save'), { exact: true }).last().click(); await p.waitForTimeout(600);
    ok('yazma düzelince uyarı kendiliğinden kalkar', (await id(p, 'inline-notice').count()) === 0);
  }
  {
    const initSkel = `window.__saw = false; new MutationObserver(function () { if (document.querySelector('[data-testid="dash-skeleton"]')) window.__saw = true; }).observe(document, { childList: true, subtree: true });`;
    const p = await open({ data: full(), init: initSkel });
    ok('yüklenme durumu: iskelet gösterildi (ve sonra panel)', (await p.evaluate(() => (window as any).__saw)) === true && (await id(p, 'dash-skeleton').count()) === 0);
  }

  /* 12) Eski kullanıcı verisi: gelirsiz / yeni ayarsız kayıt sorunsuz açılır ve korunur */
  {
    const legacy = { items, subs, settings: { budget: 1000, theme: 'noir', accent: 'gold', tint: 'classic', name: 'Eski', language: lang, currency: 'TRY', budgetCur: 'TRY', remind: false, remindHour: 21, subRemind: false, catBudgets: {} } };
    const p = await open({ data: legacy });
    ok('eski kayıt: panel açılır (gelir yok → harcanan)', (await tid(p, 'balance-card')).startsWith(T('bal.spentTitle')) && (await tid(p, 'balance-card')).includes(mny(SPENT)));
    ok('eski kayıt: açılışta üzerine yazılmaz', (await p.evaluate(() => localStorage.getItem('harcama-defteri:v1'))) === JSON.stringify(legacy));
    await id(p, 'qa-income').click(); await wait(p, T('income.newTitle'));
    await id(p, 'income-amount').fill('10');
    await p.getByText(T('common.save'), { exact: true }).last().click(); await p.waitForTimeout(500);
    const s = await stored(p);
    ok('eski kayıt: gelir eklenince eski veriler korunur', JSON.stringify(s.items) === JSON.stringify(items) && s.subs.length === 2 && s.incomes.length === 1 && s.settings.theme === 'noir' && s.settings.accent === 'gold' && s.settings.name === 'Eski');
    ok('eski kayıt: ilk gelirle hero "Net durum"a döner', (await tid(p, 'balance-card')).startsWith(T('bal.netTitle')));
  }

  await browser.close();
  server.close();
  warnings.forEach((w) => console.log('UYARI ' + w));
  console.log(`\n[${lang}] ${pass} geçti, ${errors.length} hata, ${warnings.length} uyarı`);
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); try { server.close(); } catch { /* */ } process.exit(2); });
