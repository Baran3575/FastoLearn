/**
 * Müfredat: 2 ünite × 10 bölüm = 20 bölüm.
 *
 * Öğrenci hiç Almanca bilmediği varsayılır: 1. ünite selamlaşma, tanışma, sayılar
 * ve renklerle başlar; 2. ünite günlük hayata (ev, sağlık, zaman, şehir, meslek)
 * geçer. İçerik `src/content/units/*.jsonl` dosyalarında, bir satır = bir öğe.
 *
 * Not: `VocabularyItem.unit` alanı **bölüm** kimliğini tutar (örn. "begruessung").
 */

export interface CourseUnit {
  id: string
  order: number
  /** Almanca başlık */
  title: string
  /** Türkçe alt başlık */
  subtitle: string
  description: string
  /** Arayüzdeki vurgu rengi */
  tint: string
}

export interface Section {
  id: string
  /** 1..20 — tüm kurs içindeki sıra */
  order: number
  /** Bağlı olduğu ünite */
  unitId: string
  /** Ünite içindeki sıra (1..10) */
  indexInUnit: number
  /** Almanca başlık */
  title: string
  /** Türkçe alt başlık */
  subtitle: string
  description: string
  level: string
}

export const UNITS: CourseUnit[] = [
  {
    id: 'temel',
    order: 1,
    title: 'Erste Schritte',
    subtitle: 'İlk Adımlar',
    description: 'Sıfırdan başlangıç: selamlaşma, tanışma, sayılar, renkler, aile, okul ve yemek.',
    tint: '#58cc02',
  },
  {
    id: 'alltag',
    order: 2,
    title: 'Mein Alltag',
    subtitle: 'Günlük Hayat',
    description: 'Ev, sağlık, hayvanlar, hava, zaman, fiiller, sıfatlar, şehir ve meslekler.',
    tint: '#ce82ff',
  },
]

type Row = [id: string, unitId: string, indexInUnit: number, title: string, subtitle: string, description: string]

const SECTION_DATA: Row[] = [
  // ---- Ünite 1: İlk Adımlar ----
  ['begruessung', 'temel', 1, 'Hallo!', 'Selamlaşma, teşekkür ve vedalaşma', 'Merhaba, günaydın, teşekkürler, lütfen, evet/hayır.'],
  ['bekanntschaft', 'temel', 2, 'Wer bist du?', 'Tanışma ve kendini tanıtma', 'Adını, yaşını ve nerede oturduğunu söyleme.'],
  ['zahlen', 'temel', 3, 'Zahlen', 'Sayılar', '1’den 100’e sayılar, yaş ve fiyat söyleme.'],
  ['farben', 'temel', 4, 'Farben und Kleidung', 'Renkler ve kıyafet', 'Temel renkler ve giysileri renkleriyle tarif etme.'],
  ['familie', 'temel', 5, 'Meine Familie', 'Ailem', 'Aile üyeleri ve iyelik: mein, dein.'],
  ['laender', 'temel', 6, 'Länder und Sprachen', 'Ülkeler ve diller', 'Ülke adları, diller, milliyetler ve “kommen aus”.'],
  ['schule', 'temel', 7, 'In der Schule', 'Okul hayatı', 'Dersler, öğretmenler, ödev ve okul günü.'],
  ['klassenzimmer', 'temel', 8, 'Im Klassenzimmer', 'Sınıftaki eşyalar', 'Kalem, kitap, defter ve sınıf eşyaları.'],
  ['freizeit', 'temel', 9, 'Freizeit', 'Boş zaman', 'Hobiler ve boş zaman etkinlikleri.'],
  ['essen', 'temel', 10, 'Essen und Trinken', 'Yiyecek, içecek ve lokanta', 'Temel gıdalar, içecekler, öğünler ve sipariş verme.'],
  // ---- Ünite 2: Günlük Hayat ----
  ['wohnen', 'alltag', 1, 'Wohnen', 'Ev ve odalar', 'Ev, oda, mobilya ve ev aletleri.'],
  ['koerper', 'alltag', 2, 'Körper und Gesundheit', 'Vücut ve sağlık', 'Vücut bölümleri, hastalık ve doktor.'],
  ['tiere', 'alltag', 3, 'Tiere', 'Hayvanlar', 'Ev ve çiftlik hayvanları.'],
  ['wetter', 'alltag', 4, 'Wetter und Jahreszeiten', 'Hava ve mevsimler', 'Hava durumu, mevsimler ve sıcaklık.'],
  ['zeit', 'alltag', 5, 'Zeit und Tagesablauf', 'Zaman ve günlük rutin', 'Günler, aylar, saat ve günlük rutin fiilleri.'],
  ['verben', 'alltag', 6, 'Wichtige Verben', 'Önemli fiiller', 'En sık kullanılan fiiller ve modal fiiller.'],
  ['adjektive', 'alltag', 7, 'Adjektive', 'Sıfatlar', 'Bir şeyi tanımlama ve karşıt sıfatlar.'],
  ['fragewoerter', 'alltag', 8, 'Fragewörter und Pronomen', 'Soru kelimeleri ve zamirler', 'W-soruları, kişi ve iyelik zamirleri.'],
  ['stadt', 'alltag', 9, 'In der Stadt', 'Şehirde ve yer edatları', 'Yerler, yön sorma ve in/auf/neben gibi edatlar.'],
  ['berufe', 'alltag', 10, 'Berufe und Alltag', 'Meslekler ve günlük ifadeler', 'Meslekler, kibar kalıplar ve duygular.'],
]

export const SECTIONS: Section[] = SECTION_DATA.map(([id, unitId, indexInUnit, title, subtitle, description], i) => ({
  id,
  unitId,
  indexInUnit,
  order: i + 1,
  title,
  subtitle,
  description,
  level: 'A1.1',
}))

export const SECTION_BY_ID: Record<string, Section> = Object.fromEntries(SECTIONS.map((s) => [s.id, s]))

export const SECTION_ORDER: Record<string, number> = Object.fromEntries(SECTIONS.map((s) => [s.id, s.order]))

export const UNIT_BY_ID: Record<string, CourseUnit> = Object.fromEntries(UNITS.map((u) => [u.id, u]))

/** Ünite kimliğine göre bölümler (sıralı). */
export const SECTIONS_BY_UNIT: Record<string, Section[]> = Object.fromEntries(
  UNITS.map((u) => [u.id, SECTIONS.filter((s) => s.unitId === u.id).sort((a, b) => a.indexInUnit - b.indexInUnit)]),
)

export function sectionOrder(id: string): number {
  return SECTION_ORDER[id] ?? SECTIONS.length
}

export function sectionById(id: string): Section | undefined {
  return SECTION_BY_ID[id]
}
