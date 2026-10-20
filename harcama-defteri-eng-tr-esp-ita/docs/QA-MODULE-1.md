# Modül 1 QA raporu: kimlik doğrulama, tanıtım, yasal uyumluluk

**Kapsam dışı (sonraki modüller):** bulut eşitleme, analitik/çökme raporu, push, ödemeler.

## Çalıştırılan testler

| Komut | Ne sınar | Sonuç |
|---|---|---|
| `npm test` | tip kontrolü, çeviri denetimi (5 dil), çekirdek/kur/tema testleri, hesap mantığı (98), Edge Function mantığı (42) | geçiyor |
| `npm run test:sql` | **gerçek PostgreSQL 16**'da migration + RLS/yetki (34 kontrol) | geçiyor |
| `EXPO_PUBLIC_AUTH_MOCK=1 npx expo export --platform web --output-dir /tmp/web-auth` ardından `WEB_DIR=/tmp/web-auth npx tsx scripts/auth-ui-test.ts <dil>` | tarayıcıda uçtan uca arayüz (sahte servisle), tr/en/es/it/zh | her dilde 98–104 kontrol, 0 hata |
| mevcut `ui-test`, `currency-ui-test`, `gesture-ui-test` | eski ekranlarda gerileme | geçiyor |
| `npm run check:release` | yayın engelleri | **bilerek başarısız** (yasal bilgiler `REPLACE_ME`) |

Testlerin gerçekten hata yakaladığı **mutasyonla** doğrulandı: migration'da sütun yetkisi gevşetildiğinde, RLS `select` herkese açıldığında, `apple_tokens` erişimi verildiğinde; hesap silmede yeniden kimlik doğrulama kaldırıldığında ve Apple iptali silmeden sonraya alındığında ilgili testler düştü.

## Simüle edilen gerçek kullanıcı senaryoları

| Senaryo | Beklenen | Nerede sınandı |
|---|---|---|
| İlk açılış, İngilizce cihaz | tanıtım İngilizce; dil seçici; "Atla" | UI testi |
| Tanıtımı yarıda bırakıp uygulamayı kapatma | tanıtım tekrar gösterilir; bitirildiyse bir daha çıkmaz | UI testi |
| Eski sürümden güncelleme (kayıtlı veri var) | tanıtım yok, doğrudan uygulama | UI testi |
| Kayıt: boş form, geçersiz e-posta, `gmial.com` yazım hatası, yaygın/kısa/72 bayt üstü parola, eşleşmeyen parola, onay işaretsiz | satır içi hata, gönderim yok | UI + birim |
| Kayıt düğmesine art arda 3 dokunuş | tek istek | UI testi |
| Kayıtlı adresle tekrar kayıt / kayıtsız adrese parola sıfırlama | aynı genel mesaj (hesap sızmaz) | UI + kodda |
| Doğrulanmamış hesapla giriş | `email_not_confirmed`, "tekrar gönder" | UI testi |
| E-posta bağlantısına tıklama (soğuk açılış) | hesap açılır, uygulamaya geçilir | UI testi |
| Parola sıfırlama bağlantısı soğuk açılışta | "yeni parola" ekranı **açılış tarafından ezilmez** | UI testi (yarış düzeltildi) |
| Yeni parola: yaygın / eskisiyle aynı | reddedilir | UI testi |
| Çevrimdışıyken giriş, sonra bağlantı gelince "tekrar dene" | ağ hatası → çalışır | UI testi |
| 6 yanlış deneme | hız sınırı mesajı | UI testi (sahte) |
| Hesap silme: parolasız / yanlış parola / doğru parola, cihaz verisi seçeneği | yalnızca doğruda silinir; seçilirse yerel veri de gider | UI + fonksiyon + SQL |
| Silinen hesapla giriş | reddedilir | UI testi |
| Hesap silme, son giriş 10 dk'dan eski (çalıntı oturum) | 403, silinmez | fonksiyon testi |
| Apple iptali başarısız / belirteç yok | hesap yine silinir, durum bildirilir | fonksiyon testi |
| Tablet / geniş ekran | içerik ≤ 520 px, ortalı, taşma yok | UI testi |
| Çevirisi olmayan dilde yasal metin | İngilizce + dilinde bilgi notu | UI testi |

## Bulunan ve düzeltilen kusurlar

1. **Başka bir kişinin adı varsayılandı:** `store.ts` yeni her kullanıcıya `Orhan Karabağ` adını veriyordu. Boş yapıldı (menü "Kişisel hesap" gösterir). Mevcut kayıtlı adlar korunur.
2. **İlk açılışta dil hep Türkçe:** cihaz diline (yoksa İngilizce) göre seçilir; tanıtımda dil seçici var.
3. **Yarış durumu:** soğuk açılışta e-posta bağlantısı işlemi, açılış (`BOOT`) bitmeden çalışırsa "yeni parola" ekranını ezebilirdi. Bağlantı işleme açılışı bekler.
4. **Yazım önerisi** harf yer değiştirmesini (`gmial`) yakalamıyordu (Levenshtein). Yer değiştirme tek hata sayılır. *(Birim testi yakaladı.)*
5. **Gerileme:** `store.ts`'e bildirim modülü eklemek Node testlerini kırdı; temizlik `src/wipe.ts`'e taşındı.
6. **İstemci/sunucu parola kuralı uyuşmazlığı:** sunucu "harf+rakam" istiyordu, istemci istemiyordu. İkisi hizalandı.
7. **Erişilebilirlik (web):** kilitli düğmenin durumu ekran okuyucuya iletilmiyordu. `Pressable.disabled` + `aria-busy` kullanıldı.
8. **Geniş ekranda form tüm genişliğe yayılıyordu:** 520 px sütun.
9. Test düzeltmeleri: tr/zh'de ekran başlıkları alt dize olarak başka ekranla eşleşiyordu (testID beklenir); Postgres `CASE` içindeki sabit `1/0`'ı planlama aşamasında hesaplıyordu.

## ⚠️ Doğrulanamayanlar (bu ortamda yapılamadı)

Sahte servis yalnızca **uygulama mantığını** sınar; aşağıdakiler **gerçek hesaplarla ve cihazda** denenmelidir:

- Gerçek Supabase projesiyle kayıt/giriş, e-posta şablonları ve yönlendirme adresi listesi (PKCE bağlantısı cihazda).
- **Apple ile giriş** (nonce eşleşmesi, ilk girişte ad bilgisi, `apple-link` ile belirteç saklama, **silerken iptal**). Apple uçlarına gerçek istek hiç atılmadı; yalnızca JWT imzası ve istek biçimi test edildi.
- Google akışının uygulama içi tarayıcıda dönüşü.
- `expo-secure-store` parçalı yazma (gerçek cihazda).
- Edge Function'lar **Deno'da çalıştırılmadı**; iş mantığı Node'da test edildi, `index.ts` sarmalayıcıları ve `deps.ts` bağlantıları yalnızca okundu.
- Çevrimdışıyken çıkış: kütüphane kaynağında yerel oturumun silindiği doğrulandı, cihazda denenmedi.

## Açık riskler ve öneriler

- **Yasal metinler TASLAKTIR** ve bir hukukçu tarafından okunmalıdır. Yalnızca TR/EN yazıldı. `REPLACE_ME` alanları (şirket, e-posta, adresler, veri bölgesi, uygulanacak hukuk) doldurulana dek `check:release` yayını engeller. Metin, uygulamanın **bu sürümdeki** davranışını anlatır (sunucuya harcama verisi gitmez; kur servisleri ve Expo güncelleme servisi belirtildi).
- **Bot koruması yok:** Supabase panelinde CAPTCHA (Turnstile) ve oran sınırlarını açın.
- `apple_tokens` yenileme belirteci düz metindir (yalnızca `service_role` erişir); üretimde Supabase Vault ile şifreleyin.
- İstek zaman aşımı (20 sn) sonrası sunucu işlemi geç tamamlanabilir (özellikle hesap silme); kullanıcı tekrar denerse "bilinmeyen hata" görebilir.
- Hesap açan misafirin yerel verisi cihazda kalır ve hesaba taşınmaz (Modül 3).
- Çıkış yapınca cihazdaki harcama verisi silinmez (bilinçli; ortak cihaz için Modül 3'te yeniden değerlendirilmeli).
- `npm audit`: 25 bulgunun tamamı önceden vardı (Expo araç zinciri ve `xlsx`; **`xlsx` için düzeltme yok**). Bu modülün eklediği paketlerde bulgu yok. `xlsx` yalnızca dışa aktarmada yazma için kullanılıyor.
- App Store gönderimi: gizlilik "beslenme etiketleri" (e-posta, ad, kullanıcı kimliği), gizlilik politikası adresi, hesap silme yolu (Ayarlar → Hesap → Hesabı sil), Google Play "Data deletion" adresi (`deletionUrl`).
