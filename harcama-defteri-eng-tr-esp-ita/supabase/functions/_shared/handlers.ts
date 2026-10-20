/**
 * Edge Function iş mantığı. Deno'ya özgü hiçbir şey kullanmaz; bağımlılıklar (`deps`) dışarıdan verilir,
 * bu yüzden hesap silmenin güvenlik kuralları Node altında sahte bağımlılıklarla test edilir.
 */
import { AppleConfig, exchangeCode, revokeToken } from './apple.ts';

export type User = { id: string; last_sign_in_at?: string | null; app_metadata?: { provider?: string } };
export type Deps = {
  now: () => number;
  getUser(jwt: string): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;
  getAppleToken(userId: string): Promise<string | null>;
  saveAppleToken(userId: string, token: string): Promise<boolean>;
  apple: AppleConfig | null;
  fetcher?: Parameters<typeof exchangeCode>[2];
  log(msg: string): void;
};
export type Res = { status: number; body: Record<string, unknown> };

/** Hesap silme için son girişin en fazla bu kadar yakın olması gerekir (yeniden kimlik doğrulama). */
export const REAUTH_WINDOW_MS = 10 * 60_000;

const bearer = (h: string | null | undefined) => (h ?? '').match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

export async function handleDeleteAccount(method: string, authorization: string | null, d: Deps): Promise<Res> {
  if (method !== 'POST') return { status: 405, body: { code: 'method_not_allowed' } };
  const jwt = bearer(authorization);
  if (!jwt) return { status: 401, body: { code: 'no_authorization' } };
  const user = await d.getUser(jwt).catch(() => null);
  if (!user) return { status: 401, body: { code: 'invalid_token' } };

  const last = Date.parse(user.last_sign_in_at ?? '');
  // Geçersiz/eksik zaman ya da pencere dışı → reddet (çalınmış eski oturum hesabı silemesin)
  if (!Number.isFinite(last) || d.now() - last > REAUTH_WINDOW_MS || last - d.now() > 60_000) return { status: 403, body: { code: 'reauth_required' } };

  // Apple erişim izni: silmeden ÖNCE iptal edilir. Başarısız olsa da silme sürer (silinme hakkı üçüncü tarafa bağlı olamaz); sonuç bildirilir
  let appleRevoked: boolean | null = null;
  if (user.app_metadata?.provider === 'apple') {
    appleRevoked = false;
    try {
      const token = await d.getAppleToken(user.id);
      if (token && d.apple) appleRevoked = await revokeToken(d.apple, token, d.fetcher);
      else d.log(`apple revoke skipped: ${token ? 'no apple config' : 'no stored token'}`);
    } catch (e) {
      d.log(`apple revoke failed: ${(e as Error).message}`);
    }
  }

  // Kullanıcı silinince profile ve diğer tüm kullanıcı tabloları `on delete cascade` ile gider
  if (!(await d.deleteUser(user.id))) return { status: 500, body: { code: 'delete_failed' } };
  return { status: 200, body: { deleted: true, ...(appleRevoked === null ? {} : { appleRevoked }) } };
}

export async function handleAppleLink(method: string, authorization: string | null, rawBody: string, d: Deps): Promise<Res> {
  if (method !== 'POST') return { status: 405, body: { code: 'method_not_allowed' } };
  const jwt = bearer(authorization);
  if (!jwt) return { status: 401, body: { code: 'no_authorization' } };
  const user = await d.getUser(jwt).catch(() => null);
  if (!user) return { status: 401, body: { code: 'invalid_token' } };
  if (user.app_metadata?.provider !== 'apple') return { status: 400, body: { code: 'not_apple_user' } };
  if (!d.apple) return { status: 503, body: { code: 'apple_not_configured' } };
  let code = '';
  try { code = String(JSON.parse(rawBody)?.authorizationCode ?? ''); } catch { /* geçersiz gövde aşağıda reddedilir */ }
  if (!code || code.length > 2048) return { status: 400, body: { code: 'bad_request' } };
  const token = await exchangeCode(d.apple, code, d.fetcher).catch(() => null);
  if (!token) return { status: 502, body: { code: 'apple_exchange_failed' } };
  if (!(await d.saveAppleToken(user.id, token))) return { status: 500, body: { code: 'save_failed' } };
  return { status: 200, body: { linked: true } };
}
