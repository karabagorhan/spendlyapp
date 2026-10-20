# Mimari ve kurulum (Modül 1: kimlik doğrulama, tanıtım, yasal uyumluluk)

## Karar özeti

| Konu | Karar | Neden |
|---|---|---|
| İstemci | **Expo / React Native** (mevcut), TypeScript | Uygulama zaten bunda; 5 dil, 5 para birimi, tema ve testler çalışıyor. Flutter'a geçmek bunların hepsini yeniden yazmak demek, kazancı yok. |
| Backend | **Supabase** (Auth + Postgres + Edge Functions) | Apple/Google/e-posta girişi hazır; Postgres + **satır düzeyinde güvenlik (RLS)** veriyi sunucuda korur; AB bölgesi seçilebilir; silme zinciri `on delete cascade` ile kurulur. Alternatif Firebase: NoSQL ve ilişkisel silme zinciri zayıf, bu yüzden seçilmedi. |
| Oturum belirteçleri | iOS Keychain / Android Keystore (`expo-secure-store`) | AsyncStorage şifrelenmez. Parçalı yazma `src/auth/secureStorage.ts`. |
| Giriş akışı | PKCE (`flowType: 'pkce'`) | Mobilde derin bağlantıyla kod değişimi; belirteç adreste taşınmaz. |
| Derleme | **EAS Build** (geliştirme derlemesi) | Apple ile giriş ve `expo-secure-store` Expo Go'da tam çalışmaz (aşağıya bak). |

## Temel ilke: yerel-öncelikli, hesap isteğe bağlı

Uygulama bugüne dek hesapsız ve çevrimdışı çalışıyordu. Bu kullanıcı vaadi korunur:

- **Misafir modu** ("Hesap açmadan devam et"): hiçbir şey sunucuya gitmez; uygulama eskisi gibidir.
- Hesap **isteğe bağlıdır**. Bu modülde harcama verileri hesapla **eşitlenmez**, yalnızca hesap kimliği vardır. Bulut eşitleme Modül 3'tür; gizlilik metni o zaman güncellenmelidir (`src/legal/texts.ts`).
- Supabase değişkenleri yoksa (`EXPO_PUBLIC_SUPABASE_*`) hesap özellikleri tamamen kapanır: yalnızca ilk açılışta tanıtım görünür, sonra uygulama doğrudan açılır.
- Eski sürümden güncelleyen kullanıcı (kayıtlı veri var) tanıtımı görmez; misafir olarak devam eder, hesabı Ayarlar'dan açar.

## Katmanlar

```
App.tsx
 └─ <Gate>                      src/auth/Gate.tsx          tanıtım / giriş / doğrulama / sıfırlama ekranlarını gösterir
     ├─ AccountProvider          src/auth/AccountProvider   durum makinesi + oturum + e-posta bağlantıları
     │   ├─ flow.ts              saf reducer (test edilir)
     │   ├─ prefs.ts             tanıtım görüldü / misafir / onay sürümü (AsyncStorage)
     │   └─ AuthService          src/auth/types.ts          arayüz; ekranlar yalnızca bunu bilir
     │        ├─ supabaseService.ts   gerçek (Supabase)
     │        └─ mockService.ts       yalnızca arayüz testleri (EXPO_PUBLIC_AUTH_MOCK=1)
     └─ <Main/>                  mevcut uygulama; Ayarlar'da <AccountSection/> (hesap, çıkış, hesabı sil, yasal)

supabase/
 ├─ migrations/…accounts.sql      profiles (RLS) + apple_tokens (kilitli) + tetikleyiciler
 ├─ functions/delete-account      hesabı kalıcı siler (yeniden kimlik doğrulama + Apple iptali)
 ├─ functions/apple-link          Apple kodunu yenileme belirtecine çevirir (silerken iptal için)
 ├─ functions/_shared             handlers.ts (iş mantığı, Node'da test edilir) + apple.ts
 └─ tests/                        gerçek PostgreSQL ile RLS testleri + fonksiyon mantığı testleri
```

## Güvenlik modeli (özet)

- **İstemcide yalnızca `anon` anahtarı** bulunur; veriyi RLS korur. `service_role` yalnızca Edge Function sırlarındadır (`npm run check:release` sızıntı arar).
- `profiles`: kullanıcı yalnızca kendi satırını okur; yalnızca `display_name` ve `lang` sütunlarını günceller (sütun düzeyinde yetki). Onay alanları yalnızca tetikleyici ve `accept_terms()` ile yazılır; **onay zamanı istemcinin iddiası değil sunucu saatidir**.
- **Hesap varlığı sızdırılmaz:** kayıt ve parola sıfırlama, adres kayıtlı olsun olmasın aynı yanıtı verir. Ham sunucu hata metni kullanıcıya gösterilmez.
- **Hesap silme:** Edge Function JWT'yi doğrular, **son girişin 10 dakikadan yeni olmasını** ister (çalınmış eski oturum hesabı silemesin), Apple erişim iznini iptal eder, kullanıcıyı siler; kullanıcıya bağlı her şey `on delete cascade` ile gider. İstemci de silmeden önce parolayı ya da Apple/Google girişini yeniden ister.
- Parola: en az 8 karakter, en fazla **72 bayt** (bcrypt sınırı; Türkçe harf, emoji, Çince birden çok bayt), yaygın parola listesi ve e-postayı içermeme kontrolü. Sunucu kuralı (`supabase/config.toml`) istemciyle aynıdır.
- **Kural (sonraki modüller):** kullanıcıya ait her tablo `user_id uuid references auth.users(id) on delete cascade` ve RLS açık olmalıdır.

## Kurulum adımları

1. **Supabase projesi** oluştur. Bölgeyi seç (örn. Frankfurt) ve `src/legal/config.ts` içindeki `dataRegion` alanına yaz.
2. **Authentication → Providers → Email:** *Confirm email* **AÇIK**; minimum parola uzunluğu 8; parola bileşim şartı **yok**.
3. **Authentication → URL Configuration → Redirect URLs:** `harcama://auth-callback`, `harcama://reset-callback`, geliştirme için `exp://**`.
4. **Apple:** Apple Developer'da *Sign in with Apple* yeteneğini bundle ID'ye (`com.karabag.harcamadefteri.global`) ekle; Supabase *Providers → Apple* içinde Client ID olarak bundle ID'yi gir. Hesap silerken iptal için **servis anahtarı (.p8)** oluştur.
5. **Google:** Google Cloud'da OAuth istemcisi (Web) oluştur; yönlendirme adresi `https://<proje>.supabase.co/auth/v1/callback`; kimlik ve sırrı Supabase *Providers → Google*'a gir.
6. **Migration:** `supabase db push` (ya da `supabase/migrations/*.sql` dosyasını SQL editöründe çalıştır).
7. **Edge Function sırları ve dağıtım:**
   ```bash
   supabase secrets set APPLE_TEAM_ID=… APPLE_KEY_ID=… APPLE_CLIENT_ID=com.karabag.harcamadefteri.global APPLE_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)"
   supabase functions deploy delete-account apple-link
   ```
8. **Uygulama değişkenleri** (`.env`, EAS'ta *Environment variables*): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
9. **Geliştirme derlemesi:** `npx eas-cli build --profile development --platform ios` (Apple ile giriş için gerçek cihaz).
10. **Yasal bilgileri doldur** (`src/legal/config.ts`) ve metinleri bir hukukçuya okut. Gizlilik/koşullar sayfalarını web'de yayınla; adresleri aynı dosyaya yaz.
11. `npm run check:release` hatasız bitene kadar yayına çıkma.

## Expo Go sınırları

Expo Go içinde: e-posta girişi, parola sıfırlama ve Google (tarayıcı akışı) çalışır. **Apple ile giriş** Expo Go'da kendi paket kimliğiyle sınırlıdır; bu uygulamanın kimliğiyle test için geliştirme derlemesi gerekir.

## Sonraki modüller (öneri)

| # | Modül | İçerik |
|---|---|---|
| 2 | Çevrimdışı ve gözlemlenebilirlik | Ağ durumu bandı (şu an yalnızca giriş ekranlarında), Sentry çökme raporu (kişisel veri maskeli), olay analitiği (açık izinle) |
| 3 | Bulut eşitleme | Harcama/abonelik/bütçe tabloları (RLS + cascade), çakışma çözümü, misafirden hesaba veri taşıma |
| 4 | Bildirimler | Uzak bildirim (FCM/APNs), derin bağlantı |
| 5 | Ödemeler | StoreKit/Play Billing (RevenueCat önerilir), paywall, satın alımları geri yükleme, sunucu doğrulaması |
