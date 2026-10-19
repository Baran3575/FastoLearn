import { describe, expect, it } from 'vitest'
import { SECTIONS } from '../src/content'
import { emptyCardProgress } from '../src/engine/types'
import { dueForecast, recallCurve, rollingSeries, sectionMastery } from '../src/engine/insights'
import type { ReviewEvent } from '../src/engine/types'
import { store } from '../src/state/store'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 0, 12, 9, 0, 0)

describe('motor içgörüleri', () => {
  it('tekrar takvimini gün gruplarına ayırır', () => {
    const offsets = [-1000, 1000, DAY, 2 * DAY, 5 * DAY, 10 * DAY]
    const cards = offsets.map((off, i) => {
      const card = emptyCardProgress(`c${i}`, NOW)
      card.reps = 1
      card.due = NOW + off
      return card
    })
    const forecast = dueForecast(cards, NOW)
    expect(forecast.map((b) => b.count)).toEqual([1, 1, 1, 1, 1, 1])
    expect(forecast[0].key).toBe('overdue')
  })

  it('bölüm ustalığını stabiliteye göre hesaplar', () => {
    const cards: Record<string, ReturnType<typeof emptyCardProgress>> = {}
    const first = emptyCardProgress('x1', NOW)
    first.reps = 2
    first.stability = 21
    first.due = NOW + 3 * DAY
    cards['x1'] = first

    const rows = sectionMastery({
      sections: SECTIONS,
      items: [
        { id: 'x1', unit: 'begruessung' },
        { id: 'x2', unit: 'begruessung' },
      ],
      cards,
      themeStats: { begruessung: { n: 4, correct: 3 } },
      now: NOW,
    })
    const row = rows.find((r) => r.id === 'begruessung')!
    expect(row.seen).toBe(1)
    expect(row.total).toBe(2)
    expect(row.mastery).toBeGreaterThan(0.3)
    expect(row.mastery).toBeLessThan(0.4)
    expect(row.accuracy).toBe(0.75)
    // 20 bölümün tamamı sıralı döner
    expect(rows).toHaveLength(20)
    expect(rows[0].order).toBe(1)
  })

  it('ortalama unutma eğrisi azalır ve 31 nokta üretir', () => {
    const card = emptyCardProgress('x1', NOW)
    card.reps = 2
    card.stability = 10
    card.lastReview = NOW
    const curve = recallCurve([card], store.engine().scheduler, NOW)
    expect(curve).toHaveLength(31)
    expect(curve[0]).toBeCloseTo(1, 2)
    expect(curve[30]).toBeLessThan(curve[0])
  })

  it('kayan doğruluk serisi pencere boyutunda kalır', () => {
    const events: ReviewEvent[] = Array.from({ length: 40 }, (_, i) => ({
      itemId: 'x',
      sessionId: 's',
      at: NOW + i * 1000,
      correct: i % 2 === 0,
      ms: 2000,
      kind: 'tr_to_de_choice',
      rating: 3,
      pFsrs: 0.7,
      pRwkv: 0.6,
      pFinal: 0.8,
      targetRetention: 0.9,
    }))
    const trend = rollingSeries(events, 20)
    expect(trend.accuracy).toHaveLength(21)
    expect(trend.accuracy[0]).toBeCloseTo(0.5, 5)
    expect(trend.brier[0]).toBeCloseTo(0.5 * 0.64 + 0.5 * 0.04, 5)
  })
})
