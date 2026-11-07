# Monibo 2.0 görsel dil (tasarım iyileştirmesi)

Kaynak: kullanıcının paylaştığı 5 referans (Financy, yeşil finans paneli, siyah-sarı "Manage Your Finance", RingPay, Splitty).
Amaç: referansların **ortak** güçlü yanlarını Monibo'nun mevcut mimarisine, 13 vurgu × 7 zemin × açık/koyu tema sistemine,
5 dile ve erişilebilirlik kurallarına uygun biçimde uygulamak. Kopyalama değil; ilke alma.

## Referanslardan alınan ilkeler

| Referans | Alınan ilke | Monibo'daki karşılığı |
|---|---|---|
| Financy | Koyu bakiye kartında **geometrik renk blokları** (çeyrek daire, yarım daire); gelir/gider ikiye bölünmüş satır, renkli ok çipleri; renkli "kazanç" kartları; renkli ilerleme çubuklu "birikim" kartları; tanıtımda büyük, sola dayalı başlık + geometrik illüstrasyon + yuvarlak ok düğmesi | Bakiye kartı, kategori kutucukları, bütçe kutucukları, tanıtım |
| Yeşil finans | Tek bakışta **bütçe ilerleme çubuğu + yorum** ("%30 harcandı, iyi gidiyor"); yumuşak, büyük köşeli kartlar; seçili sekmenin dolgu hapı | Bakiye kartı altı, alt sekme çubuğu |
| Siyah-sarı | Çok iri, sıkı aralıklı **tutar tipografisi**; hap biçimli birincil eylemler; **eşmerkezli yay (radyal) grafik** ve noktalı açıklama | Hızlı eylemler, Kategoriler kartı, Raporlar |
| RingPay | Sade beyaz kartlar, ikon kutuları, net hiyerarşi | Liste satırları, bölüm başlıkları |
| Splitty | **Yüzen hap biçimli alt çubuk + ortada vurgu renginde "+"**; durum çipleri (yeşil "alacaklısın" / kırmızı "borçlusun") | Alt sekme çubuğu, abonelik durum çipleri |

## Tasarım belirteçleri

- **Yazı:** Başlık ve iri tutarlar Plus Jakarta Sans (800 ExtraBold, 700 Bold); metinler sistem yazı tipi. Playfair kaldırılır.
  Tutarlarda `fontVariant: ['tabular-nums']`, iri tutarlarda `letterSpacing: -1`.
  Ölçek: ekran başlığı 28/34, iri tutar 40 (bakiye), kart başlığı 16/700, gövde 15, ikincil 13, etiket 12/600 BÜYÜK HARF yok (yalnız bölüm başlığında küçük harf aralıklı).
- **Köşe yarıçapı:** kart 24, iç kutu 16, ikon kutusu 14, hap 999.
- **Boşluk:** ekran kenarı 20, kartlar arası 14, kart iç 18.
- **Gölge (yalnız açık temada):** `shadowColor #0b1220, opacity 0.06, radius 16, y 6`; koyu temada gölge yok, 1px `line` kenarı.
- **Renk rolleri:** vurgu = birincil eylem ve seçili durum; `cats[i]` = kategori kimliği (ikon kutusu zemini %16–18 opaklık, ikon tam renk);
  gelir = `good`, uyarı/aşım = `warn`. Gider tutarı `fg` + "−" (her satırı kırmızıya boyamak yorucu ve erişilebilirlik açısından zayıf).
- **Geometrik motif:** 3–4 parçalı çeyrek/yarım daire kümesi; renkler temanın vurgusu + ikincil rengi (`SECONDARY`, yoksa `cats`) + bir nötr;
  koyu zeminde %55–90, açık zeminde %70–100 opaklık; her zaman karta kırpılır, metnin altına girmez.

## Ekranlar

1. **Alt çubuk:** yüzen hap (kenarlardan 16, altta güvenli alan + 10), yükseklik 64, `surface` + kenar, 4 sekme + ortada 56'lık vurgu daire "+".
   Sekmeler: Ana sayfa · İşlemler · [+] · Bütçe · Raporlar. "+" dokunuşu küçük bir seçim balonu açar: Harcama / Gelir.
   Ayarlar: ana ekran başlığındaki dişli ve yan menü. Seçili sekme: vurgu yumuşak hap + vurgu ikon/yazı.
2. **Ana sayfa başlığı:** solda avatar (baş harf, menü düğmesi) + sayfa adı "Özet" (selamlama yok); sağda para birimi hapı + dişli (Ayarlar). Marka yazısı ve tek cümlelik ürün özeti sayfa sonunda.
3. **Bakiye kartı:** geometrik motif sağ üstte; etiket + göz; 40'lık tutar; değişim çipi; altta ikiye bölünmüş Gelir | Gider (renkli ok çipleri, ince dikey ayırıcı);
   bütçe varsa en altta ince ilerleme çubuğu + "Bütçenin %30'u kullanıldı · iyi gidiyor / dikkat / aşıldı".
4. **Hızlı eylemler:** 4 eşit, 56'lık yuvarlak-kare ikon + altında etiket (dolgu: kendi rengi %16), daha az yer kaplar.
5. **Kategoriler kartı:** halka grafik yerine **eşmerkezli yaylar** (en çok 4 kategori + "diğer"), ortada toplam; açıklama noktalı.
6. **Liste satırı (ortak bileşen):** 44'lük ikon kutusu (kategori rengi %16 zemin), başlık 15/600, alt yazı 13 muted, sağda tutar 15/700 tabular
   (gelir `good` "+", gider `fg` "−"); satırlar kart içinde, aralarında ince çizgi; gün başlığı "Bugün · ₺540".
7. **Bütçe:** kategori limitleri 2 sütunlu kutucuklar (Financy "Savings"): ikon kutusu, ad, "₺2.500 / ₺3.000", kalın (8) yuvarlak ilerleme çubuğu kategori renginde, %80+ uyarı, %100+ aşım.
8. **Raporlar:** üstte eşmerkezli yay grafiği + bu ay toplamı; 6 aylık çubuklar yuvarlak uçlu, seçili ay vurgu rengi.
9. **Abonelikler:** durum çipleri yeşil/turuncu/gri yumuşak zeminli haplar.
10. **Tanıtım:** koyu zemin; üst yarıda her sayfaya özgü geometrik illüstrasyon (Coral, Kobalt, Erik paletleri); sola dayalı 32'lik başlık; altta sayfa noktaları solda, 56'lık yuvarlak ok düğmesi sağda.
11. **Harcama/gelir formu:** ortada iri tutar (44), altında para birimi hapları; kategoriler 4 sütunlu ikon ızgarası (renkli ikon kutusu + ad).

## Değişmeyenler

Veri modeli, para birimi/kur mantığı, 5 dil, gizlilik kipi, kilit, erişilebilirlik etiketleri, `testID`'ler (gerekirse yeni yere taşınır),
WCAG kontrast testleri (tüm vurgu × zemin × kip), mevcut gezinme hareketleri.

Cila geçişi: unslop yöntemi, Damir Sokolovsky (@heydamir), CC BY 4.0, https://github.com/heydamir/unslop

## Renk kombinasyonları (Sanzo Wada)

Hazır temalar, kategori renkleri ve varsayılan temanın motif rengi Sanzo Wada'nın *A Dictionary of Color Combinations*
(Haishoku Soukan, 1933–34; Seigensha yeniden basımı: 159 renk, 348 kombinasyon) kitabından alındı. Kombinasyon tablosu
(numara → 2–4 renk) verideki her rengin `combinations` listesinden kuruldu; veri `scripts/data/wada-colors.json`
(test bunu okur, uygulamaya paketlenmez).

### Wada'nın kombinasyonları neden işliyor (veriden çözümleme)

- **Değer (açıklık) karşıtlığı:** bir kombinasyonda en açık ile en koyu renk arasındaki L* farkının ortancası ≈ 39;
  kombinasyonların ≈ %48'inde koyu bir "çapa" (L* < 35), ≈ %46'sında çok açık bir renk (L* > 80) var. Okunurluk ve düzen tondan önce açıklıktan gelir.
- **Kısık, topraksı doygunluk:** 159 rengin kroma ortancası ≈ 36; yalnızca 22'si C* > 60. Kombinasyonların ≈ yarısında
  **tam bir** canlı renk (C* > 50) var: geri kalanlar onu taşıyan kısık renklerdir (aşı boyası, sienna, kurşuni, gri yeşil, bej).
- **Sıcak–soğuk gerilimi:** kombinasyonların ≈ yarısı belirgin bir sıcak (kırmızı-turuncu-sarı) ile belirgin bir soğuk
  (mavi-yeşil-mor) rengi yan yana koyar; aynı aileden renklerle kurulanlarda bile açıklık farkı büyüktür.
- **2–4 renk, her birinin rolü var:** zemin/çapa (geniş, koyu ya da kırık beyaz), ana renk, küçük canlı bir not, gerekirse nötr
  bir ara renk (Warm Gray, Neutral Gray, Ecru). Monibo'da bu roller: kart zemini (özet kartı gradyanı + koyu yüzeylerin tonu),
  vurgu (ana düğme, seçili öğe), motif rengi (özet kartındaki geometrik parça), açık zeminin tonu.

Uygulama kuralları (unslop ile birlikte): kitaptaki renk **aynen** kullanılır; yalnızca WCAG kontrastı için açıklık (L*)
ayarlanır ve not edilir. Yüzeyler renkli görünmez: zeminin **tonu** kombinasyondan gelir, açıklığı ve doygunluğu role göre
sabittir (koyu: L* 3.6 / 7.4 / 11 / 16.5, C* ≈ 3–10; açık: L* 95 / 99 / 97 / 88, C* ≈ 1–9). Zengin renk "anlarda" kalır:
özet kartı ve motifi, kategori halkaları, bütçe çubukları.

### Hazır temalar

Kartta kombinasyonun 2–4 rengi kitaptaki levhalar gibi bitişik bloklar halinde ve "Wada No. …" notuyla gösterilir.
Anahtarlar (vurgu/ton) önceki sürümlerle aynıdır; eski kayıtlar olduğu gibi yüklenir.

| Tema (anahtar) | Wada | Renkler | Roller |
|---|---|---|---|
| Coral (`coralteal` + `deepsea`) | **No. 193** | Light Porcelain Green `#00908a`, Grenadine Pink `#f48067`, Naples Yellow `#fbe6a0` | kart + koyu zemin tonu: Light Porcelain Green · vurgu koyu: Grenadine Pink · vurgu açık: Light Porcelain Green → `#006f67` · motif: Naples Yellow |
| Kobalt (`cobaltlime` + `cobaltnight`) | **No. 333** | Blue `#006eb8`, Lemon Yellow `#f8ed43`, Cobalt Green `#96d1aa`, Burnt Sienna `#ae5224` | kart + zemin tonu: Blue · vurgu koyu: Lemon Yellow · vurgu açık: Blue → `#0065ae` · motif: Cobalt Green · Burnt Sienna yalnızca örnekte (sıcak karşı not) |
| Erik (`plumpeach` + `midnight`) | **No. 238** | Cotinga Purple `#501345`, Ochraceous Salmon `#d8a37b`, Warm Gray `#a1a39a` | kart + koyu zemin: Cotinga Purple · açık zemin tonu: Ochraceous Salmon · vurgu koyu: Ochraceous Salmon · vurgu açık: Cotinga Purple · motif: Warm Gray |
| Çivit (`indigoochre` + `indigo`) — yeni | **No. 126** | Deep Lyons Blue `#1c4286`, Yellow Ocher `#e2b540`, Ivory Buff `#ebd3a2` | kart + koyu zemin: Deep Lyons Blue · açık zemin tonu: Ivory Buff · vurgu koyu: Yellow Ocher · vurgu açık: Deep Lyons Blue · motif: Ivory Buff |
| Adaçayı (`sagerust` + `sage`) — yeni | **No. 137** | Pistachio Green `#648f7b`, Etruscan Red `#c55347`, Cinnamon Buff `#fdc57e` | kart + zemin tonu: Pistachio Green · vurgu: Etruscan Red (koyu `#da6558`, açık `#ab3d34`) · motif: Etruscan Red · kart etiketi/dolgusu: Cinnamon Buff |
| Arduvaz (`slaterose` + `slate`) — yeni | **No. 27** | Slate Color `#34454c`, Corinthian Pink `#f8b6ba` | kart + zemin tonu: Slate Color · vurgu koyu: Corinthian Pink · vurgu açık: Slate Color · motif: Slate Color (koyu kartta otomatik açılır: ton üstüne ton) |

Kontrast için yapılan açıklık ayarları (CIE76 ΔE, D65; `npx tsx scripts/theme-test.ts --wada`):

| No. | Renk | Kitapta | Kullanılan | ΔE | Neden |
|---|---|---|---|---|---|
| 193 | Light Porcelain Green (açık modda vurgu) | `#00908a` | `#006f67` | 13.2 (L* −12) | beyaz yazı ve yumuşak zemin üstünde ≥ 4.5:1; sRGB sınırında kroma biraz düşer |
| 333 | Blue (açık modda vurgu) | `#006eb8` | `#0065ae` | 3.7 (L* −3) | vurgu/yumuşak zemin ≥ 4.5:1 |
| 137 | Etruscan Red (koyu modda vurgu) | `#c55347` | `#da6558` | 6.9 (L* +7) | koyu yüzeylerde ≥ 4.5:1 |
| 137 | Etruscan Red (açık modda vurgu) | `#c55347` | `#ab3d34` | 8.5 (L* −8) | açık zeminlerde ≥ 4.5:1 |

Öteki tüm rol renkleri kitaptaki değerlerdir. Özet kartının gradyanı kart renginin siyaha karışımıdır (`SECONDARY.k`);
koyu kartta 3:1'in altında kalan motif rengi %35 beyazla açılır (yalnızca Arduvaz'da devreye girer).
Kırmızı/pembe vurgulu Coral, Adaçayı ve Arduvaz'da uyarı rengi kehribara geçer (aşılan bütçe vurgudan ayrışsın).

### Kategori renkleri (`cats`)

Sıra: Market, Yeme-İçme, Ulaşım, Fatura, Sağlık, Eğlence, Giyim, Diğer. Yeme-İçme rengi bütçede "dikkat" (%80+) rengidir.

| | Market | Yeme-İçme | Ulaşım | Fatura | Sağlık | Eğlence | Giyim | Diğer |
|---|---|---|---|---|---|---|---|---|
| Noir | Green `#489b6e` | Raw Sienna `#bb7125` | Olympic Blue `#5a82b3` | Artemesia Green `#709390` | Etruscan Red `#c55347` | Aconite Violet `#a36aa5` | Laelia Pink `#ca92a8` | Ecru `#c2ae93` |
| Fildişi | Diamine Green `#1a7444` | Raw Sienna | Olympic Blue | Dark Medici Blue `#547076` | Etruscan Red | Aconite Violet | Veronia Purple `#8c4c62` | Dark Citrine `#8b835b` |

Kaynak kombinasyonlar: **No. 293** (Raw Sienna, Artemesia Green, Green), **No. 324** (Olympic Blue, Aconite Violet),
**No. 275** (Etruscan Red, Ecru), **No. 327** (Raw Sienna, Ecru), **No. 280** (Laelia Pink, kısık gül), açık mod koyu karşılıkları **No. 13**
(Raw Sienna + Veronia Purple), **No. 274** (Olympic Blue + Dark Citrine), **No. 249** (Ecru + Dark Medici Blue).
Raw Sienna ve Ecru setin bağlayıcı renkleridir; set kısık, topraksı, tek tek canlı notlar (Raw Sienna, Etruscan Red) taşır.
Hepsi kitaptaki değerlerdir (ayar yok). Test: her renk Wada verisinde; çift çift ΔE ≥ 20; her modda tüm zemin tonlarının
zemin/yüzey/yükseltilmiş rengine ≥ 3:1; C* ≤ 60 (neon değil). Excel dışa aktarımı etkilenmez.

### Varsayılan (Klasik + Şampanya)

Şampanya altını `#c9a86a`, Wada'nın Isabella Color'ına (`#c5a56e`, ΔE ≈ 3.8) denk düşer; siyah zemin ve "M" simgesi aynen kaldı.
Tek değişiklik: özet kartı motifinin ikinci rengi `#6f8fc9` → **Dark Medici Blue `#547076`**; böylece varsayılan
**No. 241** (Isabella Color, Dark Medici Blue, Pale Lemon Yellow ≈ kart yazısı, Red Orange ≈ uyarı) kombinasyonudur.
Hazır tema dışındaki vurgularda motif rengi: soğuk vurgularda Isabella Color (No. 12), ötekilerde Dark Medici Blue.

Sanzo Wada, A Dictionary of Color Combinations (Seigensha); veri: mattdesl/dictionary-of-colour-combinations (MIT)
