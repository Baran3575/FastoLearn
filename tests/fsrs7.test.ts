import { describe, expect, it } from 'vitest'
import {
  CardState,
  DEFAULT_PARAMETERS,
  FSRSScheduler,
  Rating,
  logLikelihood,
  mulberry32,
  newCard,
  optimiseParameters,
  validateParameters,
} from '../src/engine/fsrs7'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 0, 1)

describe('FSRS-7 — parametreler', () => {
  it('21 parametre ister', () => {
    expect(() => validateParameters([1, 2, 3])).toThrow(/21 parametre/)
  })

  it('sınır dışı parametreyi reddeder', () => {
    const bad = [...DEFAULT_PARAMETERS]
    bad[5] = 99
    expect(() => validateParameters(bad)).toThrow(/sınır dışı/)
  })

  it('varsayılan parametreler geçerlidir', () => {
    expect(() => validateParameters(DEFAULT_PARAMETERS)).not.toThrow()
  })
})

describe('FSRS-7 — unutma eğrisi', () => {
  it('hatırlanabilirlik zamanla azalır', () => {
    const sched = new FSRSScheduler()
    let card = newCard('a')
    card = sched.review(card, Rating.Good, T0)
    const r1 = sched.retrievability(card, T0 + 1 * DAY)
    const r5 = sched.retrievability(card, T0 + 5 * DAY)
    const r30 = sched.retrievability(card, T0 + 30 * DAY)
    expect(r1).toBeGreaterThan(r5)
    expect(r5).toBeGreaterThan(r30)
    expect(r30).toBeGreaterThan(0)
  })

  it('hedef hatırlanma oranı için aralık hesaplanabilir', () => {
    const sched = new FSRSScheduler()
    const ivl90 = sched.intervalForRetention(10, 0.9)
    const ivl75 = sched.intervalForRetention(10, 0.75)
    expect(ivl90).toBeGreaterThan(0)
    expect(ivl75).toBeGreaterThan(ivl90)
  })
})

describe('FSRS-7 — durum makinesi', () => {
  it('yeni kart Good ile REVIEW durumuna geçer ve en az 1 gün sonra gelir', () => {
    const sched = new FSRSScheduler({ enableFuzzing: false })
    const card = sched.review(newCard('a'), Rating.Good, T0)
    expect(card.state).toBe(CardState.Review)
    expect(card.stability).toBeGreaterThan(0)
    expect(card.due - T0).toBeGreaterThanOrEqual(DAY)
  })

  it('Again, kartı yeniden öğrenmeye alır', () => {
    const sched = new FSRSScheduler({ enableFuzzing: false })
    let card = sched.review(newCard('a'), Rating.Good, T0)
    card = sched.review(card, Rating.Good, T0 + 3 * DAY)
    const lapsed = sched.review(card, Rating.Again, T0 + 10 * DAY)
    expect(lapsed.state).toBe(CardState.Relearning)
    expect(lapsed.due - (T0 + 10 * DAY)).toBeLessThanOrEqual(15 * 60_000)
    expect(lapsed.stability!).toBeLessThan(card.stability!)
  })

  it('başarılı tekrarlar aralığı büyütür', () => {
    const sched = new FSRSScheduler({ enableFuzzing: false })
    let card = sched.review(newCard('a'), Rating.Good, T0)
    const first = card.due - T0
    card = sched.review(card, Rating.Good, card.due)
    const second = card.due - (T0 + first)
    card = sched.review(card, Rating.Good, card.due)
    const third = card.due - (T0 + first + second)
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
  })

  it('tohumlanmış RNG ile deterministiktir', () => {
    const mk = () => new FSRSScheduler({ random: mulberry32(42) })
    const a = mk().review(newCard('x'), Rating.Good, T0)
    const b = mk().review(newCard('x'), Rating.Good, T0)
    expect(a.due).toBe(b.due)
  })

  it('zorluk 1..10 aralığında kalır', () => {
    const sched = new FSRSScheduler({ enableFuzzing: false })
    let card = newCard('a')
    for (const r of [Rating.Again, Rating.Hard, Rating.Easy, Rating.Good, Rating.Again]) {
      card = sched.review(card, r, (card.due || T0) + 1000)
      expect(card.difficulty!).toBeGreaterThanOrEqual(1)
      expect(card.difficulty!).toBeLessThanOrEqual(10)
    }
  })
})

describe('FSRS-7 — parametre uyarlama', () => {
  const reviews = Array.from({ length: 60 }, (_, i) => ({
    cardId: `c${i % 6}`,
    review: T0 + i * 2 * DAY,
    rating: (i % 7 === 0 ? Rating.Again : i % 3 === 0 ? Rating.Hard : Rating.Good) as Rating,
  }))

  it('log-olabilirlik sonludur', () => {
    const nll = logLikelihood(DEFAULT_PARAMETERS, reviews)
    expect(Number.isFinite(nll)).toBe(true)
    expect(nll).toBeGreaterThan(0)
  })

  it('arama daha iyi (veya eşit) bir NLL bulur ve sınırlar içinde kalır', () => {
    const result = optimiseParameters(reviews, 6, 0.06, 0.9, 11)
    expect(result.tunedNll).toBeLessThanOrEqual(result.defaultNll + 1e-9)
    expect(() => validateParameters(result.parameters)).not.toThrow()
    expect(result.history.length).toBeGreaterThan(1)
  })
})
