/**
 * Yasal metinlerin sürümü ve yayıncı bilgileri.
 *
 * ÖNEMLİ: Aşağıdaki `REPLACE_ME` alanları yayından önce gerçek bilgilerle doldurulmalıdır; `npm run check:release`
 * doldurulmamış alan varsa başarısız olur. App Store ve Google Play, herkese açık bir Gizlilik Politikası ADRESİ ister:
 * `privacyUrl` ve `termsUrl` bu sayfaların yayınlandığı adresler olmalıdır (metin `texts.ts` ile aynı olmalı).
 */
export const LEGAL_VERSION = '2026-10-20';

export const LEGAL = {
  controllerName: 'REPLACE_ME',
  contactEmail: 'REPLACE_ME',
  privacyUrl: 'REPLACE_ME',
  termsUrl: 'REPLACE_ME',
  /** Hesap verilerinin tutulduğu bölge (ör. "Frankfurt, Almanya (AB)"). Supabase projesi oluşturulurken seçilen bölgeyle aynı olmalıdır. */
  dataRegion: 'REPLACE_ME',
  /** Uygulanacak hukuk ve yetkili mahkeme (ör. "Türkiye Cumhuriyeti hukuku; İstanbul mahkemeleri"). */
  governingLaw: 'REPLACE_ME',
  /** Hesap silme talebi için herkese açık yardım adresi (Google Play "Data deletion" alanı ister). */
  deletionUrl: 'REPLACE_ME',
} as const;

export const isPlaceholder = (v: string) => v === 'REPLACE_ME';
