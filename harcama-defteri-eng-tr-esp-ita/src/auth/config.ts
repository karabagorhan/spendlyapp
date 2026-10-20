/**
 * Hesap altyapısı ayarları. Değerler derleme sırasında EXPO_PUBLIC_* ortam değişkenlerinden gömülür
 * (`process.env.EXPO_PUBLIC_X` yazımı sabit olmalı, dinamik erişim gömülmez).
 *
 * - SUPABASE_ANON_KEY herkese açık anahtardır; veriyi satır düzeyinde güvenlik (RLS) korur.
 *   `service_role` anahtarı ASLA uygulamaya konmaz; yalnızca Edge Function sırlarında durur.
 * - İkisi de boşsa hesap özellikleri kapanır ve uygulama eskisi gibi hesapsız (yerel) çalışır.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const AUTH_CONFIGURED = /^https:\/\/[^/\s]+/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

/**
 * Yalnızca arayüz testleri için sahte servis. Üretim derlemelerinde bu değişken tanımlanmaz;
 * `scripts/release-check.ts` bu bayrağın açık bırakılmadığını denetler.
 */
export const AUTH_MOCK = process.env.EXPO_PUBLIC_AUTH_MOCK === '1';
