import { SupabaseClient, User, createClient, isAuthApiError, isAuthRetryableFetchError, isAuthWeakPasswordError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { secureStorage } from './secureStorage';
import { AuthErrorCode, AuthFailure, AuthService, AuthUser, LinkResult, Provider, SignUpMeta } from './types';
import { normalizeEmail } from './validation';

WebBrowser.maybeCompleteAuthSession();

/** Supabase panelinde "Redirect URLs" listesine eklenmesi gereken adresler (docs/ARCHITECTURE.md). */
export const CALLBACK_PATH = 'auth-callback';
export const RESET_PATH = 'reset-callback';

export function toUser(u: User): AuthUser {
  const p = u.app_metadata?.provider;
  const provider: Provider = p === 'apple' || p === 'google' ? p : 'email';
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.full_name === 'string' && meta.full_name.trim() ? meta.full_name.trim() : typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : null;
  return {
    id: u.id,
    email: u.email ?? null,
    emailConfirmed: !!u.email_confirmed_at,
    provider,
    name,
    lastSignInAt: u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : Date.now(),
  };
}

/** Sunucu hatasını ekranda gösterilecek koda çevirir. Ham sunucu metni kullanıcıya hiç gösterilmez. */
export function mapError(e: unknown): AuthFailure {
  if (e instanceof AuthFailure) return e;
  if (isAuthRetryableFetchError(e) || (e instanceof TypeError && /network|fetch|failed/i.test(e.message))) return new AuthFailure('network');
  if (isAuthWeakPasswordError(e)) return new AuthFailure('weak_password');
  const code = (e as { code?: string })?.code;
  const status = (e as { status?: number })?.status;
  const by: Record<string, AuthErrorCode> = {
    invalid_credentials: 'invalid_credentials',
    email_not_confirmed: 'email_not_confirmed',
    weak_password: 'weak_password',
    same_password: 'same_password',
    over_request_rate_limit: 'rate_limited',
    over_email_send_rate_limit: 'rate_limited',
    flow_state_not_found: 'link_invalid',
    flow_state_expired: 'link_invalid',
    bad_code_verifier: 'link_invalid',
    bad_oauth_callback: 'link_invalid',
    bad_oauth_state: 'link_invalid',
    otp_expired: 'link_invalid',
    reauthentication_needed: 'reauth_required',
    reauthentication_not_valid: 'reauth_required',
    provider_disabled: 'unavailable',
    oauth_provider_not_supported: 'unavailable',
    email_provider_disabled: 'unavailable',
    signup_disabled: 'unavailable',
  };
  if (code && by[code]) return new AuthFailure(by[code]);
  if (status === 429) return new AuthFailure('rate_limited');
  if (isAuthApiError(e) && status && status >= 500) return new AuthFailure('unavailable');
  return new AuthFailure('unknown');
}

function randomNonce(): string {
  return Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createSupabaseService(): AuthService {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return unconfiguredService;
  const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: secureStorage, storageKey: 'harcama-defteri-auth', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
  });
  // Uygulama arka plandayken belirteç yenileme zamanlayıcısı durur, öne gelince sürer
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (s) => (s === 'active' ? sb.auth.startAutoRefresh() : sb.auth.stopAutoRefresh()));
    sb.auth.startAutoRefresh();
  }
  const redirect = (path: string) => Linking.createURL(path);
  const consentData = (m: SignUpMeta) => ({ consent_version: m.consentVersion, consent_at: new Date().toISOString(), lang: m.lang, ...(m.name ? { full_name: m.name } : {}) });

  /** Kimlik doğrulama bağlantısındaki `code` değerini oturuma çevirir (PKCE). */
  async function handleLink(url: string): Promise<LinkResult> {
    const isReset = url.includes(RESET_PATH);
    if (!isReset && !url.includes(CALLBACK_PATH)) return { kind: 'ignored' };
    const q = url.includes('?') ? new URLSearchParams(url.split('#')[0].split('?')[1]) : new URLSearchParams();
    const code = q.get('code');
    if (q.get('error') || q.get('error_code') || !code) throw new AuthFailure('link_invalid');
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (error || !data.user) throw mapError(error ?? new AuthFailure('link_invalid'));
    return isReset ? { kind: 'recovery' } : { kind: 'signed-in', user: toUser(data.user) };
  }

  async function social(provider: 'google', meta: SignUpMeta): Promise<AuthUser> {
    if (Platform.OS === 'web') throw new AuthFailure('unavailable');
    const to = redirect(CALLBACK_PATH);
    const { data, error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: to, skipBrowserRedirect: true } });
    if (error || !data.url) throw mapError(error);
    const res = await WebBrowser.openAuthSessionAsync(data.url, to);
    if (res.type !== 'success') throw new AuthFailure('cancelled');
    const r = await handleLink(res.url);
    if (r.kind !== 'signed-in') throw new AuthFailure('link_invalid');
    await sb.auth.updateUser({ data: consentData(meta) }).catch(() => {});
    return r.user;
  }

  return {
    configured: true,
    async getUser() {
      const { data } = await sb.auth.getSession();
      return data.session?.user ? toUser(data.session.user) : null;
    },
    subscribe(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') cb(null);
        else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_IN') cb(session?.user ? toUser(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password, meta) {
      const e = normalizeEmail(email);
      const { data, error } = await sb.auth.signUp({ email: e, password, options: { emailRedirectTo: redirect(CALLBACK_PATH), data: consentData(meta) } });
      // Kayıtlı adres hata ile açığa çıkmaz: her durumda "doğrulama e-postası gönderildi" gösterilir
      if (error && (error as { code?: string }).code !== 'user_already_exists' && (error as { code?: string }).code !== 'email_exists') throw mapError(error);
      if (data?.session && data.user) return { status: 'signed-in', user: toUser(data.user) };
      return { status: 'verify', email: e };
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error || !data.user) throw mapError(error);
      return toUser(data.user);
    },
    async appleAvailable() {
      return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
    },
    async signInWithApple(meta) {
      if (Platform.OS !== 'ios') throw new AuthFailure('unavailable');
      // Apple'a nonce'un SHA-256'sı verilir, Supabase'e ham nonce: belirteç yeniden oynatma saldırısına karşı bağlanır
      const raw = randomNonce();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
      let cred: AppleAuthentication.AppleAuthenticationCredential;
      try {
        cred = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashed,
        });
      } catch (e) {
        if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') throw new AuthFailure('cancelled');
        throw new AuthFailure('unavailable');
      }
      if (!cred.identityToken) throw new AuthFailure('unknown');
      const { data, error } = await sb.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: raw });
      if (error || !data.user) throw mapError(error);
      // Apple adı yalnızca ilk girişte verir
      const given = cred.fullName?.givenName?.trim();
      const full = given ? [given, cred.fullName?.familyName?.trim()].filter(Boolean).join(' ') : undefined;
      await sb.auth.updateUser({ data: consentData({ ...meta, name: full }) }).catch(() => {});
      // Hesap silinirken Apple belirtecini iptal edebilmek için yetkilendirme kodu sunucuda yenileme belirtecine çevrilir
      if (cred.authorizationCode) await sb.functions.invoke('apple-link', { body: { authorizationCode: cred.authorizationCode } }).catch(() => {});
      return toUser((await sb.auth.getUser()).data.user ?? data.user);
    },
    signInWithGoogle: (meta) => social('google', meta),
    async resendVerification(email) {
      const { error } = await sb.auth.resend({ type: 'signup', email: normalizeEmail(email), options: { emailRedirectTo: redirect(CALLBACK_PATH) } });
      if (error) throw mapError(error);
    },
    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: redirect(RESET_PATH) });
      // Hesap var/yok bilgisi sızmasın diye "kullanıcı bulunamadı" türü hatalar yutulur; ağ ve hız sınırı bildirilir
      if (error) {
        const f = mapError(error);
        if (f.code === 'network' || f.code === 'rate_limited' || f.code === 'unavailable') throw f;
      }
    },
    handleLink,
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw mapError(error);
    },
    async signOut() {
      // Bu sürümde ağ hatasında bile yerel oturum silinir; hata yutulur ki çevrimdışıyken de çıkış yapılabilsin
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    },
    async deleteAccount() {
      const { error } = await sb.functions.invoke('delete-account', { method: 'POST' });
      if (error) {
        const res = (error as { context?: Response }).context;
        const body = res && typeof res.json === 'function' ? await res.clone().json().catch(() => null) : null;
        if (body?.code === 'reauth_required') throw new AuthFailure('reauth_required');
        if (isAuthRetryableFetchError(error) || /fetch|network/i.test(String((error as Error).message))) throw new AuthFailure('network');
        throw new AuthFailure('unknown');
      }
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    },
  };
}

const unconfiguredService: AuthService = {
  configured: false,
  getUser: async () => null,
  subscribe: () => () => {},
  signUp: async () => { throw new AuthFailure('not_configured'); },
  signIn: async () => { throw new AuthFailure('not_configured'); },
  signInWithApple: async () => { throw new AuthFailure('not_configured'); },
  signInWithGoogle: async () => { throw new AuthFailure('not_configured'); },
  appleAvailable: async () => false,
  resendVerification: async () => { throw new AuthFailure('not_configured'); },
  sendPasswordReset: async () => { throw new AuthFailure('not_configured'); },
  handleLink: async () => ({ kind: 'ignored' }),
  updatePassword: async () => { throw new AuthFailure('not_configured'); },
  signOut: async () => {},
  deleteAccount: async () => { throw new AuthFailure('not_configured'); },
};
