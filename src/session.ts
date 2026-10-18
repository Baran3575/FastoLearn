/**
 * Oturum mantığı: motorun ürettiği planı ekrana sığdırır, cevapları toplar,
 * yanlışları oturum sonunda tekrar sorar ve özeti üretir.
 *
 * Burada hiçbir pedagojik karar "elle" verilmez: hangi öğenin, hangi egzersiz
 * tipiyle, hangi hedef hatırlanma oranıyla sorulacağına LearningEngine
 * (RWKV-Instant + FSRS-7) karar verir.
 */

import { ITEM_BY_ID, pickDistractors, shuffle } from './content'
import { LearningEngine } from './engine/engine'
import { Rating } from './engine/fsrs7'
import { EXERCISE_LABELS, type ExerciseKind, type VocabularyItem } from './engine/types'

export type AnswerField = 'de' | 'tr' | 'article'

export interface ExerciseView {
  item: VocabularyItem
  kind: ExerciseKind
  label: string
  animationKey: string
  /** Büyük soru metni (boş olabilir: dinleme alıştırmaları) */
  prompt: string
  promptSub: string
  choices: string[]
  /** Blok yerleştirme (cümle kurma) için kelime karoları */
  tiles: string[]
  inputField: AnswerField
  audioText: string | null
  autoplay: boolean
  placeholder: string
  hint: string
  /** İsimlerde cinsiyet rengi için */
  article: VocabularyItem['article'] | null
}

export interface IntroCard {
  item: VocabularyItem
  index: number
  total: number
}

export interface SubmitResult {
  correct: boolean
  exact: boolean
  correctAnswer: string
  given: string | null
  rating: Rating
  pFsrs: number
  pRwkv: number
  pFinal: number
  targetRetention: number
  stability: number
  intervalMs: number
  xp: number
  contributions: { name: string; value: number; contribution: number }[]
  requeued: boolean
}

export interface SessionSummary {
  id: string
  startedAt: number
  endedAt: number
  durationMs: number
  reviews: number
  distinctItems: number
  correct: number
  accuracy: number
  firstTryCorrect: number
  xp: number
  newItems: number
  kind: 'lesson' | 'review' | 'mixed'
  unitId?: string
  avgMs: number
}

interface QueuedExercise {
  itemId: string
  kind: ExerciseKind
  fromQueue: boolean
  attempt: number
}

export interface SessionOptions {
  kind: 'mixed' | 'review' | 'lesson'
  unitId?: string
  limit?: number
  now?: number
  seed?: number
  /** Dersin başında tanıtılacak yeni kelime sayısı (0 = tanıtım yok) */
  introSize?: number
}

const MAX_ATTEMPTS = 2

/** Cümle kurmada kullanılan çeldirici kelime havuzu. */
const DECOY_TILES = ['nicht', 'sehr', 'auch', 'immer', 'und', 'aber', 'dann', 'schon', 'gern', 'noch']

export class StudySession {
  readonly id: string
  readonly startedAt: number
  readonly kind: 'lesson' | 'review' | 'mixed'
  readonly unitId?: string

  private readonly engine: LearningEngine
  private readonly rng: () => number
  private queue: QueuedExercise[] = []
  private cursor = 0
  private shownAt = 0
  private attempts = new Map<string, number>()
  private newItems = 0
  private xpEarned = 0
  private latencies: number[] = []
  private firstTry = 0
  private seen = new Set<string>()

  current: ExerciseView | null = null
  answered = 0
  correctCount = 0

  /** Dersin başındaki tanıtım kartları (Duolingo'daki "yeni kelimeler"). */
  readonly intro: VocabularyItem[] = []
  private introCursor = 0
  phase: 'intro' | 'practice' = 'practice'

  constructor(engine: LearningEngine, options: SessionOptions) {
    this.engine = engine
    this.kind = options.kind === 'review' ? 'review' : options.kind === 'lesson' ? 'lesson' : 'mixed'
    this.unitId = options.unitId
    this.startedAt = options.now ?? Date.now()
    this.id = `s_${this.startedAt.toString(36)}`
    this.rng = mulberry32(options.seed ?? (this.startedAt & 0xffff))

    const plan = engine.plan({
      scope: this.kind === 'review' ? 'due' : this.unitId ? 'unit' : 'all',
      unitId: this.unitId,
      limit: options.limit ?? 14,
      now: this.startedAt,
    })
    this.queue = plan.map((p) => ({
      itemId: p.item.id,
      kind: p.kind,
      fromQueue: p.fromQueue,
      attempt: 1,
    }))

    // Ders/tur başında yeni kelimeleri önce öğret, sonra sor.
    const introSize = options.introSize ?? 6
    if (this.kind !== 'review' && introSize > 0) {
      const fresh = plan.filter((p) => p.isNew).slice(0, introSize)
      if (fresh.length >= 2) {
        this.intro = fresh.map((p) => p.item)
        this.phase = 'intro'
      }
    }
  }

  get currentIntro(): IntroCard | null {
    const item = this.intro[this.introCursor]
    if (!item) return null
    return { item, index: this.introCursor, total: this.intro.length }
  }

  /** Tanıtım kartını ilerletir; tanıtım bittiyse false döner. */
  nextIntro(): boolean {
    this.introCursor += 1
    if (this.introCursor >= this.intro.length) {
      this.phase = 'practice'
      return false
    }
    return true
  }

  skipIntro(): void {
    this.introCursor = this.intro.length
    this.phase = 'practice'
  }

  get total(): number {
    // şu an ekranda duran alıştırma da toplama dâhildir
    return this.answered + (this.queue.length - this.cursor) + (this.current ? 1 : 0)
  }

  get progress(): number {
    const total = this.total
    return total > 0 ? this.answered / total : 0
  }

  get empty(): boolean {
    return this.queue.length === 0
  }

  /** Sıradaki alıştırmayı hazırlar ve `current` olarak ayarlar. */
  advance(now = Date.now()): ExerciseView | null {
    const next = this.queue[this.cursor]
    if (!next) {
      this.current = null
      return null
    }
    const item = ITEM_BY_ID.get(next.itemId)
    if (!item) {
      this.cursor += 1
      return this.advance(now)
    }
    if (next.attempt === 1 && !this.seen.has(item.id)) {
      this.seen.add(item.id)
      const card = this.engine.progress(item.id, now)
      if (card.reps === 0) this.newItems += 1
    }
    this.cursor += 1
    this.shownAt = now
    this.current = this.buildView(item, next)
    return this.current
  }

  /** Cevabı değerlendirir, motoru günceller, yanlışta tekrar kuyruğa alır. */
  submit(given: string | null, now = Date.now()): SubmitResult | null {
    const view = this.current
    const queued = this.queue[this.cursor - 1]
    if (!view || !queued) return null
    const ms = Math.max(120, now - this.shownAt)

    const graded = this.engine.grade({
      item: view.item,
      kind: view.kind,
      given,
      ms,
      sessionId: this.id,
      sessionIndex: this.answered,
      sessionTotal: this.total,
      fromQueue: queued.fromQueue,
      now,
    })

    this.answered += 1
    this.latencies.push(ms)
    if (graded.correct) this.correctCount += 1
    if (graded.correct && queued.attempt === 1) this.firstTry += 1
    this.xpEarned += graded.xp

    const attempt = (this.attempts.get(view.item.id) ?? 0) + 1
    this.attempts.set(view.item.id, attempt)
    let requeued = false
    if (!graded.correct && attempt < MAX_ATTEMPTS) {
      // Yanlış cevaplanan öğe oturum içinde bir kez daha, kolay bir tiple sorulur.
      this.queue.push({
        itemId: view.item.id,
        kind: view.item.article ? 'article' : 'tr_to_de_choice',
        fromQueue: false,
        attempt: attempt + 1,
      })
      requeued = true
    }

    this.current = null
    return {
      correct: graded.correct,
      exact: graded.exact,
      correctAnswer: graded.correctAnswer,
      given,
      rating: graded.rating,
      pFsrs: graded.pFsrs,
      pRwkv: graded.pRwkv,
      pFinal: graded.pFinal,
      targetRetention: graded.targetRetention,
      stability: graded.stability,
      intervalMs: graded.intervalMs,
      xp: graded.xp,
      contributions: graded.contributions,
      requeued,
    }
  }

  summary(now = Date.now()): SessionSummary {
    return {
      id: this.id,
      startedAt: this.startedAt,
      endedAt: now,
      durationMs: Math.max(0, now - this.startedAt),
      reviews: this.answered,
      distinctItems: this.seen.size,
      correct: this.correctCount,
      accuracy: this.answered ? this.correctCount / this.answered : 0,
      firstTryCorrect: this.firstTry,
      xp: this.xpEarned,
      newItems: this.newItems,
      kind: this.kind,
      unitId: this.unitId,
      avgMs: this.latencies.length ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : 0,
    }
  }

  // ------------------------------------------------------------------ //

  private buildView(item: VocabularyItem, queued: QueuedExercise): ExerciseView {
    const kind = queued.kind
    const bare = item.de.replace(/^(der|die|das)\s+/i, '')
    let choices: string[] = []
    let tiles: string[] = []
    let inputField: AnswerField = 'de'
    let prompt = ''
    let promptSub = ''
    let audioText: string | null = null
    let autoplay = false
    let placeholder = 'Almanca yaz…'
    let hint = ''

    switch (kind) {
      case 'tr_to_de_choice':
        choices = this.withDistractors(item, 'de')
        prompt = item.tr
        promptSub = 'Almancası hangisi?'
        break
      case 'de_to_tr_choice':
        choices = this.withDistractors(item, 'tr')
        inputField = 'tr'
        prompt = item.de
        promptSub = 'Türkçe karşılığı hangisi?'
        break
      case 'tr_to_de_type':
        prompt = item.tr
        promptSub = 'Almancasını yaz'
        hint = this.typeHint(item)
        break
      case 'listen_choice':
        choices = this.withDistractors(item, 'de')
        promptSub = 'Duyduğun kelimeyi seç'
        audioText = item.de
        autoplay = true
        hint = 'Dinlemek için hoparlör simgesine dokun'
        break
      case 'listen_type':
        promptSub = 'Duyduğunu yaz'
        audioText = item.de
        autoplay = true
        placeholder = 'Duyduğunu yaz…'
        hint = this.typeHint(item)
        break
      case 'sentence_build':
        tiles = this.withTiles(item)
        prompt = item.exTr ?? item.tr
        promptSub = 'Blokları yerleştirerek Almanca cümleyi kur'
        hint = `${item.ex?.split(/\s+/).length ?? 0} kelime`
        break
      case 'article': {
        choices = shuffle(['der', 'die', 'das'], this.rng)
        inputField = 'article'
        prompt = `___ ${bare}`
        promptSub = `${item.tr} — artikel hangisi?`
        hint = 'der / die / das'
        break
      }
    }

    if (item.article && (kind === 'tr_to_de_type' || kind === 'listen_type')) {
      placeholder = `${item.article} …`
    }

    return {
      item,
      kind,
      label: EXERCISE_LABELS[kind],
      animationKey: `${item.id}:${kind}:${queued.attempt}`,
      prompt,
      promptSub,
      choices,
      tiles,
      inputField,
      audioText,
      autoplay,
      placeholder,
      hint,
      article: kind === 'article' ? null : (item.article ?? null),
    }
  }

  /** Örnek cümleyi kelimelere ayırır, karıştırır ve birkaç çeldirici ekler. */
  private withTiles(item: VocabularyItem): string[] {
    const words = (item.ex ?? item.de)
      .replace(/[.!?]+$/g, '')
      .split(/\s+/)
      .filter(Boolean)
    const lower = new Set(words.map((w) => w.toLowerCase()))
    const decoys = DECOY_TILES.filter((d) => !lower.has(d))
    const picked: string[] = []
    while (picked.length < 2 && decoys.length) {
      const idx = Math.floor(this.rng() * decoys.length)
      picked.push(decoys.splice(idx, 1)[0])
    }
    return shuffle([...words, ...picked], this.rng)
  }

  private withDistractors(item: VocabularyItem, field: 'de' | 'tr'): string[] {
    const answer = field === 'de' ? item.de : item.tr
    const distractors = pickDistractors(item, 3, this.rng, field)
    return shuffle([answer, ...distractors], this.rng)
  }

  private typeHint(item: VocabularyItem): string {
    const bare = item.de.replace(/^(der|die|das)\s+/i, '')
    if (item.article) return `İpucu: ${item.article} + ${bare.length} harf`
    return `İpucu: ${item.de.length} harf`
  }
}

/** Deterministik PRNG — seçenek sırasını yeniden üretilebilir yapar. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Aralığı insan diline çevirir: "3 gün sonra". */
export function humanInterval(ms: number): string {
  const minutes = ms / 60_000
  if (minutes < 1) return 'şimdi'
  if (minutes < 60) return `${Math.round(minutes)} dakika sonra`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} saat sonra`
  const days = hours / 24
  if (days < 31) return `${Math.round(days)} gün sonra`
  const months = days / 30.4
  if (months < 12) return `${Math.round(months)} ay sonra`
  return `${(days / 365).toFixed(1)} yıl sonra`
}

export const RATING_LABELS: Record<Rating, string> = {
  [Rating.Again]: 'Tekrar',
  [Rating.Hard]: 'Zor',
  [Rating.Good]: 'İyi',
  [Rating.Easy]: 'Kolay',
}
