import { describe, expect, it } from 'vitest'
import { acceptedForms, fold, gradeTyped, levenshtein, normalize, similarity } from '../src/engine/grading'

describe('metin normalizasyonu', () => {
  it('noktalama ve büyük/küçük harfi sadeleştirir', () => {
    expect(normalize('  Der Apfel!  ')).toBe('der apfel')
    expect(normalize('Wie geht es dir?')).toBe('wie geht es dir')
  })

  it('Almanca özel harfleri katlar', () => {
    expect(fold('Äpfel')).toBe('apfel')
    expect(fold('Straße')).toBe('strasse')
    expect(fold('Übung')).toBe('ubung')
    expect(fold('Öl')).toBe('ol')
  })
})

describe('Levenshtein', () => {
  it('temel mesafeleri doğru hesaplar', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', 'abc')).toBe(0)
  })

  it('benzerlik 0..1 arasında', () => {
    expect(similarity('apfel', 'apfel')).toBe(1)
    expect(similarity('apfel', 'apfell')).toBeGreaterThan(0.8)
    expect(similarity('apfel', 'xyz')).toBeLessThan(0.4)
  })
})

describe('yazılı cevap değerlendirme', () => {
  it('artikelli ve artikelsiz cevabı kabul eder', () => {
    const forms = acceptedForms('der Apfel')
    expect(gradeTyped('Apfel', forms).correct).toBe(true)
    expect(gradeTyped('der apfel', forms).correct).toBe(true)
    expect(gradeTyped('Apfel', forms).exact).toBe(true)
  })

  it('umlaut yazılmayınca doğru sayar ama tam saymaz', () => {
    const g = gradeTyped('Apfel', acceptedForms('die Äpfel'))
    expect(g.correct).toBe(true)
    expect(g.exact).toBe(false)
  })

  it('küçük yazım hatasını tolere eder', () => {
    expect(gradeTyped('Guten Morgen', acceptedForms('Guten Morgen')).correct).toBe(true)
    expect(gradeTyped('Guten Morgan', acceptedForms('Guten Morgen')).correct).toBe(true)
  })

  it('tamamen yanlış cevabı reddeder', () => {
    expect(gradeTyped('Bilgisayar', acceptedForms('der Apfel')).correct).toBe(false)
    expect(gradeTyped('', acceptedForms('der Apfel')).correct).toBe(false)
  })

  it('"sich" içeren fiillerde yalın hâli de kabul eder', () => {
    const forms = acceptedForms('sich waschen')
    expect(gradeTyped('waschen', forms).correct).toBe(true)
    expect(gradeTyped('sich waschen', forms).correct).toBe(true)
  })

  it('parantezli ipuçlarını yok sayar', () => {
    const forms = acceptedForms('anrufen (jdn.)')
    expect(gradeTyped('anrufen', forms).correct).toBe(true)
  })
})
