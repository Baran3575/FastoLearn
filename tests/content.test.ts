import { describe, expect, it } from 'vitest'
import {
  CONTENT_STATS,
  ITEMS,
  ITEMS_BY_SECTION,
  SECTION_BY_ID,
  SECTIONS_WITH_ITEMS,
  UNITS,
  pickDistractors,
} from '../src/content'

describe('içerik bütünlüğü', () => {
  it('yeterli sayıda öğe var', () => {
    expect(CONTENT_STATS.items).toBeGreaterThan(300)
    expect(CONTENT_STATS.sections).toBe(20)
    expect(UNITS.length).toBe(2)
  })

  it('kimlikler tekil', () => {
    const ids = new Set(ITEMS.map((i) => i.id))
    expect(ids.size).toBe(ITEMS.length)
  })

  it('her öğenin bölümü tanımlı ve her bölümde içerik var', () => {
    for (const item of ITEMS) expect(SECTION_BY_ID[item.unit]).toBeDefined()
    expect(SECTIONS_WITH_ITEMS.length).toBe(20)
    for (const section of SECTIONS_WITH_ITEMS) {
      expect((ITEMS_BY_SECTION.get(section.id) ?? []).length).toBeGreaterThan(8)
    }
  })

  it('her ünitede 10 bölüm var', () => {
    for (const unit of UNITS) {
      const sections = SECTIONS_WITH_ITEMS.filter((s) => s.unitId === unit.id)
      expect(sections.length, unit.id).toBe(10)
      expect(sections.map((s) => s.indexInUnit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    }
    // bölüm sırası 1..20 kesintisiz
    expect(SECTIONS_WITH_ITEMS.map((s) => s.order)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('kurs sıfırdan başlar: ilk bölüm selamlaşma ve temel nezaket sözleri', () => {
    const first = ITEMS_BY_SECTION.get('begruessung') ?? []
    const words = first.map((i) => i.de.toLowerCase())
    for (const basic of ['hallo', 'tschüss', 'danke', 'bitte', 'ja', 'nein', 'guten morgen']) {
      expect(words.some((w) => w.startsWith(basic)), basic).toBe(true)
    }
  })

  it('isimler artikel taşır (özel isimler hariç)', () => {
    for (const item of ITEMS) {
      if (item.pos !== 'noun') continue
      if (item.proper) continue
      expect(item.article, item.de).toBeDefined()
      expect(item.de.startsWith(item.article as string), item.de).toBe(true)
    }
  })

  it('her öğenin Almanca ve Türkçe alanları dolu, örnek cümlesi var', () => {
    for (const item of ITEMS) {
      expect(item.de.trim().length).toBeGreaterThan(0)
      expect(item.tr.trim().length).toBeGreaterThan(0)
      expect(item.ex, `${item.id} örnek cümle`).toBeTruthy()
      expect(item.exTr, `${item.id} örnek çevirisi`).toBeTruthy()
    }
  })

  it('aynı Almanca+anlam ikilisi iki kez yok', () => {
    const seen = new Set<string>()
    for (const item of ITEMS) {
      const key = `${item.de.toLowerCase()}::${item.tr.toLowerCase()}`
      expect(seen.has(key), key).toBe(false)
      seen.add(key)
    }
  })

  it('Türkçe karşılıklar Almanca özel harf içermez (ä/ß)', () => {
    for (const item of ITEMS) {
      // 'ö' ve 'ü' Türkçede de kullanılır; yalnızca Almancaya özgü harfler aranır
      expect(/[äÄß]/.test(item.tr), `${item.id}: ${item.tr}`).toBe(false)
    }
  })
})

describe('çoktan seçmeli çeldiriciler', () => {
  it('istenen sayıda, tekrarsız ve cevabı içermeyen seçenek döner', () => {
    const item = ITEMS[0]
    const distractors = pickDistractors(item, 3, () => 0.4, 'de')
    expect(distractors.length).toBe(3)
    expect(new Set(distractors).size).toBe(3)
    expect(distractors).not.toContain(item.de)
  })

  it('Türkçe seçenekler için de çalışır', () => {
    const item = ITEMS.find((i) => i.pos === 'noun')!
    const distractors = pickDistractors(item, 3, () => 0.7, 'tr')
    expect(distractors.length).toBe(3)
    expect(distractors).not.toContain(item.tr)
  })
})
