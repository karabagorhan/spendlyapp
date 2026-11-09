/** Hesap katmanının tipleri. Ekranlar yalnızca bu tipleri bilir; Supabase ayrıntısı `supabaseService.ts` içinde kalır. */

export type Provider = 'email' | 'apple' | 'google';

export type AuthUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  provider: Provider;
  name: string | null;
  /** Son girişin zamanı (ms). Hesap silme gibi hassas işlemlerde "yakın zamanda doğrulandı mı" kontrolü için. */
  lastSignInAt: number;
};

/** Ekranlarda çevrilmiş bir mesaja karşılık gelen hata kodları (`auth.err.<kod>`). */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'network'
  | 'cancelled'
  | 'not_configured'
  | 'unavailable'
  | 'link_invalid'
  | 'reauth_required'
  | 'mismatch'
  | 'unknown';

export class AuthFailure extends Error {
  constructor(public code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthFailure';
  }
}

export type SignUpMeta = {
  /** Kullanıcının kabul ettiği Gizlilik Politikası / Koşullar sürümü. */
  consentVersion: string;
  lang: string;
  name?: string;
};

export type SignUpResult =
  | { status: 'signed-in'; user: AuthUser }
  /** E-posta doğrulaması bekleniyor. Hesap zaten varsa da aynı sonuç döner (hesap varlığı sızdırılmaz). */
  | { status: 'verify'; email: string };

export type LinkResult =
  | { kind: 'signed-in'; user: AuthUser }
  | { kind: 'recovery' }
  | { kind: 'ignored' };

export interface AuthService {
  /** false ise (ortam değişkenleri yok) uygulama hesapsız, eskisi gibi çalışır. */
  readonly configured: boolean;
  getUser(): Promise<AuthUser | null>;
  /** Oturum dışarıdan değişince (başka cihazdan çıkış, token yenileme hatası) çağrılır. Dönen işlev aboneliği kaldırır. */
  subscribe(cb: (u: AuthUser | null) => void): () => void;
  signUp(email: string, password: string, meta: SignUpMeta): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signInWithApple(meta: SignUpMeta): Promise<AuthUser>;
  signInWithGoogle(meta: SignUpMeta): Promise<AuthUser>;
  appleAvailable(): Promise<boolean>;
  resendVerification(email: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Doğrulama / şifre sıfırlama bağlantısı uygulamayı açtığında çağrılır. */
  handleLink(url: string): Promise<LinkResult>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Hesabı ve sunucudaki tüm verisini kalıcı siler. Başarısızsa oturum açık kalır. */
  deleteAccount(): Promise<void>;
}
