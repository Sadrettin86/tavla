# Tavla

Arkadaşınla online tavla. Oda kurarsın, linki WhatsApp'tan gönderirsin, linki açan karşına oturur.

**Adres:** https://sadrettin86.github.io/tavla/

## Neler var

- Ahşap tahta (Ceviz, Sedefli, Gece temaları) ve 3D zarlar
- Efektler: çift gelince büyük yazı (DÜŞEŞ!, DUBARA!…), pul kırınca vuruş, mars damgası, konfeti
- Sesler kodla üretilir, ses dosyası yok. Zar adları telefonun Türkçe sesiyle okunur (Şeşbeş, Düşeş…)
- Laf atma butonları ve tepkiler (çay, alev, kahkaha…)
- Pullar yay çizerek uçar, iz bırakır, yere oturur; kırılan pul havada takla atar; geri alınan hamle geri uçar; yeni elde pullar tahtaya dağıtılır
- Aynı telefonda iki kişi oynama
- Odaya üçüncü biri girerse izleyici olur
- Telefon kilitlenip açılınca ya da sayfa yenilenince oyun kaldığı yerden devam eder

## Telefonda tam ekran

- **iPhone:** Safari ya da Chrome'da paylaş menüsünden **Ana Ekrana Ekle**'yi seç, Tavla'yı ana ekrandaki simgeden aç. Tarayıcı çubukları olmadan açılır, tahta ekranın iki yanına değer. (iPhone tarayıcıları sayfalara tam ekran izni vermiyor, tek yol bu.)
- **Android:** Oyuna girince kendiliğinden tam ekran olur. Menüdeki **Tam ekran** satırından açıp kapatabilirsin.
- Ana ekrandan açılan uygulamada arkadaşının linkine dokunamıyorsan giriş ekranındaki **Oda kodu** kutusuna kodu yazıp katıl. Kod, bekleme ekranında ve paylaşılan mesajda yazar.

## Kurallar (Türk tavlası)

- Katlama küpü yok. Normal galibiyet 1 sayı, mars 2 sayı.
- Açılışta herkes bir zar atar, büyük atan zarları yeniden atarak başlar. Eşit gelirse yeniden atılır.
- Sonraki eli, önceki eli kazanan başlar.
- İki zar da oynanabiliyorsa ikisi de oynanır; yalnızca biri oynanabiliyorsa büyük olan oynanır.
- Kendi evinde vurduğun pulla o el kaçamazsın (vur-kaç yok).
- Toplarken, zarla toplanabilecek pul varsa o zarla içeride oynanmaz.

## Kurulum

### 1. GitHub Pages

Repo sayfasında **Settings › Pages** bölümüne gir. **Source: Deploy from a branch**, **Branch: main**, klasör **/ (root)** seç, **Save** de. Birkaç dakika içinde site yukarıdaki adreste açılır.

### 2. Firebase (online oyun için)

1. https://console.firebase.google.com adresinde **Proje ekle** de, adını `tavla` koy. Analytics gerekmez.
2. **Build › Realtime Database › Create database**: konum **europe-west1 (Belçika)**, **locked mode**.
3. Aynı sayfada **Rules** sekmesine geç, bu repodaki `database.rules.json` dosyasının içeriğini yapıştır, **Publish** de.
4. **Proje ayarları › Uygulamalarınız** bölümünde web simgesine (`</>`) bas, uygulamayı kaydet.
5. Çıkan `firebaseConfig` nesnesini `js/firebase-config.js` dosyasındaki `null` yerine yapıştır. İçinde `databaseURL` satırı olmalı; yoksa Realtime Database sayfasının üstündeki adresi ekle.

Bu ayar değerleri gizli değildir, sitenin kodunda görünmeleri normaldir. Veritabanına erişimi `database.rules.json` sınırlar: yalnızca oda kodunu bilen o odayı okuyup yazabilir, oda listesi okunamaz.

Firebase ayarı yokken site açılır, “Aynı telefonda” modu çalışır; “Oda kur” düğmesi kapalı kalır.

## Yerelde deneme

```
python3 -m http.server 8000
```

Tarayıcıda `http://localhost:8000/?yerel` adresini aç. `?yerel` ile oda, Firebase yerine aynı tarayıcıdaki sekmeler arasında kurulur; iki sekmeyle online akışı deneyebilirsin.

Kural testleri:

```
node tests/rules.test.mjs
```

## Dosyalar

| Dosya | İşi |
|---|---|
| `index.html`, `css/style.css` | Ekranlar ve yerleşim (telefon yatay/dikey, bilgisayar) |
| `js/rules.js` | Kural motoru: yasal hamleler, kırma, toplama, mars, sayı |
| `js/theme.js`, `js/board.js` | Tahta çizimi, pullar, vurgular, animasyonlar |
| `js/dice.js` | 3D zarlar |
| `js/fx.js` | Büyük yazılar, konfeti, mars damgası, baloncuklar |
| `js/sound.js` | Sesler (Web Audio) ve Türkçe zar anonsu |
| `js/net.js` | Oda bağlantısı: Firebase, yerel test, aynı telefonda |
| `js/fullscreen.js` | Tam ekran (Android) ve iPhone'da ana ekrana ekleme tarifi |
| `js/firebase-config.js` | Firebase ayarı |
| `database.rules.json` | Firebase güvenlik kuralları |

## Notlar

- Zarlar `crypto.getRandomValues` ile atılır.
- Odalar Firebase'de `rooms/` altında birikir, her biri birkaç KB. Arada bir konsoldan silebilirsin.
- Arkadaşın linki başka bir tarayıcıda açarsa aynı adı yazarak yerine geri oturabilir.
