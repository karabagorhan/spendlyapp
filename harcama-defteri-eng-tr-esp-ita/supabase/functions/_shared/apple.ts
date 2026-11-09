/**
 * Sign in with Apple sunucu tarafı: istemci sırrı (ES256 JWT), yetkilendirme kodunu yenileme belirtecine çevirme ve iptal.
 * Deno'ya özgü hiçbir şey kullanmaz (WebCrypto + fetch), bu yüzden Node altında da test edilir.
 * Kaynak: Apple "Generate and validate tokens" / "Revoke tokens" REST API'leri.
 */
export type AppleConfig = { teamId: string; keyId: string; clientId: string; privateKey: string };

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const pemToDer = (pem: string) => {
  const body = pem.replace(/-----BEGIN [A-Z ]+-----/g, '').replace(/-----END [A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Apple en çok 6 ay geçerli istemci sırrı kabul eder; kısa tutulur (5 dk). */
export async function appleClientSecret(cfg: AppleConfig, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  // Ortam değişkenlerinde satır sonları çoğu zaman "\n" metni olarak gelir
  const pem = cfg.privateKey.includes('\\n') ? cfg.privateKey.replace(/\\n/g, '\n') : cfg.privateKey;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId, typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: nowSec, exp: nowSec + 300, aud: 'https://appleid.apple.com', sub: cfg.clientId }));
  // WebCrypto ECDSA imzası zaten JWT'nin istediği ham r||s biçimindedir
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${claims}`));
  return `${head}.${claims}.${b64url(sig)}`;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
const HEAD = { 'content-type': 'application/x-www-form-urlencoded' };

/** Yetkilendirme kodunu (tek kullanımlık, kısa ömürlü) yenileme belirtecine çevirir. */
export async function exchangeCode(cfg: AppleConfig, code: string, fetcher: Fetch = fetch as unknown as Fetch): Promise<string | null> {
  const secret = await appleClientSecret(cfg);
  const r = await fetcher('https://appleid.apple.com/auth/token', { method: 'POST', headers: HEAD, body: form({ client_id: cfg.clientId, client_secret: secret, code, grant_type: 'authorization_code' }) });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return typeof j?.refresh_token === 'string' ? j.refresh_token : null;
}

/** Kullanıcının Apple erişim iznini iptal eder (hesap silme zorunluluğu). */
export async function revokeToken(cfg: AppleConfig, refreshToken: string, fetcher: Fetch = fetch as unknown as Fetch): Promise<boolean> {
  const secret = await appleClientSecret(cfg);
  const r = await fetcher('https://appleid.apple.com/auth/revoke', { method: 'POST', headers: HEAD, body: form({ client_id: cfg.clientId, client_secret: secret, token: refreshToken, token_type_hint: 'refresh_token' }) });
  return r.ok;
}
