# Harcama Defteri (iPhone uygulaması)

Expo (React Native) ile yazılmış kişisel harcama takip uygulaması. Web sürümündeki
(`../harcama-defteri.html`) tüm özellikler burada da var:

- Harcama ekleme, düzenleme, silme (listede harcamaya dokun)
- Aylık bütçe, ay analizi (günlük ortalama, geçen aya göre, en yoğun gün, ay sonu tahmini)
- Günlük harcama grafiği ve kategori dağılımı (dokunarak filtreleme)
- Abonelikler: ödeme günü gelince onay bekler, "Ödendi" ya da "Bu dönemi atla"
- Excel (.xlsx) dışa aktarma, JSON yedek alma ve geri yükleme
- Akşam hatırlatması ve abonelik ödeme günü bildirimi

Veriler yalnızca telefonda saklanır; internet gerekmez.

## Ücretsiz çalıştırma (Expo Go)

Gerekenler: iPhone'a App Store'dan **Expo Go**, bilgisayara (Windows, Mac ya da Linux)
**Node.js LTS** (https://nodejs.org).

```bash
git clone https://github.com/karabagorhan/claude-efficient-usage.git
cd claude-efficient-usage
git checkout claude/harcama-defteri
cd harcama-app
npm install
npx expo start
```

Ekranda çıkan QR kodu iPhone kamerasıyla okut; uygulama Expo Go içinde açılır.
iPhone ile bilgisayar aynı Wi-Fi ağında olmalı. Farklı ağdaysa: `npx expo start --tunnel`.

## Bilgisayar açık olmadan kullanmak (ücretsiz EAS Update)

Bir kez bilgisayardan yayınlarsın, sonra Expo Go'dan her zaman açılır:

```bash
npx eas-cli@latest login          # ücretsiz expo.dev hesabı
npx eas-cli@latest update:configure
npx eas-cli@latest update --branch main --message "ilk sürüm"
```

iPhone'da Expo Go'ya aynı hesapla giriş yap; proje "Projects" altında görünür.

## Web sürümünden verileri taşıma

1. Web sürümünde en alttaki **Yedek al (uygulamaya taşımak için)** düğmesine bas, dosyayı Dosyalar'a kaydet.
2. Uygulamada **Ayarlar → Yedekten geri yükle** ile o dosyayı seç. Aynı kayıtlar iki kez eklenmez.

## Geliştirme

```bash
npx tsc --noEmit                 # tip kontrolü
npx expo export --platform ios   # iOS paketinin derlendiğini doğrular
```

Kod yapısı: `App.tsx` ana ekran; `src/lib.ts` hesaplar; `src/store.ts` kayıt;
`src/sheets.tsx` formlar; `src/ui.tsx` grafik ve düğmeler; `src/files.ts` Excel/yedek;
`src/notify.ts` bildirimler.

## Doğrudan açma bağlantıları (Expo Go, kestirmeler için)

| Bağlantı | Açılınca |
|---|---|
| `exp://u.expo.dev/24b23d12-c615-4047-b61a-624003ad0003?runtime-version=1.0.0&channel-name=main` | Uygulama (Özet) |
| `exp://u.expo.dev/24b23d12-c615-4047-b61a-624003ad0003?runtime-version=1.0.0&channel-name=ekle` | Yeni harcama formu |
| `exp://u.expo.dev/24b23d12-c615-4047-b61a-624003ad0003?runtime-version=1.0.0&channel-name=butce` | Ayarlar → bütçe alanı |

Üç kanala aynı paket yayınlanır (`eas update --branch main|ekle|butce`); uygulama açılış bağlantısındaki
`channel-name` değerine bakarak formu ya da bütçe alanını açar. Arka plandan dönüşte hiçbir şey kendiliğinden açılmaz.
