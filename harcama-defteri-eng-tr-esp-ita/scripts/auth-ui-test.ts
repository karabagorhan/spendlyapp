/**
 * Hesap/tanıtım arayüz testi (tarayıcıda, iPhone boyutunda, SAHTE hesap servisiyle):
 *   EXPO_PUBLIC_AUTH_MOCK=1 npx expo export --clear --platform web --output-dir /tmp/web-auth   (--clear: Metro önbelleği env değerini taşımasın)
 *   WEB_DIR=/tmp/web-auth npx tsx scripts/auth-ui-test.ts <tr|en|es|it|zh>
 * Gerçek Supabase'e hiç istek gitmez. Senaryolar: tanıtım, karşılama, kayıt doğrulamaları, çifte gönderim, e-posta bağlantısı,
 * çıkış/giriş, parola sıfırlama, hesap silme, misafir, çevrimdışı, eski kullanıcı. Her ekranda taşma ve çeviri sızıntısı denetlenir.
 */
import { chromium, Page, BrowserContext } from 'playwright-core';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { CATALOGS, Lang } from '../src/i18n';

const lang = (process.argv[2] || 'en') as Lang;
const WEB_DIR = process.env.WEB_DIR || '/tmp/web-auth';
const PORT = 8900 + Math.floor(Math.random() * 90);
const cat = CATALOGS[lang];
const T = (k: string, p: Record<string, string | number> = {}) => (cat[k] as string).replace(/\{(\w+)\}/g, (_, n) => String(p[n]));
const LOCALE: Record<Lang, string> = { tr: 'tr-TR', en: 'en-US', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(WEB_DIR, p === '/' ? '/index.html' : p);
  // Tek sayfalık uygulama: dosya olmayan yollar (ör. /auth-callback) index.html'e düşer, bağlantı adresi uygulamaya ulaşır
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
const KEY_LEAK = /\b(?:ob|auth|acct|del|legal)\.[A-Za-z0-9_.]+\b/;
const TR_WORDS = /\b(Hoş geldin|Devam|Atla|Giriş yap|Parola|Hesap|Kaydol|Gizlilik|Koşulları)\b/;
const PW = 'k7#Rw2pQmZ4x';
const base = `http://127.0.0.1:${PORT}/`;

type Opts = { prefs?: object; data?: object; url?: string };
let browser: Awaited<ReturnType<typeof chromium.launch>>;
const contexts: BrowserContext[] = [];

async function open(o: Opts = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: LOCALE[lang] });
  contexts.push(ctx);
  await ctx.addInitScript(([prefs, data, once]: [object | null, object | null, string]) => {
    // Sahte hesap servisinin çalışma zamanı izni (üretim paketinde bu bayrak yoktur)
    (window as unknown as { __ALLOW_AUTH_MOCK__: boolean }).__ALLOW_AUTH_MOCK__ = true;
    // Yalnızca tarayıcı oturumunun ilk yüklemesinde tohumla; sayfa yenilenince (e-posta bağlantısı) veriler korunur
    if (sessionStorage.getItem(once)) return;
    sessionStorage.setItem(once, '1');
    if (prefs) localStorage.setItem('harcama-defteri:auth:v1', JSON.stringify(prefs));
    if (data) localStorage.setItem('harcama-defteri:v1', JSON.stringify(data));
  }, [o.prefs ?? null, o.data ?? null, 'seeded'] as [object | null, object | null, string]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ok('sayfa hatası yok', false, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) ok('konsol hatası yok', false, m.text().slice(0, 160)); });
  await page.route('**/api.frankfurter.dev/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ amount: 1, base: 'USD', date: '2026-10-16', rates: { EUR: 0.9, GBP: 0.8, TRY: 40, CNY: 7 } }) }));
  await page.goto(base + (o.url ?? ''));
  await page.waitForFunction(() => document.body.innerText.length > 20, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  return page;
}

const id = (p: Page, t: string) => p.getByTestId(t);
const text = (p: Page) => p.evaluate(() => document.body.innerText);
const has = async (p: Page, s: string) => (await text(p)).includes(s);
/** Ekrana özgü testID'yi bekler (metin eşleşmesi diller arasında başka ekranların alt dizisi olabilir: tr "doğrula…", zh "验证你的邮箱…"). */
const waitId = async (p: Page, t: string, ms = 6000) => { try { await p.getByTestId(t).first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
const waitText = async (p: Page, s: string, ms = 6000) => { try { await p.waitForFunction((x) => document.body.innerText.includes(x), s, { timeout: ms }); return true; } catch { return false; } };
const mock = <T,>(p: Page, fn: (m: any) => T) => p.evaluate((src) => new Function('m', 'return (' + src + ')(m)')((window as any).__AUTH_MOCK__), fn.toString());

async function audit(p: Page, name: string) {
  await p.waitForTimeout(350);
  const r = await p.evaluate(() => {
    const W = window.innerWidth;
    const outside: string[] = [];
    document.querySelectorAll('div,span').forEach((el) => {
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
  if (lang !== 'tr') { const m = r.text.match(TR_WORDS); if (m) warnings.push(`[${name}] Türkçe artığı: ${m[0]}`); }
}

const signUpForm = async (p: Page, email: string, pw = PW, pw2 = pw, consent = true) => {
  await id(p, 'su-email').fill(email);
  await id(p, 'su-pw').fill(pw);
  await id(p, 'su-pw2').fill(pw2);
  if (consent) await id(p, 'su-consent').click();
};
const toMain = async (p: Page) => { await id(p, 'ob-skip').click(); };

(async () => {
  await new Promise<void>((r) => server.listen(PORT, r));
  const exe = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((x) => fs.existsSync(x));
  browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const prefs = { onboarded: true, guest: false, consent: null, lang };

  /* 1) Tanıtım */
  {
    const p = await open({ prefs: { lang } });
    ok('ilk açılış: tanıtım 1. sayfa', await has(p, T('ob.1.title')));
    ok('ilk açılış: dil seçici görünür', await has(p, 'Türkçe') && await has(p, 'English'));
    await audit(p, 'tanıtım-1');
    await id(p, 'ob-next').click();
    ok('tanıtım 2. sayfa', await waitText(p, T('ob.2.title')));
    await id(p, 'ob-next').click();
    ok('tanıtım 3. sayfa (hesap isteğe bağlı)', await waitText(p, T('ob.3.title')) && await has(p, T('ob.3.body')));
    ok('son sayfada "Atla" yok', (await id(p, 'ob-skip').count()) === 0);
    await audit(p, 'tanıtım-3');
    await id(p, 'ob-next').click();
    ok('tanıtım bitince karşılama', await waitText(p, T('auth.welcome.title')));
    await p.reload();
    await p.waitForTimeout(800);
    ok('yenilenince tanıtım tekrarlanmaz', await has(p, T('auth.welcome.title')) && !(await has(p, T('ob.1.title'))));
  }

  /* 2) Atla + dil seçimi kalıcı */
  {
    const p = await open();
    await p.getByText('English', { exact: true }).first().click();
    ok('dil seçici dili hemen değiştirir', await waitText(p, CATALOGS.en['ob.1.title'] as string));
    await id(p, 'ob-skip').click();
    ok('"Atla" doğrudan karşılamaya götürür', await waitText(p, CATALOGS.en['auth.welcome.title'] as string));
    await p.reload(); await p.waitForTimeout(800);
    ok('seçilen dil yenilemeden sonra korunur', await has(p, CATALOGS.en['auth.welcome.title'] as string));
  }

  /* 3) Karşılama + yasal metin */
  {
    const p = await open({ prefs });
    ok('karşılama: Google/e-posta/giriş/misafir', (await id(p, 'btn-google').count()) === 1 && (await id(p, 'btn-signup').count()) === 1 && (await id(p, 'btn-signin').count()) === 1 && (await id(p, 'btn-guest').count()) === 1);
    ok('karşılama: yasal bildirim görünür', await has(p, T('auth.legalNotice').replace(/[\[\]]/g, '')));
    await audit(p, 'karşılama');
    const termsLabel = (T('auth.legalNotice').match(/\[(.+?)\]/) as RegExpMatchArray)[1];
    await p.getByText(termsLabel, { exact: true }).first().click();
    ok('koşullar metni açılır', await waitText(p, T('legal.terms')) && await waitText(p, '2026-10-20'));
    if (lang !== 'tr' && lang !== 'en') ok('çevirisi olmayan dilde bilgi notu', await has(p, T('legal.noTranslation')));
    await audit(p, 'yasal-metin');
    await id(p, 'legal-close').click();
    ok('yasal metin kapanır', await waitText(p, T('auth.welcome.title')));
  }

  /* 4) Kayıt doğrulamaları + çifte gönderim + e-posta bağlantısı */
  const email = 'orhan.test@example.com';
  {
    const p = await open({ prefs });
    await id(p, 'btn-signup').click();
    await id(p, 'su-submit').click();
    ok('boş gönderim: e-posta hatası', await waitText(p, T('auth.val.emailEmpty')));
    ok('boş gönderim: parola hatası', await has(p, T('auth.val.pwEmpty')));
    ok('boş gönderim: onay hatası', await has(p, T('auth.val.consent')));
    await audit(p, 'kayıt-hatalar');
    await id(p, 'su-email').fill('ali@gmial');
    await id(p, 'su-pw').click();
    ok('geçersiz e-posta', await waitText(p, T('auth.val.emailInvalid')));
    await id(p, 'su-email').fill('ali@gmial.com');
    await id(p, 'su-pw').click();
    ok('yazım hatası önerisi', await waitText(p, T('auth.val.emailSuggest', { email: 'ali@gmail.com' })));
    await p.getByText(T('auth.val.emailSuggest', { email: 'ali@gmail.com' }), { exact: true }).click();
    ok('öneriye dokununca adres düzelir', (await id(p, 'su-email').inputValue()) === 'ali@gmail.com');
    await id(p, 'su-pw').fill('Password123');
    await id(p, 'su-pw2').click();
    ok('yaygın parola reddedilir', await waitText(p, T('auth.val.pwCommon')));
    await id(p, 'su-pw').fill('kısa1');
    await id(p, 'su-pw2').click();
    ok('kısa parola reddedilir', await waitText(p, T('auth.val.pwShort', { n: 8 })));
    await id(p, 'su-pw').fill('密'.repeat(25));
    await id(p, 'su-pw2').click();
    ok('72 bayt aşımı reddedilir', await waitText(p, T('auth.val.pwLong')));
    await id(p, 'su-pw').fill(PW);
    ok('parola gücü göstergesi', await has(p, T('auth.strength', { level: T('auth.strength.2') })) || await has(p, T('auth.strength', { level: T('auth.strength.1') })));
    await id(p, 'su-pw2').fill(PW + 'x');
    await id(p, 'su-submit').click();
    ok('eşleşmeyen parola', await waitText(p, T('auth.val.pwMismatch')));
    await id(p, 'su-pw2').fill(PW);
    await id(p, 'su-submit').click();
    ok('onay işaretlenmeden gönderilmez', (await mock(p, (m) => m.log.filter((x: string) => x === 'signUp').length)) === 0);
    await signUpForm(p, email, PW, PW, true);
    await id(p, 'su-email').fill(email);
    const btn = id(p, 'su-submit');
    // Aynı JS turunda üç ardışık dokunuş: React henüz yeniden çizmediği için düğme hâlâ etkindir; yalnızca `useAction` koruması tek istek bırakır
    await btn.evaluate((el: HTMLElement) => { el.click(); el.click(); el.click(); });
    ok('doğrulama ekranı', await waitId(p, 'vf-resend'));
    ok('doğrulama ekranı başlığı', await has(p, T('auth.verify.title')) && !(await has(p, T('auth.signup.sub'))));
    ok('doğrulama: adres gösterilir', await has(p, email));
    ok('çifte dokunuşta tek kayıt isteği', (await mock(p, (m) => m.log.filter((x: string) => x === 'signUp').length)) === 1);
    ok('tekrar gönder geri sayımla kilitli', await id(p, 'vf-resend').isDisabled());
    await audit(p, 'doğrulama');
    // Doğrulanmadan giriş: reddedilir
    await id(p, 'vf-signin').click();
    await id(p, 'si-email').fill(email); await id(p, 'si-pw').fill(PW); await id(p, 'si-submit').click();
    ok('doğrulanmamış hesap giriş yapamaz', await waitText(p, T('auth.err.email_not_confirmed')));
    // E-posta bağlantısına tıklama (aynı cihaz)
    await p.goto(base + 'auth-callback?code=confirm:' + encodeURIComponent(email));
    await p.waitForTimeout(1500);
    ok('e-posta bağlantısı hesabı açar ve uygulamaya geçer', !(await has(p, T('auth.verify.title'))) && !(await has(p, T('auth.signin.title'))));
    ok('uygulama ekranı görünür (Ayarlar menüsü)', (await p.locator('[aria-label]').count()) > 0 && (await id(p, 'qa-expense').count()) > 0);
  }

  /* 5) Ayarlar: hesap bölümü, çıkış, yanlış/doğru parola */
  {
    const p = await open({ prefs, url: '' });
    // Önceki senaryodan kalan oturum yok (yeni bağlam): hesabı yeniden kur
    await mock(p, (m) => { m.reset(); });
    await p.reload(); await p.waitForTimeout(800);
    await id(p, 'btn-signup').click();
    await signUpForm(p, 'ayse@example.com');
    await id(p, 'su-submit').click();
    await waitId(p, 'vf-resend');
    await mock(p, (m) => m.confirm('ayse@example.com'));
    await id(p, 'vf-signin').click();
    await id(p, 'si-email').fill('ayse@example.com'); await id(p, 'si-pw').fill('yanlis-parola-1'); await id(p, 'si-submit').click();
    ok('yanlış parola hatası', await waitText(p, T('auth.err.invalid_credentials')));
    await audit(p, 'giriş-hata');
    await id(p, 'si-pw').fill(PW); await id(p, 'si-submit').click();
    ok('doğru parola ile giriş', await waitId(p, 'qa-expense'));
    // Ayarlar'a git
    await p.getByLabel(T('menu.open')).click();
    await p.locator('[role="menuitem"]').nth(6).click();
    await p.waitForTimeout(500);
    ok('ayarlar: hesap bölümü e-postayı gösterir', await has(p, T('acct.signedAs', { email: 'ayse@example.com' })));
    ok('ayarlar: yasal bağlantılar', (await id(p, 'legal-privacy').count()) === 1 && (await id(p, 'legal-terms').count()) === 1);
    await id(p, 'legal-privacy').scrollIntoViewIfNeeded();
    await id(p, 'legal-privacy').click();
    ok('ayarlardan gizlilik politikası açılır', await waitText(p, T('legal.privacy')));
    await id(p, 'legal-close').click();
    await audit(p, 'ayarlar-hesap');
    await id(p, 'acct-signout').scrollIntoViewIfNeeded();
    await id(p, 'acct-signout').click();
    ok('çıkış → karşılama', await waitText(p, T('auth.welcome.title')));
    await p.reload(); await p.waitForTimeout(800);
    ok('çıkıştan sonra yenilemede oturum yok', await has(p, T('auth.welcome.title')));
  }

  /* 6) Parola sıfırlama */
  {
    const p = await open({ prefs });
    await mock(p, (m) => m.reset());
    await id(p, 'btn-signup').click();
    await signUpForm(p, 'veli@example.com');
    await id(p, 'su-submit').click();
    await waitId(p, 'vf-resend');
    await mock(p, (m) => m.confirm('veli@example.com'));
    await id(p, 'vf-signin').click();
    await id(p, 'to-forgot').click();
    await id(p, 'fg-submit').click();
    ok('sıfırlama: boş e-posta hatası', await waitText(p, T('auth.val.emailEmpty')));
    await id(p, 'fg-email').fill('kayitsiz@example.com');
    await id(p, 'fg-submit').click();
    ok('sıfırlama: kayıtsız adreste de aynı genel mesaj (hesap sızmaz)', await waitText(p, T('auth.forgot.sent')));
    ok('sıfırlama: tekrar gönderme geri sayımla kilitli', await id(p, 'fg-submit').isDisabled());
    await audit(p, 'sıfırlama');
    await p.goto(base + 'reset-callback?code=recover:' + encodeURIComponent('veli@example.com'));
    ok('sıfırlama bağlantısı → yeni parola ekranı (BOOT ezmez)', await waitText(p, T('auth.recovery.title'), 8000));
    await id(p, 'rc-pw').fill('12345678'); await id(p, 'rc-pw2').fill('12345678'); await id(p, 'rc-submit').click();
    ok('yeni parola: yaygın parola reddedilir', await waitText(p, T('auth.val.pwCommon')));
    await id(p, 'rc-pw').fill(PW); await id(p, 'rc-pw2').fill(PW); await id(p, 'rc-submit').click();
    ok('yeni parola: eskisiyle aynı olamaz', await waitText(p, T('auth.err.same_password')));
    await id(p, 'rc-pw').fill('yeni-Parola-8-xQ'); await id(p, 'rc-pw2').fill('yeni-Parola-8-xQ'); await id(p, 'rc-submit').click();
    ok('yeni parola kaydedilince uygulamaya geçer', await waitId(p, 'qa-expense', 8000));
  }

  /* 7) Hesap silme */
  {
    const p = await open({ prefs });
    await mock(p, (m) => m.reset());
    await id(p, 'btn-signup').click();
    await signUpForm(p, 'sil@example.com');
    await id(p, 'su-submit').click();
    await waitId(p, 'vf-resend');
    await mock(p, (m) => m.confirm('sil@example.com'));
    await id(p, 'vf-signin').click();
    await id(p, 'si-email').fill('sil@example.com'); await id(p, 'si-pw').fill(PW); await id(p, 'si-submit').click();
    await waitId(p, 'qa-expense');
    await p.evaluate(() => localStorage.setItem('harcama-defteri:v1', JSON.stringify({ items: [{ id: 'a', amount: 10, cat: 'Market', note: '', date: '2026-10-01', ts: 1 }], subs: [], settings: {} })));
    await p.getByLabel(T('menu.open')).click();
    await p.locator('[role="menuitem"]').nth(6).click();
    await id(p, 'acct-delete').scrollIntoViewIfNeeded();
    await id(p, 'acct-delete').click();
    ok('silme: uyarı metni', await waitText(p, T('del.body')));
    await audit(p, 'hesap-sil');
    await id(p, 'del-confirm').click();
    ok('silme: parolasız onaylanamaz', await waitText(p, T('auth.val.pwEmpty')));
    await id(p, 'del-pw').fill('yanlis-parola-1');
    await id(p, 'del-confirm').click();
    ok('silme: yanlış parola ile silinmez', await waitText(p, T('auth.err.invalid_credentials')));
    ok('silme: hesap hâlâ var', (await mock(p, (m) => m.log.filter((x: string) => x === 'delete').length)) === 0);
    await id(p, 'del-pw').fill(PW);
    await id(p, 'del-wipe').click();
    await id(p, 'del-confirm').click();
    ok('silme: hesap silinir ve karşılamaya dönülür', await waitText(p, T('auth.welcome.title'), 8000));
    ok('silme: "hesabın silindi" bildirimi', await has(p, T('auth.notice.deleted')));
    ok('silme: cihaz verisi de silindi (seçenek açıkken)', (await p.evaluate(() => localStorage.getItem('harcama-defteri:v1'))) === null);
    await id(p, 'btn-signin').click();
    await id(p, 'si-email').fill('sil@example.com'); await id(p, 'si-pw').fill(PW); await id(p, 'si-submit').click();
    ok('silinen hesapla giriş yapılamaz', await waitText(p, T('auth.err.invalid_credentials')));
  }

  /* 8) Misafir + Ayarlar'dan hesap açma + çevrimdışı */
  {
    const p = await open({ prefs });
    await id(p, 'btn-guest').click();
    ok('misafir: uygulama açılır', await waitId(p, 'qa-expense'));
    await p.reload(); await p.waitForTimeout(1000);
    ok('misafir: yenilemede karşılama çıkmaz', (await id(p, 'qa-expense').count()) > 0);
    await p.getByLabel(T('menu.open')).click();
    await p.locator('[role="menuitem"]').nth(6).click();
    ok('misafir: ayarlarda hesap açma kartı', await waitText(p, T('acct.guestTitle')));
    await id(p, 'acct-open').scrollIntoViewIfNeeded();
    await id(p, 'acct-open').click();
    ok('misafir: hesap ekranı kapatılabilir', await waitText(p, T('auth.welcome.title')) && (await id(p, 'btn-guest').count()) === 0);
    await p.getByLabel(T('auth.close')).click();
    ok('kapatınca uygulamaya dönülür', await waitId(p, 'qa-expense'));
  }
  {
    const p = await open({ prefs });
    await mock(p, (m) => { m.reset(); m.offline = true; });
    await id(p, 'btn-signin').click();
    await id(p, 'si-email').fill('x@example.com'); await id(p, 'si-pw').fill('abc'); await id(p, 'si-submit').click();
    ok('çevrimdışı: ağ hatası + tekrar dene', await waitText(p, T('auth.err.network')) && await has(p, T('auth.retry')));
    await audit(p, 'çevrimdışı-hata');
    await mock(p, (m) => { m.offline = false; });
    await p.getByText(T('auth.retry'), { exact: true }).click();
    ok('bağlantı gelince tekrar dene çalışır (artık ağ hatası değil)', await waitText(p, T('auth.err.invalid_credentials')));
    // hız sınırı
    for (let i = 0; i < 6; i++) { await id(p, 'si-submit').click(); await p.waitForTimeout(350); }
    ok('çok deneme: hız sınırı mesajı', await waitText(p, T('auth.err.rate_limited')));
  }

  /* 8b) Geniş ekran (tablet): içerik sütunu sınırlı kalır, taşma yok */
  {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 }, locale: LOCALE[lang] });
    contexts.push(ctx);
    await ctx.addInitScript((pr) => { (window as unknown as { __ALLOW_AUTH_MOCK__: boolean }).__ALLOW_AUTH_MOCK__ = true; localStorage.setItem('harcama-defteri:auth:v1', JSON.stringify(pr)); }, prefs);
    const p = await ctx.newPage();
    await p.goto(base); await p.waitForTimeout(1200);
    await id(p, 'btn-signup').click();
    const box = await id(p, 'su-email').boundingBox();
    ok('geniş ekran: form alanı okunaklı genişlikte (≤ 520px)', !!box && box.width <= 521 && box.width > 300, box ? String(box.width) : 'yok');
    ok('geniş ekran: form yatayda ortalı', !!box && Math.abs(box.x + box.width / 2 - 512) < 12, box ? String(box.x + box.width / 2) : '');
    await audit(p, 'geniş-ekran');
  }

  /* 9) Eski kullanıcı: tanıtım yok, misafir olarak doğrudan uygulama */
  {
    const p = await open({ data: { items: [{ id: 'z', amount: 5, cat: 'Market', note: '', date: '2026-10-01', ts: 1 }], subs: [], settings: { language: lang, budget: 0 } } });
    ok('eski kullanıcı: tanıtım/karşılama yok, doğrudan uygulama', await waitId(p, 'qa-expense') && !(await has(p, T('ob.1.title'))));
  }

  await browser.close();
  server.close();
  warnings.forEach((w) => console.log('UYARI ' + w));
  console.log(`\n[${lang}] ${pass} geçti, ${errors.length} hata, ${warnings.length} uyarı`);
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
