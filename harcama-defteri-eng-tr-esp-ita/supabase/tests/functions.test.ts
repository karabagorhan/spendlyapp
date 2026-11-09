/**
 * Edge Function iş mantığı testleri: `npx tsx supabase/tests/functions.test.ts`
 * Hesap silme güvenlik kuralları (yeniden kimlik doğrulama penceresi, Apple iptali, hata yolları) ve Apple istemci sırrı (ES256 JWT).
 */
import { appleClientSecret, exchangeCode, revokeToken } from '../functions/_shared/apple.ts';
import { Deps, REAUTH_WINDOW_MS, User, handleAppleLink, handleDeleteAccount } from '../functions/_shared/handlers.ts';

let pass = 0, fail = 0;
const ok = (name: string, cond: unknown, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); } };
const eq = (name: string, got: unknown, want: unknown) => ok(name, JSON.stringify(got) === JSON.stringify(want), `beklenen ${JSON.stringify(want)}, bulunan ${JSON.stringify(got)}`);

const NOW = Date.parse('2026-10-20T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const b64 = (b: ArrayBuffer) => Buffer.from(b).toString('base64');
const b64urlDecode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function makeKey() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const der = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64(der).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: kp.publicKey };
}

type Calls = { deleted: string[]; saved: [string, string][]; revoked: string[]; logs: string[]; order: string[] };
function deps(over: Partial<Deps> & { user?: User | null; token?: string | null; revokeOk?: boolean; exchangeToken?: string | null; saveOk?: boolean; deleteOk?: boolean } = {}, calls?: Calls): Deps {
  const c = calls ?? { deleted: [], saved: [], revoked: [], logs: [], order: [] };
  const user = 'user' in over ? over.user : { id: 'u1', last_sign_in_at: ago(60_000), app_metadata: { provider: 'email' } };
  return {
    now: () => NOW,
    getUser: async (jwt) => { if (jwt === 'boom') throw new Error('x'); return jwt === 'good' ? user ?? null : null; },
    deleteUser: async (id) => { c.order.push('delete'); c.deleted.push(id); return over.deleteOk !== false; },
    getAppleToken: async () => ('token' in over ? over.token ?? null : 'refresh-1'),
    saveAppleToken: async (id, t) => { c.saved.push([id, t]); return over.saveOk !== false; },
    apple: 'apple' in over ? over.apple! : { teamId: 'TEAM', keyId: 'KEY', clientId: 'com.example.app', privateKey: (globalThis as any).__PEM },
    fetcher: async (url, init) => {
      if (url.endsWith('/auth/revoke')) { c.order.push('revoke'); c.revoked.push(init.body); return { ok: over.revokeOk !== false, status: over.revokeOk === false ? 400 : 200, json: async () => ({}) }; }
      return { ok: over.exchangeToken !== null, status: 200, json: async () => ({ refresh_token: over.exchangeToken ?? 'new-refresh' }) };
    },
    log: (m) => c.logs.push(m),
  };
}
const newCalls = (): Calls => ({ deleted: [], saved: [], revoked: [], logs: [], order: [] });

(async () => {
  const { pem, publicKey } = await makeKey();
  (globalThis as any).__PEM = pem;

  /* ---------- Apple istemci sırrı ---------- */
  const secret = await appleClientSecret({ teamId: 'TEAM', keyId: 'KEY', clientId: 'com.example.app', privateKey: pem }, 1_800_000_000);
  const [h, c, s] = secret.split('.');
  const head = JSON.parse(b64urlDecode(h).toString()), claims = JSON.parse(b64urlDecode(c).toString());
  eq('JWT başlığı', head, { alg: 'ES256', kid: 'KEY', typ: 'JWT' });
  eq('JWT iddiaları', claims, { iss: 'TEAM', iat: 1_800_000_000, exp: 1_800_000_300, aud: 'https://appleid.apple.com', sub: 'com.example.app' });
  ok('JWT imzası doğrulanır (ham r||s, 64 bayt)', b64urlDecode(s).length === 64 && await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}`)));
  ok('JWT imzası başka veriyle doğrulanmaz', !(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}x`))));
  const escaped = await appleClientSecret({ teamId: 'T', keyId: 'K', clientId: 'c', privateKey: pem.replace(/\n/g, '\\n') });
  ok('ortam değişkenindeki "\\n" metinli anahtar kabul edilir', escaped.split('.').length === 3);
  let bad = false; try { await appleClientSecret({ teamId: 'T', keyId: 'K', clientId: 'c', privateKey: 'geçersiz' }); } catch { bad = true; }
  ok('geçersiz anahtar hata verir', bad);

  const seen: { url: string; body: string }[] = [];
  const f = async (url: string, init: { body: string }) => { seen.push({ url, body: init.body }); return { ok: true, status: 200, json: async () => ({ refresh_token: 'rt' }) }; };
  eq('exchangeCode yenileme belirtecini döner', await exchangeCode({ teamId: 'T', keyId: 'K', clientId: 'cid', privateKey: pem }, 'CODE', f as any), 'rt');
  ok('exchangeCode: doğru uç ve alanlar', seen[0].url === 'https://appleid.apple.com/auth/token' && /grant_type=authorization_code/.test(seen[0].body) && /code=CODE/.test(seen[0].body) && /client_id=cid/.test(seen[0].body) && /client_secret=eyJ/.test(seen[0].body));
  ok('revokeToken: doğru uç ve alanlar', (await revokeToken({ teamId: 'T', keyId: 'K', clientId: 'cid', privateKey: pem }, 'RT', f as any)) && seen[1].url === 'https://appleid.apple.com/auth/revoke' && /token=RT/.test(seen[1].body) && /token_type_hint=refresh_token/.test(seen[1].body));
  eq('exchangeCode hata yanıtında null', await exchangeCode({ teamId: 'T', keyId: 'K', clientId: 'c', privateKey: pem }, 'X', (async () => ({ ok: false, status: 400, json: async () => ({}) })) as any), null);

  /* ---------- delete-account ---------- */
  eq('yanlış yöntem → 405', (await handleDeleteAccount('GET', 'Bearer good', deps())).status, 405);
  eq('Authorization yok → 401', (await handleDeleteAccount('POST', null, deps())).status, 401);
  eq('Bearer biçimi bozuk → 401', (await handleDeleteAccount('POST', 'good', deps())).status, 401);
  eq('geçersiz belirteç → 401', (await handleDeleteAccount('POST', 'Bearer nope', deps())).status, 401);
  eq('getUser hata fırlatırsa → 401', (await handleDeleteAccount('POST', 'Bearer boom', deps())).status, 401);

  let k = newCalls();
  let r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u1', last_sign_in_at: ago(REAUTH_WINDOW_MS + 1000) } }, k));
  eq('eski oturum (pencere dışı) → 403 reauth_required', [r.status, r.body.code], [403, 'reauth_required']);
  eq('403 durumunda kullanıcı SİLİNMEZ', k.deleted, []);
  k = newCalls();
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u1', last_sign_in_at: null } }, k));
  eq('son giriş zamanı yok → 403', [r.status, k.deleted.length], [403, 0]);
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u1', last_sign_in_at: 'bozuk' } }, k));
  eq('son giriş zamanı bozuk → 403', [r.status, k.deleted.length], [403, 0]);
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u1', last_sign_in_at: new Date(NOW + 3_600_000).toISOString() } }, k));
  eq('gelecekteki zaman (saat sahteciliği) → 403', [r.status, k.deleted.length], [403, 0]);

  k = newCalls();
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u1', last_sign_in_at: ago(REAUTH_WINDOW_MS - 1000), app_metadata: { provider: 'email' } } }, k));
  eq('pencere içinde e-posta hesabı → 200', [r.status, r.body], [200, { deleted: true }]);
  eq('yalnızca JWT sahibi silinir', k.deleted, ['u1']);
  eq('e-posta hesabında Apple\'a dokunulmaz', k.revoked, []);

  k = newCalls();
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u2', last_sign_in_at: ago(1000), app_metadata: { provider: 'apple' } } }, k));
  eq('Apple hesabı: 200 + iptal edildi', [r.status, r.body], [200, { deleted: true, appleRevoked: true }]);
  eq('Apple iptali kullanıcı silinmeden ÖNCE', k.order, ['revoke', 'delete']);
  ok('iptal isteği yenileme belirtecini taşır', /token=refresh-1/.test(k.revoked[0]));

  k = newCalls();
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u2', last_sign_in_at: ago(1000), app_metadata: { provider: 'apple' } }, revokeOk: false }, k));
  eq('Apple iptali reddedilse de hesap silinir ve bildirilir', [r.status, r.body, k.deleted], [200, { deleted: true, appleRevoked: false }, ['u2']]);
  k = newCalls();
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u2', last_sign_in_at: ago(1000), app_metadata: { provider: 'apple' } }, token: null }, k));
  eq('kayıtlı Apple belirteci yoksa hesap yine silinir (appleRevoked:false)', [r.status, r.body.appleRevoked, k.deleted], [200, false, ['u2']]);
  ok('belirteç yok durumu kaydedilir', k.logs.some((l) => /no stored token/.test(l)));
  k = newCalls();
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ user: { id: 'u2', last_sign_in_at: ago(1000), app_metadata: { provider: 'apple' } }, apple: null }, k));
  eq('Apple yapılandırması yoksa hesap yine silinir', [r.status, r.body.appleRevoked, k.deleted], [200, false, ['u2']]);
  k = newCalls();
  const throwing = deps({ user: { id: 'u2', last_sign_in_at: ago(1000), app_metadata: { provider: 'apple' } } }, k);
  throwing.getAppleToken = async () => { throw new Error('db down'); };
  r = await handleDeleteAccount('POST', 'Bearer good', throwing);
  eq('Apple tarafı hata fırlatsa da hesap silinir', [r.status, k.deleted], [200, ['u2']]);
  k = newCalls();
  r = await handleDeleteAccount('POST', 'Bearer good', deps({ deleteOk: false }, k));
  eq('silme başarısızsa 500 (başarı bildirilmez)', [r.status, r.body.deleted], [500, undefined]);

  /* ---------- apple-link ---------- */
  const apple = { id: 'u3', last_sign_in_at: ago(1000), app_metadata: { provider: 'apple' } };
  eq('apple-link yanlış yöntem → 405', (await handleAppleLink('GET', 'Bearer good', '{}', deps())).status, 405);
  eq('apple-link yetkisiz → 401', (await handleAppleLink('POST', null, '{}', deps())).status, 401);
  eq('apple-link e-posta kullanıcısı → 400', (await handleAppleLink('POST', 'Bearer good', '{"authorizationCode":"c"}', deps())).status, 400);
  eq('apple-link yapılandırma yok → 503', (await handleAppleLink('POST', 'Bearer good', '{"authorizationCode":"c"}', deps({ user: apple, apple: null }))).status, 503);
  eq('apple-link bozuk gövde → 400', (await handleAppleLink('POST', 'Bearer good', 'xx', deps({ user: apple }))).status, 400);
  eq('apple-link kod yok → 400', (await handleAppleLink('POST', 'Bearer good', '{}', deps({ user: apple }))).status, 400);
  eq('apple-link aşırı uzun kod → 400', (await handleAppleLink('POST', 'Bearer good', JSON.stringify({ authorizationCode: 'a'.repeat(3000) }), deps({ user: apple }))).status, 400);
  eq('apple-link değişim başarısız → 502', (await handleAppleLink('POST', 'Bearer good', '{"authorizationCode":"c"}', deps({ user: apple, exchangeToken: null }))).status, 502);
  k = newCalls();
  r = await handleAppleLink('POST', 'Bearer good', '{"authorizationCode":"c"}', deps({ user: apple, exchangeToken: 'RT9' }, k));
  eq('apple-link başarı: belirteç JWT sahibine kaydedilir', [r.status, k.saved], [200, [['u3', 'RT9']]]);
  eq('apple-link kayıt başarısız → 500', (await handleAppleLink('POST', 'Bearer good', '{"authorizationCode":"c"}', deps({ user: apple, saveOk: false }))).status, 500);

  console.log(`${pass} geçti, ${fail} başarısız`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
