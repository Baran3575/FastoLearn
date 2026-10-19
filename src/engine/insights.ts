/**
 * Motor ekranı için görsel içgörüler.
 *
 * Hepsi saf fonksiyonlardır: kartlardan/olaylardan türetilir, arayüzden
 * bağımsızdır ve kolayca test edilebilir.
 */

import type { FSRSScheduler } from './fsrs7'
import type { CardProgress, ReviewEvent } from './types'

const DAY_MS = 86_400_000

export interface ForecastBucket {
  key: string
  label: string
  count: number
}

/** Önümüzdeki günlerde tekrarı gelen kart sayısı (takvim görünümü). */
export function dueForecast(cards: CardProgress[], now: number, days = 7): ForecastBucket[] {
  const d = new Date(now)
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const endToday = start + DAY_MS
  const endTomorrow = start + 2 * DAY_MS
  const end3 = start + 4 * DAY_MS
  const end7 = start + (days + 1) * DAY_MS

  const buckets: ForecastBucket[] = [
    { key: 'overdue', label: 'Gecikmiş', count: 0 },
    { key: 'today', label: 'Bugün', count: 0 },
    { key: 'tomorrow', label: 'Yarın', count: 0 },
    { key: 'd3', label: '2–3 gün', count: 0 },
    { key: 'week', label: '4–7 gün', count: 0 },
    { key: 'later', label: 'Sonra', count: 0 },
  ]

  for (const card of cards) {
    if (card.reps === 0) continue
    const due = card.due || now
    if (due < now) buckets[0].count += 1
    else if (due < endToday) buckets[1].count += 1
    else if (due < endTomorrow) buckets[2].count += 1
    else if (due < end3) buckets[3].count += 1
    else if (due < end7) buckets[4].count += 1
    else buckets[5].count += 1
  }

  return buckets
}

export interface MasteryRow {
  id: string
  title: string
  subtitle: string
  order: number
  total: number
  seen: number
  due: number
  /** 0..1 — istikrar (stability) tabanlı ortalama ustalık */
  mastery: number
  accuracy: number | null
}

export interface MasteryInput {
  sections: { id: string; order: number; title: string; subtitle: string }[]
  items: { id: string; unit: string }[]
  cards: Record<string, CardProgress>
  themeStats: Record<string, { n: number; correct: number }>
  now: number
}

/** Bölüm bazında “ne kadar oturdu?” göstergesi. */
export function sectionMastery({
  sections,
  items,
  cards,
  themeStats,
  now,
}: MasteryInput): MasteryRow[] {
  const bySection = new Map<string, { total: number; seen: number; due: number; mastery: number }>()

  for (const item of items) {
    const row = bySection.get(item.unit) ?? { total: 0, seen: 0, due: 0, mastery: 0 }
    const card = cards[item.id]
    row.total += 1
    if (card && card.reps > 0) {
      row.seen += 1
      if (card.due <= now) row.due += 1
      // stability gün cinsinden; 21 gün ≈ %63 ustalık
      const stability = card.stability ?? 0
      row.mastery += 1 - Math.exp(-Math.max(0, stability) / 21)
    }
    bySection.set(item.unit, row)
  }

  return sections
    .map((section) => {
      const row = bySection.get(section.id) ?? { total: 0, seen: 0, due: 0, mastery: 0 }
      const stat = themeStats[section.id]
      return {
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        order: section.order,
        total: row.total,
        seen: row.seen,
        due: row.due,
        mastery: row.total ? row.mastery / row.total : 0,
        accuracy: stat && stat.n > 0 ? stat.correct / stat.n : null,
      }
    })
    .sort((a, b) => a.order - b.order)
}

/**
 * Hiç tekrar yapılmazsa ortalama hatırlama olasılığının 30 günlük seyri.
 * Öğrenilmiş kartların FSRS-7 unutma eğrilerinin ortalamasıdır.
 */
export function recallCurve(
  cards: CardProgress[],
  scheduler: FSRSScheduler,
  now: number,
  horizonDays = 30,
): number[] {
  const learned = cards.filter((c) => c.reps > 0 && c.stability != null)
  if (!learned.length) return []
  const out: number[] = []
  for (let d = 0; d <= horizonDays; d += 1) {
    let sum = 0
    for (const card of learned) sum += scheduler.retrievability(card, now + d * DAY_MS)
    out.push(sum / learned.length)
  }
  return out
}

export interface RollingSeries {
  accuracy: number[]
  brier: number[]
}

/** Kayan pencerede doğruluk ve Brier skoru (motor trendi). */
export function rollingSeries(events: ReviewEvent[], window = 20): RollingSeries {
  const accuracy: number[] = []
  const brier: number[] = []
  if (events.length < window) return { accuracy, brier }

  let correct = 0
  let sq = 0
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i]
    const y = e.correct ? 1 : 0
    correct += y
    sq += (e.pFinal - y) ** 2
    if (i >= window) {
      const old = events[i - window]
      correct -= old.correct ? 1 : 0
      sq -= (old.pFinal - (old.correct ? 1 : 0)) ** 2
    }
    if (i >= window - 1) {
      accuracy.push(correct / window)
      brier.push(sq / window)
    }
  }
  return { accuracy, brier }
}
