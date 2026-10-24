import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthFailure, AuthService, AuthUser, Provider } from './types';
import { normalizeEmail } from './validation';

/**
 * Bellekte çalışan sahte hesap servisi: arayüz testleri (ve gerçek Supabase projesi olmadan geliştirme) içindir.
 * Yalnızca EXPO_PUBLIC_AUTH_MOCK=1 ile derlenmiş pakette devreye girer. Tarayıcıda `window.__AUTH_MOCK__`
 * ile hata/gecikme enjekte edilir ve e-posta bağlantısına tıklanması taklit edilir.
 */
type Rec = { id: string; email: string; password: string; confirmed: boolean; provider: Provider; name: string | null; lastSignInAt: number };
type Ctl = { offline: boolean; latency: number; failNext: string | null; confirm: (email: string) => void; reset: () => void; log: string[] };

const KEY = 'mock-auth:v1';
let db: Rec[] = [];
let sessionId: string | null = null;
let hydrated = false;
const listeners = new Set<(u: AuthUser | null) => void>();
let failures: Record<string, number> = {};

const ctl: Ctl = {
  offline: false,
  latency: 120,
  failNext: null,
  log: [],
  confirm(email) { const r = db.find((x) => x.email === normalizeEmail(email)); if (r) { r.confirmed = true; persist(); } },
  reset() { db = []; sessionId = null; failures = {}; ctl.log = []; ctl.offline = false; ctl.failNext = null; persist(); },
};
(globalThis as any).__AUTH_MOCK__ = ctl;

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) ({ db, sessionId } = JSON.parse(raw));
  } catch {}
}
const persist = () => { AsyncStorage.setItem(KEY, JSON.stringify({ db, sessionId })).catch(() => {}); };
const wait = () => new Promise((r) => setTimeout(r, ctl.latency));
const user = (r: Rec): AuthUser => ({ id: r.id, email: r.email, emailConfirmed: r.confirmed, provider: r.provider, name: r.name, lastSignInAt: r.lastSignInAt });
const emit = (u: AuthUser | null) => listeners.forEach((l) => l(u));

async function call<T>(name: string, fn: () => T): Promise<T> {
  await hydrate();
  ctl.log.push(name);
  await wait();
  if (ctl.offline) throw new AuthFailure('network');
  if (ctl.failNext) { const c = ctl.failNext; ctl.failNext = null; throw new AuthFailure(c as any); }
  return fn();
}

export function createMockService(): AuthService {
  return {
    configured: true,
    async getUser() { await hydrate(); const r = db.find((x) => x.id === sessionId); return r ? user(r) : null; },
    subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    signUp: (email, password) => call('signUp', () => {
      const e = normalizeEmail(email);
      // Gerçek servisle aynı: var olan adres de "doğrulama gönderildi" yanıtını alır
      if (!db.some((x) => x.email === e)) { db.push({ id: 'u' + (db.length + 1), email: e, password, confirmed: false, provider: 'email', name: null, lastSignInAt: Date.now() }); persist(); }
      return { status: 'verify' as const, email: e };
    }),
    signIn: (email, password) => call('signIn', () => {
      const e = normalizeEmail(email);
      if ((failures[e] ?? 0) >= 5) throw new AuthFailure('rate_limited');
      const r = db.find((x) => x.email === e);
      if (!r || r.password !== password) { failures[e] = (failures[e] ?? 0) + 1; throw new AuthFailure('invalid_credentials'); }
      if (!r.confirmed) throw new AuthFailure('email_not_confirmed');
      failures[e] = 0;
      r.lastSignInAt = Date.now();
      sessionId = r.id; persist();
      return user(r);
    }),
    signInWithApple: () => call('apple', () => { throw new AuthFailure('cancelled'); }),
    signInWithGoogle: () => call('google', () => {
      let r = db.find((x) => x.email === 'google.user@example.com');
      if (!r) { r = { id: 'g1', email: 'google.user@example.com', password: '', confirmed: true, provider: 'google', name: 'Google User', lastSignInAt: 0 }; db.push(r); }
      r.lastSignInAt = Date.now(); sessionId = r.id; persist();
      return user(r);
    }),
    appleAvailable: async () => true,
    resendVerification: (email) => call('resend', () => { void email; }),
    sendPasswordReset: (email) => call('reset', () => { void email; }),
    handleLink: (url) => call('link', () => {
      // Gerçek servisle aynı: yalnızca hesap dönüş bağlantıları işlenir, diğer adresler (açılış vb.) yok sayılır
      if (!url.includes('auth-callback') && !url.includes('reset-callback')) return { kind: 'ignored' as const };
      const code = new URLSearchParams(url.split('?')[1] ?? '').get('code') ?? '';
      const [kind, email] = code.split(':');
      const r = db.find((x) => x.email === email);
      if (!r || !['confirm', 'recover'].includes(kind)) throw new AuthFailure('link_invalid');
      r.confirmed = true; r.lastSignInAt = Date.now(); sessionId = r.id; persist();
      return kind === 'recover' ? { kind: 'recovery' as const } : { kind: 'signed-in' as const, user: user(r) };
    }),
    updatePassword: (password) => call('updatePassword', () => {
      const r = db.find((x) => x.id === sessionId);
      if (!r) throw new AuthFailure('reauth_required');
      if (r.password === password) throw new AuthFailure('same_password');
      r.password = password; persist();
    }),
    async signOut() { await hydrate(); sessionId = null; persist(); emit(null); },
    deleteAccount: () => call('delete', () => {
      const r = db.find((x) => x.id === sessionId);
      if (!r) throw new AuthFailure('unknown');
      if (Date.now() - r.lastSignInAt > 10 * 60_000) throw new AuthFailure('reauth_required');
      db = db.filter((x) => x.id !== r.id); sessionId = null; persist(); emit(null);
    }),
  };
}
