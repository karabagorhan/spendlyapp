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
2. **Ana sayfa başlığı:** solda avatar (baş harf) + "İyi akşamlar," / kalın ad; sağda para birimi hapı + dişli (Ayarlar). Marka yazısı küçük.
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
