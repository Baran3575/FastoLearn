# FastoLearn

**Türkçeden Almancaya (A1) kelime öğrenme sitesi.** Tarayıcıda çalışır, sunucu
yoktur: tüm veri cihazında (localStorage) saklanır, hiçbir şey yüklenmez.

Öğrenci **sıfır Almanca** kabul edilir. Ders akışı Duolingo tarzındadır: önce
kelimeler tanıtılır, sonra çoktan seçmeli / yazma / dinleme / **blok
yerleştirerek cümle kurma** soruları gelir. Tekrar sıklığını hiçbir ayar
yapmadan motor belirler.

---

## Hızlı başlangıç

```bash
npm install
npm run dev -- --port 3000     # http://localhost:3000
```

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (Vite) |
| `npm run build` | Tip kontrolü (`tsc -b`) + üretim derlemesi → `dist/` |
| `npm test` | Vitest birim testleri (73 test) |
| `npm run deck:check` | İçerik doğrulama (JSONL, kimlik tekilliği, artikel/çoğul) |
| `npm run preview` | `dist/` önizlemesi |

---

## Müfredat: 2 ünite × 10 bölüm = 20 bölüm, 386 kelime

`src/content/units.ts` (yapı) + `src/content/units/*.jsonl` (bir satır = bir öğe).

### Ünite 1 — *Erste Schritte* (İlk Adımlar)

| # | Bölüm | İçerik |
| --- | --- | --- |
| 1 | **Hallo!** | Selamlaşma, teşekkür, özür, vedalaşma (hallo, tschüss, danke, bitte, ja, nein…) — 18 kelime |
| 2 | Wer bist du? | Tanışma, ad/yaş/nerede oturma |
| 3 | Zahlen | Sayılar, yaş, fiyat |
| 4 | Farben und Kleidung | Renkler ve giysiler |
| 5 | Meine Familie | Aile, iyelik (mein/dein) |
| 6 | Länder und Sprachen | Ülkeler, diller, `kommen aus` |
| 7 | In der Schule | Dersler, öğretmen, ödev |
| 8 | Im Klassenzimmer | Sınıf eşyaları |
| 9 | Freizeit | Hobiler |
| 10 | Essen und Trinken | Yiyecek, içecek, lokanta |

### Ünite 2 — *Mein Alltag* (Günlük Hayat)

| # | Bölüm | İçerik |
| --- | --- | --- |
| 11 | Wohnen | Ev, odalar, mobilya |
| 12 | Körper und Gesundheit | Vücut, hastalık, doktor |
| 13 | Tiere | Hayvanlar |
| 14 | Wetter und Jahreszeiten | Hava, mevsimler |
| 15 | Zeit und Tagesablauf | Günler, aylar, saat, günlük rutin |
| 16 | Wichtige Verben | Sık fiiller, modal fiiller |
| 17 | Adjektive | Sıfatlar, karşıtlar |
| 18 | Fragewörter und Pronomen | W-soruları, kişi/iyelik zamirleri |
| 19 | In der Stadt | Yerler, yön sorma, yer edatları |
| 20 | Berufe und Alltag | Meslekler, kibar kalıplar, duygular |

Her öğe: `id, de, tr, pos` (+ isimlerde `article`/`plural`), `unit`, `freq`
(A1 sıklık sırası), `ex`/`exTr` (Almanca örnek + Türkçe çevirisi), isteğe bağlı
`note`.

### Sıfırdan başlama (sıralı müfredat)

Varsayılan olarak **sıralı müfredat açıktır**: yeni kelimeler yalnızca
*görülmemiş en erken bölümden* gelir ve o bölümün içinde **A1 sıklık sırasına**
göre sunulur. Yani ilk oturumda ekrana gelen yeni kelimeler sırasıyla
`Hallo`, `danke`, `bitte`, `ja`, `nein`, `Danke schön` olur. Bir bölüm
tamamlanınca otomatik olarak sıradaki bölüme geçilir.

- Bir bölümü elle açmak (Müfredat ekranı) sıra kapısını **atlar**.
- Kapatmak için: Profil → *Sıralı müfredat*. Kapatınca yeni kelimeler tüm
  desteden sıklık sırasına göre seçilir.

---

## Algoritma

İki model aynı anda, kullanıcıya hiçbir şey sormadan çalışır.

### 1. RWKV-Instant (taban) — `src/engine/rwkv.ts`

Kullanıcının **cevap olay akışını** tek adımlı, sabit boyutlu yinelemeli
durumda özetler (O(1) bellek, O(1) güncelleme). Mimari RWKV'nin
zaman-karıştırma + kanal-karıştırma bloğudur; 8 kafa farklı **unutma
ufkunu** öğrenir (yarılanma süreleri ≈ 1 saat → 6 ay). Çok başlı okuma
katmanı + sapma (bias) **çevrimiçi AdaGrad** ile eğitilir, yani her cevaptan
sonra model bir adım öğrenir. Ağırlıklar başlangıçta tohumdan üretilir
(deterministik) ve kullanıcı durumuna serileştirilir.

### 2. FSRS-7 (ikincil) — `src/engine/fsrs7.ts`

21 parametreli bellek modeli (stabilite / zorluk / vade). Aralığın ölçeğini
belirler. Cevap geçmişi yeterince birikince (≥ 80 cevap, her 25 cevapta bir)
arka plandaki **Web Worker** (`tuner.worker.ts`) parametreleri cevap
geçmişine yeniden uyarlar; ana iş parçacığı kilitlenmez (worker yoksa
`requestIdleCallback`'e düşer).

### 3. Birleşim ve kişiselleştirme — `src/engine/engine.ts`

```
logit(p) = α·logit(p_RWKV) + β·logit(p_FSRS) + γ + itemBias
```

- α, β, γ **logit uzayında çevrimiçi lojistik** ile her cevapta güncellenir
  (başlangıç α=0,25, β=0,85, γ=0; FSRS-7 kalibre olduğu için başlangıçta
  ağırlık onda, RWKV-Instant kanıt topladıkça ağırlık kazanır).
- `itemBias`: bir kelime bekleneden sürekli zor/kolay çıkıyorsa öğe bazlı
  sapma olarak öğrenilir.
- **Hedef hatırlanma oranı** öğe başına kişiselleştirilir:
  `clamp(0.90 − 0.25·(p_RWKV − p_FSRS), 0.78, 0.95)` — RWKV, FSRS'ten daha
  riskli görüyorsa aralık kısalır.

### 4. Otomatik derecelendirme

Kullanıcıya "zor mu geldi?" diye sorulmaz. Derece (Again / Hard / Good /
Easy) **doğruluk + cevap süresi** (kişisel medyana göre) + modelin beklentisi
birleştirilerek çıkarılır (`grading.ts`, `engine.grade`). İstenirse elle
derece verilebilir, ama gerekmez.

### 5. Sıra seçimi

`chooseKind()` kartın geçmişine göre alıştırma tipini seçer: yeni öğe her
zaman Türkçe→Almanca seçmeli; olgunlaştıkça Almanca→Türkçe seçmeli, artikel
(der/die/das), yazma, dinleme ve **cümle kurma** (blok yerleştirme) devreye
girer. Zaten güçlü öğeler daha zor biçimlerde sorulur.

---

## Ders akışı (Duolingo tarzı)

1. **Tanıtım**: oturumdaki yeni kelimeler kart kart gösterilir (Almanca,
   artikel rengi, Türkçe karşılık, örnek cümle, sesli okuma). Atlanabilir.
2. **Alıştırmalar**: çoktan seçmeli, yazma, dinleme, artikel ve blok
   yerleştirme (kelime karolarını doğru sıraya dizerek cümle kurma).
   Yanlış cevaplanan öğe kuyruğa geri girer (oturum içinde bir kez tekrar).
3. **Özet**: doğruluk, XP, süre, yeni öğrenilen kelime sayısı.

Arayüzde **emoji yok**; tüm simgeler `src/components/icons.tsx` içindeki
stroke-SVG kitaplığından gelir. İsimler artikel rengiyle gösterilir
(der/die/das).

### Ekranlar

- **Öğren** (Home): günlük hedef, seri/XP, sıradaki bölüm önerisi, sıradaki
  kelimeler ve motora giriş.
- **Müfredat**: 2 ünite altında 10'ar bölüm; bölüm başına ilerleme, vadesi
  gelen tekrar sayısı ve doğruluk.
- **Motor**: iki katmanlı.
  - *Basit* (normal kullanıcı): "sistem seni tanıyor mu?", tahminler ne kadar
    tutuyor, en zor/kolay kelimeler, zayıf bölüm, unutma ölçekleri — sade
    dille.
  - *Gelişmiş*: Brier / log-loss / kalibrasyon hatası / AUC karşılaştırması,
    son kararlar, birleşim ağırlıkları, unutma ufukları, kalibrasyon grafiği,
    öğe yanlılıkları, 21 FSRS-7 parametresi, kart dağılımı, tema performansı.
- **Profil**: kullanıcılar, günlük hedef, tercihler (dinleme, otomatik
  derece, tahmin gösterimi, sıralı müfredat, oturum başına yeni kelime),
  JSON yedekleme/geri yükleme.

---

## Dosya düzeni

```
src/
  engine/        RWKV-Instant, FSRS-7, özellik kodlayıcı, birleşim, metrikler
  content/       units.ts (2 ünite / 20 bölüm) + units/*.jsonl (386 öğe)
  state/         user.ts (şema), store.ts (localStorage, oturum kaydı)
  components/    Home, Units, Session, Summary, EnginePanel, Profile, ui, icons
  session.ts     StudySession: tanıtım + alıştırma + özet akışı
  styles.css     tasarım sistemi
scripts/         validate-deck.mjs
tests/           engine, session, content, fsrs7, rwkv, metrics
```

## Testler ve doğrulama

```bash
npm test          # 73 test: plan/grade/birleşim, sıralı müfredat (ilk ders sırası),
                  # oturum akışı, blok yerleştirme, içerik bütünlüğü, FSRS-7,
                  # RWKV durumu, ekran duman testi (SSR)
npm run deck:check
```

`tests/render.test.ts` ekranları DOM'suz (sunucu tarafı) çizerek çalışma
zamanı hatalarını yakalar.

`tests/engine.test.ts` içinde bir değişmez vardır: özellik vektörü boyutu
(`FEATURE_DIM`) RWKV gizli boyutuna (`nEmbd = 64`) eşit olmalıdır; yeni bir
alıştırma tipi eklenirse yedek yuva tüketilmelidir.

## GitHub Pages

`.github/workflows/deploy.yml` her `main` push'unda test + derleme yapıp
`dist/` klasörünü GitHub Pages'e yayınlar. `vite.config.ts` içinde `base:
'./'` olduğu için derleme hem alt yoldan (proje sayfası) hem de `file://`
üzerinden çalışır. Depo ayarlarında **Pages → Source: GitHub Actions**
seçili olmalıdır.

## Dürüst notlar / sınırlar

- RWKV-Instant tarayıcıda **sıfırdan yazılmış** küçük bir yinelemeli modeldir;
  ön-eğitimli bir dil modeli değildir. Görevi kelime hatırlama olasılığını
  kişiselleştirmektir, dil üretmek değil. Yalnızca okuma katmanı + sapmalar
  eğitilir, gövde ağırlıkları tohumdan sabittir — bu yüzden hızlı ve
  öngörülebilirdir.
- FSRS-7 parametreleri referans Python uygulamasından taşınmıştır; yeniden
  uyarlama basit bir gradyan inişidir, FSRS'in tam eğitim hattı değildir.
- Sıfırdan başlayan bir öğrenci için ilk oturumlar bilinçli olarak küçüktür
  (varsayılan: oturum başına 6 yeni kelime).
- A1 kapsamı hedeflenir; içerik MEB 9. sınıf Almanca A1.1 izleğine yakındır
  ama resmî onaylı bir ders kitabı değildir.
- Telaffuz tarayıcının Web Speech API'sine bağlıdır; her tarayıcıda Almanca
  sesi bulunmayabilir (bu durumda dinleme alıştırmaları sessiz kalır).

## Lisans

`LICENSE` dosyasına bakın.
