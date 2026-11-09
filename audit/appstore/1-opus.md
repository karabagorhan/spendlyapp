# Monibo: App Store gönderim denetimi (bağımsız inceleme)

- **Tarih:** 8 Kasım 2026
- **Kapsam:** `harcama-defteri-eng-tr-esp-ita/`, dal `orhan/awesome-clarke-nbqv4i`, commit `e49ea87`
- **Yöntem:** Kod ve yapılandırma okundu. Şu komutlar çalıştırıldı: `npm test`, `npm run check:release`, `npx expo config --type public`, `npx expo-doctor`. Ayrıca **repo dışındaki geçici bir kopyada** `npx expo prebuild --platform ios --no-install` çalıştırıldı ve üretilen Info.plist, entitlements ve proje ayarları okundu. Kopya sonra silindi; repoda hiçbir değişiklik yok (`git status` boş).
- **Sınırlar:** Bu oturumdan docs.expo.dev, youtube.com, revenuecat.com ve exchangerate-api.com adreslerine erişilemedi. Bu kaynaklar için arama sonuçlarındaki özetler kullanıldı ve bu durum her yerde belirtildi. Gerçek cihaz, EAS derlemesi ve App Store Connect hesabı bu ortamda yoktu.

---

## 1) Kısa sonuç

**Karar: Bugün NO-GO. Aşağıdaki 5 P0 madde kapanınca GO.**

**Hazırlık: yaklaşık %75.** Kod tarafı güçlü: testler yeşil, izin akışları bağlamsal, hesap isteğe bağlı, hesap silme ve Apple ile giriş doğru kurulmuş. Engeller çoğunlukla kullanıcı tarafında: yasal bilgiler, herkese açık URL'ler ve App Store Connect beyanları. Koddaki küçük yapılandırma eksikleri de var.

### P0: gönderimden önce şart
1. **Yasal alanlar `REPLACE_ME`.** `src/legal/config.ts:11-20`'deki 7 alan boş; `npm run check:release` "Yayına hazır DEĞİL: 7 engel" veriyor. Bu hâliyle uygulama içi Gizlilik Politikası "This app is provided by **REPLACE_ME**" diye görünür. Bu, Guideline 2.1 (yer tutucu içerik) ve 5.1.1(i) (gizlilik politikası) için **kesin ret** sebebi olur.
2. **Herkese açık bir Gizlilik Politikası URL'si ve Destek URL'si yok.** App Store Connect ikisini de zorunlu tutar.
3. **v1.0'da hesap özelliği açık mı kapalı mı, karar verin.** Önerim: **kapalı** yayınlayın. Üretim derlemesinde `EXPO_PUBLIC_SUPABASE_*` tanımlanmasın.
   - Kapalıyken giriş ekranı ve Hesap bölümü zaten gizleniyor (`flow.ts:46-47`, `AccountSection.tsx:20`).
   - Böylece demo hesap, canlı backend, 4.8 ve 5.1.1(v) riskleri tamamen ortadan kalkar.
   - Açılacaksa: canlı Supabase, demo hesap, App Privacy'de e-posta, ad ve User ID beyanı ve gerçek cihazda Apple token iptali testi gerekir.
4. **App Privacy'de `Device ID` beyanı.** expo-updates her güncelleme isteğinde EAS-Client-ID gönderir. Expo bunun **Identifiers → Device ID** olarak beyan edilmesini söylüyor. Apple'ın oluşturduğu gizlilik raporunda görünmez, bu yüzden elle eklenmeli.
5. **Mağaza bölgeleri.** Çin anakarası listeden çıkarılmalı: ICP dosya numarası olmadan orada yayın yapılamaz. AB için **DSA trader** beyanı verilmeli.

---

## 2) Kaynaklar

### Apple (birincil)
- App Review Guidelines (alıntılar bu sayfadan): https://developer.apple.com/app-store/review/guidelines/
- Yaklaşan gereksinimler: https://developer.apple.com/news/upcoming-requirements/
  - **28 Nisan 2026'dan beri** Xcode 26 ve iOS 26 SDK zorunlu.
  - **31 Ocak 2026'dan beri** yeni yaş derecelendirmesi soruları zorunlu.
  - **17 Şubat 2025'ten beri** AB'de DSA trader durumu zorunlu.
  - **1 Mayıs 2024'ten beri** "required reason API" beyanları zorunlu.
  - **9 Eylül 2026'dan beri** iOS 13 ve üzeri hedef zorunlu.
- Yeni yaş derecelendirmesi (13+, 16+, 18+ eklendi): https://developer.apple.com/news/?id=ks775ehf
- App Privacy Details ("collect" tanımı, isteğe bağlı beyan kuralları, IP ve token istisnası): https://developer.apple.com/app-store/app-privacy-details/
- Hesap silme (5.1.1(v), Sign in with Apple token iptali): https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Ekran görüntüsü ölçüleri: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- DSA trader: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
- Şifreleme ihracat uyumu: https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
  - Not: sayfa gövdesi okunamadı; yalnızca başlık geldi. Bu konudaki değerlendirme genel bilgiye dayanıyor.
- Çin ICP numarası (App Information yardım sayfası): https://developer.apple.com/help/app-store-connect/reference/app-information/
  - İlgili forum başlıkları: https://developer.apple.com/forums/thread/743661, https://developer.apple.com/forums/thread/743958
- 3.2.1(viii) tartışması (forum): https://developer.apple.com/forums/thread/776099

### Expo
docs.expo.dev bu oturumdan erişilemedi. İçerik arama özetlerinden alındı.
- App Store ret nedenleri (expo.dev, okundu): https://expo.dev/articles/shipping-to-the-app-stores/app-store-rejection-reasons
  - Önemli not: "EAS Update … can't change the reviewed binary or switch on hidden features."
- Apple gizlilik manifesti: https://docs.expo.dev/guides/apple-privacy/
  - `ios.privacyManifests`; Apple statik CocoaPods içindeki manifestleri her zaman doğru okuyamayabilir.
- EAS Update mağaza gizlilik beyanı (Device ID): https://docs.expo.dev/eas-update/store-privacy-declarations/
- Uygulama sürümleri (`appVersionSource: remote`, `autoIncrement`): https://docs.expo.dev/build-reference/app-versions/
- EAS Update giriş ve SSS: https://docs.expo.dev/eas-update/introduction/, https://docs.expo.dev/eas-update/faq/
- EAS Submit iOS: https://docs.expo.dev/submit/ios/
- OTA politikası (Bitrise): https://bitrise.io/blog/post/what-app-stores-allow-with-ota-updates-apple-and-google-policy-explained

### Üçüncü taraf makaleler
- QAwerk, 2026'da en sık ret nedenleri: https://qawerk.com/blog/app-store-rejection/
- Superappp (2.1, 2.3, 4.0, 5.1.1 sıralaması): https://www.superappp.com/blog/most-common-app-store-rejection-reasons
- Choicely: https://www.choicely.com/tutorials/app-store-rejection-reasons
- Adalo: https://studio.adalo.com/blog/why-apps-get-rejected-app-store
- RevenueCat, "Ultimate guide to App Store rejections" (erişilemedi; arama özeti): https://www.revenuecat.com/blog/growth/the-ultimate-guide-to-app-store-rejections/
- ExchangeRate-API açık uç noktası koşulları (erişilemedi; arama özeti): https://www.exchangerate-api.com/docs/free
  - Özet: "requires attribution", yeniden dağıtım yasak.

### Videolar
youtube.com bu oturumdan açılamadı. Başlıklar ve özetler arama sonuçlarından alındı.

| Video | URL | Ana fikir (arama özetinden) |
|---|---|---|
| Why Apps Get Rejected from the App Store – Common Reasons & How to Avoid Them (2026) | https://www.youtube.com/watch?v=CGW3_eRM1G0 | Genel 2026 ret nedenleri: 2.1, metadata, gizlilik |
| App Store keeps rejecting simple apps for "minimal functionality" | https://www.youtube.com/watch?v=sZT0iYid7As | Basit uygulamalar 4.2 ile reddediliyor; benzersiz değer ve "app-like" deneyim gerekli |
| Apple Rejected My App: Avoid These 5 Mistakes | https://www.youtube.com/watch?v=_EUbAWiOBf8 | Sık hatalar listesi |
| Apple Rejected Your App for 4.3? Here's How to Fix It | https://www.youtube.com/watch?v=qvSt_lDUEOo | "Design spam" ve benzer uygulama konumlandırması |
| Stop Getting Rejected by App Review | https://www.youtube.com/watch?v=6G0z4MAEl1o | Yönergeleri okumak, inceleyiciyle iletişim (inceleme notları) |
| Avoid App Store Rejection! Add a Privacy manifest | https://www.youtube.com/watch?v=_W0_lbKtp1k | Required-reason API beyanı |
| App Store Submission 2026: Complete Step-by-Step Guide | https://www.youtube.com/watch?v=zionIAZlsuY | Gönderim adımları |
| Expo EAS CLI to Submit Apps … and Test with TestFlight | https://www.youtube.com/watch?v=PdwYDatvJ2I | `eas build` ve `eas submit`, TestFlight |
| Async Office Hours: publish with EAS Submit (Expo, Keith Kurak) | https://www.youtube.com/watch?v=-KZjr576tuE | EAS Submit akışı |

**Ortak tema:**
- Retlerin büyük kısmı **2.1** kaynaklı: çökme, yer tutucu, çalışmayan bağlantı, çalışmayan demo hesap.
- Ardından **2.3** (metadata ile uygulama uyuşmuyor), **4.2/4.3** (az işlev, kopya) ve **5.1.1** (gizlilik politikası, hesap silme) geliyor.
- Expo makalesi Apple kaynaklı şu ifadeyi aktarıyor: "over 40% of unresolved issues fall under 2.1".

### Finans ve bütçe uygulamalarına özgü notlar
- **3.2.1(viii):** "Apps used for financial trading, investing, or money management should be submitted by the financial institution…"
  - Monibo para taşımaz, banka bağlantısı yoktur, yatırım yaptırmaz; yalnızca kişisel kayıt tutar. Yine de metadata'da "money management service", "bankacılık", "yatırım" gibi ifadelerden kaçının.
  - İnceleme notunda "banka bağlantısı yok, para hareketi yok, finansal tavsiye yok" diye açıkça yazın.
- **2.3 / 2.3.7:** Yanıltıcı finansal iddia yazmayın ("tasarruf garantisi", "%30 daha fazla biriktir" gibi). Kur verisi üçüncü taraftan gelir ve bilgi amaçlıdır; Kullanım Koşulları bunu zaten söylüyor (`texts.ts`, terms "Hizmetin kapsamı").
- **5.1.1 / 5.1.2:** Finansal veri hassastır. Monibo'da harcama verisi cihazdan çıkmıyor, bu büyük avantaj. Beyanlar da bununla tutarlı olmalı.

---

## 3) Ret riski tablosu

Durum: ✅ uygun · ⚠️ dikkat · ❌ engel

| # | Kural | Durum | Kanıt | Risk | Çözüm | Kim |
|---|---|---|---|---|---|---|
| 1 | 5.1.1(i) Gizlilik politikası (uygulama içinde ve ASC'de URL) | ❌ | `src/legal/config.ts:11-20` hepsi `REPLACE_ME`. `check:release`: 7 HATA. `legalSheet.tsx:37` URL yer tutucu ise web bağlantısını gizliyor, ama metin içindeki `{controller}` ve `{email}` "REPLACE_ME" olarak basılıyor (`texts.ts:16-17`). | **Kritik** | Gerçek ad/unvan, e-posta, bölge ve hukuk bilgisini doldurun. Gizlilik, koşullar ve destek sayfalarını HTTPS'te yayınlayın (GitHub Pages, Notion public veya kendi alan adınız). Metin `texts.ts` ile aynı olmalı. | Kullanıcı (+ kod: config doldurma) |
| 2 | 2.1 Yer tutucu içerik | ❌ | #1 ile aynı. Uygulamanın geri kalanında yer tutucu yok: `grep lorem\|TODO\|coming soon` sonucu temiz. | **Kritik** | #1 kapanınca kapanır. | Kullanıcı |
| 3 | 2.1 Demo hesap / canlı backend | ✅ (hesaplar kapalıysa) · ⚠️ (açıksa) | Supabase değişkenleri yokken `unconfiguredService.configured=false` (`supabaseService.ts:198`). `afterOnboarding` doğrudan uygulamaya geçiyor (`flow.ts:46-47`). `AccountSection` Hesap bölümünü gizliyor (`AccountSection.tsx:20`). Tanıtım 3. sayfa yerel metni kullanıyor (`screens.tsx:73`, `ob.3.bodyLocal`). İnceleyici ölü özelliğe denk gelmez. | Düşük / Yüksek | v1.0 üretim derlemesinde EAS `production` ortamında `EXPO_PUBLIC_SUPABASE_*` **olmasın**. Kontrol: `npx eas-cli env:list --environment production`. Açılacaksa demo hesap verin, backend'i inceleme süresince açık tutun. | Kullanıcı |
| 4 | 2.5.2 / OTA (EAS Update) | ⚠️ | `app.json` içinde `updates.url`, `runtimeVersion.policy=appVersion` ve `eas.json` production `channel: "production"` var. README yayını `--branch main` ile anlatıyor. | Orta | 1) Hesap özelliğini **OTA ile açmayın**. EXPO_PUBLIC değişkenleri pakete gömülüyor; bunu OTA ile değiştirmek "gizli özelliği açma" sayılır (Expo makalesi, 2.5.2). Yeni derleme ve yeni inceleme gerekir. 2) Üretim güncellemeleri `--channel production` (ya da production'a bağlı dal) ile yayınlanmalı; `main` dalına atılanlar mağaza derlemesine gitmez. 3) OTA yalnızca hata düzeltme ve metin değişikliği için kullanılmalı. | Kullanıcı |
| 5 | 4.8 Login Services | ✅ | Google girişi olduğunda Apple ile giriş de var ve önce gösteriliyor (`screens.tsx:118-131`). iOS'ta resmi `AppleAuthenticationButton` kullanılıyor (HIG uyumlu). `usesAppleSignIn: true`; prebuild entitlement'ı `com.apple.developer.applesignin` üretiyor. | Düşük | Hesaplar kapalıysa konu dışı. | — |
| 6 | 5.1.1(v) Hesap isteğe bağlı ve uygulama içi silme | ✅ | Hesap açmadan devam: `btn-guest` (`screens.tsx:144`). Silme: Ayarlar → Hesap → Hesabı sil, yeniden doğrulama ve Apple iptali (`AccountSection.tsx:46-63`, `supabase/functions/delete-account`). QA dokümanı gerçek Apple iptalinin cihazda test edilmediğini yazıyor (`docs/QA-MODULE-1.md:57`). | Düşük (kapalıysa) / Orta (açıksa) | Açılırsa TestFlight'ta gerçek Apple hesabıyla silme ve iptal uçtan uca denenmeli. | Kullanıcı |
| 7 | 5.1.1 / 5.1.2 Veri toplama ve beyan tutarlılığı | ⚠️ | Harcama verisi yalnızca cihazda (`store.ts:9`, AsyncStorage). Ağ çağrıları: kur API'leri (`currency.ts:77,82`), EAS Update. Analitik, reklam ve izleme yok (`package.json`). `expo-eas-client` cihaz başına rastgele ID gönderiyor. | **Yüksek** (yanlış beyan) | App Privacy'de **Identifiers → Device ID** (App Functionality, kullanıcıya bağlı değil, izleme yok) beyan edin. Gizlilik metnine "EAS Update kurulum başına rastgele bir tanımlayıcı kullanır" cümlesini ekleyin. Hesaplar açılırsa e-posta, ad ve User ID de beyan edilmeli (bkz. §4). | Kullanıcı + kod (metin) |
| 8 | 5.1.1 Yasal metin dilleri | ⚠️ | ES, IT ve ZH için İngilizce metin ve uyarı gösteriliyor (`texts.ts:118`, `legalSheet.tsx:24`). | Düşük (Apple) / Orta (AB) | Apple için yeterli. GDPR şeffaflığı için ES ve IT çevirisi önerilir. | Kullanıcı |
| 9 | Info.plist amaç metinleri | ✅ / ⚠️ | Prebuild çıktısında `NSFaceIDUsageDescription` = "Allow Monibo to use Face ID to unlock your data." var. Kamera, fotoğraf ve konum anahtarı yok, gerek de yok: DocumentPicker ve paylaşım sayfası (share sheet) amaç metni istemiyor; yerel bildirim Info.plist anahtarı istemiyor. Face ID metni yalnızca İngilizce. | Düşük | `app.json` içinde `locales` ile TR, ES, IT ve ZH için `NSFaceIDUsageDescription` ekleyin. İsteğe bağlı ama TR kullanıcıya İngilizce sistem uyarısı çıkıyor. | Kod |
| 10 | Face ID izin zamanlaması | ✅ | Yalnızca kullanıcı kilidi açarken soruluyor (`App.tsx:418-421`). Açılışta sorulmuyor. | Düşük | — | — |
| 11 | Bildirim izni zamanlaması | ✅ | Açılışta sorulmuyor. İlk abonelik kaydında (`App.tsx:394-398`) ya da anahtar açılınca (`App.tsx:426-430`) soruluyor. Reddedilince Ayarlar'a yönlendiriliyor (`App.tsx:434-436`). | Düşük | — | — |
| 12 | Push entitlement (kullanılmıyor) | ⚠️ | `expo-notifications` otomatik eklentisi `enableRemoteNotifications=true` varsayılanıyla `aps-environment` ekliyor. Prebuild `Monibo.entitlements` içinde `aps-environment: development` görüldü. Uygulama yalnızca yerel bildirim kullanıyor. | Düşük | Ret sebebi değil. Temiz olsun derseniz `["expo-notifications", {"enableRemoteNotifications": false}]` ekleyin. Gereksiz Push yeteneği ve sertifika işi ortadan kalkar. | Kod |
| 13 | Şifreleme ihracatı | ✅ | `ITSAppUsesNonExemptEncryption: false` (`app.json:17`, prebuild Info.plist'te var). Yalnızca HTTPS, Keychain (`secureStorage.ts`) ve kimlik doğrulama nonce'u için SHA-256 (`supabaseService.ts:69-72`) kullanılıyor; hepsi muaf kapsamda. | Düşük | ASC her derlemede soru sormaz. | — |
| 14 | Bundle ID, sürüm, build | ✅ | `com.karabag.harcamadefteri.global`, `version 1.0.0`. `eas.json`: `appVersionSource: remote`, production `autoIncrement: true`. Prebuild: `CFBundleShortVersionString 1.0.0`, `CFBundleVersion 1`; uzaktaki sayaç EAS tarafından artırılıyor. | Düşük | Her mağaza sürümünde `app.json` `version` değerini elle artırın. `appVersion` politikası runtime'ı da değiştirir. | Kullanıcı |
| 15 | Uygulama ikonu ve splash | ✅ | `assets/icon.png` 1024×1024, RGB (alfa yok); `file` ve PIL ile doğrulandı. Expo şablonu değil (`check:release` md5 kontrolü geçti). Splash: aynı görsel, `#0B0D0F` zemin, açık ve koyu. | Düşük | **Not:** README "safir-mor gradyan kese" diyor ama gerçek ikon altın "M". README güncel değil. Katlanmış şerit "M" biçimi Gmail logosunu andırabilir (renkler farklı). 4.1 ve 5.2.1 riski düşük ama farkında olun. | Kullanıcı (marka) |
| 16 | SDK / Xcode | ✅ / ⚠️ | Expo SDK 58, RN 0.88, deployment target 16.4 (prebuild); iOS 13 alt sınırını sağlıyor. Xcode 26 ve iOS 26 SDK zorunlu; EAS SDK 58 imajı bunu karşılamalı. `expo-doctor`: 13 paket yama ve küçük sürüm gerisinde, `react-native-safe-area-context` ~5.11.1 bekleniyor (5.10.1 kurulu). | Orta | Derlemeden önce `npx expo install --check` ile hizalayın ve testleri yeniden çalıştırın. EAS derleme günlüğünde Xcode sürümünü doğrulayın. | Kod |
| 17 | Privacy manifest (required-reason API) | ⚠️ | Modül manifestleri var: AsyncStorage (FileTimestamp C617.1), expo-file-system (0A2A.1, 3B52.1, DiskSpace E174.1/85F4.1), expo-constants, expo-notifications ve expo-eas-client (UserDefaults CA92.1), RN (C617.1, CA92.1, SystemBootTime 35F9.1). Prebuild uygulama düzeyinde `PrivacyInfo.xcprivacy` **üretmedi**, çünkü `ios.privacyManifests` yok. Expo, Apple'ın statik pod manifestlerini her zaman okuyamayabileceğini belirtiyor. | Orta | `app.json` → `ios.privacyManifests.NSPrivacyAccessedAPITypes`: UserDefaults [CA92.1], FileTimestamp [C617.1, 0A2A.1, 3B52.1], DiskSpace [E174.1, 85F4.1], SystemBootTime [35F9.1]. `NSPrivacyTracking: false` ve boş `NSPrivacyTrackingDomains` ekleyin. Ya da ilk yüklemeden sonra Apple'ın ITMS-91053 e-postasını bekleyip eksikleri ekleyin. | Kod |
| 18 | supportsTablet:false / iPad | ✅ / ⚠️ | `TARGETED_DEVICE_FAMILY = "1"`. iPad'de iPhone uyumluluk penceresinde çalışır; inceleyiciler iPhone uygulamalarını iPad'de de açabilir (2.4.1). Arayüz 320 px'e kadar test edilmiş (README). `UISupportedInterfaceOrientations` Portrait ve PortraitUpsideDown. | Düşük | TestFlight'ta bir iPad'de (uyumluluk modu) açılış, tanıtım, form ve paylaşım sayfasını deneyin. iPad ekran görüntüsü gerekmez. | Kullanıcı |
| 19 | 4.0 Tasarım: açılış animasyonu | ⚠️ | `intro.tsx`: 150 + max(1450, 1050+1000) + 420 + 520 ms ≈ **3,14 sn**, her soğuk açılışta (`App.tsx:51`, web dışında). Katman `pointerEvents="none"`: animasyon sürerken alttaki tanıtım ve uygulama dokunuş alıyor, yani kullanıcı görmeden bir düğmeye basabilir. Hareketi azalt açıksa 250 ms. | Orta (UX) / Düşük (ret) | Doğrudan ret sebebi değil. Apple HIG açılışın hızlı olmasını ve marka gösterisi için bekletilmemeyi öneriyor. Öneri: tam animasyon yalnızca ilk açılışta, sonrakilerde ≤ 0,8 sn ya da yok; animasyon sırasında dokunuşu engelleyin. | Kod |
| 20 | 4.2 Minimum işlev | ✅ | Gerçek yerel uygulama: harcama, gelir, bütçe, kategori limitleri, abonelik hatırlatma, raporlar, Excel, yedek, Face ID kilidi, 5 dil ve 5 para birimi. Web sarmalayıcı değil. | Düşük | Ekran görüntülerinde bu derinliği gösterin. | Kullanıcı |
| 21 | 2.3 Doğru metadata / ilk açılış deneyimi | ⚠️ | Yeni kurulumda **para birimi her dilde TRY** (`store.ts:14,148`; yalnızca dil cihazdan geliyor). ABD'deki İngilizce inceleyici ilk ekranda "₺" görür. Ekran görüntüleri $ ile hazırlanırsa uyuşmazlık olur. Boş durumlar ve yüklenme iskeleti var (README). | Orta | Varsayılan para birimini dilden ya da bölgeden türetin (en-US → USD, es/it → EUR, zh → CNY, tr → TRY). Ya da tanıtımda para birimi seçtirin. Ekran görüntülerini gerçek uygulamadan alın. | Kod |
| 22 | Kur verisi beyanı ve atıf | ✅ / ⚠️ | Kaynak ve kur tarihi Ayarlar'da görünüyor (`sheets.tsx:686`). Koşullar "bilgi amaçlıdır" diyor (`texts.ts`). ExchangeRate-API açık uç noktası **atıf istiyor** (arama özeti); şu an yalnızca ad yazılıyor, bağlantı yok. | Düşük | Ayarlar'daki kur satırına "Rates by Exchange Rate API" bağlantısını ekleyin. ASC "Content Rights" sorusunda üçüncü taraf veri kullanıldığını ve iznin bulunduğunu belirtin. | Kod + kullanıcı |
| 23 | 2.3.7 / 5.2.1 Ad benzersizliği ve marka | ⚠️ | App Store aramasında tam "Monibo" bulunmadı. Benzerler: **Monabo** (abonelik takipçisi, işlevi çok yakın), **Monibex** (bütçe), **Monibyte** (fintech). Önceki denetim "MonBo" ve "Moniboi" adlarını da not etmiş. | Orta | ASC adı tam eşleşme ister; şimdi rezerve edin ("Monibo: Harcama & Bütçe" gibi, ≤30 karakter). TÜRKPATENT, EUIPO ve USPTO'da 9, 36 ve 42. sınıf taraması yapın. | Kullanıcı |
| 24 | Metadata yerelleştirme | ⚠️ | Uygulama 5 dilde (`src/i18n/*`). ASC metadata henüz yok. `CFBundleDisplayName` her dilde "Monibo" (sorun değil). | Düşük | ASC'de TR, EN-US, ES-ES, IT ve ZH-Hans için ad, alt başlık, açıklama, anahtar kelime ve ekran görüntüsü girin. ZH-Hans girilebilir ama Çin anakarası mağazası kapalı olmalı (#25). | Kullanıcı |
| 25 | Çin anakarası (ICP) | ⚠️ | Uygulama 简体中文 destekliyor. Çin anakarası için ICP dosya numarası gerekir (Apple yardım sayfası ve forumlar). | Yüksek (o bölgede) | Pricing and Availability'de China mainland'ı kaldırın. Tayvan, Hong Kong, Singapur gibi bölgeler etkilenmez. | Kullanıcı |
| 26 | AB DSA trader | ⚠️ | Beyan verilmezse AB'de yayın yapılamaz (17 Şubat 2025). | Orta | Ücretsiz, reklamsız ve kişisel bir projeyse "trader değilim" denebilir. Gelecekte gelir hedefi varsa "trader" seçilir; o zaman adres, telefon ve e-posta AB sayfasında görünür. Hukuki karar sizin. | Kullanıcı |
| 27 | 3.x İş modeli | ✅ | IAP, abonelik ve reklam yok. Koşullarda "Ücretli özellikler sunulursa…" maddesi var. | Düşük | Ücretli özellik eklenirse 3.1.1 (IAP) şart. | — |
| 28 | 1.x Güvenlik / 3.2.1(viii) | ✅ | Kullanıcı içeriği paylaşımı yok, para hareketi yok, banka entegrasyonu yok. | Düşük | Metadata'da "money management service", "yatırım", "banka" demeyin; "kişisel harcama defteri, bütçe planlayıcı" deyin. | Kullanıcı |
| 29 | Kalite / çökme (2.1) | ✅ / ⚠️ | `npm test`: tip ve çeviri 0 hata (26 uyarının hepsi bilinçli olarak aynı kalan metinler: "Monibo", "Euro" vb.). core 705, currency 862, theme 6376, dashboard 125, auth 101, functions 42; **0 başarısız**. Gerçek cihaz ve EAS derlemesi henüz yok. | Orta | TestFlight'ta en az 1 iPhone (ve 1 iPad uyumluluk modu) üzerinde tam tur: çevrimdışı açılış, kur hatası, Excel ve yedek paylaşımı, geri yükleme, kilit, bildirim. | Kullanıcı |
| 30 | Hesaba bağlı veri silme (yerel) | ✅ / ⚠️ | Yerel kullanıcı için "tüm verileri sil" düğmesi yok (`wipe.ts` yalnızca hesap silmede çağrılıyor). Kural gereği değil (hesap yoksa 5.1.1(v) uygulanmaz). | Düşük | İsteğe bağlı: Ayarlar'a "Tüm verileri sil" ve "Destek / İletişim" satırı ekleyin (1.5 Developer Information). | Kod |
| 31 | Çocuklar / yaş | ✅ | Gizlilik metni "16 yaş altına yönelik değil" diyor. İçerik 4+ düzeyinde. | Düşük | Yaş anketinde her şeye "Hayır/None" → 4+. "Made for Kids" seçmeyin. | Kullanıcı |
| 32 | `harcama://` şeması ve geliştirme bağlantıları | ✅ | `launchMode` `channel-name=` parametrelerini yalnızca Expo Go bağlantıları için okuyor (`App.tsx:112-118`); üretimde zararsız. | Düşük | — | — |

---

## 4) App Store Connect'te doldurulacaklar

### 4.1 App Information
- **Ad:** "Monibo", ya da benzersiz ve açıklayıcı bir ad: "Monibo: Harcama & Bütçe" / EN "Monibo: Expense & Budget" (≤30 karakter).
- **Alt başlık** (≤30): "Harcama defteri, bütçe, abonelik" / "Expense log, budgets & bills".
- **Kategori:** Finance (birincil), Productivity (ikincil, isteğe bağlı).
- **Bundle ID:** `com.karabag.harcamadefteri.global`. Apple Developer → Identifiers bölümünde EAS ilk derlemede otomatik oluşturabilir.
- **SKU:** `monibo-ios-001`.
- **Privacy Policy URL:** `LEGAL.privacyUrl` ile aynı HTTPS adresi. **Support URL:** iletişim e-postası olan bir sayfa.
- **Copyright:** "2026 [Ad Soyad / Şirket]".
- **Content Rights:** Üçüncü taraf içerik: döviz kuru verisi (ECB ve Frankfurter, ExchangeRate-API). Kullanım hakkınız var → "Yes, … has necessary rights".
- **DSA trader:** #26'ya göre.

### 4.2 App Privacy

**A) Önerilen v1.0 (hesaplar KAPALI)**

"Do you or your third-party partners collect data from this app?" → **Yes**, yalnızca şu kalem için:

| Veri türü | Kullanım amacı | Kullanıcıya bağlı mı | İzleme (tracking) |
|---|---|---|---|
| Identifiers → **Device ID** (EAS Update istemci kimliği, kurulum başına rastgele) | App Functionality | **Hayır** | **Hayır** |

Ayrıntılar:
- Expo'nun beyan sayfası EAS Update hata kurtarma nedeniyle ek bir "Diagnostics" kalemi listeliyorsa onu da ekleyin. Sayfa bu oturumdan okunamadı: https://docs.expo.dev/eas-update/store-privacy-declarations/
- **Financial Info, Purchases, Contacts, User Content: toplanmıyor.** Harcama verisi cihazda kalıyor; Apple tanımına göre yalnızca cihazda işlenen veri "collect" sayılmaz.
- Kur API'lerine giden istekte IP adresi saklanmıyor. Apple'ın istisnası ("IP address … sent on a server call and not retained") gereği beyan gerekmez. Bu istekler sizin sunucunuza da gitmiyor.
- Tracking: **No**. ATT istemi gerekmez.

**B) Hesaplar AÇIK sürüm (gelecekte, ayrı inceleme)**

Yukarıdakine ek olarak:

| Veri türü | Amaç | Bağlı | İzleme |
|---|---|---|---|
| Contact Info → Email Address | App Functionality | Evet | Hayır |
| Contact Info → Name (isteğe bağlı) | App Functionality | Evet | Hayır |
| Identifiers → User ID (Supabase hesap kimliği) | App Functionality | Evet | Hayır |

### 4.3 Yaş derecelendirmesi (yeni anket, 2026)
- Şiddet, cinsellik, küfür, korku, uyuşturucu, kumar, yarışma: **None**.
- Tıbbi / sağlıklı yaşam konuları: **No**.
- Kullanıcı tarafından oluşturulan içerik veya sohbet: **No**.
- Sınırsız web erişimi: **No**. `expo-web-browser` yalnızca Google OAuth için açılıyor, hesaplar kapalıysa hiç açılmıyor.
- Reklam: **No**. Ebeveyn denetimi veya yaş doğrulama: **No**. AI asistanı: **No**.
- **Beklenen sonuç: 4+**. "Made for Kids" seçilmemeli.

### 4.4 Şifreleme (Export Compliance)
- `ITSAppUsesNonExemptEncryption=false` derlemede var → ASC soru sormaz. Sorarsa: "No, only exempt encryption (HTTPS/OS)".

### 4.5 Fiyat ve bölgeler
- Free.
- Bölgeler: tümü **eksi China mainland** (ICP gerekir).

### 4.6 Ekran görüntüleri
- iPhone için en az bir set yeterli: **6,9"** (1320×2868, 1290×2796 veya 1260×2736; dikey) ya da 6,5" (1284×2778 / 1242×2688). Eksik boyutları ASC ölçekler.
- iPad gerekmez (`supportsTablet:false`).
- 3–6 kare önerisi: Ana panel, Harcama ekle, Raporlar, Bütçe/limitler, Abonelik hatırlatma, Face ID kilidi ve çok dilli/çok para birimli kullanım.
- Her dil için o dilin para birimiyle çekin (#21 düzeltilmeden çekilirse yeni kurulum ₺ gösterir).
- Görsellerde alfa kanalı olmasın. 4+ uygun olsun (2.3.8). Gerçek uygulamayı göstersin.

### 4.7 İnceleme notları (App Review Information → Notes) taslağı (İngilizce)
```
Monibo is a personal expense log and budget planner. All expense, income, budget and
subscription data is stored ONLY on the device (AsyncStorage); nothing is uploaded.

- No sign-in is required. This version has no user accounts, so no demo account is needed.
- No bank connection, no money movement, no payments, no investment or financial advice
  (guideline 3.2.1(viii) does not apply). No ads, no analytics, no tracking.
- Network use: (1) exchange rates from Frankfurter (ECB reference rates) and ExchangeRate-API,
  shown with source and date in Settings > Exchange rates; (2) Expo EAS Update for bug-fix updates.
- Permissions are requested only in context: notifications when the user saves the first
  subscription or turns on reminders; Face ID only when the user enables App Lock in Settings.
- To test: complete or skip the 3-page intro, tap "+" to add an expense, add a subscription
  (triggers the notification prompt), Settings > Language/Currency to switch among
  TR/EN/ES/IT/ZH and TRY/USD/EUR/GBP/CNY, Settings > Export to Excel / Backup.
- Privacy Policy and Terms: Settings > Legal (also at <privacyUrl>).
```

**Hesaplar açılırsa** notlara şunlar eklenir:
- "Demo account: reviewer@… / password", e-postası doğrulanmış olmalı.
- "Sign in with Apple and Google are offered; account is optional ('Continue without an account')."
- "Account deletion: Settings > Account > Delete account (re-authentication; Apple token is revoked server-side)."

Ayrıca **Sign-In Information**: hesaplar kapalıysa "Sign-in required" işaretini **kaldırın**.

### 4.8 Contact
- Ad, telefon ve e-posta: App Review sizi bu bilgilerle arar.

---

## 5) Gönderim adımları (EAS)

**0. Önce kod ve yapılandırma**
- `src/legal/config.ts` alanlarını doldurun. Sayfaları yayınlayın. `npm run check:release` "Engel yok" vermeli.
- Önerilenler: `npx expo install --check`, `ios.privacyManifests`, `expo-notifications` remote kapatma, para birimi varsayılanı, açılış animasyonunun kısaltılması, Face ID metni yerelleştirme. Ardından `npm test`.

**1. Ortam kontrolü**
```bash
npx eas-cli@latest login
npx eas-cli@latest env:list --environment production
```
Hesaplar kapalı yayınlanacaksa `EXPO_PUBLIC_SUPABASE_*` burada **olmamalı**. `EXPO_PUBLIC_AUTH_MOCK` asla olmamalı.

**2. ASC'de uygulama kaydı**
- App Store Connect → Apps → "+" → New App: iOS, ad, birincil dil, bundle ID, SKU.
- Alternatif: `eas submit` ilk seferde ASC kaydını oluşturabilir.

**3. Üretim derlemesi**
```bash
npx eas-cli@latest build --platform ios --profile production
```
- EAS imzalama kimliklerini ve App ID yeteneklerini (Sign in with Apple, gerekirse Push) Apple hesabınızla eşitler; Apple ID ile giriş ister.
- `autoIncrement` buildNumber'ı uzaktan artırır.
- Günlükte Xcode 26 veya üzerinin kullanıldığını doğrulayın.

**4. Gönderim (TestFlight'a yükleme)**
```bash
npx eas-cli@latest submit --platform ios --profile production --latest
```
- İsteğe bağlı: `eas.json` → `submit.production.ios.ascAppId` değerini ekleyin.
- App Store Connect API anahtarıyla etkileşimsiz de çalışır.

**5. TestFlight**
- İşleme 10–30 dk sürer. Uyarı e-postalarını kontrol edin (ITMS-91053 gibi). Varsa `privacyManifests` ekleyip yeniden derleyin.
- Dahili test (en fazla 100 kişi, inceleme yok): gerçek iPhone'da tam tur, ayrıca iPad uyumluluk modu.
- Harici test isterseniz Beta App Review gerekir (kısa sürer).

**6. Mağaza sürümü**
- ASC → App Store → 1.0 Prepare for Submission.
- Derlemeyi seçin. Metadata, ekran görüntüleri, App Privacy, yaş derecelendirmesi, fiyat ve bölge, inceleme notları ve DSA'yı doldurun.
- "Manually release" seçin, sonra Submit for Review.

**7. Sonrası**
- OTA düzeltmeleri yalnızca `production` kanalına gönderin:
  ```bash
  npx eas-cli@latest update --channel production --environment production --message "..."
  ```
  JS ve metin düzeltmesi için kullanın; yeni özellik veya hesap açma için kullanmayın.
- Her mağaza sürümünde `app.json` `version` değerini artırın.
- Ret gelirse Resolution Center'da kısa ve kanıtlı yanıt verin: ne değişti, nerede görülür.

---

### Önceki denetimle karşılaştırma (doğrulandı)
- **Kapandı:**
  - Şablon ikon ve splash (md5 kontrolü geçiyor; 1024 RGB).
  - `eas.json` ve `ITSAppUsesNonExemptEncryption`.
  - Bildirim izni akışı.
  - Resmi Apple düğmesi.
  - Uygulama kilidi.
- **Hâlâ açık:**
  - Yasal `REPLACE_ME` alanları (F-03).
  - Yasal metinlerin ES ve IT çevirisi (F-27).
  - Gerçek cihaz testleri.
  - `expo-doctor` sürüm farkları.
- **Bu incelemede yeni bulunan:**
  - EAS Device ID beyanı.
  - Uygulama düzeyinde privacy manifest yok.
  - Kullanılmayan `aps-environment`.
  - TRY varsayılanı.
  - 3,1 sn ve dokunuşu geçiren açılış animasyonu.
  - Çin ICP / bölge seçimi.
  - ER-API atfı.
  - Monabo ad benzerliği.
  - OTA ile hesap açmama uyarısı.
