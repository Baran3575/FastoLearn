/**
 * RWKV-Instant girdi kodlayıcı.
 *
 * Her cevap olayı 64 boyutlu bir vektöre dönüştürülür. Vektör; egzersiz tipi,
 * kartın bellek durumu (FSRS-7), geçen süre, cevap süresi, oturum bağlamı,
 * öğenin dilbilgisel kimliği ve kullanıcının o temaya/türüne özel geçmiş
 * performansını birlikte taşır. Model bu diziyi tekrarlı durumda özetler.
 */

import type { VocabularyItem, CardProgress, ExerciseKind } from './types'
import { KIND_SLOTS } from './types'

export const FEATURE_SLOTS: string[] = [
  ...KIND_SLOTS.map((k) => `egzersiz:${k}`),
  'ilk kez görüyor',
  'bugün ilk kez',
  'önceki:Again',
  'önceki:Hard',
  'önceki:Good',
  'önceki:Easy',
  'önceki:yok',
  'log(geçen gün)',
  'aynı oturum',
  'FSRS hatırlanabilirlik',
  'log(stabilite)',
  'FSRS zorluk',
  'log(tekrar)',
  'log(unutma)',
  'son cevap doğru',
  'oturum doğruluğu',
  'cevap süresi',
  'süre/kişisel medyan',
  'oturum ilerlemesi',
  'bugünkü tekrar',
  'saat sin',
  'saat cos',
  ...Array.from({ length: 8 }, (_, i) => `ünite kovası ${i + 1}`),
  'kelime uzunluğu',
  'artikelli mi',
  'cinsiyet:m',
  'cinsiyet:f',
  'cinsiyet:n',
  'düzensiz çoğul',
  'fiil',
  'sıfat',
  'isim',
  'işlev kelimesi',
  'sıklık yüzdelik',
  'tema doğruluğu',
  'tür doğruluğu',
  'öğe yanlılığı',
  'seri (streak)',
  'oturum arası saat',
  'hatadan sonra tekrar',
  'son sefer kolay',
  'log(FSRS aralığı)',
  'oturum çeşitliliği',
  'üst üste hata',
  'örnek cümle uzunluğu',
  'yedek',
  'inceleme kuyruğu',
  'kritik hatırlanabilirlik',
  'saat ritmi (6 sa)',
  'sabit 1',
]

export const FEATURE_DIM = FEATURE_SLOTS.length

export interface FeatureContext {
  kind: ExerciseKind
  now: number
  sessionId: string
  sessionIndex: number
  sessionTotal: number
  /** Önceki kart durumu (yoksa null) */
  card: CardProgress | null
  /** Son olaydan bu yana geçen gün */
  elapsedDays: number
  fsrsRetrievability: number
  fsrsStability: number
  fsrsDifficulty: number
  /** Kişiselleştirilmiş öğe yanlılığı */
  itemBias: number
  sessionAccuracy: number
  /** Bu oturumdaki cevap sürelerinin medyanına oranı (0..2) */
  latencyRatio: number
  reviewsToday: number
  streakDays: number
  /** Aynı temadaki geçmiş doğruluk (0..1) */
  themeAccuracy: number
  /** Aynı sözcük türündeki geçmiş doğruluk (0..1) */
  posAccuracy: number
  /** Kuyruktan mı geldi (yeni öğe değil) */
  fromQueue: boolean
  /** Örnek cümledeki kelime sayısı */
  exampleWords: number
}

const FUNC_POS = new Set(['prep', 'pron', 'num', 'other'])
const LOG_20K = Math.log1p(20_000)

function hashUnit(unit: string): number {
  let h = 2166136261
  for (let i = 0; i < unit.length; i++) {
    h ^= unit.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 8
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function encodeFeatures(item: VocabularyItem, ctx: FeatureContext): Float64Array {
  const x = new Float64Array(FEATURE_DIM)
  let i = 0

  // 0-5 egzersiz tipi
  const kindIdx = KIND_SLOTS.indexOf(ctx.kind)
  if (kindIdx >= 0) x[i + kindIdx] = 1
  i += KIND_SLOTS.length

  const card = ctx.card
  const isNew = !card || card.reps === 0 || card.lastReview == null
  x[i++] = isNew ? 1 : 0
  // bugün ilk kez
  const todayStart = new Date(ctx.now)
  todayStart.setHours(0, 0, 0, 0)
  x[i++] = !card || card.lastReview == null || card.lastReview < todayStart.getTime() ? 1 : 0

  // 8-11 önceki derece, 12 yok
  const prevRating = card?.lastRating ?? 0
  if (prevRating >= 1 && prevRating <= 4) x[i + (prevRating - 1)] = 1
  i += 4
  x[i++] = prevRating === 0 ? 1 : 0

  x[i++] = clamp01(Math.log1p(Math.max(0, ctx.elapsedDays)) / 3.5)
  x[i++] = ctx.elapsedDays < 1 && !isNew ? 1 : 0
  x[i++] = clamp01(ctx.fsrsRetrievability)
  x[i++] = clamp01(Math.log1p(Math.max(0, ctx.fsrsStability)) / 5)
  x[i++] = clamp01(ctx.fsrsDifficulty / 10)
  x[i++] = clamp01(Math.log1p(card?.reps ?? 0) / 4)
  x[i++] = clamp01(Math.log1p(card?.lapses ?? 0) / 4)
  x[i++] = card?.lastCorrect == null ? 0.5 : card.lastCorrect ? 1 : 0
  x[i++] = clamp01(ctx.sessionAccuracy)
  const ms = card?.lastMs ?? 0
  x[i++] = clamp01(Math.log1p(Math.max(0, ms)) / LOG_20K)
  x[i++] = clamp01(ctx.latencyRatio / 2)
  x[i++] = ctx.sessionTotal > 0 ? clamp01(ctx.sessionIndex / ctx.sessionTotal) : 0
  x[i++] = clamp01(ctx.reviewsToday / 40)
  const hour = new Date(ctx.now).getHours() + new Date(ctx.now).getMinutes() / 60
  x[i++] = Math.sin((2 * Math.PI * hour) / 24)
  x[i++] = Math.cos((2 * Math.PI * hour) / 24)

  // 28-35 ünite kovası
  x[i + hashUnit(item.unit)] = 1
  i += 8

  x[i++] = clamp01(item.de.replace(/^(der|die|das)\s+/i, '').length / 12)
  x[i++] = item.article ? 1 : 0
  const gender = item.article === 'der' ? 0 : item.article === 'die' ? 1 : item.article === 'das' ? 2 : -1
  if (gender >= 0) x[i + gender] = 1
  i += 3
  x[i++] = item.plural && !/^die .*en$/.test(item.plural) ? 1 : 0
  x[i++] = item.pos === 'verb' ? 1 : 0
  x[i++] = item.pos === 'adj' || item.pos === 'adv' ? 1 : 0
  x[i++] = item.pos === 'noun' ? 1 : 0
  x[i++] = FUNC_POS.has(item.pos) ? 1 : 0
  x[i++] = clamp01(1 - (item.freq ?? 200) / 400)
  x[i++] = clamp01(ctx.themeAccuracy)
  x[i++] = clamp01(ctx.posAccuracy)
  x[i++] = Math.max(-1, Math.min(1, ctx.itemBias / 3))
  x[i++] = clamp01(Math.log1p(ctx.streakDays) / 3)
  x[i++] = clamp01(Math.log1p(card?.seenAt ? Math.max(0, (ctx.now - card.seenAt) / 3_600_000) : 0) / 4)
  x[i++] = (card?.missStreak ?? 0) > 0 ? 1 : 0
  x[i++] = card?.lastRating === 4 ? 1 : 0
  const ivlDays = card?.lastReview ? Math.max(0, (card.due - card.lastReview) / 86_400_000) : 0
  x[i++] = clamp01(Math.log1p(ivlDays) / 5)
  x[i++] = clamp01((card?.sessions ?? 0) / 5)
  x[i++] = clamp01((card?.missStreak ?? 0) / 3)
  x[i++] = clamp01(ctx.exampleWords / 10)
  x[i++] = 0 // yedek
  x[i++] = ctx.fromQueue ? 1 : 0
  x[i++] = ctx.fsrsRetrievability > 0 && ctx.fsrsRetrievability < 0.7 ? 1 : 0
  x[i++] = Math.sin((2 * Math.PI * hour) / 6)
  x[i] = 1

  return x
}

/** Kullanıcıya gösterilecek "en etkili özellikler" (readout ⊙ hidden). */
export function featureContributions(features: Float64Array, hidden: Float64Array, readout: Float64Array, top = 5) {
  const n = Math.min(features.length, hidden.length, readout.length)
  const rows: { name: string; value: number; contribution: number }[] = []
  for (let i = 0; i < n; i++) {
    rows.push({
      name: FEATURE_SLOTS[i] ?? `özellik ${i}`,
      value: features[i],
      contribution: readout[i] * hidden[i],
    })
  }
  return rows
    .filter((r) => r.value !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, top)
}
