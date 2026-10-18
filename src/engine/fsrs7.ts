/**
 * FSRS-7 — Free Spaced Repetition Scheduler (ikincil motor).
 *
 * `dilingo/app/srs/fsrs.py` dosyasındaki 21 parametreli referans uygulamanın
 * birebir TypeScript portu: üs yasası unutma eğrisi
 *
 *     R(t) = (1 + FACTOR * t / S) ** DECAY ,  FACTOR = 0.9 ** (1/DECAY) - 1
 *
 * ve stabilite/zorluk güncellemeleri. Tarayıcıda çalıştığı için Date yerine
 * epoch milisaniye (number) kullanılır.
 */

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export enum CardState {
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export const FSRS_DEFAULT_DECAY = 0.1542

export const DEFAULT_PARAMETERS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, // w0-w3  başlangıç stabilitesi (rating başına)
  6.4133, 0.8334, // w4-w5  başlangıç zorluğu
  3.0194, 0.001, // w6-w7  zorluk adımı / ortalamaya dönüş
  1.8722, 0.1666, // w8-w9  hatırlamada stabilite
  0.796, 1.4835, // w10-w11
  0.0614, 0.2629, 1.6483, // w12-w14 unutmada stabilite
  0.6014, 1.8729, // w15-w16 hard cezası / easy bonusu
  0.5425, 0.0912, 0.0658, // w17-w19 kısa dönem stabilite
  FSRS_DEFAULT_DECAY, // w20   decay
]

export const STABILITY_MIN = 0.001
export const INITIAL_STABILITY_MAX = 100.0
export const MIN_DIFFICULTY = 1.0
export const MAX_DIFFICULTY = 10.0

export const LOWER_BOUNDS_PARAMETERS: readonly number[] = [
  0.001, 0.001, 0.001, 0.001, 1.0, 0.001, 0.001, 0.001, 0.0, 0.0, 0.001, 0.001, 0.001, 0.001, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.1,
]

export const UPPER_BOUNDS_PARAMETERS: readonly number[] = [
  100.0, 100.0, 100.0, 100.0, 10.0, 4.0, 4.0, 0.75, 4.5, 0.8, 3.5, 5.0, 0.25, 0.9, 4.0, 1.0, 6.0, 2.0, 2.0, 0.8, 0.8,
]

const FUZZ_RANGES = [
  { start: 2.5, end: 7.0, factor: 0.15 },
  { start: 7.0, end: 20.0, factor: 0.1 },
  { start: 20.0, end: Number.POSITIVE_INFINITY, factor: 0.05 },
]

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

/** Tek bir kartın bellek durumu. `due` ve `lastReview` epoch ms. */
export interface Card {
  cardId: string
  state: CardState
  step: number | null
  stability: number | null
  difficulty: number | null
  due: number
  lastReview: number | null
}

export function newCard(cardId: string): Card {
  return {
    cardId,
    state: CardState.Learning,
    step: null,
    stability: null,
    difficulty: null,
    due: 0,
    lastReview: null,
  }
}

export function cloneCard(card: Card): Card {
  return { ...card }
}

export interface FSRSConfig {
  parameters?: readonly number[]
  desiredRetention?: number
  learningSteps?: readonly number[]
  relearningSteps?: readonly number[]
  maximumInterval?: number
  enableFuzzing?: boolean
  /** Enjekte edilebilir RNG (deterministik testler için). */
  random?: () => number
}

export function clampDifficulty(d: number): number {
  return Math.min(Math.max(d, MIN_DIFFICULTY), MAX_DIFFICULTY)
}

export function clampStability(s: number): number {
  return Math.min(Math.max(s, STABILITY_MIN), INITIAL_STABILITY_MAX)
}

export function validateParameters(p: readonly number[]): void {
  if (p.length !== 21) throw new Error(`FSRS-7 21 parametre ister, alınan: ${p.length}`)
  const errors: string[] = []
  for (let i = 0; i < p.length; i++) {
    const lo = LOWER_BOUNDS_PARAMETERS[i]
    const hi = UPPER_BOUNDS_PARAMETERS[i]
    if (!(p[i] >= lo && p[i] <= hi)) errors.push(`parameters[${i}] = ${p[i]} sınır dışı (${lo}, ${hi})`)
  }
  if (errors.length) throw new Error(`Geçersiz parametreler:\n  ${errors.join('\n  ')}`)
}

export class FSRSScheduler {
  static readonly name = 'FSRS-7'

  readonly parameters: readonly number[]
  readonly desiredRetention: number
  readonly learningSteps: readonly number[]
  readonly relearningSteps: readonly number[]
  readonly maximumInterval: number
  readonly enableFuzzing: boolean

  private readonly decay: number
  private readonly factor: number
  private readonly random: () => number

  constructor(config: FSRSConfig = {}) {
    const parameters = config.parameters ?? DEFAULT_PARAMETERS
    validateParameters(parameters)
    this.parameters = [...parameters]
    this.desiredRetention = config.desiredRetention ?? 0.9
    this.learningSteps = config.learningSteps ?? [1, 10]
    this.relearningSteps = config.relearningSteps ?? [10]
    this.maximumInterval = config.maximumInterval ?? 36_500
    this.enableFuzzing = config.enableFuzzing ?? true
    this.random = config.random ?? Math.random
    this.decay = -this.parameters[20]
    this.factor = 0.9 ** (1 / this.decay) - 1
  }

  // -- bellek modeli ------------------------------------------------------- //

  private p(i: number): number {
    return this.parameters[i]
  }

  private initialStability(rating: Rating): number {
    return clampStability(this.p(rating - 1))
  }

  private initialDifficulty(rating: Rating, clamp = true): number {
    const d = this.p(4) - Math.exp(this.p(5) * (rating - 1)) + 1
    return clamp ? clampDifficulty(d) : d
  }

  private nextInterval(stability: number): number {
    const ivl = (stability / this.factor) * (this.desiredRetention ** (1 / this.decay) - 1)
    return Math.max(1, Math.min(Math.round(ivl), this.maximumInterval))
  }

  private shortTermStability(stability: number, rating: Rating): number {
    let inc = Math.exp(this.p(17) * (rating - 3 + this.p(18))) * stability ** -this.p(19)
    if (rating !== Rating.Again) inc = Math.max(inc, 1)
    return clampStability(stability * inc)
  }

  private nextDifficulty(difficulty: number, rating: Rating): number {
    const linearDamping = (delta: number, d: number) => ((10 - d) * delta) / 9
    const arg1 = this.initialDifficulty(Rating.Easy, false)
    const delta = -(this.p(6) * (rating - 3))
    const arg2 = difficulty + linearDamping(delta, difficulty)
    return clampDifficulty(this.p(7) * arg1 + (1 - this.p(7)) * arg2)
  }

  private nextForgetStability(difficulty: number, stability: number, retrievability: number): number {
    const longTerm =
      this.p(11) *
      difficulty ** -this.p(12) *
      ((stability + 1) ** this.p(13) - 1) *
      Math.exp((1 - retrievability) * this.p(14))
    const shortTerm = stability / Math.exp(this.p(17) * this.p(18))
    return Math.min(longTerm, shortTerm)
  }

  private nextRecallStability(difficulty: number, stability: number, retrievability: number, rating: Rating): number {
    const hardPenalty = rating === Rating.Hard ? this.p(15) : 1
    const easyBonus = rating === Rating.Easy ? this.p(16) : 1
    return (
      stability *
      (1 +
        Math.exp(this.p(8)) *
          (11 - difficulty) *
          stability ** -this.p(9) *
          (Math.exp((1 - retrievability) * this.p(10)) - 1) *
          hardPenalty *
          easyBonus)
    )
  }

  // -- dışa açık yardımcılar ---------------------------------------------- //

  /** Kartın şu andaki hatırlanma olasılığı (0-1). */
  retrievability(card: Card, now: number = Date.now()): number {
    if (card.lastReview == null || card.stability == null || card.stability <= 0) return 0
    const elapsedDays = Math.max(0, (now - card.lastReview) / DAY_MS)
    return (1 + (this.factor * elapsedDays) / card.stability) ** this.decay
  }

  /** Verilen stabilite için hedef hatırlanma olasılığına denk gelen aralık (gün). */
  intervalForRetention(stability: number, retention: number = this.desiredRetention): number {
    return (stability / this.factor) * (retention ** (1 / this.decay) - 1)
  }

  /** Kartın "olgunluk" seviyesi: 0 = yeni, 1 = kısa, 2 = orta, 3 = uzun vade. */
  maturity(s: number | null): 0 | 1 | 2 | 3 {
    if (s == null || s < 1) return 0
    if (s < 10) return 1
    if (s < 60) return 2
    return 3
  }

  // -- inceleme ----------------------------------------------------------- //

  /** Bir cevabı uygular ve *yeni* kart döner (girdi değişmez). */
  review(card: Card, rating: Rating, at: number = Date.now()): Card {
    const now = at
    const daysSince = card.lastReview != null ? Math.max(0, (now - card.lastReview) / DAY_MS) : null
    const subDay = daysSince != null && daysSince < 1
    const c = cloneCard(card)
    c.lastReview = now

    // ---- yeni kart ----
    if (card.stability == null || card.difficulty == null) {
      c.stability = this.initialStability(rating)
      c.difficulty = this.initialDifficulty(rating)
      c.state = rating === Rating.Again ? CardState.Learning : CardState.Review
      c.step = c.state === CardState.Review ? null : 0
      c.due =
        c.state === CardState.Learning
          ? now + this.learningSteps[0] * MINUTE_MS
          : now + this.nextInterval(c.stability) * DAY_MS
      return c
    }

    // ---- stabilite / zorluk ----
    if (subDay) {
      c.stability = this.shortTermStability(card.stability, rating)
    } else {
      c.stability =
        rating === Rating.Again
          ? clampStability(this.nextForgetStability(card.difficulty, card.stability, this.retrievability(card, now)))
          : clampStability(
              this.nextRecallStability(card.difficulty, card.stability, this.retrievability(card, now), rating),
            )
    }
    c.difficulty = this.nextDifficulty(card.difficulty, rating)

    // ---- durum makinesi / aralık ----
    let ivlMs: number
    const step = card.step ?? 0

    if (card.state === CardState.Learning) {
      if (this.learningSteps.length === 0) {
        c.state = CardState.Review
        c.step = null
        ivlMs = this.nextInterval(c.stability) * DAY_MS
      } else if (rating === Rating.Again) {
        c.step = 0
        return { ...c, due: now + this.learningSteps[0] * MINUTE_MS }
      } else if (rating === Rating.Hard) {
        if (step === 0 && this.learningSteps.length === 1) {
          ivlMs = this.learningSteps[0] * 1.5 * MINUTE_MS
        } else if (step === 0) {
          ivlMs = (((this.learningSteps[0] + this.learningSteps[1]) / 2) * MINUTE_MS)
        } else {
          ivlMs = this.learningSteps[Math.min(step, this.learningSteps.length - 1)] * MINUTE_MS
        }
        return { ...c, due: now + ivlMs }
      } else if (rating === Rating.Good) {
        if (step + 1 >= this.learningSteps.length) {
          c.state = CardState.Review
          c.step = null
          ivlMs = this.nextInterval(c.stability) * DAY_MS
        } else {
          c.step = step + 1
          ivlMs = this.learningSteps[c.step] * MINUTE_MS
        }
      } else {
        // Easy
        c.state = CardState.Review
        c.step = null
        ivlMs = this.nextInterval(c.stability) * DAY_MS
      }
    } else if (card.state === CardState.Review) {
      if (rating === Rating.Again && this.relearningSteps.length > 0) {
        c.state = CardState.Relearning
        c.step = 0
        return { ...c, due: now + this.relearningSteps[0] * MINUTE_MS }
      }
      ivlMs = this.nextInterval(c.stability) * DAY_MS
    } else {
      // Relearning
      if (rating === Rating.Again) {
        c.step = 0
        return { ...c, due: now + this.relearningSteps[0] * MINUTE_MS }
      }
      if (rating === Rating.Hard) {
        const s = Math.min(step, this.relearningSteps.length - 1)
        return { ...c, due: now + this.relearningSteps[s] * 1.5 * MINUTE_MS }
      }
      if (rating === Rating.Good && step + 1 < this.relearningSteps.length) {
        c.step = step + 1
        return { ...c, due: now + this.relearningSteps[c.step] * MINUTE_MS }
      }
      c.state = CardState.Review
      c.step = null
      ivlMs = this.nextInterval(c.stability) * DAY_MS
    }

    if (this.enableFuzzing) ivlMs = this.fuzz(ivlMs)
    return { ...c, due: now + ivlMs }
  }

  private fuzz(intervalMs: number): number {
    const days = Math.floor(intervalMs / DAY_MS)
    if (days < 2.5) return intervalMs
    let delta = 1
    for (const fr of FUZZ_RANGES) delta += fr.factor * Math.max(Math.min(days, fr.end) - fr.start, 0)
    let lo = Math.max(2, Math.round(days - delta))
    const hi = Math.min(Math.round(days + delta), this.maximumInterval)
    lo = Math.min(lo, hi)
    const fuzzed = Math.min(Math.round(this.random() * (hi - lo + 1) + lo), this.maximumInterval)
    return fuzzed * DAY_MS
  }

  /** Bu ayarlarla hedef aralık dağılımı (UI önizlemesi için). */
  intervalPreview(card: Card, now: number = Date.now()): Record<Rating, number> {
    const out = {} as Record<Rating, number>
    for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      const next = this.review(card, r, now)
      out[r] = Math.max(0, next.due - now)
    }
    return out
  }

  config() {
    return {
      name: FSRSScheduler.name,
      parameters: [...this.parameters],
      desiredRetention: this.desiredRetention,
      learningSteps: [...this.learningSteps],
      relearningSteps: [...this.relearningSteps],
      maximumInterval: this.maximumInterval,
    }
  }
}

// --------------------------------------------------------------------------- //
// Parametre optimizasyonu: gözlem logu üzerinde negatif log-olabilirlik
// --------------------------------------------------------------------------- //

export interface ReviewRecord {
  cardId: string
  review: number // epoch ms
  rating: Rating
}

/** FSRS-7 altında gözlenen sonuçların ortalama NLL'i. */
export function logLikelihood(
  params: readonly number[],
  reviews: readonly ReviewRecord[],
  desiredRetention = 0.9,
): number {
  const sched = new FSRSScheduler({ parameters: params, desiredRetention, enableFuzzing: false })
  const states = new Map<string, Card>()
  let total = 0
  let n = 0
  const eps = 1e-9
  for (const r of reviews) {
    const card = states.get(r.cardId) ?? newCard(r.cardId)
    const R = sched.retrievability(card, r.review)
    n += 1
    const p = r.rating === Rating.Again ? R : 1 - R
    total += -Math.log(Math.min(Math.max(p, eps), 1 - eps))
    states.set(r.cardId, sched.review(card, r.rating, r.review))
  }
  return total / Math.max(n, 1)
}

/** Basit mulberry32 PRNG — tarayıcıda deterministik arama için. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export interface TuneResult {
  parameters: number[]
  defaultNll: number
  tunedNll: number
  improvement: number
  history: { iteration: number; nll: number }[]
}

/**
 * Sıfırıncı mertebeden (1+λ) evrim araması — Python sürümünün portu.
 * Arka planda (Web Worker) çalışarak kullanıcının kendi loguna göre
 * 21 FSRS-7 ağırlığını kişiselleştirir.
 */
export function optimiseParameters(
  reviews: readonly ReviewRecord[],
  iterations = 60,
  step = 0.06,
  desiredRetention = 0.9,
  seed = 7,
): TuneResult {
  const rng = mulberry32(seed)
  let base = [...DEFAULT_PARAMETERS]
  let best = [...base]
  let bestNll = logLikelihood(best, reviews, desiredRetention)
  const defaultNll = bestNll
  const history = [{ iteration: 0, nll: bestNll }]

  const clampAt = (i: number, v: number) => {
    let nv = Math.min(Math.max(v, LOWER_BOUNDS_PARAMETERS[i]), UPPER_BOUNDS_PARAMETERS[i])
    if (i === 20) nv = Math.min(Math.max(nv, 0.1), 0.8)
    return nv
  }

  for (let it = 1; it <= iterations; it++) {
    const candidates: number[][] = []
    for (let c = 0; c < 3; c++) {
      const cand = base.map((v, i) => clampAt(i, v + gauss(rng) * step * (UPPER_BOUNDS_PARAMETERS[i] - LOWER_BOUNDS_PARAMETERS[i])))
      candidates.push(cand)
    }
    for (const cand of candidates) {
      try {
        const nll = logLikelihood(cand, reviews, desiredRetention)
        if (nll < bestNll) {
          best = cand
          bestNll = nll
        }
      } catch {
        /* sınır dışı adayı yoksay */
      }
    }
    base = base.map((v, i) => clampAt(i, v + gauss(rng) * step * 0.15 * (UPPER_BOUNDS_PARAMETERS[i] - LOWER_BOUNDS_PARAMETERS[i])))
    history.push({ iteration: it, nll: bestNll })
  }

  return {
    parameters: best,
    defaultNll,
    tunedNll: bestNll,
    improvement: defaultNll > 0 ? (100 * (defaultNll - bestNll)) / defaultNll : 0,
    history,
  }
}
