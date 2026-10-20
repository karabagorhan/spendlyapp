# Claude için Maliyet Odaklı Kullanım Rehberi

Bu repo, Claude'ı Excel, Word, PowerPoint ve basit kodlama işleri için daha verimli ve daha düşük maliyetli kullanmak isteyenler için hazırlanmıştır.

Amaç:
- Gerekli her iş için tek bir "çok genel" prompt yazmak yerine, görev bazlı kısa ve net promptlar kullanmak
- Dosya işlerinde yüksek maliyetli gereksiz analizlerden kaçınmak
- PowerPoint, Word, Excel ve basit script üretiminde çıktıyı kontrollü, adım adım ve doğru hedefe uygun hale getirmek
- Maliyet/kalite dengesini koruyarak Claude kullanımını sürdürülebilir kılmak

## Klasör Yapısı

- `prompts/` : Hazır prompt şablonları
- `examples/` : Excel, Word, PowerPoint ve kodlama örnekleri
- `checklists/` : Kullanım öncesi ve sonrası kontroller

## Temel İlkeler

### 1) Her isteği tek adımda değil, küçük parçalara böl

Kötü örnek:
- "Bu Excel dosyasında tüm veri temizleme, analiz, grafik ve rapor üretimini yap."

Daha iyi:
- "Bu dosyadaki sütunları kontrol et; hatalı verileri listeler misin?"
- "Şimdi bu temizlenen verilerden toplam satış trendini çıkar."
- "Son adımda yalnız bunu Markdown tablosu olarak ver."

### 2) Hedefi net belirt

Claude'ya şunu açıkça yaz:
- "Sadece veri temizleme yap"
- "Sadece grafik önerisi üret"
- "Yalnızca sunum metni hazırla"
- "Kod üret, ama açıklamasız ve kısa olsun"

### 3) Girdi ve çıktı boyutunu kontrol et

- Büyük Excel dosyalarını tek seferde göndermeyin
- Word/PPT dosyalarını bütün dosya yerine yalnızca ilgili bölümlerini paylaşın
- Sonucu Markdown, tablo veya maddeler halinde isteyin

### 4) Başlık, format ve sınır koy

Örnek:
- "5 maddelik sonuç ver"
- "Sadece Türkçe cevap yaz"
- "Hiçbir ek açıklama yapma"
- "Yalnızca üç slayt taslağı üret"

### 5) İşin zincirini yönet

İlk istek: veriyi analiz et
İkinci istek: anlam çıkar
Üçüncü istek: çıktı hazırla
Dördüncü istek: incele ve düzelt

## Excel için Kullanım

### Durumlar

- Veri temizleme
- Formül önerisi
- Excel işlevi açıklaması
- Hata bulma ve yorumlama
- Tablo formatı / pivot önerisi

### Örnek prompt

"Bu Excel tablosundaki 3. sütundaki boş hücreleri bulun. Doğru biçime dönüştür. Hata içeren satırları tek tek listele. Sonucu küçük bir tablo halinde ver."

### Maliyet için ipuçları

- Dosya yerine yalnızca ilgili sayfayı paylaş
- Büyük veri setlerinde örnek satırlar sor
- "Tüm dosyayı analiz et" yerine "sadece şu 5 sütunu analiz et" yaz

## Word için Kullanım

### Durumlar

- Metin düzenleme
- Rapor yazma
- Giriş / sonuç çıkarma
- Dil kontrolü
- Kısa ve profesyonel ton üretimi

### Örnek prompt

"Bu metni resmi ve net Türkçe ile düzenle. 3 paragraf ve 5 maddelik özet çıkar. Teknik jargonları azalt. Sonucu profesyonel rapor tonu ile yaz."

### Maliyet için ipuçları

- Metin bölümlerini ayrı ayrı gönder
- 'Tüm dosya için kapsamlı revizyon' yerine 'yalnızca giriş ve sonuç bölümü' iste

## PowerPoint için Kullanım

### Durumlar

- Slayt taslağı hazırlama
- Sunum anlatım metni üretme
- Görsel anlatım içerikleri oluşturma
- Kısa özlü konuşma metni yazma

### Örnek prompt

"Bu konuyla ilgili 5 slaytlık bir sunum taslağı hazırla. Her slaytta başlık, 2-3 madde ve konuşma metni olsun. Teknik ayrıntıları azalt, izleyici odaklı olsun."

### Maliyet için ipuçları

- İlk adımda yalnızca taslak istenmeli
- Sonraki adımda yalnızca bir slayt düzenlenmeli
- Çok detaylı anlatımlar yerine tek bir sayfalık ana akış tercih edilmeli

## Basit Kodlama için Kullanım

### Durumlar

- Python ile veri işleme
- Excel otomasyonu
- CSV okuma ve filtreleme
- Basit script yazımı
- Hata düzeltme

### Örnek prompt

"Python ile CSV dosyasını okuyup sadece müşteri bazlı toplam satışları hesaplayan kısa bir script yaz. Gerekli kütüphaneleri ekle. Sonucu çalıştırılabilir şekilde ver."

### Maliyet için ipuçları

- İlk önce kod istenir, sonra açıklama istenir
- Gereksiz yorum satırları eklenmez
- Hedef fonksiyon tek ve küçük tutularak geliştirilir

## Prompt Şablonları

### Şablon 1: Kısa ve net görev

"[Görev] yap. Sonucu [format] formatında ver. Sadece [çıkış türü] üret. [Kısıt] ekle."

### Şablon 2: Adım adım işlem

"1) Veriyi incele. 2) Hataları bul. 3) Düzelt. 4) Sonucu tablo halinde yaz."

### Şablon 3: Maliyet dostu versiyon

"Bu iş için yalnızca gerekli kısmı yap. Gereksiz açıklama yapma. Kısa ve net cevap ver."

## Örnek Maliyet Odaklı Akış

### Excel örneği

1. "Bu sayfadaki sütun isimlerini listeler misin?"
2. "Boş ve hatalı değerleri bul."
3. "Şimdi sadece temiz veri tablosunu üret."
4. "Sonuçta yalnızca toplam ve eğilim grafiğini ver."

### Word örneği

1. "Metnin giriş bölümünü düzenle."
2. "Sonra sonuç bölümünü yaz."
3. "Son olarak 5 maddelik özet çıkar."

### PowerPoint örneği

1. "3 slaytlık başlık taslağı oluştur."
2. "Şimdi bir slayt için konuşma metni yaz."
3. "Son olarak sunumun kısa özeti çıkar."

## Repo Geliştirme Fikirleri

Bu repo ileride şu şekilde geliştirilmelidir:

- Prompt katalogu
- Excel örnekleri
- Word/PowerPoint örnekleri
- Maliyet karşılaştırma tablosu
- "Düşük maliyetli prompt" örnekleri
- "Yüksek maliyetli prompt" ve neden kaçınılması gerektiği
- Kullanım notları
- Versiyonlanan prompt setleri

## Katkıda Bulunma

Bu repoya katkı sağlamak için:

1. Yeni prompt örneği ekleyin
2. Hata ve iyileştirme önerisi paylaşın
3. Yeni iş senaryosu ekleyin
4. Maliyet odaklı kullanım notları yazın

## Hedef Kullanıcı

- Excel kullanıcıları
- Word belgesi hazırlayanlar
- PowerPoint sunum hazırlayanlar
- Basit Python/JavaScript otomasyon isteyenler
- Claude kullanım maliyetini kontrol etmek isteyen herkes

## Son Söz

En büyük tasarruf, "geniş kapsamlı bir görev" istemek yerine "küçük, net ve kontrollü adımlarla çalışmak"tır. Bu reposunun en önemli amacı budur.

Bu yaklaşım sayesinde:
- Daha hızlı sonuç alırsınız
- Daha az maliyet ödersiniz
- Daha düzenli ve kullanılabilir çıktılar elde edersiniz

---

İstersen bu repoyu bir sonraki adımda şu şekilde geliştirebilirim:
- daha profesyonel bir README yapısı
- prompt örnekleri klasörü
- ready-to-use şablonlar
- Excel/Word/PowerPoint kullanım cheat sheet
- GitHub Pages benzeri kullanım dokümanı
