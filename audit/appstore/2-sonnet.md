# Monibo — App Store gönderim ön incelemesi (bağımsız, Sonnet)

Repo: harcama-defteri-eng-tr-esp-ita, commit e49ea87. Salt-okunur inceleme; hiçbir dosya değiştirilmedi.
Tarih: 2026-11-08. Not: docs.expo.dev bu oturumun ağ izninde değildi (WebFetch ENOTFOUND); Expo bilgisi web aramasından ve repodaki README/eas.json'dan alındı, "doğrulanmadı" diye işaretlendi.

## 1) Kısa sonuç

**NO-GO (bugün için). Hazırlık: ~%70.**
Kod tarafı beklenenden iyi: hesap silme + Apple token iptali, Apple ile giriş, misafir modu, Face ID metni, şifreleme bayrağı, simge (1024, alfa yok), ayrı EAS kanalı hazır. Ret/engel nedenleri neredeyse tamamen "içerik/hesap/mağaza kaydı" tarafında:

1. **7 adet `REPLACE_ME`** (`src/legal/config.ts:11-20`) → `npm run check:release` 7 HATA veriyor. Gizlilik Politikası URL'si App Store Connect'te zorunlu (5.1.1(i)), ve uygulama içi yasal metinlere `REPLACE_ME` kelimesi **görünür biçimde** basılıyor (texts.ts `{controller}/{email}/{region}/{law}` yer tutucuları bu değerlerle doldurulur) → 2.1(a) "placeholder text".
2. Supabase ortam değişkenleri yoksa hesap özellikleri kapalı kalır (doğru çalışıyor); açılırsa Apple/Google/e-posta giriş + silme akışının **gerçek cihazda ve gerçek Apple ID ile** hiç doğrulanmadığı `docs/QA-MODULE-1.md`'de yazıyor.
3. Hukuk metinleri taslak (docs/QA-MODULE-1.md:67), yalnızca TR/EN; bir hukukçu okumalı.
4. Ad "Monibo": App Store Connect'te ad müsait mi, benzerlik (MonBo) riski — ancak kayıt oluşturulunca kesinleşir.
5. Mağaza tarafı henüz yok: gizlilik URL'si, destek URL'si, ekran görüntüleri, App Privacy cevapları, yaş derecelendirme, AB satıcı (DSA trader) beyanı, inceleme notları.

Hesap-kapalı (yerel) sürüm çıkarmak en kısa yol: Supabase olmadan gönderirseniz 4.8 / 5.1.1(v) / demo hesap konuları **hiç devreye girmez**; yine de 1., 3. ve 5. madde gerekir. Sonra hesap özelliğini 1.1 güncellemesiyle açabilirsiniz (ama Apple "yeni işlev" için yeni inceleme ister; OTA ile açmayın, bkz. 2.5.2).

## 2) Kaynaklar

Resmî (doğrudan okundu):
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/ (1.5, 2.1, 2.3.x, 2.5.2, 3.1.1, 3.2.1(viii), 4.1, 4.2, 4.8, 5.1.1, 5.1.2 metinleri okundu; sayfa tarihi yok)
- SDK / yükleme gereksinimleri: https://developer.apple.com/news/upcoming-requirements/ — 28 Nis 2026'dan beri Xcode 26 + iOS 26 SDK şart; 9 Eyl 2026'dan beri minimum iOS 13 hedefi; 31 Oca 2026 yeni yaş derecelendirme soruları; 17 Şub 2025 AB DSA trader durumu (doğrulanmayan uygulamalar AB mağazasından kalkar); 1 May 2024 privacy manifest "required reason" API beyanı.
- Hesap silme: https://developer.apple.com/support/offering-account-deletion-in-your-app/ — uygulama içi başlatılmalı, yalnızca "devre dışı bırakma" yetmez, Sign in with Apple için REST API ile token iptali, destek hattı/e-posta ile silme kabul edilmez (düzenlenmiş sektörler hariç).
- Privacy manifest: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files (sayfa içeriği alınamadı; ayrıntılar Apple haberleriyle teyitli)
- Yaş derecelendirme: https://developer.apple.com/news/?id=ks775ehf (4+/9+/13+/16+/18+; 12+ ve 17+ kalktı)
- Expo: https://docs.expo.dev/submit/ios (arama sonucu; erişilemedi), https://docs.expo.dev/guides/apple-privacy (erişilemedi), https://expo.dev/blog/app-store-connect-minimum-sdk-26.md, https://expo.dev/articles/shipping-to-the-app-stores/app-store-rejection-reasons, https://expo.dev/articles/updates-and-rollouts/over-the-air-updates (OTA yalnızca JS+asset, 2.5.2 sınırı içinde), https://forums.expo.dev/t/expo-and-apple-store-guideline-2-5-2/20259
- Ret nedenleri (ikincil): RevenueCat https://www.revenuecat.com/blog/growth/the-ultimate-guide-to-app-store-rejections/ ve https://www.revenuecat.com/blog/engineering/how-to-avoid-app-store-rejections.md ; Choicely https://www.choicely.com/tutorials/app-store-rejection-reasons ; MobiLoud https://www.mobiloud.com/blog/avoid-app-rejected-apple. Not: "%40+ ret 2.1" iddiası satıcı bloglarından, Apple rakamı değil. "Gizlilik URL'si 404 = otomatik ret" iddiası doğrulanamadı.
- Apple forumları: 5.1.1(v) https://developer.apple.com/forums/thread/765160 ; 4.8 https://developer.apple.com/forums/thread/765145 ; 2.1 demo giriş sorunları https://developer.apple.com/forums/thread/849775

YouTube (izlenemedi; yalnızca başlık/özet arama sonuçlarından):
- "Apple App Review 2026: New Requirements for New App Submissions" — https://www.youtube.com/watch?v=Ycw_nhy8t9Q — yeni uygulamalarda inceleme ekibi ek bilgi/açıklama istiyor; inceleme notlarını ayrıntılı yazın.
- "App Store Review Guidelines: Avoid These Common Mistakes" — https://www.youtube.com/watch?v=c9HLIGu8TLo — resmî dokümanı gezerek yaygın hatalar (içerik izlenmedi, ayrıntı doğrulanmadı).
- "Apple's New App Review Guidelines: What Developers Need to Know About AI and Data Privacy" — https://www.youtube.com/watch?v=WTXr0m9x2s4 (ve https://www.youtube.com/watch?v=4rQ3RQPXdLs, https://www.youtube.com/watch?v=qeu4QBCMW8U) — 5.1.2(i): kişisel veriyi 3. taraf yapay zekâ dahil paylaşmadan önce açık izin. Monibo'da yapay zekâ servisi yok → ilgisiz ama gizlilik metni dürüst kalmalı.
- Genel: https://www.youtube.com/watch?v=mq9_E8gWVwQ, https://www.youtube.com/watch?v=j4Jidh6EolA (temel kural özeti; düşük değer).
Video içeriği doğrulanmadığı için kararlar videolara değil resmî metne dayanıyor.

## 3) Ret riski tablosu

Risk: Y=yüksek, O=orta, D=düşük. Kim: S=siz (hesap/hukuk/içerik), K=kod (Claude), E=EAS/komut.

| # | Kural | Durum | Kanıt | Risk | Çözüm | Kim |
|---|---|---|---|---|---|---|
| 1 | 2.1(a) yer tutucu / 5.1.1(i) gizlilik URL | ❌ | `src/legal/config.ts:11-20` 7×REPLACE_ME; `npm run check:release` → "7 engel"; yasal metin `texts.ts:17` değerleri metne basar | **Y** | Gerçek şirket/kişi adı, e-posta, https gizlilik+koşullar+silme sayfası, veri bölgesi, hukuk; sayfaları yayınla; metin uygulamayla aynı olsun | S + K |
| 2 | 5.1.1(i) gizlilik metni içeriği | ⚠️ | texts.ts: toplanan veri, kur servisleri, EAS Update, saklama/silme, haklar anlatılmış; hukukçu onaysız taslak, yalnız TR/EN (es/it/zh'de uyarı) | O | Hukukçu/KVKK-GDPR kontrolü; web sayfası en az EN | S |
| 3 | 5.1.1(v) hesap silme | ✅ (hesap açıksa) | `AccountSection.tsx:28` acct-delete → `supabaseService.ts:185` `delete-account` fonksiyonu; `handlers.ts:37-43` Apple token iptali (`revokeToken`) | D | Gerçek cihazda Apple/Google/e-posta ile uçtan uca dene; Apple secret'ları fonksiyonda tanımlı olsun | S + E |
| 4 | 5.1.1(v) / hesap UI gizleme | ✅ | `AccountSection.tsx:20` yalnız `service.configured` iken hesap bölümü; `Gate.tsx:52` `accountsEnabled`; `AccountProvider.tsx:97` yapılandırılmamışsa misafir; `config.ts` boş env → kapalı | D | Supabase'siz derlemede hesap UI yok; "Yasal" bölümü yine de görünür | — |
| 5 | 4.8 giriş hizmetleri | ✅ | `screens.tsx:120-137` Apple resmî düğme + Google; `app.json` `usesAppleSignIn:true`; introspect: `com.apple.developer.applesignin` var; e-posta girişi de var | D | Apple Developer'da App ID'de Sign in with Apple etkin olmalı (EAS otomatik açar); Apple düğmesi Google'dan aşağıda/küçük olmamalı (şu an önde) | E |
| 6 | 5.1.1(v) "hesap şart değil" | ✅ | misafir mod (`AccountProvider.tsx:97`, `acct.guestTitle`) | D | İnceleme notunda "giriş zorunlu değil" yaz | S |
| 7 | 2.1 demo hesap / canlı backend | ⚠️ | Supabase açılırsa e-posta doğrulama gerekir (`Verify` ekranı); yapılandırma gerçekte doğrulanmamış (`docs/QA-MODULE-1.md`) | **Y** (hesap açıksa) | Doğrulanmış demo hesap + parola notta; Supabase projesi ücretsiz planda **duraklayabilir** (genel bilgi, doğrulayın) → inceleme süresince açık tutun; Apple/Google girişi review'da çalışmalı | S |
| 8 | 2.1 çökme/tamlık | ⚠️ | `npm test` repoda var; ama store derlemesi (Release, gerçek cihaz) denenmedi; iPad uyumluluk modu (supportsTablet:false) incelemeciler tarafından kullanılabilir | O | TestFlight'ta temiz kurulum + eski/yeni iPhone + iPad uyumluluk modunda deneme; çevrimdışı ve uçak modu | S + E |
| 9 | 2.3 meta veri / ekran görüntüleri | ❌ (yok) | Mağaza sayfası henüz yok; `scripts/` ve scratchpad'de ekran görüntüleri üretilebiliyor | O | 6.9" (veya 6.5") iPhone ekran görüntüleri gerçek kullanımı göstersin (2.3.3), ad ≤30 karakter, fiyat/rakip adı yok | S |
| 10 | 2.3.7 / 4.1(c) ad benzersizliği | ⚠️ | `app.json` name "Monibo"; README:100 adın Spendly'den değiştirildiğini söylüyor; MonBo mevcut | O | ASC'de ad rezerve et (kayıt anında çakışma çıkarsa "Monibo: Harcama Takibi" gibi alt başlıklı ad); USPTO/TÜRKPATENT/EUIPO marka araması; ikon/ad MonBo'ya benzer görünmesin (ikon altın "M" şeridi, özgün) | S |
| 11 | 4.2 minimum işlev | ✅ | Harcama, bütçe, abonelik, takvim, Excel/JSON yedek, kilit, bildirim, 5 dil | D | Notta özellik listesi | — |
| 12 | 3.2.1(viii) / 5.1.1(ix) finans uygulaması | ⚠️ | Uygulama manuel harcama defteri; banka bağlantısı, yatırım, kredi yok; Koşullar "finansal tavsiye değildir" (texts.ts) | D–O | Notta "banka/ödeme/yatırım yok, yalnızca kişisel kayıt" yaz; yaş/kategori: Finance veya Productivity; hesap türünü (bireysel/kurum) bilinçli seç | S |
| 13 | 3.1.1 uygulama içi satın alma | ✅ | Ücretli özellik yok (`texts.ts` "ücretli özellikler sunulursa..."); IAP kodu yok | D | "Ücretli özellikler" cümlesini koşullardan çıkar veya bırak; ücretli özellik gelirse IAP şart | K |
| 14 | 5.1.1(ii)/Info.plist amaç metni | ✅ | `app.json` faceIDPermission "Allow Monibo to use Face ID to unlock your data."; introspect NSFaceIDUsageDescription var; başka izin yok (kamera/konum/foto yok; DocumentPicker sistem seçicisi) | D | TR/ES/IT/ZH için `InfoPlist` yerelleştirmesi isteğe bağlı | — |
| 15 | 5.1.2(i) bildirim izni zorunlu mu | ✅ | `notify.ts`: yerel bildirim, izin bağlama göre isteniyor (App.tsx:430-441), reddedilirse uygulama çalışır, ayarlara yönlendirme var | D | — | — |
| 16 | Bildirim yetkisi (aps-environment) | ⚠️ | introspect: `aps-environment: development`; yalnızca yerel bildirim kullanılıyor | D | EAS production profilinde otomatik `production`'a döner; push kullanılmıyorsa sorun değil. Derleme sonrası entitlements'a bak | E |
| 17 | Şifreleme / ihracat uyumu | ✅ | `app.json` `ITSAppUsesNonExemptEncryption:false` (yalnız HTTPS/standart kripto) | D | ASC'de her derlemede soru çıkmaz | — |
| 18 | Privacy manifest (required reason API) | ⚠️ | `app.json`'da `ios.privacyManifests` yok; modüllerin kendi `PrivacyInfo.xcprivacy`'si var (application, constants, eas-client, file-system, notifications, async-storage); secure-store/local-auth/updates için ayrı dosya bulunamadı | D–O | Derlemeden sonra Xcode/ASC e-postasında "ITMS-91053" uyarısı gelirse `ios.privacyManifests` ile ekle; EAS build'e geçince ASC otomatik doğrular | E |
| 19 | App Privacy etiketi | ⚠️ (henüz doldurulmadı) | Hesap kapalı: toplanan veri yok. Hesap açık: e-posta, ad, kullanıcı kimliği. Kur servisleri (frankfurter, open.er-api) yalnız IP görür; harcama verisi gitmez (`currency.ts:77-82`). Expo Updates teknik bilgi alır | O | Cevaplar: aşağıda §4. Gizlilik metniyle birebir tutarlı olsun | S |
| 20 | 5.1.2 izleme (ATT) | ✅ | Reklam/analitik/izleme yok (texts.ts:89); `NSUserTrackingUsageDescription` yok | D | "Tracking: No" | — |
| 21 | 2.5.2 OTA güncelleme | ✅ / ⚠️ | `expo-updates`, `eas.json` production kanalı, `runtimeVersion: appVersion` (`app.json`); OTA yalnız JS+asset | D–O | OTA ile yeni ana özellik/izin ekleme; incelenen amacı değiştirme. Mağaza sürümü eşleşen runtime (1.0.0) için `eas update --branch production` | S |
| 22 | Yayın kanalı | ✅ | `eas.json build.production.channel = "production"`, `autoIncrement: true`, `appVersionSource: remote` | D | `submit.production.ios` boş: ilk `eas submit`'te ascAppId sorulur veya `ascAppId` ekle | E |
| 23 | 4.0 tasarım / açılış animasyonu | ⚠️ | `src/intro.tsx` ~3,2 sn, atlanamaz, her soğuk açılışta (`App.tsx:51` native'de her zaman) ; hareketi azalt desteği var | D (ret değil) / UX O | 3,2 sn Apple için ret nedeni değil ama yorulduran deneyim; ilk açılışta tam, sonrasında ≤1 sn veya dokununca geç | K |
| 24 | İlk açılış (tanıtım) | ✅ | `Gate.tsx` onboarding sadece ilk açılış; hesap yoksa misafir; dil seçimi | D | — | — |
| 25 | İkon / splash | ✅ | `assets/icon.png` 1024×1024 RGB (alfa yok, görsel doğrulandı), şablon değil; splash aynı görsel 200px, zemin #0B0D0F; `check:release` marka görseli kontrolü geçti | D | Splash'te ikonun tüm karesini kullanmak sorun değil; koyu zemin tutarlı | — |
| 26 | iPad: supportsTablet false | ✅ | `app.json ios.supportsTablet:false` → yalnız iPhone; iPad ekran görüntüsü gerekmez | D | iPad'de uyumluluk modunda çökme/taşma kontrolü (#8) | S |
| 27 | Xcode 26 / SDK | ✅ (doğrulanmadı) | EAS Build görüntüsü SDK 58 için Xcode 26+ kullanmalı; yerel doğrulanamadı | D | `eas build` günlüğünde Xcode sürümüne bak; `npx expo-doctor` 13 paket yama sürümü geride (`expo install --fix`) | E |
| 28 | EU DSA trader durumu | ❌ (yapılmadı) | Apple: doğrulanmayan hesaplar AB mağazasından kalkar | O | ASC > Business > Compliance'ta trader / non-trader beyanı; trader ise adres+telefon+e-posta herkese gösterilir | S |
| 29 | 1.5 destek iletişimi / destek URL | ❌ | `contactEmail` REPLACE_ME | Y | Çalışan destek sayfası/e-posta, uygulama içinde de görünür | S |
| 30 | Yaş derecelendirme | ⚠️ | Beklenen sonuç 4+ (şiddet/kumar/kullanıcı içeriği yok); 2026'da yeni sorular zorunlu | D | Hepsine "Hayır"; "kullanıcı oluşturduğu içerik/sosyal" Hayır (yoksa 13+ olur) | S |
| 31 | Yasal bilgi / kaynak kod sızıntısı | ✅ | `check:release` yalnız yasal alan hatası; sahte auth servisi, service_role, JWT sızıntısı yok | D | `EXPO_PUBLIC_AUTH_MOCK` EAS ortamında tanımlı olmasın | E |
| 32 | Veri aktarımı (dışa/içe) | ✅ | Excel/JSON `expo-sharing`, DocumentPicker; kapsayıcı dışı yazma yok | D | — | — |

## 4) App Store Connect'te doldurulacaklar

Önce: Apple Developer üyeliği aktif mi, Agreements/Tax/Banking (ücretsiz uygulama için "Free Apps" sözleşmesi yeterli) kabul edilmiş mi.

**Uygulama kaydı:** Bundle ID `com.karabag.harcamadefteri.global` (EAS ilk derlemede oluşturur), SKU (ör. monibo-ios-1), birincil dil, ad "Monibo" (müsaitlik kontrolü bu adımda), alt başlık (≤30 karakter, rakip/fiyat yok).
**Sürüm 1.0.0:** açıklama (gerçeği yansıtsın: yerel veri, yedek, hesap opsiyonel), anahtar kelimeler, destek URL'si (zorunlu), pazarlama URL'si (opsiyonel), telif hakkı, **gizlilik politikası URL'si (zorunlu, 404 olmasın)**, "What's New", kategori (Finance veya Productivity), 6.9"/6.5" iPhone ekran görüntüleri (2-10 adet, gerçek kullanım).
**Uygulama Gizliliği (App Privacy):**
- Hesap kapalı derleme: "Veri toplamıyoruz" (Data Not Collected). Kur istekleri yalnız IP gösterir, harcama verisi gitmez.
- Hesap açık derleme: E-posta, Ad (isteğe bağlı), Kullanıcı kimliği → "Linked to you", amaç "App Functionality", izleme "Hayır". Expo Updates/EAS teknik bilgi (IP, sürüm) için "Diagnostics/Device ID" gerekip gerekmediğini gizlilik metniyle tutarlı karara bağlayın (belirsiz; muhafazakâr davranın).
- Tracking: Hayır (ATT yok).
**Yaş derecelendirme:** yeni soruların hepsi Hayır → 4+.
**Şifreleme:** `ITSAppUsesNonExemptEncryption=false` zaten Info.plist'te; ASC'de ek soru çıkarsa "yalnız standart/HTTPS, muaf".
**AB/DSA:** trader durumu beyanı (Business bölümü).
**Fiyat/Erişilebilirlik:** Ücretsiz, tüm bölgeler (Türkiye dahil).
**İnceleme bilgileri (App Review Information):** ad, telefon, e-posta; **Sign-in required**: hesap açıksa evet + doğrulanmış demo e-posta/parola; "Giriş zorunlu değil, Misafir olarak devam edilebilir"; notlar: "Manuel harcama defteri, banka/ödeme/yatırım yok. Veri cihazda. Kur servisleri Frankfurter ve ExchangeRate-API (yalnız kur okur). Bildirimler yerel. Hesap silme: Ayarlar > Hesap > Hesabı sil (Apple token iptali dahil). Açılışta animasyon ~3 sn." Backend canlı olduğundan emin olun.
**Sürüm yayın seçeneği:** İnceleme sonrası "manuel yayınla" ile ilk sürümü kontrol edin.

## 5) Gönderim adımları

1. `src/legal/config.ts` doldur (7 alan), gizlilik + koşullar + silme/destek sayfalarını https üzerinde yayınla (GitHub Pages/Notion/kendi alan adın), hukukçu kontrolü.
2. Karar: ilk sürüm hesap kapalı mı açık mı? Açıksa Supabase üretim projesi, Apple/Google OAuth, `delete-account` ve Apple secret'ları, demo hesap; EAS ortamında `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` (`eas env:create`, README:73). Kapalıysa bu env'leri hiç tanımlama.
3. `npm run check:release` → "Engel yok" olmalı; `npm test`; `npx expo install --fix`; `npx expo-doctor`.
4. (İsteğe bağlı UX) açılış animasyonunu ilk açılışa/kısa sürüme indir.
5. ASC'de uygulama kaydını oluştur (ad rezervasyonu). Sertifika/profil: `eas credentials` veya `eas build` istemleri; Apple Developer ile EAS hesabını bağla (2FA).
6. `npx eas-cli@latest build --platform ios --profile production` (Xcode 26+ ve buildNumber otomatik).
7. `npx eas-cli@latest submit --platform ios --profile production` (ASC API anahtarı veya Apple ID; `ascAppId` eklenebilir). TestFlight'ta işlemeyi bekle (ITMS uyarı e-postalarını oku: privacy manifest, SDK).
8. TestFlight iç testi: temiz kurulum, misafir, (hesap varsa) Apple/Google/e-posta giriş, Face ID kilidi, bildirim izni reddi/kabulü, hesap silme, uçak modu, iPad uyumluluk modu.
9. ASC meta verisi, ekran görüntüleri, App Privacy, yaş, DSA, inceleme notları → build'i sürüme ekle → "Submit for Review".
10. Ret gelirse: Resolution Center'da kural numarasını oku, gerekiyorsa yanıtla ya da yeni build; 2.1 için çoğu zaman not + demo hesap yeter.
11. Onaydan sonra OTA yalnız JS düzeltmeleri için (`eas update --branch production`), yeni özelliği yeni mağaza sürümüyle gönder.
