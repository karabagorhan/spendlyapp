# Monibo: App Store yayın incelemesi (bağımsız değerlendirme)

Tarih: 2026-11-08 · Repo: /home/user/spendlyapp · Uygulama klasörü: harcama-defteri-eng-tr-esp-ita/ · Commit: e49ea87
Kapsam: salt okunur. Repo değiştirilmedi, commit atılmadı (`git status --short` boş).

---

## 1) GO / NO-GO ve hazırlık yüzdesi

**Karar: NO-GO (bugünkü haliyle gönderilmemeli).**

- `npm run check:release` **yayını engelliyor**: 7 engel (`src/legal/config.ts` içinde 7 alan `REPLACE_ME`), 1 uyarı (Supabase değişkenleri ayarlı değil). Çıkış kodu 1. (Not: ilk denemede `| tail` yüzünden çıkış kodu 0 göründü; asıl çıktı "Yayına hazır DEĞİL: 7 engel" idi.)
- Kod tarafı sağlam: `tsc --noEmit` temiz (exit 0), `scripts/auth-test.ts` 101/101 geçti. Hesap silme, Apple ile giriş, misafir modu ve yasal metin ekranları kodda mevcut.
- Eksik olanlar kod değil, yayın ve hesap kurulumu: yasal bilgiler, yayınlanmış gizlilik/koşullar adresleri, Supabase prod kurulumu (Apple/Google sağlayıcıları, Apple `.p8` anahtarı, Edge Function sırları), App Store Connect kaydı, App Privacy formu ve "Monibo" adı için marka/isim müsaitliği.

**Hazırlık (tahmini, değerlendirme yargısı):**
- Kod ve yapılandırma: ~80%
- Yayın ve operasyon (yasal bilgi, URL, Supabase prod, ASC formları, isim): ~35%
- **Genel: ~55%**

**GO koşulları (hepsi zorunlu):**
1. `src/legal/config.ts` 7 alanı gerçek değerlerle doldurulmuş; `npm run check:release` çıkış kodu 0.
2. `privacyUrl`, `termsUrl`, `deletionUrl` herkese açık https sayfaları; metinler `src/legal/texts.ts` ile aynı.
3. Prod derlemesinde Supabase değişkenleri (EAS env) tanımlı; Apple ve Google sağlayıcıları Supabase'de açık; Apple `.p8` ve Edge Function sırları girili. Yoksa giriş ekranındaki Apple/Google düğmeleri reviewer'da hata verir.
4. Hesap silme prod'da uçtan uca denenmiş (e-posta, Apple, Google hesabı ayrı ayrı).
5. Apple Developer üyeliği aktif; bundle ID `com.karabag.harcamadefteri.global` ve "Sign in with Apple" yeteneği tanımlı.
6. App Store Connect'te "Monibo" adı müsait ve marka araştırması yapılmış (README:98-101 "MonBo" ve "Moniboi" uyarısı).
7. Build Xcode 26 / iOS 26 SDK ile alınmış; build içindeki `PrivacyInfo.xcprivacy` ve Info.plist doğrulanmış.

---

## 2) Kaynaklar

**Birincil (Apple, doğrudan çekildi):**
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/ (sayfa 5.2'de kesildi; 2.1, 2.3, 3.1.1, 4.2, 4.8, 5.1.1, 5.1.2 metinleri alındı; sayfada **4.0 diye bir bölüm yok**, 4. bölüm tasarım girişi ile 4.1'den başlıyor)
- Offering account deletion in your app: https://developer.apple.com/support/offering-account-deletion-in-your-app
- Upcoming requirements (SDK, tarihler): https://developer.apple.com/news/upcoming-requirements/
- App privacy details: https://developer.apple.com/app-store/app-privacy-details/
- App Review Help, 5.1.1 account deletion: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion (arama sonucunda göründü, içeriği çekilmedi)

**İkincil (doğrulanmadı, yön için):**
- iOS 26 SDK zorunluluğu açıklaması: https://dev.to/raxxostudios/apples-april-28-sdk-deadline-will-reject-your-app-21a8
- Privacy manifest / ITMS-91053 açıklaması: https://medium.com/@sachinsiwal/apples-new-privacy-requirements-in-the-app-store-92fb5b3e8a32
- 4.8 yorumu: https://ptkd.com/journal/app-store-rejection-4-8-sign-in-with-apple-requirement-fix
- Reddetme nedenleri özeti (2026): https://www.superappp.com/blog/why-apps-get-rejected-from-the-app-store-2026-guide
- Reddetme nedenleri özeti: https://qawerk.com/blog/app-store-rejection/

**Expo (ERİŞİLEMEDİ):** `docs.expo.dev` bu oturumdan DNS hatası verdi (`getaddrinfo ENOTFOUND`). Arama sonuçlarında görünen adresler: https://docs.expo.dev/eas/submit/ , https://docs.expo.dev/submit/ios.md . Bu nedenle `eas build` / `eas submit` ayrıntıları ve Expo SDK 58'in Xcode sürümü **doğrulanamadı**. Session ağ ayarlarında docs.expo.dev izni verilirse yeniden bakılmalı.

**YouTube (video izlenmedi; yalnızca arama sonuçlarındaki başlık ve özet):**
- "App Store Review Guidelines: Avoid These Common Mistakes": https://www.youtube.com/watch?v=c9HLIGu8TLo. Özet: resmi kurallara uymayınca reddedilirsiniz; reviewer ile net iletişim.
- "Apple App Store Rejection Checklist (Avoid Getting Rejected Before Launch)": https://www.youtube.com/watch?v=Kuepn6pr6QU. Özet: gönderim öncesi kontrol listesi.
- "How to Avoid App Store Rejection": https://www.youtube.com/watch?v=5hmv9zjpFNo. Genel rehber.
- "Apple Rejected My App: Avoid These 5 Mistakes": https://www.youtube.com/watch?v=_EUbAWiOBf8. Yaygın hatalar.
- "App Store keeps rejecting simple apps for 'minimal functionality'": https://www.youtube.com/watch?v=sZT0iYid7As. Guideline 4.2 riski.
- "App Store Submission 2026: The Complete Step-by-Step Guide": https://www.youtube.com/watch?v=zionIAZlsuY. Adım adım gönderim.
- "Apple Rejected Your App for 4.3? Here's How to Fix It": https://www.youtube.com/watch?v=qvSt_lDUEOo. Tasarım tekrarı (spam).
- "Stop Getting Rejected by App Review": https://www.youtube.com/watch?v=6G0z4MAEl1o
- "My app has been rejected 5 times by App Store": https://www.youtube.com/watch?v=xw538GifcvY
- "Avoid App Store Rejection! Add a Privacy manifest to your app today": https://www.youtube.com/watch?v=_W0_lbKtp1k. Privacy manifest eklemesi.

---

## 3) Ret riski tablosu

Durum: ✅ uygun · ⚠️ kısmen/doğrulanmalı · ❌ bugün engel. "Kim": U = sen (hesap sahibi), D = geliştirici (kod), H = hukukçu.

| # | Kural | Durum | Kanıt | Risk | Çözüm | Kim |
|---|---|---|---|---|---|---|
| 1 | Yasal bilgiler (kılavuz: 2.1 eksik metadata/bağlantı) | ❌ | `src/legal/config.ts:11-20` 7 alan `REPLACE_ME`; `npm run check:release` "Yayına hazır DEĞİL: 7 engel" | Çok yüksek: gönderim öncesi ve reviewer'da tamamlanmamış içerik | 7 alanı doldur (controllerName, contactEmail, privacyUrl, termsUrl, dataRegion, governingLaw, deletionUrl) | U + H |
| 2 | 5.1 / Gizlilik politikası URL'si | ❌ | `config.ts:13` privacyUrl `REPLACE_ME`; `legalSheet.tsx:38` bağlantı yalnızca URL doluysa gösteriliyor | Çok yüksek: App Store Connect herkese açık gizlilik adresi ister; uygulama içinde bağlantı da yok | Gizlilik ve koşullar sayfalarını https'te yayınla; metni hukukçuya okut | U + H |
| 3 | 5.1.1(v) Hesap silme | ✅ (koşullu ⚠️) | `AccountSection.tsx:28` "Hesabı sil" (yalnız giriş yapmış kullanıcıya); `DeleteSheet` yeniden kimlik doğrulama; `supabaseService.ts` `deleteAccount` → Edge Function; `supabase/functions/_shared/handlers.ts:25-52` silme + Apple iptali + `on delete cascade` | Orta: silme yalnızca Supabase prod'da çalışıyorsa; prod'da uçtan uca denenmedi. Apple iptali sadece `apple-link` ile token saklandıysa yapılıyor (handlers.ts:43) | Prod'da üç hesap türüyle (e-posta, Apple, Google) silme testi; App Review notlarına silme yolu yaz | D + U |
| 4 | 5.1.1(v) Misafir hesabı | ✅ | `screens.tsx:148` "misafir olarak devam" (`!closable` iken); misafir veri Supabase'e gitmez (`texts.ts:25`) | Düşük | Değişiklik gerekmez | — |
| 5 | 4.8 Giriş servisleri (Google var, Apple şart) | ✅ | Google düğmesi `screens.tsx:137`; Apple düğmesi `screens.tsx:122-133` (HIG düğmesi); Apple adı+e-posta isteği `supabaseService.ts:144-147`; gizleme seçeneği metinde (`texts.ts:31`) | Yüksek olsaydı reddedilirdi; şu an karşılanıyor. Ancak Supabase'de Apple sağlayıcısı kapalıysa düğme hata verir → 2.1 riski | Supabase Apple sağlayıcısını ve Services ID / bundle ID eşleşmesini prod'da doğrula | U + D |
| 6 | 4.8 (Apple iptali yönlendirmesi) | ⚠️ | Apple sayfası "should" diyor (zorunlu değil); kod `handlers.ts:36-47` iptal eder | Düşük | Apple REST iptalini prod'da kanıtla; `.p8` anahtarını gir | U |
| 7 | 2.1 Uygulama tamlığı / çalışırlık | ⚠️ | `tsc` temiz; `auth-test` 101/101; `npm run test:core` vb. çalıştırılmadı; 3,2 sn açılış animasyonu `intro.tsx:7` | Orta: gerçek cihazda test ve reviewer için çalışır demo yolu yok | Gerçek iPhone'da TestFlight; misafir modu tarifi ve (gerekirse) test hesabını App Review notlarına yaz | D + U |
| 8 | 2.1 Demo hesabı | ⚠️ | Misafir modu var (`screens.tsx:148`), reviewer hesapsız deneyebilir | Düşük-orta: reviewer hesap özelliklerini test ederse hesap ister | Notes for Review'a e-posta+parola (doğrulanmış) test hesabı ve "misafir modu da var" yaz | U |
| 9 | 2.3 Doğru metadata ve ekran görüntüleri | ⚠️ | Ekran görüntüleri henüz yok (kanıt yok); 2.3.3 "splash/giriş ekranı değil" | Orta: giriş/tanıtım ekranı görüntüsü reddedilir | Uygulamanın gerçek kullanım ekranlarından (harcama, bütçe, dashboard) iPhone 6.9" ve 6.5" setleri | U |
| 10 | 2.3.10 Diğer platform imgesi | ✅ | Kodda Android/Google Play adı yok (metin taraması yalnız uygulama içi). Metadata henüz yazılmadı | Düşük | Mağaza metninde "Android/Google Play" ifadelerinden kaçın | U |
| 11 | 2.5 Yazılım gereksinimleri (özel API, OTA) | ✅ | `expo-updates` `runtimeVersion: appVersion` (app.json); özel API taraması yapılmadı | Düşük. OTA yalnız JS güncellemesi; 2.5.2 riski yok sayılabilir | Yayın öncesi OTA ile sadece JS/metin değişikliği yap | D |
| 12 | 4.2 Minimum işlevsellik | ✅ | 5 dil, 5 para birimi, bütçe/abonelik/takvim, Excel dışa aktarım (App.tsx, src/*) | Düşük | Notes'ta öne çıkan özellikleri yaz | U |
| 13 | 3.1.1 Dijital satın alma | ✅ | `package.json`'da ödeme/IAP kütüphanesi yok; `texts.ts:111` "ücretli özellik" gelecek planı | Düşük. Gelecekte ücretli özellik eklenirse StoreKit zorunlu | Ücretli özellik eklenmeden önce IAP kur | D |
| 14 | 5.1.2 Veri kullanımı ve paylaşımı (+ App Privacy formu) | ⚠️ | Hesap: e-posta, ad (opsiyonel), kullanıcı kimliği, Supabase'de. Kur çekimi: Frankfurter ve ExchangeRate-API'ye yalnız IP ile istek (`currency.ts:74-84`). EAS Update. Reklam/analitik yok (`package.json`, `texts.ts:40,89`) | Orta: App Privacy beyanı yanlışsa reddedilir. Apple "işlendikten sonra cihazda kalan" veriyi toplanmış saymaz; kur istekleri ve EAS bu sınıra girebilir (yorum gerekir) | Form önerisi: Contact Info (E-posta, Ad), Identifiers (User ID); amaç App Functionality; "Tracking: hayır". Kur/EAS için hukuki-teknik yorum ver | U + H |
| 15 | Şifreleme beyanı | ✅ | `app.json` ios.infoPlist `ITSAppUsesNonExemptEncryption: false`; özel kripto yok (grep: yalnız `crypto.subtle` ECDSA, Apple JWT için sunucuda) | Düşük. HTTPS ve işletim sistemi şifrelemesi standart kabul edilir | App Store Connect'te uyumluluk sorusu çıkarsa "muaf/standart" seç |  U |
| 16 | Privacy manifest (PrivacyInfo.xcprivacy) | ⚠️ | Repo'da `PrivacyInfo.xcprivacy` dosyası yok; app.json'da `privacyManifests` yok; bağımlılıklar (AsyncStorage, expo-*) kendi manifestini getirmiş olabilir (doğrulanmadı) | Yüksek (teknik): ITMS-91053 ile yükleme reddi | Build sonrası Xcode'da Privacy Report al; eksikse app.json'a `ios.privacyManifests` ekle | D |
| 17 | SDK minimumu (Xcode 26 / iOS 26 SDK, 28 Nisan 2026'dan beri) | ⚠️ | Apple sayfası: "Since April 28, 2026... Xcode 26 ... iOS 26 SDK". Expo SDK 58 EAS build imajının Xcode sürümü doğrulanamadı (docs.expo.dev erişilemedi) | Yüksek (yükleme reddi) | EAS build loglarında Xcode/SDK sürümünü kontrol et; değilse build imajını güncelle | D |
| 18 | Minimum iOS sürümü (9 Eylül 2026'dan beri iOS 13+) | ✅ (doğrulanmadı) | Apple: "must target iOS 13 or later"; Expo SDK 58 minimum sürümü kontrol edilmedi | Düşük | Build ayarlarında deployment target'ı kontrol et | D |
| 19 | 5.1.1 Yaş derecelendirmesi | ⚠️ | Yeni derecelendirme anketi: son tarih 31 Ocak 2026 (geçti). Uygulamada UGC, sohbet, tarayıcı, kumar yok (kod taraması) | Düşük: anket cevapsız kalırsa gönderim engellenir | ASC'de anketi doldur; büyük olasılıkla 4+ | U |
| 20 | Bildirimler (izin) | ✅ | İzin kontekste istenir: abonelik kaydında (`App.tsx:395-396`), ayar açılışında (`App.tsx:428`); yerel bildirim (`notify.ts`); `app.json` plugin yok | Düşük. Uzak bildirim yok; `aps-environment` gerekmez | Build'de Info.plist kontrolü; izin reddinde uygulama çalışır (notify.ts:78) | D |
| 21 | Face ID kullanım metni | ✅ | `app.json` plugins: `expo-local-authentication` → `faceIDPermission: "Allow Monibo to use Face ID to unlock your data."` | Düşük. Plugin `NSFaceIDUsageDescription` yazar; build'de doğrulanmalı | Prebuild/Info.plist'te `NSFaceIDUsageDescription` var mı kontrol | D |
| 22 | İkon | ✅ | `assets/icon.png` 1024×1024, renk tipi 2 (RGB, alfa yok); md5 Expo şablonu listesinde değil (`c2a547ea...`) | Düşük | — | — |
| 23 | iPad (supportsTablet) | ✅ | `app.json` `ios.supportsTablet: false`; `orientation: portrait` | Düşük. Yalnız iPhone ekran görüntüleri gerekir | — | — |
| 24 | İlk açılış ve tanıtım | ✅ | `flow.ts` (durum makinesi), `Gate.tsx`, `Onboarding` 3 sayfa (README:87); hesapsız devam | Düşük | — | — |
| 25 | ~3,2 sn açılış animasyonu | ✅ | `intro.tsx:7` yorumu "~3,2 sn"; hesap: 150+2050+420+520 = 3140 ms; `pointerEvents="none"` (dokunmalar geçer) | Düşük. Uzun splash'ı tek başına red sebebi değil; HIG önerisi kısa | İstersen 2 sn'ye kısalt (zorunlu değil) | D (isteğe bağlı) |
| 26 | Döviz kuru API'leri | ✅ / ⚠️ | Sırayla Frankfurter (`api.frankfurter.dev`) ve ExchangeRate-API (`open.er-api.com`); kur yoksa uydurma kur yok (`useRates.ts`, `currency.ts:37`); ExchangeRate-API'nin atıf (attribution) koşulu kontrol edilmedi | Düşük. Atıf koşulu eksikse lisans sorunu (reddetme nedeni değil ama risk) | Her iki sağlayıcının kullanım koşullarını oku; gerekiyorsa uygulamada atıf ekle | D |
| 27 | Uygulama adı "Monibo" (benzersizlik ve marka) | ⚠️ | `app.json` name "Monibo"; README:98-101 "MonBo" (finans) ve "Moniboi" (oyun) benzer ad; resmi marka araştırması yapılmamış | Yüksek (iş riski): ASC adı alamazsan veya marka itirazı gelirse isim değişir; 2.3 / 5.2 yönünden itiraz | TÜRKPATENT, EUIPO, USPTO, WIPO: 9, 36, 42. sınıflar; ASC'de adı rezerve et | U + H |
| 28 | Bundle ID ve EAS kimlikleri | ⚠️ | `com.karabag.harcamadefteri.global`; `eas.json` `submit.production.ios: {}` (ascAppId yok) | Orta: ilk `eas submit` etkileşimli sorar; CI'da ascAppId gerekir | Apple Developer'da bundle ID'yi oluştur; ASC uygulama kaydı sonrası `ascAppId`'yi `submit.production.ios` altına yaz (Expo dokümanı doğrulanamadı) | U + D |
| 29 | Yasal metin dilleri | ✅ | `texts.ts` TR ve EN; diğer dillerde İngilizce + uyarı (`legalSheet.tsx:26-30`) | Düşük | Hukukçu TR ve EN'i onaylasın | H |
| 30 | Yasal metin tutarlılığı (silme yolu ve Apple) | ✅ | `texts.ts:43` "Ayarlar > Hesap > Hesabı sil"; tr `acct.delete` = "Hesabı sil" (`tr.ts:502`) | Düşük | Mağaza metni ile birebir eşle | D |
| 31 | Test paketi | ⚠️ | `npm run typecheck` ✅; `test:auth` ✅ (101/101); `test:core`, `test:currency`, `test:theme`, `test:dashboard`, `test:functions`, `test:sql` çalıştırılmadı (test:sql PostgreSQL gerektirir) | Orta: RLS ve silme SQL'leri prod'da doğrulanmamış | `npm test` ve `npm run test:sql` gönderimden önce çalıştır | D |
| 32 | Güvenlik: prod'da sahte servis ve gizli anahtar | ✅ | `release-check` "EXPO_PUBLIC_AUTH_MOCK" ve service_role taraması (fail yok); `config.ts` yalnız anon anahtarı | Düşük | EAS env'de `EXPO_PUBLIC_AUTH_MOCK` tanımlı olmasın | D |

Not: Apple 4.0 diye bir bölüm yok; tablodaki "4.x" tasarım maddeleri 4.2 ile karşılandı.

---

## 4) App Store Connect'te doldurulacaklar

**Uygulama bilgisi**
- Ad: "Monibo" (müsaitlik ve marka kontrolü şart, madde 27)
- Birincil dil: Türkçe ya da İngilizce (karar sana ait); ek diller için ayrı metadata
- Bundle ID: `com.karabag.harcamadefteri.global`; SKU: kendi belirlediğin kod
- Kategori: Finans (önerilir); ikincil: Verimlilik

**Gizlilik**
- Gizlilik Politikası URL: `privacyUrl` ile aynı (https, herkese açık)
- Kullanım Koşulları: `termsUrl` (ASC'de alan yoksa uygulama açıklamasına ekle)
- App Privacy (öneri, hukuki onayla):
  - Contact Info: E-posta adresi, Ad (opsiyonel). Bağlı: Evet. Takip: Hayır. Amaç: App Functionality.
  - Identifiers: User ID. Bağlı: Evet. Takip: Hayır. Amaç: App Functionality.
  - Kur istekleri ve EAS Update için: "toplanmıyor" görüşü hukukçuya sorulmalı (madde 14).
  - Reklam, analitik, çökme raporu: yok (`texts.ts:40,89`).

**Yaş derecelendirmesi:** Yeni anketi doldur (UGC yok, sohbet yok, tarayıcı yok; büyük ihtimalle 4+).

**Dışa aktarım uyumluluğu:** `ITSAppUsesNonExemptEncryption: false` zaten app.json'da; ASC sorusu çıkarsa "standart şifreleme / muaf" seç.

**Gönderim notları (App Review Information):**
- Hesapsız kullanım: "Hesap açmadan devam et" (Welcome ekranı).
- Test hesabı (e-posta/parola, doğrulanmış, 2FA yok) ve hesap silme yolu: Ayarlar > Hesap > Hesabı sil.
- Apple ile giriş sadece iOS'ta görünür; reviewer'a Apple ile girişin nasıl deneneceğini yaz.
- Kur verisi üçüncü taraf sağlayıcılardan gelir; uydurma kur yok.

**Ekran görüntüleri:** iPhone 6.9" (zorunlu set), gerçek kullanım ekranları (2.3.3). iPad yok.

**Fiyat ve dağıtım:** Ücretsiz (IAP yok). Ülkeler: kendi kararın.

---

## 5) Gönderim adımları

1. **Yasal bilgiler:** `src/legal/config.ts` 7 alanı doldur; `privacyUrl`, `termsUrl`, `deletionUrl` için https sayfaları yayınla. Hukukçuya oku (TR+EN). Kontrol: `npm run check:release` → çıkış kodu 0.
2. **Marka:** "Monibo" için TÜRKPATENT, EUIPO, USPTO, WIPO araması (9, 36, 42. sınıflar). Sonuç riskliyse adı değiştir (bundle/slug değişmez).
3. **Apple Developer:** Bundle ID oluştur, "Sign in with Apple" yeteneğini ekle, `.p8` anahtarı ve Team ID / Key ID al.
4. **Supabase prod:** Migration (`supabase db push`), Redirect URL'ler (`harcama://auth-callback`, `harcama://reset-callback`), Apple ve Google sağlayıcıları, Edge Function sırları (`APPLE_*`), `supabase functions deploy delete-account apple-link`. (Adımlar `docs/ARCHITECTURE.md` kurulum bölümü.)
5. **EAS env:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (yalnız production). `EXPO_PUBLIC_AUTH_MOCK` tanımlanmasın.
6. **Test:** `npm test` ve `npm run test:sql`; gerçek iPhone'da TestFlight'tan (Apple ile giriş, e-posta doğrulama, parola sıfırlama, hesap silme üçlüsü, misafir modu, Face ID kilidi, bildirim izni).
7. **Build:** `eas build --profile production --platform ios`. Log'da Xcode 26 / iOS 26 SDK doğrula. Build içinde `PrivacyInfo.xcprivacy` ve Info.plist (`NSFaceIDUsageDescription`) kontrol et; Xcode Privacy Report al.
8. **ASC kaydı:** Uygulamayı oluştur; `ascAppId`'yi `eas.json` → `submit.production.ios` altına yaz.
9. **Yükleme:** `eas submit --platform ios --profile production` (Expo dokümanı erişilemediği için komut ve seçenekler doğrulanamadı; alternatif: Transporter ya da Xcode Organizer ile manuel yükleme).
10. **ASC formları:** Gizlilik (App Privacy), yaş derecelendirmesi, metadata, ekran görüntüleri, Notes for Review (test hesabı, silme yolu, misafir modu).
11. **Gönderim:** TestFlight'ta son test; "Submit for Review". Reddedilirse Resolution Center'daki madde numarasını (örn. 5.1.1(v)) esas al.

**Gönderimden sonra:** OTA güncellemeleri yalnız JS ve metin için; native değişiklik yeni build gerektirir (runtimeVersion `appVersion`).

---

## Açık noktalar ve sınırlar
- Expo dokümanına erişilemedi; EAS komutları ve Xcode sürümü doğrulanamadı.
- Apple'ın 4.8 ve 5.1.1(v) metinleri birincil kaynaktan alındı; sayfa 5.2'de kesildiği için sonraki maddeler okunmadı.
- YouTube videoları izlenmedi; yalnızca arama özetleri kullanıldı.
- Prod Supabase, gerçek build, Info.plist ve privacy manifest bu oturumda kontrol edilemedi.
- Yüzdeler ve risk seviyeleri değerlendirme yargısıdır, ölçülmüş değer değildir.
