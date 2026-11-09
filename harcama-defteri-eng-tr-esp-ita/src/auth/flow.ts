import { AuthUser } from './types';

/**
 * Uygulamanın açılış akışı (saf durum makinesi; ekran ve ağ bilmez, bu yüzden tek tek test edilir).
 *
 *   boot → onboarding → auth(welcome | signin | signup | forgot) → verify → app
 *                                         ↘ (hesapsız devam) ─────────────↗
 *   recovery: şifre sıfırlama bağlantısından gelen "yeni şifre" ekranı
 */
export type AuthMode = 'welcome' | 'signin' | 'signup' | 'forgot';
export type Phase =
  | { name: 'boot' }
  | { name: 'onboarding' }
  | { name: 'auth'; mode: AuthMode; closable: boolean }
  | { name: 'verify'; email: string }
  | { name: 'recovery' }
  | { name: 'app' };

export type State = { phase: Phase; user: AuthUser | null; guest: boolean; configured: boolean };

export type Action =
  | { type: 'BOOT'; onboarded: boolean; guest: boolean; user: AuthUser | null; configured: boolean }
  | { type: 'OB_DONE' }
  | { type: 'GO'; mode: AuthMode }
  /** Doğrulama/sıfırlama ekranından giriş ekranlarına dönüş ("yanlış adres", "giriş yap"). */
  | { type: 'TO_AUTH'; mode: AuthMode }
  | { type: 'OPEN_AUTH' }
  | { type: 'CLOSE_AUTH' }
  | { type: 'GUEST' }
  | { type: 'SIGNED_IN'; user: AuthUser }
  | { type: 'VERIFY'; email: string }
  | { type: 'RECOVERY' }
  | { type: 'RECOVERY_DONE' }
  | { type: 'SIGNED_OUT' }
  | { type: 'EXTERNAL'; user: AuthUser | null };

export const initial: State = { phase: { name: 'boot' }, user: null, guest: false, configured: false };

const needsVerification = (u: AuthUser) => u.provider === 'email' && !u.emailConfirmed;
const afterOnboarding = (s: State): State =>
  s.configured ? { ...s, phase: { name: 'auth', mode: 'welcome', closable: false } } : { ...s, guest: true, phase: { name: 'app' } };

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'BOOT': {
      const base = { ...s, user: a.user, guest: a.guest, configured: a.configured };
      if (a.user) return { ...base, guest: false, phase: needsVerification(a.user) ? { name: 'verify', email: a.user.email ?? '' } : { name: 'app' } };
      if (!a.onboarded) return { ...base, phase: { name: 'onboarding' } };
      if (a.guest || !a.configured) return { ...base, guest: true, phase: { name: 'app' } };
      return { ...base, phase: { name: 'auth', mode: 'welcome', closable: false } };
    }
    case 'OB_DONE':
      return s.phase.name === 'onboarding' ? afterOnboarding(s) : s;
    case 'GO':
      return s.phase.name === 'auth' ? { ...s, phase: { ...s.phase, mode: a.mode } } : s;
    case 'TO_AUTH':
      return s.phase.name === 'verify' || s.phase.name === 'recovery' ? { ...s, phase: { name: 'auth', mode: a.mode, closable: false } } : s;
    case 'OPEN_AUTH':
      return s.phase.name === 'app' && s.configured && !s.user ? { ...s, phase: { name: 'auth', mode: 'welcome', closable: true } } : s;
    case 'CLOSE_AUTH':
      return s.phase.name === 'auth' && s.phase.closable ? { ...s, phase: { name: 'app' } } : s;
    case 'GUEST':
      return s.phase.name === 'auth' ? { ...s, guest: true, user: null, phase: { name: 'app' } } : s;
    case 'SIGNED_IN':
      return { ...s, user: a.user, guest: false, phase: needsVerification(a.user) ? { name: 'verify', email: a.user.email ?? '' } : { name: 'app' } };
    case 'VERIFY':
      return { ...s, phase: { name: 'verify', email: a.email } };
    case 'RECOVERY':
      return { ...s, phase: { name: 'recovery' } };
    case 'RECOVERY_DONE':
      return s.phase.name === 'recovery' ? { ...s, phase: { name: 'app' } } : s;
    case 'SIGNED_OUT':
      return { ...s, user: null, guest: false, phase: s.configured ? { name: 'auth', mode: 'welcome', closable: false } : { name: 'app' } };
    case 'EXTERNAL': {
      // Oturum dışarıdan sona erdiyse (başka cihazdan çıkış, yenileme başarısız) giriş ekranına dön
      if (!a.user) return s.user && s.phase.name !== 'recovery' ? reduce(s, { type: 'SIGNED_OUT' }) : s;
      // Şifre sıfırlama sırasında gelen oturum olayı kullanıcıyı uygulamaya atmamalı
      if (s.phase.name === 'app' && s.user) return { ...s, user: a.user };
      return s;
    }
  }
}
