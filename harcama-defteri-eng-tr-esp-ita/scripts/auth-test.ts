/**
 * Hesap katmanı testleri: `npx tsx scripts/auth-test.ts`
 * Doğrulama kuralları, açılış akışı durum makinesi ve tercih okuma. Ağ ve cihaz gerektirmez.
 */
import { State, Action, initial, reduce } from '../src/auth/flow';
import { parsePrefs } from '../src/auth/prefs';
import { AuthUser } from '../src/auth/types';
import { MAX_PASSWORD_BYTES, byteLength, normalizeEmail, passwordStrength, suggestEmail, validateEmail, validateName, validatePassword } from '../src/auth/validation';

let fail = 0, pass = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name}: beklenen ${JSON.stringify(want)}, bulunan ${JSON.stringify(got)}`); }
};

/* ---------- E-posta ---------- */
for (const ok of ['ali@example.com', 'ali.veli+harcama@sub.example.co.uk', 'a@b.io', 'ÇAĞLA@Örnek.com.tr', '  Ali@Example.COM  ', "o'brien@example.com", 'x_y-z@my-site.org'])
  eq(`geçerli e-posta: ${ok}`, validateEmail(ok), null);
const bad: [string, string][] = [
  ['', 'empty'], ['   ', 'empty'], ['ali', 'invalid'], ['ali@', 'invalid'], ['@example.com', 'invalid'], ['ali@example', 'invalid'],
  ['ali@@example.com', 'invalid'], ['ali@exa mple.com', 'invalid'], ['ali..veli@example.com', 'invalid'], ['.ali@example.com', 'invalid'],
  ['ali.@example.com', 'invalid'], ['ali@-example.com', 'invalid'], ['ali@example-.com', 'invalid'], ['ali@example.c', 'invalid'], ['ali@example.123', 'invalid'],
  ['ali@.com', 'invalid'], ['ali@example..com', 'invalid'], ['a'.repeat(65) + '@example.com', 'invalid'], ['a@' + 'b'.repeat(250) + '.com', 'invalid'],
];
for (const [v, want] of bad) eq(`geçersiz e-posta: ${v.slice(0, 30)}`, validateEmail(v), want);
eq('normalizeEmail', normalizeEmail('  Ali@Example.COM '), 'ali@example.com');
eq('öneri gmial', suggestEmail('ali@gmial.com'), 'ali@gmail.com');
eq('öneri hotmial', suggestEmail('ali@hotmial.com'), 'ali@hotmail.com');
eq('öneri yok (doğru alan adı)', suggestEmail('ali@gmail.com'), null);
eq('öneri yok (alakasız alan adı)', suggestEmail('ali@sirket.com.tr'), null);
eq('öneri yok (geçersiz adres)', suggestEmail('ali@gmial'), null);

/* ---------- Parola ---------- */
eq('kısa', validatePassword('Ab1!xyz'), 'short');
eq('8 karakter yeterli', validatePassword('k7#Rw2pQ'), null);
eq('yaygın: password', validatePassword('password'), 'common');
eq('yaygın: Password123', validatePassword('Password123'), 'common');
eq('yaygın: 12345678', validatePassword('12345678'), 'common');
eq('yaygın: qwertyuiop', validatePassword('qwertyuiop'), 'common');
eq('yaygın: tek karakter', validatePassword('aaaaaaaaaa'), 'common');
eq('yaygın: Galatasaray', validatePassword('Galatasaray'), 'common');
eq('yaygın: sifre1234', validatePassword('Sifre1234'), 'common');
eq('e-postayı içeriyor', validatePassword('orhankarabag99', 'orhankarabag@example.com'), 'email');
eq('kısa yerel kısım yok sayılır', validatePassword('xk3#abcd9Z', 'ab@example.com'), null);
eq('72 bayt sınırı (ASCII)', validatePassword('aB3$'.repeat(18) + 'x'), 'long');
eq('72 bayt tam sınır geçerli', validatePassword('aB3$' + 'kQ7!'.repeat(17)), null);
eq('bayt sayımı: Çince 25 karakter = 75 bayt', validatePassword('密'.repeat(25)), 'long');
eq('bayt sayımı: Türkçe harfler', byteLength('çğş'), 6);
eq('72 bayt sabiti', MAX_PASSWORD_BYTES, 72);
eq('Türkçe/emoji parola geçerli', validatePassword('Çağrı-şifre-🔑-27'), null);
eq('güç: yaygın = 0', passwordStrength('password123'), 0);
eq('güç: 8 karakter = 1', passwordStrength('k7#Rw2pQ'), 1);
eq('güç: 12+ karakter = 2', passwordStrength('k7#Rw2pQmZ4x'), 2);
eq('güç: 16 karakter çeşitli = 3', passwordStrength('k7#Rw2pQmZ4x!vB9'), 3);
eq('güç: uzun ama tekdüze ≤ 2', passwordStrength('abababababababab') <= 2, true);

eq('ad: boş serbest', validateName(''), true);
eq('ad: 41 karakter', validateName('x'.repeat(41)), false);
eq('ad: etiket karakteri', validateName('<b>Ali</b>'), false);

/* ---------- Açılış akışı ---------- */
const user = (o: Partial<AuthUser> = {}): AuthUser => ({ id: 'u1', email: 'a@b.co', emailConfirmed: true, provider: 'email', name: null, lastSignInAt: 1, ...o });
const run = (s: State, ...as: Action[]) => as.reduce(reduce, s);
const boot = (o: Partial<Extract<Action, { type: 'BOOT' }>> = {}): Action => ({ type: 'BOOT', onboarded: false, guest: false, user: null, configured: true, ...o });
const name = (s: State) => s.phase.name;

eq('ilk açılış → tanıtım', run(initial, boot()).phase, { name: 'onboarding' });
eq('tanıtım görüldü, hesap yok → giriş', run(initial, boot({ onboarded: true })).phase, { name: 'auth', mode: 'welcome', closable: false });
eq('misafir → uygulama', name(run(initial, boot({ onboarded: true, guest: true }))), 'app');
eq('oturum var → uygulama', name(run(initial, boot({ onboarded: true, user: user() }))), 'app');
eq('oturum var, tanıtım görülmemiş → yine uygulama', name(run(initial, boot({ user: user() }))), 'app');
eq('doğrulanmamış e-posta hesabı → doğrulama', run(initial, boot({ onboarded: true, user: user({ emailConfirmed: false }) })).phase, { name: 'verify', email: 'a@b.co' });
eq('doğrulanmamış ama Apple → uygulama', name(run(initial, boot({ onboarded: true, user: user({ emailConfirmed: false, provider: 'apple' }) }))), 'app');
eq('yapılandırılmamış: tanıtımdan sonra uygulama', name(run(initial, boot({ configured: false }), { type: 'OB_DONE' })), 'app');
eq('yapılandırılmamış: tanıtım görülmüşse doğrudan uygulama', name(run(initial, boot({ onboarded: true, configured: false }))), 'app');
eq('yapılandırılmış: tanıtım bitince giriş', name(run(initial, boot(), { type: 'OB_DONE' })), 'auth');

eq('uygulamadayken tanıtım bitirme olayı yok sayılır', name(run(run(initial, boot({ onboarded: true, guest: true })), { type: 'OB_DONE' })), 'app');

const welcome = run(initial, boot({ onboarded: true }));
const guestApp0 = () => run(initial, boot({ onboarded: true, guest: true }));
eq('GO signup', run(welcome, { type: 'GO', mode: 'signup' }).phase, { name: 'auth', mode: 'signup', closable: false });
eq('misafir devam', run(welcome, { type: 'GUEST' }).guest, true);
eq('kapatılamaz giriş ekranı CLOSE_AUTH yok sayar', name(run(welcome, { type: 'CLOSE_AUTH' })), 'auth');
eq('giriş yapınca uygulama', name(run(welcome, { type: 'SIGNED_IN', user: user() })), 'app');
eq('kayıt sonrası doğrulama', run(welcome, { type: 'VERIFY', email: 'a@b.co' }).phase, { name: 'verify', email: 'a@b.co' });
eq('doğrulama ekranından yanlış adres → kayıt', run(welcome, { type: 'VERIFY', email: 'x@y.co' }, { type: 'TO_AUTH', mode: 'signup' }).phase, { name: 'auth', mode: 'signup', closable: false });
eq('TO_AUTH yalnızca doğrulama/sıfırlamada', name(run(guestApp0(), { type: 'TO_AUTH', mode: 'signin' })), 'app');
eq('doğrulama bağlantısı → uygulama', name(run(welcome, { type: 'VERIFY', email: 'a@b.co' }, { type: 'SIGNED_IN', user: user() })), 'app');

// Ayarlar'dan hesap açma: misafir kapatıp uygulamaya dönebilir
const guestApp = run(initial, boot({ onboarded: true, guest: true }));
const opened = run(guestApp, { type: 'OPEN_AUTH' });
eq('misafir hesap aç → kapatılabilir giriş', opened.phase, { name: 'auth', mode: 'welcome', closable: true });
eq('kapat → uygulama', name(run(opened, { type: 'CLOSE_AUTH' })), 'app');
eq('oturumlu kullanıcıda OPEN_AUTH yok sayılır', name(run(run(initial, boot({ onboarded: true, user: user() })), { type: 'OPEN_AUTH' })), 'app');
const unconfigured = run(initial, boot({ onboarded: true, configured: false }));
eq('yapılandırılmamışken OPEN_AUTH yok sayılır', name(run(unconfigured, { type: 'OPEN_AUTH' })), 'app');

// Şifre sıfırlama
const rec = run(welcome, { type: 'RECOVERY' });
eq('sıfırlama bağlantısı → yeni şifre', name(rec), 'recovery');
eq('sıfırlama sırasında oturum olayı uygulamaya atmaz', name(run(rec, { type: 'EXTERNAL', user: user() })), 'recovery');
eq('sıfırlama sırasında oturum null olayı sıfırlamayı bozmaz', name(run(rec, { type: 'EXTERNAL', user: null })), 'recovery');
eq('yeni şifre kaydedilince uygulama', name(run(rec, { type: 'SIGNED_IN', user: user() })), 'app');
eq('RECOVERY_DONE yalnızca sıfırlamada', name(run(guestApp, { type: 'RECOVERY_DONE' })), 'app');

// Oturum dışarıdan sona erdi
const inApp = run(initial, boot({ onboarded: true, user: user() }));
eq('oturum sona erdi → giriş ekranı', run(inApp, { type: 'EXTERNAL', user: null }).phase, { name: 'auth', mode: 'welcome', closable: false });
eq('oturum sona erdi: kullanıcı temizlenir', run(inApp, { type: 'EXTERNAL', user: null }).user, null);
eq('misafirde EXTERNAL null yok sayılır', name(run(guestApp, { type: 'EXTERNAL', user: null })), 'app');
eq('token yenilenince kullanıcı güncellenir', run(inApp, { type: 'EXTERNAL', user: user({ name: 'Yeni' }) }).user?.name, 'Yeni');
eq('çıkış → giriş ekranı', name(run(inApp, { type: 'SIGNED_OUT' })), 'auth');
eq('çıkış: misafir bayrağı sıfırlanır', run(inApp, { type: 'SIGNED_OUT' }).guest, false);
eq('yapılandırılmamışken çıkış uygulamada kalır', name(run(unconfigured, { type: 'SIGNED_OUT' })), 'app');

/* ---------- Tercih kaydı ---------- */
eq('prefs: boş', parsePrefs(null), null);
eq('prefs: bozuk JSON', parsePrefs('{x'), null);
eq('prefs: eksik alanlar güvenli', parsePrefs('{}'), { onboarded: false, guest: false, lang: null, consent: null });
eq('prefs: doğru', parsePrefs('{"onboarded":true,"guest":true,"consent":{"version":"v1","at":5}}'), { onboarded: true, guest: true, lang: null, consent: { version: 'v1', at: 5 } });
eq('prefs: bozuk onay yok sayılır', parsePrefs('{"onboarded":true,"consent":{"version":3}}')?.consent, null);
eq('prefs: geçerli dil okunur', parsePrefs('{"lang":"zh"}')?.lang, 'zh');
eq('prefs: geçersiz dil null olur', parsePrefs('{"lang":"xx"}')?.lang, null);
eq('prefs: dil sayı ise null', parsePrefs('{"lang":5}')?.lang, null);
eq('prefs: string "true" kabul edilmez', parsePrefs('{"onboarded":"true"}')?.onboarded, false);

console.log(`${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
