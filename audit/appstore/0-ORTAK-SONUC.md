# Monibo · App Store gönderim denetimi: üç bağımsız incelemenin ortak sonucu

**Tarih:** 8 Kasım 2026 · **İncelenen sürüm:** `e49ea87` (dal `orhan/awesome-clarke-nbqv4i`, PR #2)
**Yöntem:** Opus, Sonnet ve Haiku birbirinden habersiz; her biri Apple'ın güncel kurallarını, ret nedenlerini, Expo gönderim rehberlerini
ve YouTube/makale kaynaklarını kendi aradı, uygulamanın kodunu kendi inceledi. Ayrıntılı raporlar: `1-opus.md`, `2-sonnet.md`, `3-haiku.md`.
Not: YouTube videoları izlenemez; videolar arama yoluyla bulunup başlık/açıklama/özet makaleleriyle kullanıldı. `docs.expo.dev` bu ortamdan
açılmadı; Expo bilgileri arama sonuçlarından alındı ve raporlarda "doğrulanmadı" diye işaretli.

## Karar

| Model | Karar | Hazırlık |
|---|---|---|
| Opus | NO-GO | ~%75 |
| Sonnet | NO-GO | ~%70 |
| Haiku | NO-GO | ~%55 |

**Ortak karar: NO-GO.** Kod tarafı güçlü; engellerin hepsi yasal bilgiler, mağaza kaydı ve birkaç küçük yapılandırma.
Aşağıdaki P0 maddeleri kapanınca gönderilebilir.

## Üç modelin de bulduğu (kesin)

| # | Bulgu | Risk | Kim |
|---|---|---|---|
| 1 | `src/legal/config.ts` 7 alan `REPLACE_ME`; uygulama içi Gizlilik Politikası "REPLACE_ME tarafından sunulur" diye görünüyor (2.1 yer tutucu, 5.1.1(i)) | **Kritik** | Siz (bilgi) + ben (yerleştirme) |
| 2 | Herkese açık **Gizlilik Politikası URL'si** ve **Destek URL'si** yok (App Store Connect zorunlu) | **Kritik** | Siz (yayın yeri) + ben (sayfa taslağı) |
| 3 | "Monibo" adı ancak App Store Connect'te kayıt açılınca kesinleşir; benzer adlar var (MonBo, Moniboi, Monabo) | Yüksek | Siz (hemen rezerve et) |
| 4 | Uygulama düzeyinde privacy manifest (`ios.privacyManifests`) yok; modüllerin kendi manifestleri var, ITMS-91053 uyarısı gelebilir | Orta | Ben |
| 5 | Face ID metni, şifreleme bayrağı (`false`), ikon (1024, alfasız), bundle ID, otomatik build numarası, bağlama göre izinler, takip/reklam/analitik yok | ✅ Uygun | — |

## İki modelin bulduğu

| # | Bulgu | Risk | Kim |
|---|---|---|---|
| 6 | **v1.0'ı hesaplar KAPALI yayınla** (Opus, Sonnet): Supabase değişkenleri yokken giriş ve Hesap bölümü zaten gizli → demo hesap, canlı sunucu, 4.8 ve 5.1.1(v) riskleri yok. Hesaplar sonradan OTA ile açılmamalı (2.5.2), yeni derleme + inceleme gerekir | Öneri | Siz (karar) |
| 7 | Açılış animasyonu her açılışta ~3,2 sn, atlanamaz (Opus, Sonnet); Opus: bu sırada dokunuşlar alttaki ekrana geçiyor | Orta (ret değil, deneyim) | Ben |
| 8 | `expo-doctor`: 13 paket yama sürümü geride (Opus, Sonnet) | Orta | Ben |
| 9 | Xcode 26 / iOS 26 SDK zorunluluğu (28 Nisan 2026'dan beri) EAS derlemesinde doğrulanmalı (Haiku, Opus) | Orta | İlk derlemede |

## Yalnız bir modelin bulduğu (önemli)

| # | Bulgu | Model | Risk | Kim |
|---|---|---|---|---|
| 10 | **App Privacy:** expo-updates cihaz başına istemci kimliği gönderir → **Identifiers → Device ID** (App Functionality, kullanıcıya bağlı değil, izleme yok) beyan edilmeli | Opus | Yüksek | Siz (form) |
| 11 | Yeni kurulumda para birimi her dilde **TRY**; ABD'deki inceleyici ilk ekranda ₺ görür | Opus | Orta | Ben |
| 12 | Prebuild kullanılmayan bir push (`aps-environment`) yetkisi ekliyor (yalnız yerel bildirim var) | Opus | Düşük | Ben |
| 13 | ExchangeRate-API ücretsiz uç noktası atıf bağlantısı istiyor; yalnız adı yazıyor | Opus | Düşük | Ben |
| 14 | Face ID izin metni yalnız İngilizce | Opus | Düşük | Ben |
| 15 | **Çin anakarası** bölge listesinden çıkarılmalı (ICP numarası gerekir); AB için **DSA trader** beyanı | Opus (+Sonnet DSA) | Yüksek | Siz (form) |
| 16 | Finans uygulaması: para hareketi/banka bağlantısı yok → 3.2.1(viii) uygulanmaz; inceleme notunda açıkça yaz, metadata'da "yatırım/banka" ifadelerinden kaçın | Opus | Orta | Siz (metin; taslak hazır) |

## Eylem planı

**Ben yapabilirim (kod, sizden bilgi gerekmez):** #4 privacy manifest · #7 animasyon: ilk açılışta tam, sonrakilerde ~1 sn ve dokunuşları engelle ·
#8 paket yamaları · #11 varsayılan para birimini cihaz bölgesinden seç · #12 push yetkisini kaldır · #13 kur kaynağı atıf bağlantısı ·
#14 Face ID metnini 5 dile çevir · Gizlilik Politikası ve Destek sayfası **taslağı** (web'de yayınlanmaya hazır HTML).

**Sizin yapmanız gereken:**
1. Yasal bilgiler: şirket/kişi adı, iletişim e-postası, veri bölgesi (hesaplar kapalıysa "yok"), uygulanacak hukuk.
2. Gizlilik ve destek sayfalarının yayınlanacağı adres (GitHub Pages ücretsiz ve yeterli; kurulumunu ben hazırlayabilirim).
3. App Store Connect: uygulama kaydı ("Monibo" adını hemen ayırın), App Privacy (#10), yaş derecelendirmesi (4+), bölgeler (Çin hariç), DSA trader beyanı, ekran görüntüleri, inceleme notu (taslak `1-opus.md` §4.7).
4. Karar: v1.0 hesaplar kapalı mı (önerilen)?

**Sonra:** `eas build --platform ios --profile production` → TestFlight'ta gerçek cihaz turu → `eas submit` → incelemeye gönder.

## Durum (9 Kasım 2026)

| # | Madde | Durum |
|---|---|---|
| — | Form sayfalarında üstteki Kaydet/Vazgeç dokunuşa yanıt vermiyordu (görünmez klavye çubuğu üstüne biniyordu) | ✅ Düzeltildi (`096f1e1`) |
| 11 | Varsayılan para birimi cihaz bölgesinden (expo-localization; desteklenmeyen bölgede USD). Tarayıcıda doğrulandı: en-US→$, de-DE→€, tr-TR→₺, en-GB→£, ja-JP→$ | ✅ |
| 8 | 13 paket yama sürümüne (`expo install --check` temiz) | ✅ |
| 12 | `aps-environment` yetkisi `plugins/without-push-entitlement.js` ile çıkarıldı (prebuild ile doğrulandı) | ✅ |
| 13 | Kurlar ExchangeRate-API'den geldiğinde Ayarlar › Döviz kurları altında "Rates By Exchange Rate API" bağlantısı | ✅ |
| 14 | Face ID izin metni 5 dilde (`locales/*.json`; prebuild'de 5 `InfoPlist.strings`). Yan etki: App Store'da uygulama dilleri artık 5 dil olarak listelenir | ✅ |
| 4, 7 | Privacy manifest; açılış animasyonu kısaltma | Bekliyor |
| 1, 2 | Yasal bilgiler, gizlilik/destek URL'leri | Sizden bilgi bekleniyor (`check:release`: 7 engel, hepsi bu) |
