# Spendly paneli: tasarım, veri, testler, kalan sorunlar

Referans: `Spendly` ana ekran görseli (başlık, bakiye kartı, hızlı eylemler, ikili kartlar, son işlemler, alt sekme çubuğu).

## Ne yapıldı

| Alan | Durum |
|---|---|
| Başlık: marka, saate göre selamlama, para birimi seçici, profil | ✔ (`DashHeader`, `CurrencyMenu`) |
| Bakiye kartı: net durum, geçen aya göre değişim, gelir/gider, göz ile gizleme | ✔ (`BalanceCard`) |
| Hızlı eylemler: Harcama ekle, Gelir ekle, Raporlar, Bütçe | ✔ |
| Harcama özeti (günlük çubuklar + dokununca ipucu), Kategoriler (halka), Aylık bütçe (halka), Abonelikler, Son işlemler | ✔ |
| Alt sekme çubuğu (Ana sayfa · İşlemler · Bütçe · Raporlar · Ayarlar) | ✔ (`TabBar`) |
| Gelir kaydı (ekle / düzenle / sil + geri al), İşlemler'de Harcamalar \| Gelirler | ✔ **yeni özellik** |
| Yüklenme iskeleti, hata ekranı + tekrar dene, boş durumlar, başarı bildirimleri | ✔ |
| Koyu / açık / telefona göre tema; tüm vurgu ve ton seçenekleri | ✔ |
| 320 px → 1280 px duyarlı yerleşim | ✔ (web'de ölçüldü) |
| Görünen ad "Spendly" | ✔ (uygulama adı, bildirimler, dosya adları, yedek iletileri, sayfa başlığı) |

### Referanstan bilerek ayrılanlar (ve nedeni)

- **"Total Balance" yerine "Net durum"**: uygulama hiç hesap bakiyesi tutmadı; başlangıç bakiyesi verisi yok. Kart **o ayın** gelir − giderini gösterir. Gelir kaydı yoksa net tutar **uydurulmaz**: "Harcanan" gösterilir ve gelir eklemek önerilir (istem: gerçek veri olmayan yerde sahte tutar gösterme).
- **Gelir**: referanstaki "Add Income / Monthly Income" için gelir kaydı gerçek bir özellik olarak eklendi (aşağıda).
- **Profil fotoğrafı yerine baş harfler**, **bayrak yerine para birimi simgesi** (bayrak emojileri tüm platformlarda çizilmez), **manzara fotoğrafı yerine** uygulamanın kendi gradyanlı koyu kartı. Fotoğraf varlığı yok; uydurma görsel eklenmedi.
- Yeni kurulumların varsayılan görünümü referansa yakın (telefona göre açık/koyu, safir vurgu, mavi ton). Uygulamanın "Noir ve Şampanya" kimliği tema seçeneği olarak duruyor.

## Veri modeli ve geriye uyumluluk

- `Data` artık `{ items, subs, incomes, settings }`. `incomes` **ayrı bir listedir**; harcama, rapor, kategori ve abonelik hesaplarına hiç karışmaz.
- **Eski kayıtlar:** `incomes` yoksa boş liste olur; yeni ayar alanı (`hideBalance`) yoksa `false`. **Eksik ayar alanlarında eski varsayılanlar korunur** (`noir`, `gold`, `classic`); yeni varsayılanlar yalnızca sıfırdan kurulumda geçerlidir. Açılış saklanan veriyi **yeniden yazmaz** (testle doğrulanır).
- **Yedek:** `incomes` yedeğe girer; gelirsiz eski yedekler olduğu gibi içe aktarılır, geri yüklerken aynı kimlikli gelir tekrarlanmaz.
- **Para birimi:** gelirler de girildikleri birimde saklanır ve gösterimde dönüştürülür; birim değiştirip geri alınca saklanan veri **bayt bayt aynıdır** (testle doğrulanır). TRY/USD/EUR/GBP/CNY ve 5 dil değişmedi.
- **Excel:** ayrı "Gelirler" sayfası. Yalnızca geliri olan ay artık "veri yok" demez. Üretim `src/excel.ts`'e (saf) ayrıldı ve Node'da çalışma kitabı okunarak test edilir.

## Bulunan ve düzeltilen kusurlar (geliştirme sırasında)

1. **Veri kaybı riski (var olandı):** depolama okunamayınca uygulama sessizce boş veriyle açılıyor ve sonraki kayıt gerçek veriyi eziyordu. Artık hata ekranı + "Tekrar dene"; **okuma hatasında gerçek veriye hiçbir şey yazılmaz** (testle doğrulanır). Bozuk kayıt `…:corrupt:<zaman>` anahtarına **özgün haliyle yedeklenir** ve kalıcı bir uyarıyla bildirilir; yazma hatası da kalıcı uyarı verir.
2. **Mevcut kullanıcı yeni sayılıyordu:** depolama okunamazsa kapı onu tanıtıma yönlendiriyordu; artık mevcut kullanıcı sayılır.
3. **Gerileme yakalandı:** yeni "Son işlemler" kartı, başka para biriminde girilmiş kayıtların **özgün tutarını** göstermiyordu. Geri getirildi.
4. **Yanlış uyarı:** hiç kur çekilememişken "son kayıtlı kurlar kullanılıyor" deniyordu. Artık doğru metin ("çevrilmeden gösteriliyor").
5. **Uzun tutarlar** bakiye kartında ikinci satıra taşıyordu ("₺12,004.5 / 0"); tutar uzunluğuna göre küçülüp tek satırda kalır.
6. **Dar ekran:** kart başlıkları, sekme etiketleri ve mini tutarlar es/it'te kesiliyordu; düzeltildi.
7. **Çalışma zamanı hatası önlendi:** menü uyarı sayıları gövdeden sonra hesaplanıyordu (yeni panel gövdede kullanıyor); öne alındı.
8. Eski Raporlar ekranının kullandığı `dash` stil adını yeni stilim eziyordu (sessiz görsel gerileme); ad değiştirildi.
9. Excel: yalnızca geliri olan ay "aktarılacak veri yok" diyordu.
10. Kurtarılan bozuk veri için uyarı **cihaz diline** uygun dilde çıkar (önce Türkçeydi).
11. **Güvenlik tuzağı (Modül 1):** sahte hesap servisi yalnızca derleme değişkenine bağlıydı; Metro önbelleği bu değeri bir derlemeden ötekine taşıyabiliyor. Artık ek olarak **çalışma zamanında** yalnızca `__DEV__` iken ya da testin verdiği bayrakla çalışır (bayraksız paketle doğrulandı).
12. Gereksiz kod temizliği: kullanılmayan `Hero`, 13 ölü çeviri anahtarı, 4 ölü dışa aktarım, kullanılmayan içe aktarmalar kaldırıldı.

## Test sonuçları (son çalıştırma)

| Paket | Sonuç |
|---|---|
| `npm test` (tip kontrolü, çeviri denetimi, çekirdek **709**, kur **811**, tema **1032**, panel/gelir **100**, hesap **101**, Edge Function **42**) | hepsi geçiyor, 0 hata |
| `npm run test:sql` (gerçek PostgreSQL, RLS) | 34 / 34 |
| `dashboard-ui-test` (yeni; tr/en/es/it/zh) | 239 / 258 / 258 / 258 / 258 kontrol, **0 hata** |
| `ui-test`, `currency-ui-test`, `gesture-ui-test`, `theme-ui-test` (mevcut; 5 dil) | 51·42·33·78 kontrol, **0 hata** (gerileme yok) |
| `auth-ui-test` (Modül 1; sahte hesap servisli paket) | 103–104 kontrol / dil, 0 hata |

Mevcut tarayıcı testleri yeni arayüze **uyarlandı** (menü düğmesi `testID`, hızlı eylem, panel başlığı); kapsamları azaltılmadı. Testlerin gerçekten hata yakaladığı **mutasyonla** doğrulandı (yanlış gelir tutarı, çalışmayan gizleme, kaydedilmeyen gelir, sığdırma kapalıyken büyük tutar, bakiye hesabında kesit/sıfıra bölme/gelirsiz ay).

Panel testi şunları sınar: tutarların doğruluğu (gelir − gider, +%175 gibi değişim, bütçe %, kategori %), gelir ekle/düzenle/sil/geri al, geçersiz tutar, gizleme (kalıcı), para birimi geçişi (kayıt bazlı yuvarlama, veri bütünlüğü, kur yokken kapalı seçenekler, kur hatası uyarıları), sekmeler ve gezinme, boş ve yalnız-gider durumları, bozuk veri / okuma hatası / yazma hatası / yüklenme iskeleti, açık-koyu-sistem tema ve **WCAG AA kontrast**, 5 vurgu rengi, 320–1280 px yerleşim ve taşma, büyük tutarlar, eski biçimli kayıt.

## Doğrulanamayanlar / kalan sorunlar (dürüst liste)

- **Gerçek iPhone/Android cihazlarda çalıştırılmadı.** Bu ortamda cihaz/emülatör yok; arayüz **Chromium'da** (telefon, tablet ve masaüstü boyutlarında, dokunmatik olaylarla) doğrulandı. Haptik, yerel bildirim, `expo-secure-store`, uygulama içi tarayıcı ve gerçek Expo Go davranışı cihazda denenmelidir.
- Alt sekme çubuğu ve kartlar iOS'ta "home indicator" boşluğunu güvenli alan değeriyle hesaplar; çentik/ada ve Android gezinme çubuğu **gerçek cihazda** gözle kontrol edilmelidir.
- `expo-doctor`/EAS derlemesi çalıştırılmadı.
- **Excel**: çalışma kitabı içeriği Node'da okunarak doğrulandı, ama dosya Excel/Numbers'ta açılıp paylaşım menüsü denenmedi.
- Net durum **aylıktır** (birikimli bakiye değil, bkz. yukarıdaki gerekçe). Düzenli (tekrarlayan) gelir yoktur.
- Net durum yüzdesi, geçen ayın neti sıfır ya da karşılaştırılacak veri yokken **gösterilmez**; negatif önceki netle yüzde "iyileşme" olarak yorumlanır (mutlak değerle).
- Ana sayfa tek ekranda uzundur (kartlar + eski "öne çıkanlar" ve "ay özeti" kutuları korunduğu için).
- Hesap (Modül 1) kısmında gerçek Supabase/Apple/Google doğrulanmadı ve yasal bilgiler `REPLACE_ME` durumda: bkz. `docs/QA-MODULE-1.md`. `npm run check:release` bu yüzden **yayını engeller**.
- `npm audit`: 25 bulgu önceden vardı (Expo araç zinciri, `xlsx` için düzeltme yok); bu çalışma yeni bağımlılık eklemedi.
- Eski `harcama-app/` projesi ve `harcama-defteri.html` **dokunulmadan** bırakıldı (kendi mağaza kimliği olan ayrı uygulama).
