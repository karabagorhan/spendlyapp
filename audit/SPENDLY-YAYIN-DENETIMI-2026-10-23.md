# Spendly: Uçtan Uca Yayın Hazırlık Denetimi

**Tarih:** 23 Ekim 2026 · **İncelenen sürüm:** PR #1 başı `8d4c7a5` (`claude/spendly-dashboard`, Modül 1 hesap dalı `567feab` dahil) · **Uygulama klasörü:** `harcama-defteri-eng-tr-esp-ita/`
**Bu aşamada uygulama koduna dokunulmadı.** Bu klasör yalnızca rapor ve kanıt görüntüleri içerir.

> Dosya/satır referansları aksi belirtilmedikçe `harcama-defteri-eng-tr-esp-ita/` köküne göredir ve PR #1 dalındaki koda aittir. `main` dalında hesap, panel, gelir ve `check:release` **yoktur**; yayın PR #1 birleştirildikten sonra yapılabilir.

---

## 0. Yönetici özeti

| | |
|---|---|
| **Karar** | **NO-GO** (şu an mağazaya gönderilemez) |
| **Genel yayın hazırlığı** | **%57** (ağırlıklı; hesap §7'de) |
| **Kesin yayın engeli (P0)** | 9 adet (ikon/splash şablon görseli, yasal `REPLACE_ME` ×7 ve yayınlanmış gizlilik/silme sayfaları yok, Supabase üretim ortamı kurulmamış, `eas.json`/sürüm numaraları yok, bildirim izni hatası, hiç gerçek cihaz derlemesi yok, Play kapalı test süresi, mağaza beyanları) |
| **Güçlü yanlar** | Yerel-öncelikli ve hesapsız kullanım, 5 dil, kayıt bazlı çoklu para birimi, sağlam RLS ve hesap silme akışı, kapsamlı otomatik testler (2.795 birim + 34 SQL + ~2.000 tarayıcı kontrolü), bakımlı tema/kontrast sistemi |
| **Ana zayıflıklar** | Mağaza varlıkları hazır değil; birkaç veri doğruluğu hatası; rakiplere göre eksik çekirdek özellikler (özel kategori, tekrarlayan işlem, hesap/cüzdan, uygulama kilidi, bulut eşitleme) |
| **En kısa güvenli yol** | 1. hafta P0 düzeltmeleri ve derlemeler → 2. hafta TestFlight ve Play kapalı test → Play kişisel hesapsa 14 günlük kapalı test zorunluluğu nedeniyle **en erken üretim: ~3,5 hafta** |

### Yöntem ve sınırlar
- **Okunan kod:** `App.tsx`, `src/**` (store, lib, currency, useRates, sheets, dashboard, files, excel, notify, i18n, auth/*, legal/*), `supabase/**` (migration, config.toml, Edge Function'lar), `scripts/release-check.ts`, `app.json`, `package.json`, dokümanlar.
- **Çalıştırılanlar (bu ortamda, Node 22, Chromium 1243):** `npm ci`, `npm test`, `npm run test:sql` (gerçek PostgreSQL 16), `npm run check:release`, `npm audit`, `npx expo-doctor`, `expo export --platform web` (normal + sahte hesap servisli), depodaki tüm tarayıcı testleri (tr/en/es/it), kendi yazdığım ekran görüntüsü/uç durum betiği ve performans ölçümü.
- **Uygulama web derlemesiyle Chromium'da (390×844 dokunmatik, 320 px, 1024 px; açık/koyu) çalıştırıldı.** Gerçek iPhone/Android, Expo Go, EAS derlemesi, gerçek Supabase/Apple/Google hesapları **bu ortamda yok**; bunlara bağlı her madde "**Cihazda/canlıda doğrulanmalı**" olarak ayrıca işaretlendi ve puanlanmadı.
- Rakip özellikleri resmi sayfalar ve mağaza listelemeleriyle doğrulandı (kaynaklar §2 sonunda). Rakip uygulamalar bu ortamda kurulup denenemedi.

---

## 1. Ekran bazlı denetim (açılıştan ayarlara)

Kanıt görüntüleri: `audit/ekran-goruntuleri/` (dosya adları tabloda).

| # | Ekran / akış | Doğrulanan durum (kanıt) | Sorunlar |
|---|---|---|---|
| 1 | **Splash screen** | `app.json` içinde `splash` ya da `expo-splash-screen` eklentisi **yok**; `expo-splash-screen` paketi kurulu değil. `assets/splash-icon.png` hiçbir yerde kullanılmıyor ve Expo şablonunun varsayılan görseli (md5 eski `harcama-app` ile aynı). | Açılışta markasız/boş ekran olacak (cihazda doğrulanmalı). Koyu mod splash yok. |
| 2 | **Uygulama ikonu** | `assets/icon.png` = **Expo şablonundaki "A" logosu** (kılavuz çizgileriyle birlikte); Android uyarlanabilir ikon ve tek renkli ikon da şablon. md5'ler eski `harcama-app` ile birebir aynı. | **Yayın engeli.** Apple 2.3.8 / 4.1 (placeholder, başkasının markası) ve Play mağaza varlığı politikası. |
| 3 | **Tanıtım (onboarding)** — `auth-tr-01-onboarding.jpg` | 3 sayfa, dil çipleri, "Atla", sayfa noktaları, ekran okuyucu etiketi. İlk dil cihaz dilinden (`src/i18n/index.ts:56`). Eski kullanıcı (veri var) tanıtımı görmez (`src/auth/prefs.ts:44-52`, UI testi geçti). | Sayfalar yalnızca ikon + metin; değer önerisi zayıf (ekran görüntüsü/örnek veri yok). Para birimi seçimi tanıtımda sorulmuyor (TRY varsayılanı, İspanyol/İtalyan kullanıcı sonradan değiştirmeli). |
| 4 | **Karşılama (giriş seçenekleri)** — `auth-en-02-welcome.jpg` | Apple (yalnız iOS), Google, e-posta kayıt/giriş, "Hesap açmadan devam et", yasal bağlantılar. Supabase değişkenleri yoksa bu ekran hiç görünmez, uygulama doğrudan açılır (doğrulandı). Sahte servis üretim paketinde çalışmaz (bayraksız mock paketiyle doğrulandı). | Apple düğmesi özel çizim (`BusyButton`); Apple HIG'e uygun resmi `AppleAuthenticationButton` önerilir (ret riski düşük-orta). Görüntüdeki "bağlantı geçersiz" bandı **yalnızca sahte serviste** çıkıyor (`src/auth/mockService.ts:84-88` her adresi bağlantı sanıyor); gerçek servis yok sayıyor. Test sadakati sorunu. |
| 5 | **Kayıt** — `auth-tr-03-signup-errors.jpg` | Satır içi doğrulama, ad isteğe bağlı, parola gücü, `gmial`→`gmail` önerisi, 72 bayt sınırı, yaygın parola listesi, zorunlu onay kutusu, art arda dokunuşta tek istek. Hesap varlığı sızdırılmıyor (`supabaseService.ts` signUp). | Onay kutusu metni ve gizlilik politikası adresi `REPLACE_ME` (yayın engeli). |
| 6 | **Giriş / hatalı giriş** — `auth-tr-04-signin-wrong.jpg` | Genel hata mesajı ("E-posta veya parola hatalı"), doğrulanmamış hesapta "tekrar gönder", ağ hatasında "tekrar dene", hız sınırı mesajı (UI testi 103/103). | Supabase panelinde CAPTCHA ve hız sınırı ayarlanmadı (canlıda yapılmalı). |
| 7 | **Parola sıfırlama / yeni parola** | 60 sn bekleme, hesap var/yok sızıntısı yok, soğuk açılış yarışı düzeltilmiş, PKCE kod değişimi. | **PKCE sınırlaması:** bağlantı başka cihazda/masaüstünde açılırsa doğrulayıcı olmadığı için başarısız olur (metin "aynı cihazda iste" diyor). Kullanıcıların çoğu e-postayı bilgisayarda açar; 6 haneli OTP alternatifi önerilir. Gerçek e-posta şablonları **canlıda doğrulanmalı**. |
| 8 | **Ana sayfa (panel)** — `main-tr-01-dashboard.jpg`, `main-tr-02-dashboard-scrolled.jpg`, `edge-empty-320.jpg` | Selamlama, para birimi seçici, ay seçici, net durum kartı (gizleme), 4 hızlı eylem, harcama çubukları, kategori halkası, bütçe halkası, abonelikler, onay bekleyen abonelikler, öne çıkanlar, 4 kutucuk, son işlemler, alt sekme çubuğu. Boş durumlar ve iskelet var. Panel testi tr/en/es/it: 239/258/258/258 kontrol, 0 hata. | **(a)** Net değişim "**+%999+**" gösteriyor: geçen ay hiç gelir yokken (net negatif) bu ay maaş girilince yüzde anlamsızlaşıyor (`src/lib.ts:209`, `src/dashboard.tsx:149`). **(b)** Ekran çok uzun (≈ 3 ekran boyu); "öne çıkanlar", "kutucuklar" ve kartlar bilgiyi tekrarlıyor. **(c)** "Net durum" yalnız aylık; gerçek bakiye/hesap kavramı yok. |
| 9 | **Harcama ekleme** — `main-tr-08-add-expense.jpg`, `edge-huge-amount.jpg` | Tutar otomatik odak, ondalık klavye, para birimi çipleri ve çeviri ipucu, 8 kategori, not, "Bugün/Dün/2 gün önce" + gün adım düğmeleri, sık girilenler, iOS klavye üstü Kaydet çubuğu, düzenle/sil + geri al. Minimum 3 dokunuş (aç → tutar → kaydet). | **(a) Tarih seçici yok:** 2 ay önceki bir harcama ~60 dokunuş ister (`src/sheets.tsx:209-223`). **(b) Üst sınır yok:** `999999999999999` kabul ediliyor; üstteki Kaydet hapı "Vazgeç"in üstüne taşıyor. **(c)** Not alanında uzunluk sınırı yok (gelirde 80). **(d)** Kategori varsayılanı her zaman "Market"; son kullanılan kategori hatırlanmıyor. |
| 10 | **Gelir ekleme** | Harcamayla aynı yapı, 5 gelir kategorisi, ayrı liste, yedek/Excel/kur dönüşümüne dahil. | Tekrarlayan gelir (maaş) yok; her ay elle girilmeli. |
| 11 | **İşlemler (geçmiş)** — `main-en-03-transactions.jpg` | Harcamalar/Gelirler anahtarı, arama (tüm aylarda not/kategori/tutar), kategori çipleri, gün filtresi, gün başlıkları, boş durumlar. | **(a)** Sekme adı "Transactions/İşlemler", başlık "Expenses/Harcamalar": tutarsız. **(b)** Gelirlerde arama yok. **(c)** `ScrollView` ile tüm sonuçlar bir anda çiziliyor (sanallaştırma yok, `App.tsx:560-614`, `App.tsx:775`); büyük veride takılma riski. **(d)** Toplu seçim/silme, tarih aralığı filtresi yok. |
| 12 | **Kategoriler** | 8 sabit kategori (`src/lib.ts` `CATS`); bilinmeyen kategori "Diğer"e çevrilir (`src/store.ts:31`). Abonelik türleri ad tahminiyle. | **Özel kategori ekleme/düzenleme/gizleme/sıralama yok.** Rakiplerin hepsinde var; en sık talep edilen özelliktir. |
| 13 | **Bütçe** — `main-es-05-budget.jpg`, `main-it-05-budget.jpg` | Aylık toplam bütçe + kategori limitleri, %80 uyarısı, limit toplamı, farklı para biriminde saklama. | **(a)** Bütçe sekmesi yalnız form; kategori bazında **ilerleme çubuğu/kalan tutar bu ekranda yok** (raporlara dağılmış). **(b)** Haftalık/yıllık/devreden (rollover) bütçe yok. **(c)** İtalyancada yer tutucu "Nessun limi…" kesiliyor; İspanyolcada başlık "Presupuesto y lím…" kesiliyor (depo testi de uyarı veriyor: `ui-test.js es` 2 uyarı). |
| 14 | **Raporlar / grafikler** — `main-es-04-reports.jpg` | Öne çıkanlar (yorumlar), son 6 ay çubukları, günlük harcama + ortalama + bütçe çizgisi, hafta günü ortalaması, kategori dağılımı ve geçen aya göre değişim, en büyük 5 harcama, ay için Excel. | **(a)** Gelir/gider karşılaştırması, nakit akışı, birikim oranı grafikleri yok. **(b)** Tarih aralığı/yıllık rapor yok. **(c)** Grafiklerde ekran okuyucuya tutar söylenmiyor (yalnız gün etiketi). |
| 15 | **Excel dışa aktarma** | `src/excel.ts` saf; Harcamalar, Kategoriler, Aylar, Gelirler, Abonelikler sayfaları; para biçimi; kur notu. Node'da çalışma kitabı okunarak test edilmiş. | `xlsx@0.18.5` npm'de **bakımsız, yüksek önem dereceli 2 açık, düzeltme yok** (yalnız yazma için kullanılıyor, pratik risk düşük). Excel/Numbers'ta açılması ve paylaşım menüsü **cihazda doğrulanmalı**. Tarih aralığı seçimi yok (yalnız "bu ay" / "tümü"). |
| 16 | **Abonelikler** — `tall-abonelikler.jpg` | Aylık/yıllık toplam, türe göre dağılım, bekleyen/yaklaşan/ödendi durumları, "ödendi olarak işaretle"/"atla". | **(a)** Ödeme otomatik kaydedilmiyor, her ay elle onay gerekir. **(b)** Kaçırılan geçmiş dönemler izlenmiyor (yalnız içinde bulunulan dönem). **(c)** Bildirim hatası (aşağıda #17). |
| 17 | **Bildirimler** | Akşam hatırlatması (varsayılan kapalı), abonelik ödeme günü uyarısı (**varsayılan açık**). İzin yalnızca bir anahtar kapalıdan açığa çevrilince isteniyor (`App.tsx:346-351`). | **Hata (yüksek):** abonelik uyarısı varsayılan açık olduğu için izin **hiç istenmiyor**; `reschedule` izin yoksa sessizce çıkıyor (`src/notify.ts:31-32`). Kullanıcı akşam hatırlatmasını açmadıkça abonelik bildirimi hiç gelmez, oysa anahtar "açık" görünür. Kilit ekranında tutarlar görünür (gizlilik seçeneği yok). Gerçek bildirim teslimi **cihazda doğrulanmalı**. |
| 18 | **Profil** | Yalnızca ad (menüde ve selamlamada) ve baş harf avatarı. Hesap varsa e-posta. | Profil ekranı yok; hesap bilgisi Ayarlar'ın içinde. |
| 19 | **Ayarlar** — `tall-ayarlar.jpg`, `main-tr-06-settings.jpg` | Ad, dil (5), ana para birimi, kurlar (kaynak, zaman, elle yenile), tema (Noir/Fildişi/Telefona göre), 8 vurgu, 4 zemin, bildirimler, Excel, yedek al/geri yükle, hesap (çıkış, hesabı sil), yasal metinler. | Tek uzun kart, bölüm başlıkları küçük; arama/alt sayfa yok. "Web sürümünden aldığın yedeği…" metni mağaza kullanıcısı için anlamsız. Uygulama kilidi (Face ID/parmak izi) yok. Uygulama sürümü ve destek/iletişim bağlantısı yok. |
| 20 | **Hesap silme** | Ayarlar → Hesap → Hesabı sil; yeniden kimlik doğrulama (parola ya da Apple/Google), sunucu tarafında son girişin ≤ 10 dk olması, Apple belirteci iptali, `on delete cascade`, isteğe bağlı cihaz verisini silme. Fonksiyon testi 42/42, SQL 34/34. | Edge Function'lar **Deno'da hiç çalıştırılmadı**; Apple iptal uç noktasına gerçek istek atılmadı (**canlıda doğrulanmalı**). Google Play için web'de silme sayfası (`deletionUrl`) yok. |
| 21 | **Hata / boş / yüklenme / bağlantı kesik** — `edge-offline-norates.jpg` | Okuma hatasında hata ekranı + "tekrar dene" ve **veriye yazmama**; bozuk kaydın yedeklenmesi; yazma hatası bandı; kur alınamadı bandı + "tekrar dene"; boş kartlar. | **Hata (orta):** hiç kur alınmamışken (ilk açılış çevrimdışı, yeni cihaza yedek yükleme) farklı para birimli kayıtlar **çevrilmeden ana birimle toplanıyor**: 35 € harcama toplamlara "₺35" olarak giriyor (`src/currency.ts:162`). Band "çevrilmeden gösteriliyor" diyor ama toplamlar sessizce yanlış. |
| 22 | **Yan menü ve hareketler** | Sol kenar kaydırma geri/menü, menü sola kaydırarak kapanır. | Depodaki `gesture-ui-test.js` bu ortamda **tr, en ve es'de aynı 3 hatayı** veriyor (kısa sola kaydırma ve dikey kaydırma menüyü kapatıyor; çapraz kaydırma geri götürüyor). PR açıklamasındaki "0 hata" bu ortamda tekrarlanamadı. Sebep: `onPanResponderRelease` yalnız hıza (`g.vx > 0.6`) bakıyor, yön baskınlığını yeniden denetlemiyor (`App.tsx:196-199`). **Cihazda doğrulanmalı.** |
| 23 | **Yedek / geri yükleme** | JSON yedeği paylaşım menüsüyle; içe aktarmada aynı kimlik tekrar eklenmez. | **Hata (orta):** `normalize` harcama ve abonelik tutarlarında **negatif/0/aşırı büyük değerleri kabul ediyor** (yalnız `typeof number`, `src/store.ts:27`, `:39`; gelirlerde doğru `:53`). Negatif kayıtlı yedek yüklenince Gider "−₺1.379", kategori payı "%332" ve "%-124" gösteriliyor (`edge-negative-item.jpg`). Yedek şifresiz; dosya her uygulamayla paylaşılabilir. |
| 24 | **Erişilebilirlik** | Ana düğmelerde etiket ve rol var; WCAG kontrast testi 64 tema birleşimi; dokunma alanları çoğunlukla ≥ 44 pt; `hitSlop` kullanımı. | Alt sekme yazısı 10 pt, hızlı eylem 11 pt; `maxFontSizeMultiplier`/büyük yazı tipi senaryosu test edilmemiş. VoiceOver/TalkBack **cihazda doğrulanmalı**. Kategori filtre çiplerinde rol yok. |
| 25 | **Dark mode / ekran boyutları** | Açık, koyu ve sistem; 320–1280 px duyarlı (testler). iPad desteği kapalı (`supportsTablet: false`). | Çentik/Dynamic Island/Android gezinme çubuğu **cihazda doğrulanmalı**. |
| 26 | **Dil ve biçimler** | tr/en/es/it/zh tam katalog (çeviri denetimi 0 hata, 21 "aynı kalmış" uyarısı, hepsi meşru: "Spendly", "Euro", biçim kalıpları). Sayı/para/tarih CLDR ile test edilmiş; es/it'te simge sonda. | es/it başlık ve yer tutucu kesilmeleri (#13). **Yasal metinler yalnız TR/EN**; ES/IT/ZH kullanıcı İngilizce metin görür (AB'de GDPR şeffaflık ilkesi açısından ES/IT çevirisi önerilir). Hermes'te `Intl` ile cihaz dili algılama **cihazda doğrulanmalı** (`expo-localization` daha güvenilir). |
| 27 | **Para birimi dönüşümü** | Kayıt girildiği birimde saklanıyor; gösterimde **bugünkü kurla** çevriliyor; birim değiştirip geri almak veriyi değiştirmiyor (811 test). | **Tasarım riski (orta):** geçmiş harcamalar **bugünkü kurla** yeniden hesaplanıyor. TRY gibi oynak bir birimde, 6 ay önceki 100 $'lık harcama raporda bugün ~%15–30 farklı görünür; geçmiş aylar ve bütçe karşılaştırmaları her gün değişir. Rakipler işlem anındaki kuru saklar. |

---

## 2. Rakiplerle karşılaştırmalı özellik ve UI/UX matrisi

Gösterim: ✔ = kaynakta doğrulandı · ◐ = kısmi/ücretli katman · ✖ = yok · ? = kaynakta doğrulanamadı.

| Özellik | **Spendly (bugün)** | Wallet (BudgetBakers) | Money Manager (Realbyte) | Spendee | YNAB | Money Lover |
|---|---|---|---|---|---|---|
| Hesapsız / yerel kullanım | ✔ (güçlü yan) | ? | ✔ (cihazda kayıt) | ? | ✖ (abonelik + hesap) | ? |
| Banka eşitleme | ✖ | ✔ (15.000+ banka, satıcı beyanı) | ◐ (kart ile otomatik kayıt) | ◐ Premium | ✔ (ABD odaklı; AB'de sınırlı) | ◐ (ülkeye göre) |
| Çoklu hesap / cüzdan, transfer | ✖ | ✔ | ✔ (varlık yönetimi, transfer) | ✔ (cüzdanlar) | ✔ | ✔ |
| Özel kategori | ✖ (8 sabit) | ? | ? | ? | ✔ | ? |
| Bütçe türleri | Aylık + kategori limiti | Tek seferlik/tekrarlayan, kategori birleşimi | Bütçe-gider grafiği | Ücretsiz 1, Premium sınırsız | Hedefler (haftalık/aylık/yıllık/tarih) | Kategori limitleri |
| Tekrarlayan / planlı işlem | ◐ (abonelik, elle onay) | ✔ planlı ödemeler + hatırlatma | ✔ tekrarlayan kayıtlar | ? | ✔ | ✔ + vade bildirimi |
| Birikim hedefi | ✖ | ? | ? | ? | ✔ (targets) | ✔ (Saving Planner) |
| Çoklu para birimi | ✔ (5 birim, kayıt bazlı) | ✔ | ? | ? | ? | ✔ |
| Bulut eşitleme / çok cihaz | ✖ (hesap var, veri eşitlenmiyor) | ✔ | ◐ (Wi-Fi ile PC) | ✔ | ✔ (web + mobil) | ✔ |
| Paylaşılan / aile bütçesi | ✖ | ✔ ("Family Finance") | ? | ✔ paylaşılan cüzdan | ? | ? |
| Uygulama kilidi (parola/biyometri) | ✖ | ? | ✔ (gecikmeli parola) | ? | ? | ? |
| Widget / hızlı giriş | ◐ (derin bağlantı `harcama://ekle`) | ? | ✔ (hızlı giriş widget'ı) | ? | ✔ (Apple Watch) | ? |
| Fiş tarama | ✖ | ? | ? | ? | ? | ◐ Premium |
| Dışa aktarma | ✔ Excel (çok sayfalı) | ✔ Excel/API | ? | ? | ? | ◐ CSV (Premium) |
| Borç/alacak takibi | ✖ | ? | ✔ (kredi, mevduat) | ? | ? | ✔ |
| Akıllı yorumlar | ✔ (öne çıkanlar) | ✔ (nakit akışı içgörüleri) | ✖ | ? | ✔ (Age of Money) | ◐ (tahmin) |

### Alan bazlı karşılaştırma ve öneriler (Spendly mimarisine uygun)

| Alan | Spendly'nin durumu | Rakiplerdeki iyi uygulama | Eksik/zayıf yön | Önerilen iyileştirme (mevcut mimariye göre) | Kullanıcı faydası | Öncelik |
|---|---|---|---|---|---|---|
| İlk kullanım | 3 sayfa tanıtım + giriş/misafir | Kurulumda para birimi ve başlangıç bakiyesi sorulur (Wallet, Money Lover); YNAB ilk bütçeyi birlikte kurar | Para birimi, bütçe ve ilk kayıt yönlendirmesi yok; ilk ekran boş kartlarla dolu | Tanıtımın son adımına **para birimi seçimi + isteğe bağlı aylık bütçe** ekle (`settings.currency/budget` zaten var); boş panelde tek büyük "İlk harcamanı ekle" kartı | İlk 60 sn'de değer görme, erken bırakmanın azalması | P1 |
| İşlem ekleme hızı | 3 dokunuş; sık girilenler; derin bağlantı | Widget ve hızlı giriş (Money Manager), şablonlar | Tarih seçici yok; son kategori hatırlanmıyor; widget yok | Takvim seçici (`@react-native-community/datetimepicker`); son kategoriyi hatırla; mevcut `harcama://ekle` bağlantısıyla **ana ekran kısayolu** (`expo-quick-actions`) ve iOS Kısayollar; widget P3 | Günlük kullanımda saniyeler, alışkanlık | P1 (tarih), P2 (kısayol) |
| Panel okunabilirliği | Zengin ama ~3 ekran uzunluğunda | Wallet: özelleştirilebilir kartlar; YNAB: tek "ne kadar harcayabilirim" sayısı | Tekrarlayan bilgiler, anlamsız "%999+" | Kartları sadeleştir: bakiye, bütçe kalan/gün başı harcanabilir tutar, son işlemler; diğerleri "Raporlar"a. Kart sırası/gizleme ayarı (`settings` içine `dashCards`) | Göz atışta karar | P1 |
| Bütçe takibi | Form + dağınık uyarılar | YNAB hedefleri; Wallet tekrarlayan bütçeler | Bütçe sekmesinde ilerleme yok; devreden bütçe yok | Bütçe sekmesini **ilerleme listesi** yap (kategori başına çubuk, kalan, gün başı kalan); düzenleme alt sayfaya taşınsın | Bütçenin aktif kullanımı | P1 |
| Grafiklerin anlaşılırlığı | Çok sayıda kart, açıklamalar var | Gelir-gider ve nakit akışı grafikleri | Gelir verisi grafiklerde yok | Raporlara "Gelir vs gider (6 ay)" ve "birikim oranı" ekle (`balanceFor` aylık çalıştırılarak) | Gelirin anlam kazanması | P2 |
| Tutma (retention) | Akşam hatırlatması, abonelik uyarıları | Seri/hatırlatma, aylık özet bildirimi, planlı ödemeler | Abonelik bildirimi hatalı; aylık özet yok | Bildirim hatasını düzelt; **ay sonu özeti** yerel bildirimi; bütçe %80 yerel bildirimi | Geri dönüş | P0 (hata), P2 (yeni) |
| Kategoriler | 8 sabit | Hepsinde özelleştirme | — | `Data`'ya `categories: {id,name,icon,color,hidden}[]` ekle; mevcut `CATS` yerleşik kimlik olarak kalsın (yedek uyumu korunur), `normalize` bilinmeyeni silmek yerine korusun | Kişiselleştirme | P2 |
| Tekrarlayan işlem | Abonelik (elle onay) | Planlı ödemeler, otomatik kayıt | Gelir tekrarlanamıyor | `Sub` modelini `kind: 'expense' \| 'income'` + `autoPost` ile genişlet; açılışta geçmiş dönemleri tamamla | Maaş/kira girişi otomatik | P2 |
| Hesap/cüzdan ve bakiye | Aylık net | Çoklu hesap, transfer | "Bakiye" yok | `Expense/Income`'a isteğe bağlı `accountId`, `accounts: {id,name,opening,cur}`; bakiye = açılış + akış | Gerçek "toplam bakiye" | P3 |
| Güvenlik/gizlilik | Yerel veri, hesap isteğe bağlı | Parola kilidi (Money Manager) | Kilit yok, veri şifresiz | `expo-local-authentication` ile kilit + arka planda bulanıklaştırma; tutarları gizle zaten var | Finans verisinde güven | P1 |
| Bulut eşitleme | Yok (hesap amaçsız kalıyor) | Hepsinde | Hesap açmanın şu an kullanıcıya faydası yok | Modül 3 planı (RLS'li tablolar, `user_id … on delete cascade`, çakışma çözümü). O zamana kadar karşılama ekranında hesabın faydasını dürüstçe anlat | Çok cihaz, kayıp koruması | P3 |

**Spendly'yi ayıran yanlar (korunmalı):** hesapsız tam kullanım, kayıt bazlı para birimi saklama, 5 dil ve CLDR uyumlu biçimler, abonelik türü tahmini, açıklayıcı "öne çıkanlar", tema/kontrast kalitesi, Excel'in çok sayfalı çıktısı.

**Kaynaklar (rakipler):** [Wallet ürün sayfası](https://budgetbakers.com/en/products/wallet/), [Wallet "What is Wallet"](https://budgetbakers.com/what-is-wallet/), [Wallet sürüm notları (APKMirror)](https://www.apkmirror.com/apk/budgetbakers-com/wallet-budget-tracker/wallet-budget-expense-tracker-9-2-15-release/), [YNAB Targets (resmi)](https://www.ynab.com/ynab-targets/), [YNAB inceleme 2026 (Freenance)](https://freenance.io/products/ynab-review-2026-budgeting-app-worth-it-european-investors/), [Spendee](https://www.spendee.com/), [Spendee Premium](https://www.spendee.com/premium), [Spendee Capterra](https://www.capterra.com/p/238829/Spendee/), [Money Lover Microsoft Store](https://apps.microsoft.com/detail/9wzdncrdrg5v), [Money Lover AppFollow](https://appfollow.io/ios/money-lover-expense-manager/486312413?country=us), [Money Manager Expense & Budget (App Store)](https://apps.apple.com/app/id560481810), [Money Manager Classic (App Store)](https://apps.apple.com/app/id395153197). Not: Satıcı sayfaları ve mağaza listelemeleri satıcı beyanıdır; uygulamalar bu ortamda kurulup denenemedi.

---

## 3. Eksik, hatalı ve iyileştirilmesi gereken fonksiyonlar (tam bulgu listesi)

Sütunlar istenen biçimdedir: Ekran/Özellik · Mevcut durum · Eksiklik · Rakip karşılaştırması · Risk · Yayın engeli · Çözüm · Öncelik · Süre (geliştirme + test).

| ID | Ekran / Özellik | Mevcut durum (kanıt) | Eksiklik | Rakip karşılaştırması | Risk | Yayın engeli | Çözüm | Öncelik | Süre |
|---|---|---|---|---|---|---|---|---|---|
| F-01 | Uygulama ikonu, uyarlanabilir ikon | `assets/icon.png` vb. Expo şablon görselleri (md5 doğrulandı) | Marka ikonu yok | Hepsinde özgün ikon | Kritik | **Evet** | 1024² iOS ikonu (saydamsız), Android ön/arka/tek renk katmanları, `adaptiveIcon.backgroundColor` | P0 | 1–2 gün |
| F-02 | Splash screen | `app.json`'da yapılandırma yok, `expo-splash-screen` kurulu değil | Markasız açılış, koyu mod yok | — | Yüksek | Koşullu | `npx expo install expo-splash-screen`; eklentide `image`, `backgroundColor`, `dark` | P0 | 0,5 gün |
| F-03 | Yasal bilgiler | `src/legal/config.ts:11-20` 7 alan `REPLACE_ME`; `check:release` 7 hata | Şirket/iletişim, gizlilik ve koşul adresleri, veri bölgesi, hukuk, silme adresi yok | — | Kritik | **Evet** | Alanları doldur; gizlilik, koşullar ve hesap silme sayfalarını HTTPS'te yayınla; hukukçu onayı | P0 | 2–4 gün (hukuk dahil) |
| F-04 | Bildirim izni | `App.tsx:346-351`, `store.ts:14` `subRemind: true`, `notify.ts:31-32` | Varsayılan açık abonelik uyarısı için izin hiç istenmiyor; bildirim gelmiyor | Rakipler fatura hatırlatmasını güvenilir sunar | Yüksek | Koşullu (işlev bozuk) | İlk abonelik kaydında ya da açılışta `subRemind && subs.length` iken bağlamsal izin iste; izin yoksa Ayarlar'da durum + "izin ver" | P0 | 0,5 gün + cihaz testi |
| F-05 | Yedekten geri yükleme | `store.ts:27,39` negatif/0/sonsuz tutar kabul; ekran: `edge-negative-item.jpg` | Veri bütünlüğü doğrulaması eksik | — | Orta | Hayır | Harcama/abonelikte `amount > 0 && isFinite && amount < 1e12`; tarih geçerliliği; birim testi | P0 | 0,5 gün |
| F-06 | Kur yokken toplamlar | `currency.ts:162` çevrilemeyen kayıt toplamlara özgün sayıyla giriyor; `edge-offline-norates.jpg` | Farklı birimler karışık toplanıyor | — | Orta | Hayır | Kur yokken çevrilemeyen kayıtları toplamların dışında tut ve "x kayıt çevrilemedi" de; ya da birim bazında ayrı toplam göster | P0 | 1 gün |
| F-07 | Tutar üst sınırı | `sheets.tsx` sınır yok; `edge-huge-amount.jpg` | Taşma, anlamsız tutarlar | — | Düşük | Hayır | `parseAmount` sonrası üst sınır (ör. 1e10) ve `maxLength`; Kaydet hapında `numberOfLines`/kısaltma | P1 | 0,5 gün |
| F-08 | Net değişim yüzdesi | `lib.ts:209`, `dashboard.tsx:149` "+%999+" | Geçen ay gelirsizken yanıltıcı yüzde | YNAB/Wallet tutar farkı gösterir | Orta | Hayır | Geçen ay gelir yoksa ya da işaret değiştiyse yüzde yerine **tutar farkı** göster | P1 | 0,5 gün |
| F-09 | Geçmiş kayıtların kuru | `currency.ts` `viewData` bugünkü kurla çevirir | Geçmiş raporlar her gün değişir | Rakipler işlem anı kurunu saklar | Orta | Hayır | Kayıt anında `fx` (ana birim karşılığı ya da USD kurları) sakla; eski kayıtlar için bugünkü kur + not | P1 | 2–3 gün |
| F-10 | Tarih seçici | `sheets.tsx:209-223` yalnız gün adımı | Eski tarihli kayıt zahmetli | Hepsinde takvim | Orta | Hayır | Takvim/tarih seçici; gelecekteki tarih engeli korunsun | P1 | 1 gün |
| F-11 | Hareket eşikleri | `App.tsx:196-199`; `gesture-ui-test` her dilde aynı 3 hata (tr, en, es) | Dikey/kısa kaydırma menüyü kapatabiliyor, çapraz kaydırma geri götürebiliyor | — | Orta | Hayır | Bırakmada yön baskınlığını yeniden denetle; hız eşiğini yalnız yatay baskınken uygula; cihazda ayarla | P1 | 1 gün + cihaz |
| F-12 | i18n kesilmeleri | es başlık "Presupuesto y lím…", menü alt yazısı; it "Nessun limi…" | Metin taşması | — | Düşük | Hayır | Kısa başlık anahtarları (`title.butce.short`), yer tutucuyu "—" yap; `ui-test` uyarılarını hataya çevir | P1 | 0,5 gün |
| F-13 | Sekme/başlık tutarlılığı | Sekme "İşlemler", başlık "Harcamalar" | Karışık adlandırma | — | Düşük | Hayır | Başlığı sekme adıyla eşle ya da segmentle birlikte "İşlemler" | P2 | 0,25 gün |
| F-14 | Bütçe ekranı | Yalnız form | İlerleme görünmüyor | YNAB, Wallet | Orta | Hayır | Kategori ilerleme listesi + düzenle alt sayfası | P1 | 2 gün |
| F-15 | Panel uzunluğu | ~3 ekran | Bilgi tekrarı | Wallet özelleştirilebilir panel | Düşük | Hayır | Kartları azalt, sıralama/gizleme | P2 | 2 gün |
| F-16 | Özel kategoriler | Sabit 8 | — | Hepsinde | Orta | Hayır | §2'deki veri modeli genişletmesi | P2 | 4–5 gün |
| F-17 | Tekrarlayan gelir/gider | Yalnız abonelik, elle onay | Otomatik kayıt yok | Wallet, Money Lover, Money Manager | Orta | Hayır | `Sub` genişletmesi + geçmiş dönem tamamlama | P2 | 3–4 gün |
| F-18 | Uygulama kilidi | Yok | Finans verisi açık | Money Manager parola | Orta | Hayır | Biyometri/parola kilidi, arka planda gizleme | P1 | 2 gün |
| F-19 | Liste performansı | `ScrollView` + tüm sonuçlar; 10k kayıtta render hesabı ~34 ms (V8) | Sanallaştırma yok | — | Orta | Hayır | `FlatList`/`SectionList`; `useMemo` ile `analyse/insights` | P2 | 2 gün |
| F-20 | Depolama modeli | Tüm veri tek AsyncStorage anahtarında; her değişiklikte tamamı yazılıyor (`store.ts:169`); 10k kayıt ≈ 1 MB | Android'de ~2 MB satır sınırı riski, yazma maliyeti | — | Orta | Hayır | `expo-sqlite`'a geçiş (tablo başına kayıt), ilk açılışta tek seferlik taşıma | P2 | 4–5 gün |
| F-21 | Gelir araması, tarih aralığı filtresi | Yok | — | Hepsinde | Düşük | Hayır | Ortak işlem listesi bileşeni | P2 | 1–2 gün |
| F-22 | Excel kütüphanesi | `xlsx@0.18.5` 2 yüksek açık, düzeltme yok | Bakımsız paket | — | Orta | Hayır | SheetJS'in resmi CDN sürümü (0.20.x) ya da `exceljs`; yalnız yazma kullanımı korunur | P1 | 1 gün |
| F-23 | Yedek şifreleme | Düz JSON | Paylaşılan dosyada finans verisi | — | Düşük | Hayır | İsteğe bağlı parola ile şifreli yedek; paylaşım öncesi uyarı | P3 | 2 gün |
| F-24 | Hesap ↔ veri eşitleme | Hesap var, veri eşitlenmiyor | Hesabın kullanıcıya faydası yok | Hepsinde eşitleme | Orta | Hayır (hesap isteğe bağlı) | Modül 3; o zamana dek karşılama metninde net ifade | P3 | 3–4 hafta |
| F-25 | Parola sıfırlama bağlantısı (PKCE) | Başka cihazda açılırsa çalışmaz | Sık destek talebi | — | Orta | Hayır | E-posta OTP (6 hane) seçeneği ya da Universal/App Links | P1 | 1–2 gün |
| F-26 | Apple ile giriş düğmesi | Özel çizim | HIG uyumu | — | Düşük | Koşullu | `AppleAuthenticationButton` | P1 | 0,25 gün |
| F-27 | Yasal metin dilleri | TR/EN | ES/IT/ZH İngilizce | — | Orta | Koşullu (AB) | ES ve IT çevirisi (hukukçu onaylı) | P1 | 2–3 gün |
| F-28 | Mock servis bağlantı davranışı | `mockService.ts:84-88` | Testte sahte hata bandı | — | Düşük | Hayır | Mock'ta da `auth-callback`/`reset-callback` dışındaki adresleri yok say | P3 | 0,25 gün |
| F-29 | Kilit ekranı bildirim içeriği | Tutar görünür | Gizlilik | — | Düşük | Hayır | "Tutarları bildirimde gösterme" seçeneği | P3 | 0,5 gün |
| F-30 | Ayarlar düzeni | Tek uzun kart | Bulunabilirlik | Hepsinde gruplu ayarlar | Düşük | Hayır | Bölümlü liste + alt sayfalar, sürüm/destek satırı | P2 | 1–2 gün |

---

## 4. Teknik, güvenlik ve performans denetimi

### 4.1 Test ve araç çıktıları (bu ortamda çalıştırıldı)

| Komut | Sonuç |
|---|---|
| `npm test` (tsc + çeviri + core 709 + currency 811 + theme 1032 + dashboard 100 + auth 101 + functions 42) | **Geçti**, 0 hata (çeviri: 21 meşru uyarı) |
| `npm run test:sql` (PostgreSQL 16, migration + RLS) | **34/34** |
| `dashboard-ui-test` tr/en/es/it | 239 / 258 / 258 / 258 kontrol, **0 hata** |
| `ui-test` tr/en/es/it | 42 / 51 / 51 / 51 kontrol, 0 hata; **es: 2, it: 1 kesilme uyarısı** |
| `currency-ui-test` tr/en/es/it | 42 kontrol × 4, 0 hata |
| `theme-ui-test` tr/en/es | 78 kontrol × 3, 0 hata |
| `auth-ui-test` (sahte servisli paket) tr/en/es | 103 / 103 / 104 kontrol, 0 hata |
| `gesture-ui-test` tr, en, es | **Her dilde 30 geçti, aynı 3 hata** (F-11, tutarlı; rastgele değil) |
| `npm run check:release` | **Başarısız: 7 engel** (yasal `REPLACE_ME`), 1 uyarı (Supabase değişkenleri yok) |
| `npx expo-doctor` | 19/21; **4 paket yama sürümü geride** (`expo` 57.0.30→57.0.31, `expo-network`, `expo-notifications`, `expo-sharing`); dizin denetimi ağ hatası |
| `npm audit` | 9 açık: **6 yüksek** (`@expo/cli`/`expo-updates` zinciri `node-forge`, `xlsx` ×2, düzeltmesi yok), 3 orta (`uuid`, `xcode`) |
| Android hedef SDK | `react-native` 0.86.3: `targetSdk = 36`, `compileSdk = 36`, `minSdk = 24` → Google Play'in 31 Ağustos 2026 API 36 şartını **karşılıyor** |
| Performans (Node V8, tools/bench) | 1k kayıt: 109 KB, ayrıştırma 3 ms, render hesabı 6 ms · 10k: 1,07 MB, 18 ms / 34 ms · 30k: 3,2 MB, 55 ms / 48 ms. Hermes'li orta segment Android'de **5–10 kat** yavaş beklenir; cihazda ölçülmeli |

Not: depodaki tarayıcı testleri `/opt/pw-browsers/chromium-1194` yolunu sabit kodluyor; bu ortamda `PW_CHROMIUM` verilmeden çalışmıyor. CI'da taşınabilir yapılmalı.

### 4.2 Mimari ve kod kalitesi
- **Olumlu:** TypeScript `strict`; saf mantık (`lib`, `currency`, `excel`, `auth/flow`, `validation`, Edge `handlers`) RN'den ayrılmış ve Node'da test ediliyor; okuma hatasında veri yazmama güvencesi; açık ve gerekçeli belgeler.
- **Riskli:** `App.tsx` 1.142 satır, tüm ekranlar tek bileşende; her render'da tüm analiz yeniden hesaplanıyor (memo yok). `AGENTS.md` Expo Router zorunlu diyor, uygulama elle durum tabanlı gezinme kullanıyor (kural ile kod çelişiyor). ESLint yapılandırması yok. **CI yok** (PR #1'de hiç denetim çalışmadı: `check_runs: 0`). RN bileşen testi (Jest/RNTL) ve kapsam ölçümü yok; UI testleri web derlemesi üzerinde.
- **Dal yönetimi:** `claude/eloquent-clarke-lklodn` dalı PR #1 ile **11 dosyada çakışıyor** (App.tsx, dashboard.tsx, i18n ×5, sheets, store…). Hangisinin esas olacağına karar verilmeli; PR #1 iki modülü (hesap + panel) birlikte taşıyor (+6.258/−306, 64 dosya). Depo kökünde ilgisiz içerik var (`prompts/`, `examples/`, `README.md` = ":)", eski `harcama-app/` aynı `harcama://` şemasıyla).

### 4.3 Supabase, kimlik doğrulama, oturum (OWASP MASVS'e göre)

| MASVS alanı | Durum | Değerlendirme |
|---|---|---|
| **AUTH** | PKCE (`supabaseService.ts:73`), Apple'da SHA-256 nonce, refresh token rotasyonu, JWT 1 saat, hesap silmede ≤ 10 dk yeniden doğrulama + Apple iptali; hesap varlığı sızdırılmıyor; e-posta doğrulaması zorunlu | İyi. Çıkış yalnız yerel kapsam (`scope: 'local'`), "tüm cihazlardan çık" yok. CAPTCHA/oran sınırı panelde açılmalı. |
| **STORAGE** | Oturum: Keychain/Keystore, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, parçalı yazma. **Finans verisi AsyncStorage'da şifresiz**; Android otomatik yedeği varsayılan açık | Orta risk. Uygulama kilidi ve Android `allowBackup`/yedek kuralları kararı gerekli; yedek dosyası şifresiz. |
| **NETWORK** | Yalnız HTTPS (Supabase, Frankfurter, ExchangeRate-API, EAS Update) | Uygun. Kur yanıtları aralık doğrulamalı (`validateRates`). |
| **PLATFORM** | `harcama://` özel şema; eski uygulama da aynı şemayı kullanıyor; `harcama://ekle?tutar=…` formu önceden dolduruyor (kayıt kullanıcı onayıyla) | Düşük. Kimlik doğrulama dönüşü için Universal Links/App Links önerilir (şema ele geçirmeye karşı PKCE zaten koruyor). |
| **CODE** | 6 yüksek önemli bağımlılık bulgusu; `xlsx` bakımsız; `expo` yama sürümleri geride | Orta. Expo yamalarını al, `xlsx`'i değiştir. |
| **PRIVACY** | Analitik/reklam yok; hesap verisi minimum; Apple belirteci düz metin (`migrations/…accounts.sql:75`, yalnız `service_role`) | İyi; Vault ile şifreleme önerilir. |
| **Gizli anahtar** | Kaynakta JWT/`service_role` yok (`check:release` taraması temiz); `.env` git dışı; `.p8` gitignore'da | İyi. |
| **RLS** | `profiles`: yalnız kendi satırı, sütun düzeyi güncelleme; `apple_tokens`: politika yok, yetki yok | Gerçek PG'de 34/34 test ile doğrulandı. **Canlı projede uygulandığı doğrulanmadı.** |

**Tamamlanmamış entegrasyonlar:** Supabase projesi/ortam değişkenleri yok (bu derlemede hesap özellikleri kapalı) · Edge Function'lar Deno'da çalıştırılmadı ve dağıtılmadı · Apple Developer'da Sign in with Apple yeteneği ve `.p8` anahtarı · Google OAuth istemcisi · e-posta şablonları ve yönlendirme adresleri · bulut eşitleme (Modül 3) · çökme raporlama (Sentry vb.) yok · `eas.json` yok · iOS `buildNumber` / Android `versionCode` yönetimi yok · `ITSAppUsesNonExemptEncryption` tanımlı değil.

---

## 5. Kritik güvenlik ve mağaza yayın engelleri

| # | Engel | Mağaza | Kanıt | Çözüm |
|---|---|---|---|---|
| B-1 | Şablon ikon ve splash | Her ikisi | F-01, F-02 | Marka varlıkları |
| B-2 | Gizlilik politikası URL'si, koşullar, iletişim, silme sayfası yok | Apple 5.1.1, Play Kullanıcı Verisi ve Hesap Silme | F-03, `check:release` | Yayınla ve `LEGAL`'e yaz |
| B-3 | Supabase üretim ortamı yok (hesap özellikleri derlemede kapalı) | Koşullu | `check:release` uyarısı | Proje + migration + function + gizli anahtarlar; ya da ilk sürümde hesap özelliğini **kapalı** yayınla (karşılama ekranı görünmez, yasal metin buna göre) |
| B-4 | Hiç gerçek cihaz/EAS derlemesi yok, `eas.json` yok | Her ikisi | Dokümanlar, depo | `eas build` profilleri, imzalama, TestFlight/internal test |
| B-5 | Bildirim izni hatası | İşlev | F-04 | Düzelt |
| B-6 | Mağaza beyanları doldurulmadı | Apple App Privacy, Play Data safety + Financial features beyanı | — | §6 listeleri |
| B-7 | Play kişisel hesapsa 12 test kullanıcısı × 14 gün kapalı test | Play | Google Play Console yardım | Takvime şimdi ekle |
| B-8 | Yasal metin hukuki onaysız ve ES/IT çevirisi yok | Koşullu (AB) | F-27 | Hukukçu onayı |
| B-9 | Xcode 26 / iOS 26 SDK ile derleme zorunlu (28 Nisan 2026'dan beri) | Apple | Apple "upcoming requirements" | EAS'te SDK 57 varsayılan imajı kullan (derlemede doğrula) |

---

## 6. Yayın kontrol listeleri

### 6.1 App Store (iOS)
- [ ] Apple Developer Program üyeliği, App ID `com.karabag.harcamadefteri.global`, **Sign in with Apple** yeteneği
- [ ] `eas.json` (development / preview / production), `appVersionSource: remote`, `autoIncrement` ile `buildNumber`
- [ ] Marka ikonu (1024², saydamsız), splash (açık + koyu)
- [ ] `ios.infoPlist.ITSAppUsesNonExemptEncryption = false` (yalnız HTTPS)
- [ ] Xcode 26 / iOS 26 SDK ile derleme (EAS imajı)
- [ ] Gizlilik bildirimi (privacy manifest): Expo/RN modüllerinin `PrivacyInfo.xcprivacy` dosyaları birleşiyor (AsyncStorage, file-system, notifications, constants… mevcut); derlenen `.ipa` içinde kontrol et
- [ ] App Privacy ("besin etiketi"): hesap açılırsa **İletişim bilgisi (e-posta, ad)**, **Tanımlayıcı (kullanıcı kimliği)**: kullanıcıya bağlı, uygulama işlevi için, izleme yok. Harcama verisi cihazdan çıkmadığı için toplanan veri sayılmaz. Hesap özelliği kapalı yayınlanırsa "Veri toplanmıyor"
- [ ] Gizlilik politikası URL'si, destek URL'si, telif hakkı satırı
- [ ] Hesap silme uygulama içinde (var: Ayarlar → Hesap → Hesabı sil), App Review notlarında yolunu yaz
- [ ] Guideline 4.8: Google girişi varsa Apple ile giriş sunuluyor (var)
- [ ] Guideline 5.1.1(v): hesap isteğe bağlı (var: "Hesap açmadan devam et")
- [ ] İnceleme için demo hesabı (e-posta/parola) ve notlar
- [ ] Ekran görüntüleri: 6,9" ve 6,5" (iPhone), TR + EN (+ ES, IT) yerelleştirilmiş metadata
- [ ] Yaş derecelendirmesi anketi, kategori: Finans
- [ ] TestFlight dahili test → harici test (Beta App Review)
- [ ] **Gerçek cihaz testleri** (§6.3)

### 6.2 Google Play (Android)
- [ ] Play Console hesabı türü: kişisel hesapsa **12 test kullanıcısı, 14 gün kesintisiz kapalı test** sonra üretim başvurusu
- [ ] `android.versionCode` yönetimi (EAS remote), AAB ve Play App Signing
- [ ] Hedef API 36 (sağlanıyor), `minSdk 24`
- [ ] Uyarlanabilir ikon katmanları + tek renkli ikon, 512² mağaza ikonu, 1024×500 öne çıkan görsel
- [ ] Data safety formu: hesap varsa e-posta, ad, kullanıcı kimliği (toplanan, aktarımda şifreli, silme talebi mümkün); üçüncü taraf kur servislerine giden IP'yi değerlendir
- [ ] **Hesap silme web adresi** (`deletionUrl`), uygulama dışından silme talebi
- [ ] Financial features beyanı (bankacılık/ödeme/kredi yok → "yok" olarak beyan)
- [ ] Gizlilik politikası URL'si, hedef kitle (16+ politikası ile uyumlu), içerik derecelendirmesi
- [ ] `POST_NOTIFICATIONS` izni (Android 13+) bağlamsal isteniyor mu (F-04 düzeltmesiyle)
- [ ] Android otomatik yedekleme kararı (`allowBackup`)
- [ ] Dahili test → kapalı test → üretim (aşamalı yayın %10 → %100)
- [ ] Pre-launch report (Play'in otomatik cihaz testleri) sonuçları

### 6.3 Gerçek cihaz ve canlı servis gerektiren doğrulamalar (bu ortamda yapılamadı)
1. Açılış süresi (soğuk/sıcak), bellek, 10k kayıtta liste kaydırma ve arama yazarken akıcılık (Hermes, orta segment Android + eski iPhone).
2. Splash/ikon görünümü, çentik/Dynamic Island/gezinme çubuğu güvenli alanları, yatay/klavye davranışı (`InputAccessoryView`, `KeyboardAvoidingView`).
3. Yerel bildirimlerin teslimi (iOS + Android 13/14/15/16), izin reddedildiğinde davranış.
4. Apple ile giriş (nonce, ilk girişte ad, `apple-link`, silmede iptal), Google OAuth dönüşü, e-posta doğrulama ve parola sıfırlama bağlantıları (aynı ve farklı cihaz).
5. `expo-secure-store` parçalı yazma, uygulama silinip yüklenince Keychain davranışı.
6. Edge Function'ların Deno'da dağıtılması ve gerçek JWT ile çağrılması; RLS'nin canlı projede doğrulanması.
7. Excel ve yedek dosyasının Dosyalar/Drive/WhatsApp ile paylaşımı ve Excel/Numbers/Google Sheets'te açılması.
8. Haptik, kaydırma hareketleri (F-11) ve VoiceOver/TalkBack, büyük yazı tipi (%200).
9. Çevrimdışı ilk açılış, uçak modunda kayıt, bağlantı gelince kur yenileme.
10. EAS Update (OTA) kanal/çalışma zamanı sürümü eşleşmesi.

---

## 7. Puanlama (100 üzerinden, yalnızca kanıta dayalı)

| Alan | Puan | Gerekçe (kanıt) | Puana katılmayanlar |
|---|---|---|---|
| **Kod kalitesi** | **68** | + strict TS, typecheck temiz, 2.795 birim + 34 SQL testi, saf mantık katmanları, iyi belgeler · − 1.142 satırlık `App.tsx`, lint yok, CI yok, RN bileşen testi yok, testlerde sabit tarayıcı yolu, `gesture-ui-test` bu ortamda 3 hata | — |
| **Güvenlik** | **70** | + RLS (34/34), PKCE, SecureStore, mock koruması, yeniden doğrulamalı silme, gizli anahtar sızıntısı yok · − finans verisi şifresiz ve kilit yok, 6 yüksek bağımlılık bulgusu (`xlsx` düzeltmesiz), yedekte veri doğrulama açığı, Apple belirteci düz metin, CAPTCHA yok | Canlı Supabase yapılandırması, Apple/Google uçları |
| **UI/UX** | **64** | + tutarlı görsel dil, 64 tema birleşiminde kontrast testi, boş/hata/yüklenme durumları, 5 dil · − şablon ikon/splash, tarih seçici yok, sabit kategoriler, bütçe sekmesi pasif, uzun panel, "+%999+", es/it kesilmeleri | Cihazdaki dokunma hissi, VoiceOver/TalkBack |
| **Performans** | **60** | + 1k kayıtta hesaplar ≤ 10 ms, kur önbelleği, okuma bir kez · − sanallaştırılmamış listeler, her değişiklikte tüm verinin yazılması, memo yok; 10k kayıtta ~1 MB tek değer | Açılış süresi, bellek, FPS (cihaz gerekli) |
| **Fonksiyonellik** | **63** | + harcama/gelir/abonelik/bütçe/rapor/Excel/yedek/çoklu para birimi tarayıcıda uçtan uca çalışıyor · − abonelik bildirimi fiilen kapalı (F-04), kur yokken karışık toplam (F-06), negatif tutar kabulü (F-05), geçmişin bugünkü kurla değişmesi (F-09), özel kategori/tekrarlayan gelir yok, hesap var ama eşitleme yok | Gerçek bildirim, gerçek giriş sağlayıcıları |
| **Yayın hazırlığı** | **25** | + hedef API 36, hesap silme akışı, yasal metin taslağı, `check:release` betiği · − şablon ikon/splash, 7 `REPLACE_ME`, yayınlanmış URL yok, `eas.json`/sürüm numarası yok, hiç cihaz derlemesi yok, Supabase kurulmamış, CI yok, mağaza beyanları ve görselleri yok | — |

**Genel yayın hazırlık yüzdesi = %57**
Ağırlıklar: Kod %15 · Güvenlik %20 · UI/UX %15 · Performans %10 · Fonksiyonellik %20 · Yayın hazırlığı %20 →
`0,15×68 + 0,20×70 + 0,15×64 + 0,10×60 + 0,20×63 + 0,20×25 = 10,2 + 14,0 + 9,6 + 6,0 + 12,6 + 5,0 = 57,4`

---

## 8. P0–P3 geliştirme programı

**Varsayım:** 1 geliştirici (tam zamanlı) + yasal metinler için hukukçu + tasarımcı (ikon/görseller). Süreler geliştirme + test dahildir.

### Hafta 1: Yayın engelleri (P0)
| Gün | İş | Çıktı / kabul ölçütü |
|---|---|---|
| 1 | Karar: ilk sürümde hesap özelliği **açık mı kapalı mı**? (Önerim: veri eşitlemesi gelene kadar **kapalı** yayınla; yasal yük, App Privacy ve Supabase işletimi küçülür. Kod hazır kalır.) PR #1'i birleştir; `eloquent-clarke` dalı için karar. | Tek esas dal |
| 1 | CI (GitHub Actions): `npm test`, `check:release`, web derlemesi + tarayıcı testleri (`PW_CHROMIUM` ortam değişkeni) | Her PR'da yeşil denetim |
| 2 | F-04 bildirim izni, F-05 tutar doğrulama, F-06 kur yokken toplamlar (+ birim/UI testleri) | Testler yeşil; F-05/F-06 için yeni test |
| 2–3 | F-01/F-02 ikon ve splash (tasarımcı), `expo-splash-screen`; `npx expo install --fix` ile yama sürümleri | `expo-doctor` 21/21 (ağ kontrolü hariç) |
| 3 | `eas.json` profilleri, `appVersionSource: remote`, `ITSAppUsesNonExemptEncryption` | İlk iOS/Android `preview` derlemesi |
| 3–5 | F-03 yasal alanlar, gizlilik/koşullar/silme sayfalarının yayını (hukukçu), `check:release`'e eklemeler: ikon md5'i şablon değil, `eas.json` var, splash yapılandırılmış | `check:release` → "Engel yok" |
| 4–5 | (Hesap açık seçilirse) Supabase üretim projesi, migration, Edge Function dağıtımı, Apple/Google sağlayıcıları, CAPTCHA, e-posta şablonları | Canlı uçtan uca giriş/silme |
| 5 | TestFlight dahili + Play dahili test yüklemesi; **Play kapalı testi başlat (12 kişi)** | 14 günlük saat başlar |

### Hafta 2: Cihaz doğrulaması ve P1
| Gün | İş |
|---|---|
| 6–7 | §6.3 cihaz test planı (en az 2 iPhone + 3 Android: biri Android 13+, biri düşük RAM) ve bulunan hataların giderilmesi |
| 8 | F-08 net değişim, F-07 üst sınır, F-12 kesilmeler, F-26 Apple düğmesi, F-22 `xlsx` değişimi |
| 9 | F-10 tarih seçici, F-11 hareket eşikleri (cihazda ayar) |
| 10 | Mağaza metadata (TR/EN/ES/IT), ekran görüntüleri, App Privacy ve Data safety formları, inceleme notları |

### Hafta 3: Gönderim ve P1 devamı
| Gün | İş |
|---|---|
| 11–12 | F-14 bütçe ekranı ilerleme listesi, tanıtım sonuna para birimi + bütçe adımı |
| 13 | F-18 uygulama kilidi, F-25 OTP (hesap açıksa), F-27 yasal ES/IT çevirisi |
| 14 | **App Store'a gönderim** (inceleme genelde 1–3 gün) |
| 15 | F-09 işlem anı kuru (veri modeli + taşıma + test) |

### Hafta 4: Play üretimi ve P2 başlangıcı
- Play kapalı test 14. günü dolunca üretim erişimi başvurusu → aşamalı yayın.
- P2 (Hafta 4–6): F-16 özel kategoriler, F-17 tekrarlayan gelir/gider, F-19 liste sanallaştırma, F-20 SQLite'a geçiş, F-15 panel sadeleştirme, F-21 filtreler, F-30 ayarlar, gelir-gider raporu, ay sonu özeti bildirimi, ana ekran kısayolları.
- P3 (Hafta 7+): Modül 3 bulut eşitleme, hesaplar/cüzdanlar ve gerçek bakiye, widget, şifreli yedek, birikim hedefleri, çökme raporlama (Sentry, kişisel veri maskeli).

---

## 9. GO / NO-GO kararı

**NO-GO.** Gerekçe:
1. Mağaza varlıkları ve yasal zorunluluklar hazır değil: şablon ikon/splash, doldurulmamış yasal bilgiler ve yayınlanmamış gizlilik/silme sayfaları (`check:release` 7 engel). Bunlar tek başına ret sebebidir.
2. Uygulama **hiç gerçek cihazda ya da EAS derlemesinde çalıştırılmadı**; `eas.json` ve sürüm numarası yönetimi yok.
3. Kullanıcıya görünen bir işlev bozuk (abonelik bildirimleri) ve iki veri doğruluğu hatası var (karışık birim toplamı, negatif tutar kabulü).
4. Hesap altyapısı (Supabase/Apple/Google) canlıda kurulmadı ve doğrulanmadı.

**GO'ya dönüş koşulları:** §8 Hafta 1 tamamlanmış; `check:release` "Engel yok"; CI yeşil; TestFlight ve Play kapalı testte §6.3'ün 1–9. maddeleri geçmiş; App Privacy/Data safety formları doldurulmuş. Bu koşullarla tahmini hazırlık **%80+** olur. App Store gönderimi ~2,5. hafta, Google Play üretimi (kişisel hesapta 14 günlük kapalı test nedeniyle) ~3,5. hafta.

---

### Ek A: Yayın politikası kaynakları
- Apple, minimum SDK şartı (Xcode 26 / iOS 26 SDK, 28 Nisan 2026): [developer.apple.com/news/upcoming-requirements](https://www.developer.apple.com/news/upcoming-requirements/) · [Expo blog](https://expo.dev/blog/app-store-connect-minimum-sdk-26)
- Google Play hedef API seviyesi (31 Ağustos 2026'dan itibaren API 36): [developer.android.com/google/play/requirements/target-sdk](https://developer.android.com/google/play/requirements/target-sdk) · [Play Console yardım](https://support.google.com/googleplay/android-developer/answer/11926878)
- Google Play kişisel hesap kapalı test şartı (12 test kullanıcısı, 14 gün): [Play Console yardım 14151465](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
- Google Play Financial features beyanı: [Play Console yardım 13849271](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en) · [Financial Services politikası](https://support.google.com/googleplay/android-developer/answer/9876821?hl=en)

### Ek B: Yeniden üretme
```bash
git fetch origin claude/spendly-dashboard && git worktree add ../pr1 origin/claude/spendly-dashboard
cd ../pr1/harcama-defteri-eng-tr-esp-ita && npm ci
npm test && npm run check:release; npx expo-doctor; npm audit
PATH=/usr/lib/postgresql/16/bin:$PATH npm run test:sql
npx expo export --platform web --output-dir /tmp/web-out
PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome WEB_DIR=/tmp/web-out node scripts/gesture-ui-test.js tr   # F-11
```
