# Monibo · Rakip analizi ve iyileştirme raporu

**Tarih:** 9 Kasım 2026 · **İncelenen sürüm:** `c181601` (dal `orhan/awesome-clarke-nbqv4i`)
**Kapsam:** Sizin verdiğiniz 7 ad → App Store'da 8 uygulama ("para yönetimi cashflow" iki ayrı uygulamaya karşılık geldiği için ikisi de alındı).

## 0. Yöntem ve sınırlar

- **Mağaza verisi:** Apple'ın iTunes Arama/Lookup servisi (TR ve ABD mağazası) ve App Store sayfaları: puan, değerlendirme sayısı, sürüm, ilk çıkış, açıklama, uygulama içi satın alma fiyatları (₺ ve $), gizlilik etiketleri.
- **Kullanıcı yorumları:** App Store'un herkese açık yorum akışından, her uygulama için ABD, Türkiye ve İngiltere mağazalarının **en yeni** yorumları (ülke başına en fazla 500). Toplam **4.298 yorum**, bunların **1.112'si Türkçe**.
- **Analiz:** Konu bazlı anahtar kelime sayımı (TR + EN) ve yorumların tek tek okunması. Sayılar **yaklaşık**tır (bir yorum birden fazla konuya girebilir; kelime eşleşmesi kusursuzdur diye varsayılmamalı). Alıntılar yorumlardan aynen alınmıştır.
- **Sınırlar:** Uygulamalar telefonda kurulup denenmedi; özellikler mağaza açıklaması ve yorumlardan çıkarıldı. YouTube kullanılmadı. Cashflow (5 değerlendirme) ve PocketPal (TR'de 38) çok yeni olduğu için yorum verisi zayıf. Yorum akışı yalnız en yeni yorumları verir: Spendee ve Budget Bestie'nin düşük puan oranı **son güncellemelerinden sonraki** dönemi yansıtır, genel puanlarını değil.

## 1. Pazar tablosu

| Uygulama (TR adı) | Geliştirici · çıkış | TR puan (adet) | ABD puan (adet) | Son yorumlarda 1–2★ | Model ve TR fiyatı | Son sürüm |
|---|---|---|---|---|---|---|
| **DEFTER** | BIZCE (TR) · 2014 | **4,72 (25.611)** · Finans #88 | 4,77 (508) | %18 | Abonelik: PRO ₺600, HOME ₺1.000, BOSS ₺1.800–4.799 | 13.1.2 · 29 Eki 2026 |
| **Para Yönetimi** (Money Manager) | Realbyte (KR) · 2012 | **4,81 (3.233)** | 4,82 (19.874) | %5 | Reklamlı ücretsiz; $2,49/ay, $19,99/yıl; ayrı reklamsız sürüm | 2.15.4 · 9 Kas 2026 |
| **Spending Tracker** | MH Riley (UK) · 2012 | 4,75 (79) | 4,78 (19.528) | %3 | Reklamlı ücretsiz; **tek seferlik Pro ₺149,99 / $2,99** | 3.3 · 22 Ağu 2026 |
| **Spendee** | Cleevio (CZ) · 2013 | 4,64 (589) | 4,61 (6.274) | **%42** (v6 tasarımı sonrası) | Abonelik ₺129,99–299,99/ay; ömür boyu $44,99–119,99 | 6.0.12 · 27 Eki 2026 |
| **Wallet** | BudgetBakers (CZ) · 2015 | 4,39 (389) | 4,56 (5.938) | **%34** | ₺249,99/ay, ₺1.499,99/yıl, ömür boyu ₺2.499,99 | 5.7.5 · 15 Eki 2026 |
| **Budget Bestie** | Budget Bestie Corp (US) · 2024 | — (3) | 4,66 (3.183) | **%60** | Yalnız abonelik: ₺149,99–299,99/ay, ₺1.299,99–2.299,99/yıl | 1.7.2 · 17 Eki 2026 |
| **PocketPal Budget** | 8x Social (US) · Mayıs 2026 | 3,5 (38) · Finans #73 | — | %30 (13 yorum) | **Haftalık ₺149,99**, aylık ₺299,99, yıllık ₺1.999,99 | 2.1.1 · 6 Kas 2026 |
| **Cashflow: Para Yöneticisi** | Burakhan Alptekin (TR) · Ağu 2026 | 5,0 (5) | — | yetersiz veri | ₺249,99/ay, ₺2.499,99/yıl, ömür boyu ₺5.999,99 | 1.4 · 30 Eki 2026 |

**Okuma:** Türkiye'de pazarın iki büyüğü 10 yılı aşkın **DEFTER** ve **Para Yönetimi**. İkisi de "her şeyi yapan ama karmaşık" uygulamalar. Global büyükler (Spendee, Wallet, Budget Bestie) şu anda **kendi güncellemeleri yüzünden kullanıcı kaybediyor**. Bu, yeni giren için bir pencere.

## 2. Uygulama bazında inceleme

### 2.1 DEFTER: Türkiye lideri (kişisel + ticari muhasebe)
- **Güçlü:** Defter/hesap **paylaşımı** (aile ve iş ortağıyla), cari/tedarikçi/stok hesapları, 150+ para birimi ve **altın** (AU) birimi, Excel'i e-postayla ve PDF'i WhatsApp'la gönderme, çoklu cihaz, 18 dil.
- **Şikâyet (TR, son dönem):** fiyat artışı ("300 liradan x2 yapmak ne kadar doğruydu"), karmaşıklaşan arayüz ("eski hali daha iyiydi"), destek yanıtsız ("yazdıklarına kimse cevap vermiyor"), defter silinemiyor.
- **İstekler:** **taksit bölümü** ("Programda taksit bölümü neden yok"), **ödendi/ödenmedi** durumu, **gümüş (XAG)**, banka/kart hareketlerini otomatik çekme.
- **Gizlilik etiketi:** ad, iletişim bilgisi, finansal bilgi ve satın alma geçmişi kimliğe bağlı toplanıyor.
- **Monibo için ders:** Ticari muhasebeye girmeyin; o alan DEFTER'in. Onun bireysel kullanıcıya fazla gelen karmaşıklığı Monibo'nun fırsatı.

### 2.2 Para Yönetimi (Money Manager, Realbyte): TR ve dünyada en yüksek puan
- **Güçlü:** Çift taraflı kayıt (hesaplar arası transfer), **kredi kartı hesap kesim tarihi** ve dönem borcu, **ay başlangıç gününü değiştirme**, takvim görünümü, ödeme şablonları ("payment profiles"), alt kategoriler, Wi-Fi üzerinden bilgisayardan düzenleme.
- **Şikâyet:** reklamlar ("Too many ads"), **senkronizasyon ve hesap yok**: cihaz değişince veri kaybı ("Updating wiped all my data", "Lost all my 2-3 months data"), Android'den iPhone'a geçilemiyor, taksit girişi karışık ("tutar borcun tutarı mı aylık taksit tutarı mı anlayamıyoruz").
- **Monibo için ders:** Ana ekran sade olabilir ama "güçlü kullanıcı" ayarları (ay başlangıcı, alt kategori, kart kesim günü) sadakat yaratıyor.

### 2.3 Spending Tracker (MH Riley): basitliğin şampiyonu
- **Güçlü:** Çok basit giriş; haftalık / **iki haftalık** / aylık / yıllık dönem; **kalan bütçeyi sonraki döneme devretme**; düzenlenebilir kategoriler ve ikonlar. Yüksek puanlı yorumlarda en sık övülen konu **kategori özelleştirme** (109 yorum).
- **Şikâyet:** tam ekran, yer yer uygunsuz reklamlar ("Can't X out of ads to access your data"), Dropbox'a bağlı yedek.
- **İstekler:** **birikim takibi** ("I would love for there to be a savings option/tracker"), **hedefe bölüştürme** ("buy a laptop in June for $1000… divide weekly or monthly"), alt kategoriler, takvim, kategoriye dokununca işlemlerinin listelenmesi.
- **Para modeli:** tek seferlik $2,99, yorumlarda açıkça takdir ediliyor ("I like that the pro is just $2.99 and no more ads").

### 2.4 Spendee: büyük tasarım değişikliği geri tepti
- **Güçlü:** banka, PayPal ve kripto bağlantısı; **yapay zekâ ile fiş tarama**; paylaşımlı cüzdan; etiketler; web sürümü. Son sürümde **Apple Pay ödemeleri kendiliğinden kaydoluyor** (iOS 27) ve **Siri ile ekleme ve bakiye sorma** var.
- **Şikâyet (Ağu–Eki 2026, v6):** donma ve yavaşlık ("After clicking the add button the pop up takes over a minute"), eski arayüze dönememe, büyüyen yazı tipleri, veri kaybı ("All my records for the last three years gone"), deneme süresi olmadan yıllık ücret çekilmesi. Son yorumların %42'si 1–2★.
- **Gizlilik etiketi:** cihaz kimliği ve **reklam verisi** kimliğe bağlı toplanıyor.
- **Monibo için ders:** Monibo da yakın zamanda tasarım değiştirdi. Ekleme akışının hızı ve dokunma tepkisi her güncellemede ölçülmeli (üstteki Kaydet hatası bu riskin küçük bir örneğiydi).

### 2.5 Wallet (BudgetBakers): banka bağlantısı vaadi, destek sorunu
- **Güçlü:** 4.000+ bankayla otomatik senkronizasyon, borsa takibi, paylaşım, 47 dil.
- **Şikâyet:** **banka bağlanmıyor** (119 düşük puanlı yorumda geçiyor), destek talebi bile oluşturulamıyor ("Death spiral of help requests"), ömür boyu satın alımın iptal edilmesi, eski telefona desteğin kesilmesi, iOS'ta Android'deki **borçlar** ve **hedefler** özelliklerinin olmaması.
- **İstekler:** **Apple Pay otomasyonuyla otomatik kayıt** (Kısayollar), yerleşik hesap makinesi, borç ve alacak takibi, "aya kaç parayla başladım".
- **Monibo için ders:** Banka bağlantısı Türkiye'de zaten yok ve dünyada en büyük şikâyet kaynağı. Monibo bunun yerine elle girişi çok hızlı yapıp Apple Pay ve Kısayollar ile yarı otomatik girişe yatırım yapmalı.

### 2.6 Budget Bestie: gizli ödeme duvarı öfkesi
- **Güçlü:** maaş dönemine göre (haftalık / iki haftalık / ayda iki / aylık) **zarf ("cash stuffing")** bütçesi; geçmişe ve yaklaşan faturalara bakarak **zarflara ne koyulacağını öneriyor**; birikim zarfları; aylık özet; ödenmemiş düzenli gider hatırlatması.
- **Şikâyet:** **30 dakikalık kurulumdan sonra ücretli olduğunu söylemesi** (102 düşük puanlı yorumun 56'sı): "It took like 30 minutes to set up… it was $90 to actually use!!", "whole point of the app is to save money". Yeni tasarım da beğenilmedi.
- **İstekler:** eşin kendi telefonundan giriş yapabilmesi, **borç ve kredi kartı ödemesi takibi**, toplamlar.
- **Monibo için ders:** Ücretli bir bölüm olacaksa **kurulumdan önce** açıkça söylenmeli. Temel kayıt hiçbir zaman kilitlenmemeli.

### 2.7 PocketPal Budget: yeni, agresif, yapay zekâlı
- **Güçlü (açıklamadan):** ana ekranda tek sayı: **"maaşa kadar harcayabileceğin"**; zarflar; fişi okuyup satırları zarflara dağıtma; **Back Tap ve Kısayollar ile uygulamayı açmadan kayıt**; kendi verilerinden yanıt veren asistan ("Can I afford a night out?"); hedeflerin **ne zaman tamamlanacağını** söylemesi; **taksitler** ve önümüzdeki 12 ay; seri (streak), seviye, büyüyen kumbara; banka bağlantısı yok.
- **Şikâyet (TR):** 4. zarfta ödeme istemesi, **kredi kartı ve mevcut borç eklenememesi**, zarf mantığının anlaşılmaması ("harcadığımı toplamak yerine zarftaki paradan düşüyor"), haftalık ₺149,99 fiyat, **domuz simgesi** ("Tr dil ekliyorsun simgen domuz??").
- **Gizlilik etiketi:** "Data Used to Track You": satın alma, iletişim, kimlik ve kullanım verisiyle **izleme yapıyor**.
- **Monibo için ders:** Türkiye'de birikim için **domuz kumbara görseli kullanılmamalı**. Para Yönetimi yorumlarında da aynı tepki var ("Domuz sembolüne aldanmayın").

### 2.8 Cashflow: Para Yöneticisi: yeni yerli rakip
- **Güçlü (açıklamadan):** **30 ve 90 günlük nakit akışı tahmini** ve "bakiyenin düşeceği günleri önceden görme", kart, borç ve abonelik takibi, **kart ekstresi içe aktarma**, Siri, widget, Face ID, **iCloud yedeği**, Apple Watch, başarımlar, temalar.
- Yorum verisi yok; ömür boyu fiyatı ₺5.999,99.
- **Monibo için ders:** En yakın konumlanan rakip bu (yerli, gizlilik odaklı, iOS'a özgü özellikler). Monibo'nun farkı fiyat, 5 dil ve çoklu para birimi olmalı.

## 3. Yorumlardan çıkan 7 ortak ders

| # | Ders | Kanıt (son yorumlar) | Monibo'nun durumu |
|---|---|---|---|
| D1 | **Sürpriz ödeme duvarı en büyük 1★ sebebi** | Budget Bestie 56/102, PocketPal, Spending Tracker ("Another 'Free' Budget App"), Spendee (deneme olmadan ücret çekme) | Ödeme yok. Model belirlenirken bu ders esas alınmalı |
| D2 | **Veri kaybı ve cihaz değişimi** güveni bitiriyor | Para Yönetimi, Spendee, Wallet (91), DEFTER | ⚠️ Veri yalnız telefonda; yedek elle alınıyor. **En büyük risk** |
| D3 | **Büyük tasarım değişikliği ve yavaşlık** sadık kullanıcıyı kaçırıyor | Spendee (107), Budget Bestie | Yeni tasarım yapıldı; hız ölçümü yok |
| D4 | **Reklam** temel işlevi engellediğinde terk ediliyor | Spending Tracker, Para Yönetimi | ✅ Reklam yok (fark olarak öne çıkarılmalı) |
| D5 | **Banka bağlantısı** ya yok ya da sürekli bozuk | Wallet (119), Spendee (69) | Yok; TR için doğru. Yerine hızlı ve yarı otomatik giriş |
| D6 | **Destek yanıtsız** | Wallet (60), Spendee (43), DEFTER | Uygulama içi geri bildirim yok |
| D7 | **Kategori özgürlüğü** en çok övülen şey | Spending Tracker (109), Para Yönetimi (45) | ⚠️ 8 sabit kategori; ekleme ve düzenleme yok |

**Türkiye'ye özgü (1.112 TR yorumu):** kolay ve hızlı kullanım en çok övülen konu (102). Fiyat (88), Excel/PDF rapor (37), yedek ve senkronizasyon (35), **borç/alacak (27)**, ailece ve eşle **paylaşım (25)**, **altın ve döviz (24)**, **kredi kartı ve ekstre (18)**, **taksit (12)** sık geçiyor. Taksit ve kart dönemini iyi yapan bir rakip yok: DEFTER'de taksit yok, Para Yönetimi'nde girişi karışık, PocketPal'da kredi kartı eklenemiyor.

## 4. Özellik karşılaştırması

✅ var · ◐ kısmen · — yok · ? doğrulanmadı

| Özellik | Monibo | DEFTER | Para Yön. | Sp. Tracker | Spendee | Wallet | B. Bestie | PocketPal | Cashflow |
|---|---|---|---|---|---|---|---|---|---|
| Reklamsız (ücretsiz sürümde) | ✅ | ? | — | — | ? | ? | — (ödemesiz kullanılmıyor) | — | ? |
| İzleme yok (gizlilik etiketi) | ✅ | ◐ | ? | ? | — (reklam verisi) | ◐ | ? | — (izliyor) | ✅ |
| Hesapsız kullanım | ✅ | — | ✅ | ? | ? | — | ? | ? | ? |
| Çoklu para birimi + canlı kur | ✅ (5) | ✅ (150+) | ✅ | — | ✅ | ✅ | — | — | ? |
| Altın/gümüş birimi | — | ◐ (altın) | — | — | — | — | — | — | ? |
| Kendi kategorisini ekleme/düzenleme | **—** | ✅ | ✅ (+alt kat.) | ✅ | ✅ | ✅ | ✅ (zarf) | ✅ (zarf) | ? |
| Kategori limitleri | ✅ | ✅ | ✅ | — (istek) | ✅ | ✅ | ✅ | ✅ | ? |
| Ay başlangıç günü / maaş dönemi | — | ? | ✅ | ✅ | ? | ? | ✅ | ✅ | ? |
| Kalan bütçeyi devretme | — | ? | ? | ✅ | ? | ? | ✅ | ✅ | ? |
| Abonelik / düzenli ödeme | ✅ (aylık/yıllık) | ✅ | ✅ | ◐ (Pro) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Haftalık / iki haftalık tekrar | — | ✅ | ✅ | ✅ | ? | ✅ | ✅ | ? | ? |
| **Taksit takibi** | — | — (istek) | ◐ (karışık) | — | — | — | — | ✅ | ? |
| **Kredi kartı kesim / son ödeme** | — | ◐ | ✅ | — | — | ◐ | — | — | ✅ |
| Borç / alacak | — | ✅ | ◐ | — | — | ◐ (yalnız Android) | — (istek) | ◐ | ✅ |
| Birikim hedefi | — | ◐ | — | — (istek) | — (istek) | ◐ (yalnız Android) | ✅ | ✅ | ◐ |
| Nakit akışı tahmini | — | — | — | — | — | — | ◐ | ◐ | ✅ (30/90 gün) |
| Paylaşım (eş/aile) | — | ✅ | — | ◐ (Dropbox) | ✅ | ✅ | — (istek) | — | — |
| Bulut senkronizasyon / otomatik yedek | — (elle yedek) | ✅ | — | ◐ | ✅ | ✅ | ? | ? | ✅ (iCloud) |
| Widget | — | ? | ? | ? | ? | ? | ? | ? | ✅ |
| Siri / Kısayollar / Back Tap | — | ? | ? | ? | ✅ | — (istek) | ? | ✅ | ✅ |
| Apple Pay ile otomatik kayıt | — | — | — | — | ✅ (iOS 27) | ◐ | — | — | ? |
| Fiş tarama | — | — | — | — | ✅ | ? | — | ✅ | ? |
| Banka bağlantısı | — | — | — | — | ✅ | ✅ | — | — | ◐ (ekstre içe aktarma) |
| Excel / PDF dışa aktarma | ✅ (Excel) | ✅ (Excel+PDF) | ✅ | ◐ (Pro) | ? | ✅ | — | — | ✅ |
| İçe aktarma (CSV / başka uygulama) | — (yalnız kendi yedeği) | ? | ◐ | ? | ? | ✅ | — | — | ✅ (ekstre) |
| Tutarları gizleme kipi | ✅ | ? | ? | ? | ? | ? | ? | ? | ? |
| Face ID kilidi | ✅ | ✅ | ✅ | ✅ | ? | ✅ | ? | ? | ✅ |
| Dil sayısı | 5 | 18 | 19 | 1 | 27 | 47 | 1 | 6 | 10 |

## 5. Monibo'yu farklı kılacak konumlandırma

> **"Reklamsız, seni izlemeyen, Türkiye'nin kart ve taksit gerçeğine göre kurulmuş, verisi kaybolmayan, 5 dilli kişisel bütçe."**

Bu birleşimi sunan bir rakip yok:
- DEFTER ve Para Yönetimi güçlü ama karmaşık ve reklamlı ya da pahalı.
- Spendee, Wallet ve PocketPal kullanıcıyı izliyor ya da reklam verisi topluyor.
- Taksit ve kart dönemini düzgün yapan bir uygulama yok.
- Monibo'nun bugün zaten sahip olduğu farklar: **tutar gizleme kipi**, **hesapsız ve tamamen yerel çalışma**, **canlı kurla çoklu para birimi**, **Wada renk kombinasyonlu temalar**.

## 6. Eksikler ve iyileştirme programı

İş büyüklüğü: **S** ≤ 1 gün · **M** 2–4 gün · **L** 1–2 hafta · **XL** > 2 hafta. "Yerel modül" yazan maddeler Expo Go'da görünmez; yeni bir `eas build` ister.

### P0: Güven (yayından önce ya da hemen sonra)
| # | İş | Neden (kanıt) | Büyüklük |
|---|---|---|---|
| P0-1 | **Otomatik yedek:** her gün ya da her değişiklikte iCloud Drive/Dosyalar'a şifreli yedek, ilk açılışta "yedekten geri yükle" sorusu | D2: dört rakipte veri kaybı şikâyeti; Monibo'da yalnız elle yedek | M (yerel modül gerekebilir, doğrulanmadı) |
| P0-2 | **Fiyat modeli kararı ve şeffaflık:** ücretli bölüm olacaksa ilk ekranda söylenmeli; temel kayıt hiçbir zaman kilitlenmemeli | D1 | S (karar) |
| P0-3 | **Uygulama içi geri bildirim:** Ayarlar'da "Öneri / Sorun bildir" (e-posta taslağı + uygulama sürümü) | D6 | S |
| P0-4 | **Ekleme akışı için hız bütçesi:** "+"dan kaydete kadar süreyi testle ölç, her sürümde kontrol et | D3: Spendee v6 | S |

### P1: Farklılaşma (ilk 1–2 güncelleme)
| # | İş | Neden (kanıt) | Büyüklük |
|---|---|---|---|
| P1-1 | **Kendi kategorini ekle ve düzenle** (ad, ikon, renk; sabit 8'in yanında) | D7: en çok övülen özellik; bütün rakiplerde var | M |
| P1-2 | **Taksit takibi:** toplam tutar, taksit sayısı, kart; her ay otomatik gider, "kalan taksit borcu" ve gelecek aylara yük | TR yorumları, DEFTER'den istek, Para Yönetimi'nde karışık, PocketPal'da kart yok; rakipsiz alan | M (abonelik altyapısının üstüne) |
| P1-3 | **Kredi kartı dönemi:** kart tanımı (kesim günü, son ödeme günü), harcamada "nakit / kart" seçimi, "bu dönem kart borcu" ve son ödeme hatırlatması | TR: ekstre ve kesim isteği (18 yorum), Para Yönetimi'nin en çok övülen yanı | M |
| P1-4 | **Birikim hedefleri** (önceki önerideki 1+2+3): hedef tarih ile "ayda ne ayırmalıyım", ay sonu artanı hedefe aktarma, birikim oranı grafiği. **Görsel: kavanoz ya da kasa, domuz değil** | Spending Tracker ve Spendee'den istek, Budget Bestie ve PocketPal'ın temel özelliği, TR'de domuz simgesine tepki | M |
| P1-5 | **Ay başlangıç günü / maaş günü** ayarı ve ana ekranda **"maaşa kadar günlük harcanabilir"** | Para Yönetimi, Spending Tracker, PocketPal, Budget Bestie | S–M |
| P1-6 | **Hızlı giriş:** Siri/Kısayollar eylemi ("Monibo'ya 120 lira market ekle"), Back Tap, **Apple Pay sonrası Kısayol otomasyonu** | Wallet'tan istek, Spendee ve PocketPal'da var | L (yerel modül, App Intents; doğrulanmadı) |
| P1-7 | **Borç / alacak** ("kime ne verdim, kimden ne alacağım", hatırlatmalı) | TR'de 27 yorum, Wallet iOS'tan istek, Budget Bestie'den istek | M |

### P2: Derinlik
| # | İş | Neden | Büyüklük |
|---|---|---|---|
| P2-1 | **Altın (gram) ve gümüş** birimi; birikimde ve hesapta TL karşılığı | DEFTER'den istek; TR'de birikim alışkanlığı. Kur kaynağı gerekli (Frankfurter'da yok, doğrulanmadı) | M |
| P2-2 | **Nakit akışı tahmini:** gelir + abonelik + taksit + kart ödemesinden "ay sonu tahmini bakiye" ve "eksiye düşeceğin gün" | Cashflow'un ana özelliği; Monibo'da veri zaten var | M |
| P2-3 | **Haftalık / iki haftalık tekrar** ve **düzenli gelir** (maaş) | Spending Tracker, Budget Bestie | S |
| P2-4 | **Kalan bütçeyi devretme** (isteğe bağlı) | Spending Tracker | S |
| P2-5 | **İçe aktarma:** CSV ve Para Yönetimi / Spendee dışa aktarımlarından geçiş sihirbazı | Rakipten gelen kullanıcıyı kazanmak; Para Yönetimi'nde Android→iOS şikâyeti | M |
| P2-6 | **PDF rapor ve WhatsApp ile paylaşım** (aylık özet) | DEFTER'in TR'de sevilen özelliği; TR'de 37 rapor yorumu | M |
| P2-7 | **Takvim görünümü** ve **kategoriye dokununca işlemleri** | Para Yönetimi; Spending Tracker'dan istek | S–M |
| P2-8 | **Widget** (bugün harcanan / kalan) | Cashflow; Spendee'den istek | L (yerel modül) |

### P3: Sonra
| # | İş | Not | Büyüklük |
|---|---|---|---|
| P3-1 | **Aile/eş ile ortak bütçe** | TR'de güçlü istek, ama Supabase'de veri senkronizasyonu kurmayı gerektirir; gizlilik ve App Store yükü artar | XL |
| P3-2 | **Fiş tarama** (cihaz üzerinde, fotoğraf dışarı gönderilmeden) | Spendee ve PocketPal'da var; gizlilik vaadiyle uyumlu olmalı | L |
| P3-3 | Hafif oyunlaştırma (kayıt serisi) | PocketPal ve Cashflow; dozunda tutulmalı | S |
| P3-4 | Verilerinden yanıt veren asistan ("Bu ay dışarıda yemeğe ne kadar kaldı?") | PocketPal "Pal"; maliyet ve gizlilik değerlendirmesi gerek | L |
| P3-5 | Banka bağlantısı | **Önerilmez:** TR'de pratik değil, dünyada en büyük şikâyet kaynağı (D5) | — |

### Yapılmaması gerekenler (rakiplerden dersler)
- Kurulumu bitirttikten sonra ödeme istemek (Budget Bestie).
- Haftalık abonelik (PocketPal ₺149,99/hafta tepki aldı).
- Tam ekran reklam (Spending Tracker, Para Yönetimi).
- Geri dönüşsüz büyük tasarım değişikliği (Spendee v6).
- "Ömür boyu" satın alımı sonradan geri çekmek (Wallet).
- Türkiye'de domuz kumbara görseli (PocketPal, Para Yönetimi).
- Ticari muhasebeye (cari, stok) girmek; o alan DEFTER'in.

## 7. Fiyat modeli önerisi (karar sizin)

Kanıt: tek seferlik ücretler övülüyor (Spending Tracker $2,99); abonelikler ve özellikle kurulum sonrası ücret ise 1★ sebebi. TR fiyat aralığı: DEFTER PRO ₺600, Spending Tracker Pro ₺149,99, Wallet yıllık ₺1.499,99, Cashflow yıllık ₺2.499,99.

**Öneri:** Kayıt, bütçe, rapor ve gizlilik **ücretsiz ve reklamsız** kalsın. İsteğe bağlı **tek seferlik "Monibo Plus"** ya da düşük yıllık ücret, ileri özellikleri açsın: otomatik bulut yedeği, taksit ve kart, tahmin, PDF, widget. Fiyat, rakip aralığının alt yarısında konumlanabilir. Kesin rakam için TR ve ABD'de küçük bir deneme önerilir. Ödeme eklenmesi App Store'da uygulama içi satın alma, gizlilik formu ve inceleme notunun güncellenmesini gerektirir.

## 8. Önerilen yol haritası

| Sürüm | İçerik |
|---|---|
| **1.0 (gönderim)** | Mevcut + P0-3 (geri bildirim) + P0-4 (hız ölçümü). Hesaplar kapalı (önceki karar önerisi) |
| **1.1** | P1-1 kategori düzenleme · P1-4 birikim hedefleri · P1-5 maaş günü / günlük harcanabilir · P2-3 haftalık tekrar ve düzenli gelir |
| **1.2 ("Türkiye sürümü")** | P1-2 taksit · P1-3 kredi kartı dönemi · P1-7 borç/alacak · P2-1 altın/gümüş |
| **1.3 (yeni derleme ister)** | P0-1 otomatik iCloud yedeği · P1-6 Siri/Kısayollar/Apple Pay · P2-8 widget · P2-2 nakit akışı tahmini |
| **2.0** | Plus modeli · P2-5 içe aktarma · P2-6 PDF · P3-1 ortak bütçe (değerlendirme) |

## 9. Kaynaklar

- App Store sayfaları (TR): [DEFTER](https://apps.apple.com/tr/app/id880944538) · [Para Yönetimi](https://apps.apple.com/tr/app/id560481810) · [Spending Tracker](https://apps.apple.com/tr/app/id548615579) · [Spendee](https://apps.apple.com/tr/app/id635861140) · [Wallet](https://apps.apple.com/tr/app/id1032467659) · [Budget Bestie](https://apps.apple.com/tr/app/id6460258044) · [PocketPal Budget](https://apps.apple.com/tr/app/id6771015224) · [Cashflow: Para Yöneticisi](https://apps.apple.com/tr/app/id6760368797)
- Mağaza verisi: iTunes Lookup servisi (`itunes.apple.com/lookup?id=…&country=tr|us`), 9 Kasım 2026.
- Yorumlar: App Store yorum akışı (`itunes.apple.com/{tr,us,gb}/rss/customerreviews/…/sortby=mostrecent/json`), 9 Kasım 2026'da çekilen 4.298 yorum.
- Monibo karşılaştırması: kod tabanı `c181601` (kategori listesi `src/lib.ts` `CATS`, tekrar sıklığı `Sub.freq`, yedek `src/files.ts`).
