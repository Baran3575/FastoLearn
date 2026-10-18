/**
 * Öğrenme motoru — RWKV-Instant (taban) + FSRS-7 (ikincil) birlikte çalışır.
 *
 * Akış:
 *   1. RWKV-Instant, kullanıcının olay akışını sabit boyutlu durumda özetler
 *      ve *kişisel* hatırlama olasılığını üretir (her cevaptan sonra tek
 *      adımda güncellenir, O(1)).
 *   2. FSRS-7, öğe başına kalibre bir bellek durumu tutar
 *      (stabilite / zorluk / vade) ve aralıkların ölçeğini belirler.
 *   3. İki tahmin logit uzayında çevrimiçi öğrenilen ağırlıklarla (α, β, γ)
 *      birleşir; hedef hatırlanma oranı öğe başına kişiselleştirilir.
 *   4. Derecelendirme (Again/Hard/Good/Easy) kullanıcıya sorulmadan
 *      doğruluk + cevap süresi + tahminden otomatik çıkarılır.
 *
 * Her şey arka planda, her cevaptan sonra otomatik çalışır; kullanıcı hiçbir
 * ayar yapmak zorunda değildir.
 */

import {
  CardState,
  DEFAULT_PARAMETERS,
  FSRSScheduler,
  Rating,
  type Card,
} from './fsrs7'
import { RWKVInstant, DEFAULT_RWKV_CONFIG, HORIZON_LABELS, type RWKVStateSnapshot } from './rwkv'
import { FEATURE_DIM, encodeFeatures, featureContributions, type FeatureContext } from './features'
import { gradeTyped, acceptedForms } from './grading'
import { summarize, type PredictionPair } from './metrics'
import { emptyCardProgress, type CardProgress, type ExerciseKind, type UserState, type VocabularyItem } from './types'

const DAY = 86_400_000
const HOUR = 3_600_000

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const clamp01 = (v: number) => clamp(v, 0, 1)

/** Tek bir modelin (FSRS-7 / RWKV-Instant / birleşim) hata ölçütleri. */
export type MetricsSummary = ReturnType<typeof summarize>
export type AccuracyModels = Record<'fsrs' | 'rwkv' | 'blend', MetricsSummary>

export interface AccuracyModelReport {
  /** tüm geçmiş */
  all: AccuracyModels
  /** son 200 cevap */
  recent: AccuracyModels
}

export interface PersonalizationReport {
  horizons: { label: string; value: number }[]
  mixture: [number, number, number]
  modelSteps: number
  stateSize: number
  paramCount: number
  lateHorizonNote: string
  biases: { item: string; tr: string; bias: number }[]
  weakestThemes: { unit: string; accuracy: number; n: number }[]
  strongestThemes: { unit: string; accuracy: number; n: number }[]
  fsrsTuned: boolean
  fsrsTuningNll: number | null
  fsrsTunedAt: number | null
}

export interface CardStats {
  fresh: number
  learning: number
  young: number
  mature: number
  dueNow: number
  total: number
}

export function logit(p: number): number {
  const q = clamp(p, 1e-4, 1 - 1e-4)
  return Math.log(q / (1 - q))
}

export interface EvaluateResult {
  correct: boolean
  exact: boolean
  similarity: number
  correctAnswer: string
}

export interface PlanItem {
  item: VocabularyItem
  kind: ExerciseKind
  fromQueue: boolean
  isNew: boolean
  dueAt: number
  overdueDays: number
  pFsrs: number
  pRwkv: number
  pFinal: number
  targetRetention: number
  score: number
}

export interface GradeResult {
  itemId: string
  kind: ExerciseKind
  correct: boolean
  exact: boolean
  correctAnswer: string
  rating: Rating
  pFsrs: number
  pRwkv: number
  pFinal: number
  /** Gözlemden sonraki bellek durumu */
  stability: number
  difficulty: number
  targetRetention: number
  intervalMs: number
  dueAt: number
  xp: number
  horizons: number[]
  contributions: { name: string; value: number; contribution: number }[]
}

export interface PlanRequest {
  scope?: 'all' | 'due' | 'unit'
  unitId?: string
  limit?: number
  now?: number
}

export class LearningEngine {
  readonly items: VocabularyItem[]
  private readonly byId: Map<string, VocabularyItem>
  private fsrs: FSRSScheduler
  private rwkv: RWKVInstant
  private readonly state: UserState
  private lastHorizons: number[] = []
  private sectionOrder: Record<string, number> = {}
  private sectionTotal = 1

  constructor(items: VocabularyItem[], state: UserState, rwkvConfig = DEFAULT_RWKV_CONFIG) {
    this.items = items
    this.byId = new Map(items.map((i) => [i.id, i]))
    this.state = state
    this.fsrs = new FSRSScheduler({
      parameters: state.fsrsParameters ?? DEFAULT_PARAMETERS,
      enableFuzzing: true,
    })
    this.rwkv = new RWKVInstant(rwkvConfig)
    if (state.rwkv) this.rwkv.restoreState(state.rwkv)
  }

  // ---------------------------------------------------------------- //
  // yardımcılar
  // ---------------------------------------------------------------- //

  get scheduler(): FSRSScheduler {
    return this.fsrs
  }

  get model(): RWKVInstant {
    return this.rwkv
  }

  /** Kişiselleştirilmiş FSRS-7 parametrelerini uygular (arka plan işinden gelir). */
  setFsrsParameters(parameters: number[] | null, nll?: number): void {
    this.state.fsrsParameters = parameters
    this.state.fsrsTunedAt = Date.now()
    this.state.fsrsTuningNll = nll ?? null
    this.fsrs = new FSRSScheduler({ parameters: parameters ?? DEFAULT_PARAMETERS, enableFuzzing: true })
  }

  /**
   * Müfredat sırası: bölüm kimliği → 1..N sıra. Verilirse, sıfırdan başlayan
   * kullanıcıya önce ilk bölümün kelimeleri sunulur (bkz. `plan`).
   */
  setSectionOrder(map: Record<string, number>): void {
    this.sectionOrder = map ?? {}
    this.sectionTotal = Math.max(1, Object.keys(this.sectionOrder).length)
  }

  private orderOf(unit: string): number {
    return this.sectionOrder[unit] ?? Number.MAX_SAFE_INTEGER
  }

  progress(itemId: string, now = Date.now()): CardProgress {
    const existing = this.state.cards[itemId]
    if (existing) return existing
    const fresh = emptyCardProgress(itemId, now)
    this.state.cards[itemId] = fresh
    return fresh
  }

  private asCard(p: CardProgress): Card {
    return p
  }

  /** İki tahmini logit uzayında birleştirir. */
  blend(pRwkv: number, pFsrs: number): number {
    const [a, b, c] = this.state.mixture
    return clamp01(1 / (1 + Math.exp(-(a * logit(pRwkv) + b * logit(pFsrs) + c))))
  }

  private targetRetention(pRwkv: number, pFsrs: number): number {
    // RWKV-Instant FSRS'ten daha riskli görüyorsa hedefi düşür → aralık kısalır
    return clamp(0.9 - 0.25 * (pRwkv - pFsrs), 0.78, 0.95)
  }

  private featureContext(
    item: VocabularyItem,
    kind: ExerciseKind,
    card: CardProgress,
    now: number,
    sessionIndex: number,
    sessionTotal: number,
    fromQueue: boolean,
  ): FeatureContext {
    const elapsedDays = card.lastReview ? Math.max(0, (now - card.lastReview) / DAY) : 0
    const theme = this.state.themeStats[item.unit]
    const pos = this.state.posStats[item.pos]
    return {
      kind,
      now,
      sessionId: card.lastSessionId ?? '',
      sessionIndex,
      sessionTotal,
      card: card.reps > 0 ? card : null,
      elapsedDays,
      fsrsRetrievability: this.fsrs.retrievability(this.asCard(card), now),
      fsrsStability: card.stability ?? 0,
      fsrsDifficulty: card.difficulty ?? 5,
      itemBias: card.itemBias,
      sessionAccuracy: this.sessionAccuracy(sessionIndex),
      latencyRatio: this.latencyRatio(card.lastMs),
      reviewsToday: this.reviewsToday(now),
      streakDays: this.state.streak,
      themeAccuracy: theme && theme.n > 0 ? theme.correct / theme.n : 0.5,
      posAccuracy: pos && pos.n > 0 ? pos.correct / pos.n : 0.5,
      fromQueue,
      exampleWords: item.ex ? item.ex.split(/\s+/).length : 0,
    }
  }

  private sessionAccuracy(sessionIndex: number): number {
    if (!this.state.events.length || sessionIndex === 0) return 0.5
    const recent = this.state.events.slice(-20)
    return recent.filter((e) => e.correct).length / recent.length
  }

  private latencyRatio(lastMs: number | null): number {
    if (lastMs == null || !this.state.medianMs) return 1
    return clamp(lastMs / this.state.medianMs, 0, 4)
  }

  private reviewsToday(now: number): number {
    const key = dayKey(now)
    return this.state.daily[key]?.reviews ?? 0
  }

  // ---------------------------------------------------------------- //
  // sıradaki en iyi şey: kişiselleştirilmiş kuyruk
  // ---------------------------------------------------------------- //

  plan(request: PlanRequest = {}): PlanItem[] {
    const now = request.now ?? Date.now()
    const limit = request.limit ?? 12
    const pool =
      request.scope === 'unit' && request.unitId
        ? this.items.filter((i) => i.unit === request.unitId)
        : this.items
    const dtDays = Math.max(0, (now - (this.state.lastEventAt || now)) / DAY)

    const due: PlanItem[] = []
    const fresh: PlanItem[] = []
    const early: PlanItem[] = []

    // Sıralı müfredat: yalnızca sıradaki (görülmemiş en erken) bölümden yeni
    // kelime sunulur. Kullanıcı bir bölümü elle seçtiyse (scope: 'unit') kapı yok.
    const gating =
      this.state.settings.curriculum && request.scope !== 'unit' && Object.keys(this.sectionOrder).length > 0
    let gate = Number.MAX_SAFE_INTEGER
    if (gating) {
      for (const item of pool) {
        if ((this.state.cards[item.id]?.reps ?? 0) === 0) {
          const o = this.orderOf(item.unit)
          if (o < gate) gate = o
        }
      }
    }

    for (const item of pool) {
      const card = this.state.cards[item.id]
      const reps = card?.reps ?? 0

      if (!card || reps === 0) {
        if (gating && this.orderOf(item.unit) > gate) continue
        const order = this.orderOf(item.unit)
        const prior = gating ? 1 - clamp01((order - 1) / this.sectionTotal) : 0.5
        const pFsrs = 0.5
        const pRwkv = this.probe(item, 'tr_to_de_choice', emptyCardProgress(item.id, now), now, dtDays)
        const core = 1 - clamp01((item.freq ?? 200) / 400)
        // Görülmemiş öğede kişisel sinyal yoktur; bu yüzden seçim modele değil
        // müfredata ve A1 sıklık sırasına dayanır (ilk ders = en temel kelimeler).
        fresh.push({
          item,
          kind: 'tr_to_de_choice',
          fromQueue: false,
          isNew: true,
          dueAt: now,
          overdueDays: 0,
          pFsrs,
          pRwkv,
          pFinal: this.blend(pRwkv, pFsrs),
          targetRetention: 0.9,
          score: 0.5 * core + 0.1 * (item.article ? 1 : 0) + 0.35 * prior,
        })
        continue
      }

      const overdueDays = (now - card.due) / DAY
      const pFsrs = this.fsrs.retrievability(this.asCard(card), now)
      const kind = this.chooseKind(item, card)
      const pRwkv = this.probe(item, kind, card, now, dtDays)
      const pFinal = this.blend(pRwkv, pFsrs)
      const targetR = this.targetRetention(pRwkv, pFsrs)
      const risk = Math.max(0, targetR - pFinal)
      const core = 0.6 + 0.4 * (1 - clamp01((item.freq ?? 200) / 400))
      const lateness = clamp01(Math.log1p(Math.max(0, overdueDays)) / 3)
      const score = risk * core * (1 + 0.6 * lateness) + 0.12 * (1 - pFinal)

      const entry: PlanItem = {
        item,
        kind,
        fromQueue: true,
        isNew: false,
        dueAt: card.due,
        overdueDays,
        pFsrs,
        pRwkv,
        pFinal,
        targetRetention: targetR,
        score,
      }
      if (overdueDays >= 0) due.push(entry)
      else early.push(entry)
    }

    due.sort((a, b) => b.score - a.score)
    fresh.sort((a, b) => b.score - a.score)
    early.sort((a, b) => b.score - a.score)

    const newQuota = request.scope === 'due' ? 0 : this.state.settings.newPerSession
    const picked = interleave([...due], [...fresh.slice(0, newQuota)], 5, 2)
    const fill = [...early]
    while (picked.length < limit && fill.length) {
      const next = fill.shift()
      if (next) picked.push(next)
    }
    if (request.scope === 'due') return due.slice(0, limit)
    return picked.slice(0, limit)
  }

  private probe(item: VocabularyItem, kind: ExerciseKind, card: CardProgress, now: number, dtDays: number): number {
    const ctx = this.featureContext(item, kind, card, now, 0, 1, true)
    const features = encodeFeatures(item, ctx)
    const p = this.rwkv.probe(features, dtDays)
    return clamp01(1 / (1 + Math.exp(-(logit(p) + card.itemBias))))
  }

  /** Öğe ve geçmişine göre egzersiz tipini otomatik seçer. */
  chooseKind(item: VocabularyItem, card: CardProgress): ExerciseKind {
    const reps = card.reps
    const stability = card.stability ?? 0
    const listen = this.state.settings.listenEnabled
    if (reps === 0) return 'tr_to_de_choice'
    if (card.lastCorrect === false || card.missStreak > 0) {
      return item.article && card.missStreak >= 2 ? 'article' : 'tr_to_de_choice'
    }
    if (item.article && reps % 3 === 2) return 'article'
    if (reps >= 2 && reps % 5 === 4 && item.ex) return 'sentence_build'
    if (listen && stability >= 4 && reps % 4 === 3) return 'listen_type'
    if (listen && reps >= 2 && reps % 3 === 0) return 'listen_choice'
    if (reps >= 3 && stability < 4) return 'tr_to_de_type'
    if (reps === 1) return 'de_to_tr_choice'
    return 'tr_to_de_type'
  }

  // ---------------------------------------------------------------- //
  // cevabı değerlendir + arka planda her şeyi güncelle
  // ---------------------------------------------------------------- //

  evaluate(item: VocabularyItem, kind: ExerciseKind, given: string | null): EvaluateResult {
    if (given == null) return { correct: false, exact: false, similarity: 0, correctAnswer: item.de }
    if (kind === 'article') {
      const want = item.article ?? 'der'
      const got = given.trim().toLowerCase()
      return {
        correct: got === want,
        exact: got === want,
        similarity: got === want ? 1 : 0,
        correctAnswer: want,
      }
    }
    if (kind === 'de_to_tr_choice') {
      const g = gradeTyped(given, [item.tr])
      return { correct: g.correct, exact: g.exact, similarity: g.similarity, correctAnswer: item.tr }
    }
    if (kind === 'sentence_build') {
      const target = item.ex ?? item.de
      const g = gradeTyped(given, acceptedForms(target))
      return { correct: g.correct, exact: g.exact, similarity: g.similarity, correctAnswer: target }
    }
    const g = gradeTyped(given, acceptedForms(item.de))
    return { correct: g.correct, exact: g.exact, similarity: g.similarity, correctAnswer: item.de }
  }

  /**
   * Otomatik derecelendirme: doğruluk + cevap süresi + modelin beklentisi.
   * Kullanıcıya "bu ne kadardı?" diye sormayız.
   */
  inferRating(
    correct: boolean,
    exact: boolean,
    ms: number,
    pFinal: number,
    card: CardProgress,
  ): Rating {
    if (!correct) return Rating.Again
    if (card.reps === 0) return Rating.Good
    const median = this.state.medianMs || ms || 4000
    const fast = ms < median * 0.55
    const slow = ms > median * 1.45
    if (!exact) return Rating.Hard
    if (fast && (card.reps >= 2 || pFinal < 0.8)) return Rating.Easy
    if (slow || (card.missStreak > 0 && card.reps < 3)) return Rating.Hard
    return Rating.Good
  }

  grade(args: {
    item: VocabularyItem
    kind: ExerciseKind
    given: string | null
    ms: number
    sessionId: string
    sessionIndex: number
    sessionTotal: number
    fromQueue: boolean
    manualRating?: Rating
    now?: number
  }): GradeResult {
    const now = args.now ?? Date.now()
    const { item, kind } = args
    const ev = this.evaluate(item, kind, args.given)
    const card = this.progress(item.id, now)

    // 1) cevaptan önceki tahminler
    const pFsrs = card.reps > 0 && card.lastReview != null ? this.fsrs.retrievability(this.asCard(card), now) : 0.5
    const dtDays = Math.max(0, (now - (this.state.lastEventAt || now)) / DAY)
    const features = encodeFeatures(
      item,
      this.featureContext(item, kind, card, now, args.sessionIndex, args.sessionTotal, args.fromQueue),
    )
    const step = this.rwkv.step(features, dtDays)
    const zR = step.logit + card.itemBias
    const pRwkv = clamp01(1 / (1 + Math.exp(-zR)))
    const pFinal = this.blend(pRwkv, pFsrs)
    this.lastHorizons = step.horizons

    // 2) otomatik derecelendirme
    const rating =
      args.manualRating ?? (this.state.settings.autoRating ? this.inferRating(ev.correct, ev.exact, args.ms, pFinal, card) : Rating.Good)
    const outcome: 0 | 1 = ev.correct ? 1 : 0

    // 3) RWKV-Instant: tek adımda kişisel öğrenme
    this.rwkv.learn(outcome, pRwkv)
    card.itemBias = clamp(card.itemBias + 0.25 * (outcome - pRwkv), -3, 3)

    // 4) birleşim ağırlıkları (çevrimiçi lojistik regresyon)
    const [a, b, c] = this.state.mixture
    const err = outcome - pFinal
    const lr = 0.08
    this.state.mixture = [
      clamp(a + lr * err * logit(pRwkv), 0, 1.6),
      clamp(b + lr * err * logit(pFsrs), 0, 1.6),
      clamp(c + lr * err, -1.5, 1.5),
    ]

    // 5) FSRS-7: bellek durumunu güncelle, hedefi kişiselleştir
    const targetR = this.targetRetention(pRwkv, pFsrs)
    let next = this.fsrs.review(this.asCard(card), rating, now)
    if (next.state === CardState.Review && next.stability != null && rating !== Rating.Again) {
      const days = this.fsrs.intervalForRetention(next.stability, targetR)
      next = { ...next, due: now + clamp(days * DAY, DAY, 36_500 * DAY) }
    }

    // 6) kullanıcıya özel sayaçlar
    const sameSession = card.lastSessionId === args.sessionId
    const p: CardProgress = {
      ...card,
      ...next,
      cardId: item.id,
      reps: card.reps + 1,
      lapses: card.lapses + (ev.correct ? 0 : 1),
      sessions: card.sessions + (sameSession ? 0 : 1),
      missStreak: ev.correct ? 0 : card.missStreak + 1,
      seenAt: now,
      lastKind: kind,
      lastCorrect: ev.correct,
      lastMs: args.ms,
      lastRating: rating,
      lastSessionId: args.sessionId,
      itemBias: card.itemBias,
      learned: (next.stability ?? 0) >= 21,
    }
    this.state.cards[item.id] = p

    // tema / tür doğruluğu
    bump(this.state.themeStats, item.unit, ev.correct)
    bump(this.state.posStats, item.pos, ev.correct)
    if (ev.correct) {
      const m = this.state.medianMs || args.ms
      this.state.medianMs = m + (args.ms - m) * 0.15
    }

    // 7) istatistik + XP
    const xp = ev.correct ? (args.fromQueue ? 8 : 10) + (kind === 'listen_type' || kind === 'tr_to_de_type' ? 4 : 0) : 2
    this.state.xp += xp
    this.state.totals.reviews += 1
    this.state.totals.correct += outcome
    const key = dayKey(now)
    const day = (this.state.daily[key] ??= { date: key, reviews: 0, correct: 0, xp: 0, ms: 0 })
    day.reviews += 1
    day.correct += outcome
    day.xp += xp
    day.ms += args.ms
    this.state.lastEventAt = now

    const event = {
      itemId: item.id,
      sessionId: args.sessionId,
      at: now,
      correct: ev.correct,
      ms: args.ms,
      kind,
      rating,
      pFsrs,
      pRwkv,
      pFinal,
      targetRetention: targetR,
    }
    this.state.events.push(event)
    if (this.state.events.length > 4000) this.state.events.splice(0, this.state.events.length - 4000)

    return {
      itemId: item.id,
      kind,
      correct: ev.correct,
      exact: ev.exact,
      correctAnswer: ev.correctAnswer,
      rating,
      pFsrs,
      pRwkv,
      pFinal,
      stability: next.stability ?? 0,
      difficulty: next.difficulty ?? 5,
      targetRetention: targetR,
      intervalMs: Math.max(0, next.due - now),
      dueAt: next.due,
      xp,
      horizons: step.horizons,
      contributions: featureContributions(features, step.hidden, this.rwkv.readout, 4),
    }
  }

  // ---------------------------------------------------------------- //
  // gözlemlenebilirlik: motor gerçekten öğreniyor mu?
  // ---------------------------------------------------------------- //

  accuracyModelReport(): AccuracyModelReport {
    const events = this.state.events
    const toPairs = (rows: typeof events, pick: (e: (typeof events)[number]) => number): PredictionPair[] =>
      rows.map((e) => ({ p: pick(e), y: (e.correct ? 1 : 0) as 0 | 1 }))
    const last = events.slice(-200)
    const models = (rows: typeof events) => ({
      fsrs: summarize(toPairs(rows, (e) => e.pFsrs)),
      rwkv: summarize(toPairs(rows, (e) => e.pRwkv)),
      blend: summarize(toPairs(rows, (e) => e.pFinal)),
    })
    return { all: models(events), recent: models(last) }
  }

  personalizationReport(): PersonalizationReport {
    const horizons = (this.lastHorizons.length ? this.lastHorizons : new Array(8).fill(0)).map((v, i) => ({
      label: HORIZON_LABELS[i] ?? `${i}`,
      value: v,
    }))
    const biases = Object.entries(this.state.cards)
      .filter(([, c]) => Math.abs(c.itemBias) > 0.05)
      .sort((a, b) => Math.abs(b[1].itemBias) - Math.abs(a[1].itemBias))
      .slice(0, 6)
      .map(([id, c]) => ({
        item: this.byId.get(id)?.de ?? id,
        tr: this.byId.get(id)?.tr ?? '',
        bias: c.itemBias,
      }))
    const themes = Object.entries(this.state.themeStats)
      .filter(([, s]) => s.n >= 4)
      .map(([unit, s]) => ({ unit, accuracy: s.correct / s.n, n: s.n }))
      .sort((a, b) => a.accuracy - b.accuracy)
    return {
      horizons,
      mixture: this.state.mixture,
      modelSteps: this.rwkv.steps,
      stateSize: this.rwkv.stateSize(),
      paramCount: this.rwkv.paramCount(),
      lateHorizonNote: 'Kafalar saatlerden aylara uzanan unutma ufuklarını öğrenir.',
      biases,
      weakestThemes: themes.slice(0, 3),
      strongestThemes: themes.slice(-3).reverse(),
      fsrsTuned: this.state.fsrsParameters != null,
      fsrsTuningNll: this.state.fsrsTuningNll,
      fsrsTunedAt: this.state.fsrsTunedAt,
    }
  }

  /** Öğrenme istatistikleri (kart dağılımı). */
  cardStats(now = Date.now()): CardStats {
    let fresh = 0
    let learning = 0
    let young = 0
    let mature = 0
    let dueNow = 0
    for (const item of this.items) {
      const card = this.state.cards[item.id]
      if (!card || card.reps === 0) {
        fresh += 1
        continue
      }
      const s = card.stability ?? 0
      if (s < 1) learning += 1
      else if (s < 21) young += 1
      else mature += 1
      if (card.due <= now) dueNow += 1
    }
    return { fresh, learning, young, mature, dueNow, total: this.items.length }
  }

  serialize(): RWKVStateSnapshot {
    return this.rwkv.snapshotState()
  }

  /** Oturum sonunda/uygulama kapanırken durumu kaydeder. */
  persistIntoState(): void {
    this.state.rwkv = this.rwkv.snapshotState()
  }
}

// ------------------------------------------------------------------ //
// küçük yardımcılar
// ------------------------------------------------------------------ //

function bump(map: Record<string, { n: number; correct: number }>, key: string, correct: boolean): void {
  const entry = (map[key] ??= { n: 0, correct: 0 })
  entry.n += 1
  if (correct) entry.correct += 1
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Vadesi gelenlerle yenileri karıştırır (kademeli öğrenme için). */
function interleave(due: PlanItem[], fresh: PlanItem[], duePerBlock: number, newPerBlock: number): PlanItem[] {
  const out: PlanItem[] = []
  while (due.length || fresh.length) {
    for (let i = 0; i < duePerBlock && due.length; i++) out.push(due.shift()!)
    for (let i = 0; i < newPerBlock && fresh.length; i++) out.push(fresh.shift()!)
  }
  return out
}

export { FEATURE_DIM, HOUR }
