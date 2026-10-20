# Harcama Defteri · TR / EN / ES / IT / 中文

`harcama-app` klasöründeki uygulamanın **bağımsız** çok dilli, çok para birimli sürümü. Kaynak proje değiştirilmedi;
tüm geliştirmeler yalnızca bu klasörde yapıldı. Önceki uygulamanın bütün işlevleri (harcama, bütçe ve kategori limitleri,
raporlar, abonelikler, Excel/yedek, bildirimler, Noir ve Fildişi temalar) ve tasarımı korunmuştur.

## Yenilikler

- **Diller:** Türkçe, İngilizce, İspanyolca, İtalyanca, Mandarin Çincesi (简体中文, basitleştirilmiş yazı). Tüm ekranlar, menü, kategoriler, bildirimler, hata/bilgi mesajları ve Excel
  çıktısı çevrilidir. Dil Ayarlar'dan anında değişir ve kalıcıdır.
- **Para birimleri:** TRY (₺), USD ($), EUR (€), GBP (£), CNY (¥, Çin yuanı). Ana para birimi dilden **bağımsız** seçilir (Ayarlar → Para birimi).
- **Güncel kurlar:** Açılışta, uygulama öne gelince (kurlar 6 saatten eskiyse) ve elle güncellenir. Kaynaklar sırayla
  [Frankfurter](https://frankfurter.dev) (AB Merkez Bankası referans kurları) ve [ExchangeRate-API open endpoint](https://www.exchangerate-api.com/docs/free).
  Kur güncelleme zamanı, kaynağı ve kur tarihi Ayarlar'da; çevrilmiş tutar içeren ekranlarda (Özet, Harcamalar, Raporlar, Abonelikler, Bütçe)
  kısa bir kur notu olarak görünür.
  **Uygulamada yerleşik ya da uydurma kur yoktur.** İlk başarılı çekimden önce kur yoksa bu açıkça yazılır, çevrim gerektiren seçenekler kapalı kalır.
  Çevrimdışıyken son kayıtlı kurlar kullanılır ve eskiyse uyarı çıkar.
- **Nasıl dönüştürülür:** Her kayıt **girildiği para biriminde** saklanır (`cur`). Ekranlarda (özet, listeler, grafikler, raporlar,
  bütçe ve limitler, abonelikler, öne çıkanlar, Excel) tutarlar güncel kurla ana para birimine çevrilir; çevrilen kayıtlarda özgün tutar da
  yazılır. Kur ya da ana para birimi değişince saklanan veri değişmez, bu yüzden para birimini değiştirip geri almak hiçbir tutarı kaydırmaz.
  Harcama ve abonelik formunda kayıt için istenen para birimi seçilebilir (ana birimdeki karşılığı ve kur formda görünür).
- **Renk kartelaları:** Ayarlar → Görünüm'de 8 vurgu rengi (şampanya, zümrüt, safir, ametist, gül, bakır, turkuaz, gümüş) ve 4 zemin tonu
  (klasik, mavi, yeşil, erik). Seçim hem koyu (Noir) hem açık (Fildişi) temada ve "Telefona göre" modunda geçerlidir; ekran anında yeniden boyanır.
  64 tema birleşiminin tamamı WCAG kontrast testinden geçer (yazı ≥ 7:1, vurgu ve özet kartı etiketleri ≥ 4.5:1). Varsayılan görünüm değişmedi.
- **Kaydırma hareketleri:** Ekranın herhangi bir yerinden sağa kaydırınca önceki ekrana dönülür (sayfa parmakla birlikte kayar, kenarda geri oku belirir);
  ana ekranda gidecek yer olmadığı için yalnızca sol kenardan sağa kaydırma yan menüyü açar. Yan menü sola kaydırılarak kapanır (panelden ya da karartılmış
  alandan); alt sayfalar (harcama/abonelik formu) sol kenardan sağa kaydırılarak kapanır. Yatay kaydırılan kategori çipleri kendi kaydırmasını korur; kısa,
  dikey ağırlıklı ya da yanlış yöndeki kaydırma bir şey yapmaz.
- **Yerelleştirme:** Sayı/ondalık ayracı, para simgesinin yeri (tr/en/zh önde `₺1.250,50`, es/it sonda `1250,50 €`), yüzde işareti, tarih ve
  saat gösterimi seçilen dile göredir; Node'un `Intl` (CLDR) çıktısıyla karşılaştırılarak test edilir.

Uygulamada **gelir ya da bakiye kaydı yoktur** (yalnızca harcama, bütçe ve limitler); "kalan bütçe" bakiye benzeri değerdir ve çevrilir.

## Eski veriler

Eski kayıtlar para birimi taşımadığı için TRY sayılır. Aynı cihazda aynı depolamayı kullanırsan veri otomatik okunur
(`harcama-defteri:v1`). Eski uygulamadan taşımak için orada **Ayarlar → Yedek al**, buradaki **Ayarlar → Yedekten geri yükle**
(eski ve yeni yedek biçimleri okunur; bütçe/limitler ₺ olarak gelir).

## Bağımsız çalıştırma

`app.json` bu proje için ayrıdır (slug `harcama-defteri-eng-tr-esp-ita`, paket kimliği `com.karabag.harcamadefteri.global`);
eski projenin EAS kimliği kullanılmaz, böylece eski uygulamanın güncellemeleri etkilenmez.

Bu proje için ayrı bir EAS projesi oluşturuldu (`karabagorhans-team/harcama-defteri-eng-tr-esp-ita`) ve `main` dalına yayınlandı.
Expo Go'da açmak için (iPhone'da Safari'ye ya da Notlar'a yapıştırıp dokun):

`exp://u.expo.dev/065165d8-42b7-447e-9960-e8263cf7d992?runtime-version=1.0.0&channel-name=main`

Diğer açılış bağlantıları: `…&channel-name=ekle` (yeni harcama formu), `…&channel-name=ayarlar` (Ayarlar), `…&channel-name=butce` (bütçe alanı).

Yeniden yayınlamak: `npx eas-cli@latest update --branch main --environment production --message "..."`.

```bash
npm install
npx expo start            # Expo Go
```

Kestirme bağlantıları (`harcama://ekle?tutar=125,50&kategori=market`) aynen çalışır; tutar her zaman Türkçe kurallarla okunur ve ana para
biriminde girilir. Aynı cihazda iki uygulama kuruluysa `harcama://` şeması ikisinde de tanımlıdır.

## Testler

```bash
npm test                  # tip kontrolü + çeviri denetimi + çekirdek, para birimi ve renk (kontrast) testleri
npx expo export --platform web --output-dir /tmp/web-out
node scripts/ui-test.js <tr|en|es|it|zh>            # tüm ekranlar, taşma/kesilme, dil geçişi
node scripts/currency-ui-test.js <tr|en|es|it|zh>   # kur, ana para birimi, veri bütünlüğü, çevrimdışı
npx tsx scripts/theme-ui-test.ts <tr|en|es|it|zh>   # renk kartelaları: mod × ton × vurgu, kalıcılık
node scripts/gesture-ui-test.js <tr|en|es|it|zh>    # kaydırma hareketleri (gerçek dokunma olaylarıyla)
```

Testlerdeki kur değerleri yalnızca test verisidir; canlı API çağrısı testlerde taklit edilir.

Kod yapısı: `App.tsx` ana ekran; `src/currency.ts` para birimi/kur/dönüşüm; `src/useRates.ts` kur çekme ve önbellek;
`src/i18n/` katalogları (`tr`, `en`, `es`, `it`, `zh`); `src/palette.ts` renkler ve kartelalar; `src/lib.ts` hesaplar; `src/store.ts` kayıt ve eski veri uyumu; `src/sheets.tsx` formlar;
`src/ui.tsx` grafik ve düğmeler; `src/files.ts` Excel/yedek; `src/notify.ts` bildirimler.
