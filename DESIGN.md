# FastoLearn tasarım dili

Yuvarlak, dolgun, oyun gibi: **Duolingo benzeri** bir öğrenme arayüzü.
Tek kaynak `src/styles.css`; bileşenler yalnızca sınıf adlarını kullanır.

---

## 1. İlkeler

1. **Yumuşak köşeler.** Keskin köşe yok. Düğme 14 px, kart 20 px, sayfa
   yaprağı 26 px, karo 12 px, etiketler tam yuvarlak.
2. **Dolgun 3B.** Her eylem düğmesinin alt kenarı kalın (2 px normal,
   4 px büyük, 3 px küçük); basıldığında düğme 3–4 px aşağı inar ve alt
   kenar incelir. Kartlar da 2 px kenar + 4 px alt kenarla yükselir.
3. **Tek ana eylem.** Ekranda bir yeşil düğme olur (Başla, Kontrol et,
   Devam, Ana sayfa). Diğerleri beyaz/çerçeveli, yıkıcı olanlar kırmızı.
4. **İçerik önde, süs arkada.** Gradient yok, gölge yok; derinlik yalnızca
   kalın alt kenar ve renk bloğuyla verilir.
5. **Az hareket.** Animasyon anlam taşır (doğru → `pop`, yanlış → `shake`,
   bölüm damgası → `thump`, aktif düğüm → `bob`) ve
   `prefers-reduced-motion` ile kapanır.

## 2. Simgeler ve renkler

| Belirteç | Değer | Kullanım |
| --- | --- | --- |
| `--green` / `--green-d` | `#58cc02` / `#46a302` | Ana eylem, doğru cevap, ilerleme |
| `--blue` / `--blue-d` | `#1cb0f6` / `#1899d6` | **der**, bilgi, seçili şık, dinleme |
| `--red` / `--red-d` | `#ff4b4b` / `#d33131` | **die**, yanlış cevap, gecikmiş tekrar |
| `--gold` | `#ffc800` | Tamamlanmış bölüm düğümü, XP, "yeni kelime" |
| `--purple` | `#ce82ff` | Kişiselleştirme halkası, kullanıcı avatarı |
| `--ink` / `--ink-2` / `--ink-3` | `#3c3c3c` / `#737373` / `#8b929c` | Metin / ikincil / üçüncül |
| `--sheet` / `--bg` / `--line` | `#ffffff` / `#f7f9fc` / `#e5e9ef` | Yüzey / sayfa / kenar |

Almanca isimler artikel rengiyle okunur (`der` mavi, `die` kırmızı,
`das` yeşil) — bu, A1 ders kitaplarının standardıdır ve uygulamanın
öğretim kodudur. Emoji yok; bütün simgeler `src/components/icons.tsx`
içindeki stroke-SVG kitaplığından gelir.

## 3. Ölçek

| Öğe | Yarıçap | Kenar |
| --- | --- | --- |
| Düğme / giriş alanı | 14 px | 2 px + 4 px alt |
| Kart, uyarı kutusu | 20 px | 2 px + 4 px alt |
| Ders yaprağı, özet | 26 px | 2 px + 4 px alt |
| Karo (blok), küçük düğme | 12 px | 2 px + 4 px alt |
| Etiket, ilerleme çubuğu, halka | 999 px | — |
| Yol düğümü (bölüm) | 50 % | gölge `0 7px 0` |

Yol düğümleri: aktif **yeşil** ve nefes alır, tamamlanan **altın** ve tik
gösterir, açık **mavi**, kilitli **gri**. Tamamlanma oranı düğümün altında
"yerinde bir çip" olarak yazılır; çevresindeki halka durumu renklendirir.

## 4. Tipografi

- Tek aile: **Nunito** (400/600/700/800/900). Yuvarlak uçlu, oyun tonu.
- Başlık 30 px / 900, sayfa notu 14 px / 600, bölüm başlığı 17 px / 800.
- Almanca sözcükler `.de` sınıfıyla 800–900 ağırlıkta; 42 px'e kadar çıkar.
- Gövde metni en az 12 px; ikincil metin kontrastı ≥ 4,5:1.

## 5. Ekranlar

| Ekran | İmza öğe |
| --- | --- |
| **Öğren** | Yeşil devam plakası, günlük hedef halkası, 14 günlük çizgi |
| **Müfredat** | Renkli ünite afişi + zikzak inen yuvarlak yol düğümleri |
| **Ders** | Hap parçalı ilerleme, yuvarlak seçenek satırları, blok karoları, renkli düzeltme kartı |
| **Özet** | Eğik "BESTANDEN" damgası, büyük yüzde, defter satırları |
| **Motor** | Halka, 7 günlük tekrar sütunları, ustalık çubukları |
| **Profil** | Ayar satırları, yuvarlak anahtarlar, kullanıcı kartları |

## 6. Erişilebilirlik

- Bütün simge düğmeleri `aria-label` taşır; yol düğümleri bölüm adını ve
  durumunu okur ("Hallo! — başla").
- Odak halkası 3 px mavi, `:focus-visible` ile; klavye ile tam gezinme
  (`Enter`, `1`–`4`, `Boşluk`).
- Dokunma hedefleri ≥ 34 px, aralarında ≥ 8 px boşluk; mobil gezinme
  çubuğu 4 sekme (44 px üstü).
- `prefers-reduced-motion` bütün animasyonları durdurur.
