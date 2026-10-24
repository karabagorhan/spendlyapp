/**
 * Giriş formu doğrulamaları (saf işlevler, ağ yok). Hata değerleri `auth.val.<kod>` çeviri anahtarlarına karşılık gelir.
 */

export type EmailIssue = 'empty' | 'invalid';
export type PasswordIssue = 'short' | 'long' | 'common' | 'email';

export const MIN_PASSWORD = 8;
/** bcrypt 72 BAYT'tan fazlasını sessizce keser; Supabase da reddeder. Karakter değil bayt sayılır (ç, ş, 中 birden çok bayttır). */
export const MAX_PASSWORD_BYTES = 72;
export const MAX_EMAIL = 254;

export const normalizeEmail = (s: string) => s.trim().toLowerCase();

export function validateEmail(raw: string): EmailIssue | null {
  const e = normalizeEmail(raw);
  if (!e) return 'empty';
  if (e.length > MAX_EMAIL) return 'invalid';
  const at = e.lastIndexOf('@');
  if (at < 1 || at !== e.indexOf('@')) return 'invalid';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (local.length > 64) return 'invalid';
  if (/\s/.test(e)) return 'invalid';
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return 'invalid';
  // Alan adı: en az bir nokta, etiketler harf/rakam/tire, tire ile başlayıp bitmez, son etiket en az 2 harf
  const labels = domain.split('.');
  if (labels.length < 2) return 'invalid';
  if (!labels.every((l) => l.length > 0 && l.length <= 63 && /^[\p{L}\p{N}]([\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(l))) return 'invalid';
  if (!/^[\p{L}]{2,}$|^xn--[a-z0-9-]+$/u.test(labels[labels.length - 1])) return 'invalid';
  return null;
}

const POPULAR_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'yahoo.com', 'yandex.com', 'proton.me', 'me.com'];

function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Bitişik iki harfin yer değiştirmesi ("gmial") tek hata sayılır
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** "ali@gmial.com" → "ali@gmail.com". Yalnızca öneridir; kullanıcı kendi adresinde ısrar edebilir. */
export function suggestEmail(raw: string): string | null {
  const e = normalizeEmail(raw);
  if (validateEmail(e)) return null;
  const at = e.indexOf('@');
  const domain = e.slice(at + 1);
  if (POPULAR_DOMAINS.includes(domain)) return null;
  for (const p of POPULAR_DOMAINS) if (distance(domain, p) === 1) return e.slice(0, at + 1) + p;
  return null;
}
// Sık kullanılan parolalar (küçük harfe çevrilmiş, ≥8 karakter). Türkçe yaygınlar dahil.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'qwertyui', 'qwerty123', 'qwertyuiop', 'asdfghjk', 'asdfghjkl', 'zxcvbnm1',
  '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', '12341234', '123123123', 'abcd1234', 'abc12345', 'iloveyou', 'letmein1',
  'welcome1', 'welcome123', 'admin123', 'administrator', 'monkey123', 'dragon123', 'football', 'baseball', 'sunshine', 'princess', 'superman', 'master123',
  'sifre123', 'sifre1234', 'parola123', 'merhaba123', 'istanbul', 'istanbul34', 'ankara06', 'izmir3535', 'galatasaray', 'fenerbahce', 'besiktas', 'trabzonspor',
  'galatasaray1', 'fenerbahce1', 'besiktas1', 'trabzon61', 'turkiye123', 'sevgilim', 'canimanne', 'harcama123', 'spendly123',
]);
const COMMON_ROOTS = ['password', 'qwerty', 'asdfg', 'iloveyou', 'letmein', 'welcome', 'admin', 'sifre', 'parola', 'harcama', 'spendly'];

export const byteLength = (s: string) => new TextEncoder().encode(s).length;

export function validatePassword(pw: string, email = ''): PasswordIssue | null {
  if ([...pw].length < MIN_PASSWORD) return 'short';
  if (byteLength(pw) > MAX_PASSWORD_BYTES) return 'long';
  const low = pw.toLowerCase();
  const letters = low.replace(/[^a-z]/g, '');
  const trimmedDigits = low.replace(/[0-9!@#$%^&*._-]+$/g, '');
  if (COMMON.has(low) || COMMON.has(trimmedDigits) || /^(.)\1+$/.test(pw)) return 'common';
  if (COMMON_ROOTS.some((r) => letters === r) || /^(?:0?1234567890?|abcdefgh)/.test(low)) return 'common';
  const local = normalizeEmail(email).split('@')[0];
  if (local.length >= 4 && low.includes(local)) return 'email';
  return null;
}

/** 0 = zayıf, 1 = orta, 2 = iyi, 3 = güçlü. Yalnızca görsel geri bildirimdir; engelleme `validatePassword` ile yapılır. */
export function passwordStrength(pw: string, email = ''): 0 | 1 | 2 | 3 {
  if (validatePassword(pw, email)) return 0;
  const chars = [...pw];
  const classes = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /[0-9]/, /[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/].filter((r) => r.test(pw)).length;
  const unique = new Set(chars).size;
  let score = 1;
  if (chars.length >= 12 && unique >= 7) score++;
  if (chars.length >= 14 && classes >= 3 && unique >= 9) score++;
  if (chars.length < 10 && classes < 2) score = 1;
  return Math.min(3, score) as 1 | 2 | 3;
}

export function validateName(raw: string): boolean {
  const n = raw.trim();
  return n.length <= 40 && !/[<>]/.test(n);
}
