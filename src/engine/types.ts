import type { Card, Rating } from './fsrs7'

export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'pron' | 'num' | 'phrase' | 'other'

export type Article = 'der' | 'die' | 'das'

export type Gender = 'm' | 'f' | 'n'

/** Tek bir öğrenme öğesi (kelime / kalıp). */
export interface VocabularyItem {
  id: string
  /** Almanca (isimlerde artikel ile birlikte: "der Apfel") */
  de: string
  /** Türkçe karşılık */
  tr: string
  pos: PartOfSpeech
  /** İsimlerde artikel (özel isimlerde bulunmaz) */
  article?: Article
  /** İsimlerde çoğul hâli */
  plural?: string
  /** Özel isim / dil adı: artikel almaz (Deutschland, Deutsch) */
  proper?: boolean
  /** Yalnızca çoğul kullanılan isim (die Eltern) */
  pluralOnly?: boolean
  /** Ünite kimliği (src/content/units.ts) */
  unit: string
  /** Almanca örnek cümle */
  ex?: string
  /** Örnek cümlenin Türkçesi */
  exTr?: string
  /** A1 çekirdek sıklık sırası (küçük = daha temel) */
  freq?: number
  /** Ek not (dilbilgisi ipucu) */
  note?: string
}

export type ExerciseKind =
  | 'tr_to_de_choice'
  | 'tr_to_de_type'
  | 'de_to_tr_choice'
  | 'article'
  | 'listen_choice'
  | 'listen_type'
  | 'sentence_build'

export const EXERCISE_LABELS: Record<ExerciseKind, string> = {
  tr_to_de_choice: 'Çoktan seçmeli',
  tr_to_de_type: 'Yazarak',
  de_to_tr_choice: 'Anlam eşleştirme',
  article: 'Artikel',
  listen_choice: 'Dinleme',
  listen_type: 'Dikte',
  sentence_build: 'Cümle kur',
}

export const KIND_SLOTS: ExerciseKind[] = [
  'tr_to_de_choice',
  'tr_to_de_type',
  'de_to_tr_choice',
  'article',
  'listen_choice',
  'listen_type',
  'sentence_build',
]

/** FSRS-7 kartına eklenen kullanıcıya özel alanlar. */
export interface CardProgress extends Card {
  reps: number
  lapses: number
  /** Kaç ayrı oturumda görüldü */
  sessions: number
  /** Üst üste yanlış sayısı */
  missStreak: number
  seenAt: number
  lastKind: ExerciseKind | null
  lastCorrect: boolean | null
  lastMs: number | null
  /** Sistemin otomatik çıkardığı son derece (Again/Hard/Good/Easy) */
  lastRating: Rating | null
  /** En son görüldüğü oturum (oturum çeşitliliği için) */
  lastSessionId: string | null
  /** Öğeye özel, çevrimiçi öğrenilen yanlılık (RWKV-Instant tamamlayıcısı) */
  itemBias: number
  learned: boolean
}

export interface ReviewEvent {
  itemId: string
  sessionId: string
  at: number
  correct: boolean
  ms: number
  kind: ExerciseKind
  rating: Rating
  /** o anki tahminler */
  pFsrs: number
  pRwkv: number
  pFinal: number
  /** o anki kişisel hedef hatırlanma oranı */
  targetRetention: number
}

export interface DailyStat {
  date: string
  reviews: number
  correct: number
  xp: number
  ms: number
}

export interface SessionRecord {
  id: string
  startedAt: number
  endedAt: number
  reviews: number
  correct: number
  xp: number
  newItems: number
  kind: 'lesson' | 'review' | 'mixed'
}

export interface UserState {
  version: number
  id: string
  name: string
  createdAt: number
  xp: number
  streak: number
  bestStreak: number
  lastStudyDay: string | null
  dailyGoal: number
  /** FSRS-7 parametreleri (kişiselleştirilmiş olabilir) */
  fsrsParameters: number[] | null
  fsrsTunedAt: number | null
  fsrsTuningNll: number | null
  /** RWKV-Instant durumu + okuma katmanı */
  rwkv: import('./rwkv').RWKVStateSnapshot | null
  /** Birleşim ağırlıkları (α, β, γ) — çevrimiçi öğrenilir */
  mixture: [number, number, number]
  cards: Record<string, CardProgress>
  events: ReviewEvent[]
  history: SessionRecord[]
  daily: Record<string, DailyStat>
  /** Tema başına doğruluk sayaçları (kişiselleştirme özelliği) */
  themeStats: Record<string, { n: number; correct: number }>
  /** Sözcük türü başına doğruluk sayaçları */
  posStats: Record<string, { n: number; correct: number }>
  /** Kullanıcının kişisel medyan cevap süresi (ms) */
  medianMs: number
  /** Son olayın zamanı — RWKV-Instant gerçek zamanlı Δt için */
  lastEventAt: number
  totals: { reviews: number; correct: number }
  settings: {
    listenEnabled: boolean
    autoRating: boolean
    showPredictions: boolean
    newPerSession: number
    /** Sıfırdan başlayan sıralı müfredat (bölümleri sırayla açar) */
    curriculum: boolean
    /** Doğru/yanlış geri bildirim sesleri */
    soundEnabled: boolean
  }
}

export const DEFAULT_SETTINGS: UserState['settings'] = {
  listenEnabled: true,
  autoRating: true,
  showPredictions: true,
  newPerSession: 6,
  curriculum: true,
  soundEnabled: true,
}

export const emptyCardProgress = (cardId: string, now: number): CardProgress => ({
  cardId,
  state: 1,
  step: null,
  stability: null,
  difficulty: null,
  due: 0,
  lastReview: null,
  reps: 0,
  lapses: 0,
  sessions: 0,
  missStreak: 0,
  seenAt: now,
  lastKind: null,
  lastCorrect: null,
  lastMs: null,
  lastRating: null,
  lastSessionId: null,
  itemBias: 0,
  learned: false,
})

export type { Card, Rating }
