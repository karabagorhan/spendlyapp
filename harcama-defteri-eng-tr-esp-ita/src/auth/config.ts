/**
 * Hesap altyapısı ayarları. Değerler derleme sırasında EXPO_PUBLIC_* ortam değişkenlerinden gömülür
 * (`process.env.EXPO_PUBLIC_X` yazımı sabit olmalı, dinamik erişim gömülmez).
 *
 * - SUPABASE_ANON_KEY herkese açık anahtardır; veriyi satır düzeyinde güvenlik (RLS) korur.
 *   `service_role` anahtarı ASLA uygulamaya konmaz; yalnızca Edge Function sırlarında durur.
 * - İkisi de boşsa (ya da geçersizse) hesap özellikleri kapanır ve uygulama eskisi gibi hesapsız (yerel) çalışır; bu karar `supabaseService.ts` içinde verilir.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Yalnızca arayüz testleri için sahte servis. Üretim derlemelerinde bu değişken tanımlanmaz; `scripts/release-check.ts` bunu denetler.
 * Ek güvence: `AccountProvider` sahte servisi yalnızca `__DEV__` iken ya da `globalThis.__ALLOW_AUTH_MOCK__ === true` (testin verdiği bayrak) ise kullanır;
 * böylece önbellekten üretim paketine sızan bir değer bile sahte servisi etkinleştiremez. Sahte paket almak için `expo export --clear` kullanın.
 */
export const AUTH_MOCK = process.env.EXPO_PUBLIC_AUTH_MOCK === '1';
