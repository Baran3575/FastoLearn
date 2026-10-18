/**
 * Uygulama deposu: kullanıcılar, motor önbelleği, kalıcılık (localStorage) ve
 * arka plan kişiselleştirmenin bağlanması.
 *
 * Motor (RWKV-Instant + FSRS-7) kullanıcı başına bir kez kurulur; her cevaptan
 * sonra durum diske yazılır ve ayarlayıcı (Personalizer) gerektiğinde FSRS-7
 * parametrelerini arka planda kullanıcıya uyarlar.
 */

import { useSyncExternalStore } from 'react'
import { LearningEngine, dayKey } from '../engine/engine'
import { Personalizer, type TuneOutcome } from '../engine/personalizer'
import type { ReviewRecord } from '../engine/fsrs7'
import { ITEMS, SECTION_ORDER } from '../content'
import type { SessionRecord, UserState } from '../engine/types'
import { createUserState, migrate, newUserId, SCHEMA_VERSION } from './user'

const STORAGE_KEY = 'fastolearn.v1'

interface Persisted {
  schema: number
  activeUserId: string
  users: Record<string, UserState>
}

function seedReviews(state: UserState): ReviewRecord[] {
  return state.events.map((e) => ({ cardId: e.itemId, review: e.at, rating: e.rating }))
}

function emptyData(): Persisted {
  const id = newUserId()
  return {
    schema: SCHEMA_VERSION,
    activeUserId: id,
    users: { [id]: createUserState(id, 'Öğrenci') },
  }
}

function read(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Persisted
    const users: Record<string, UserState> = {}
    for (const [id, value] of Object.entries(parsed.users ?? {})) {
      users[id] = migrate({ ...value, id })
    }
    const activeUserId = users[parsed.activeUserId] ? parsed.activeUserId : Object.keys(users)[0]
    if (!activeUserId) return emptyData()
    return { schema: SCHEMA_VERSION, activeUserId, users }
  } catch {
    return emptyData()
  }
}

export class AppStore {
  private data: Persisted
  private version = 0
  private listeners = new Set<() => void>()
  private engines = new Map<string, LearningEngine>()
  private personalizer = new Personalizer()
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private lastTune: TuneOutcome | null = null

  constructor() {
    this.data = read()
    this.personalizer.onTuned((outcome) => {
      this.lastTune = outcome
      this.engine().setFsrsParameters(outcome.parameters, outcome.tunedNll)
      this.save()
      this.emit()
    })
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.saveNow())
    }
  }

  // -- React bağlantısı --------------------------------------------------- //

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): number => this.version

  private emit(): void {
    this.version += 1
    for (const l of this.listeners) l()
  }

  // -- okuma -------------------------------------------------------------- //

  users(): UserState[] {
    return Object.values(this.data.users).sort((a, b) => a.createdAt - b.createdAt)
  }

  activeUser(): UserState {
    return this.data.users[this.data.activeUserId]
  }

  engine(): LearningEngine {
    const user = this.activeUser()
    let engine = this.engines.get(user.id)
    if (!engine) {
      engine = new LearningEngine(ITEMS, user)
      engine.setSectionOrder(SECTION_ORDER)
      this.engines.set(user.id, engine)
    }
    return engine
  }

  /** Uzun süren arka plan işlerinin sonucu (UI'da gösterilir). */
  tuningInfo(): TuneOutcome | null {
    return this.lastTune
  }

  todayStats() {
    const user = this.activeUser()
    const key = dayKey(Date.now())
    const day = user.daily[key] ?? { date: key, reviews: 0, correct: 0, xp: 0, ms: 0 }
    return { ...day, goal: user.dailyGoal, done: day.reviews >= user.dailyGoal }
  }

  // -- eyleme geçen ------------------------------------------------------- //

  setActiveUser(id: string): void {
    if (!this.data.users[id]) return
    this.saveNow()
    this.data.activeUserId = id
    this.persistActiveEngine()
    this.save()
    this.emit()
  }

  addUser(name: string): string {
    const id = newUserId()
    this.data.users[id] = createUserState(id, name.trim() || 'Öğrenci')
    this.data.activeUserId = id
    this.engines.delete(id)
    this.save()
    this.emit()
    return id
  }

  renameUser(id: string, name: string): void {
    const user = this.data.users[id]
    if (!user) return
    user.name = name.trim() || user.name
    this.save()
    this.emit()
  }

  deleteUser(id: string): void {
    if (Object.keys(this.data.users).length <= 1) return
    delete this.data.users[id]
    this.engines.delete(id)
    if (this.data.activeUserId === id) this.data.activeUserId = Object.keys(this.data.users)[0]
    this.saveNow()
    this.emit()
  }

  updateSettings(partial: Partial<UserState['settings']>): void {
    Object.assign(this.activeUser().settings, partial)
    this.save()
    this.emit()
  }

  setDailyGoal(goal: number): void {
    this.activeUser().dailyGoal = Math.max(10, Math.min(200, Math.round(goal)))
    this.save()
    this.emit()
  }

  resetProgress(): void {
    const user = this.activeUser()
    const fresh = createUserState(user.id, user.name, user.createdAt)
    fresh.dailyGoal = user.dailyGoal
    fresh.settings = { ...user.settings }
    this.data.users[user.id] = fresh
    this.engines.delete(user.id)
    this.saveNow()
    this.emit()
  }

  /**
   * Her cevaptan sonra çağrılır: seri (streak), kalıcılık ve arka plan
   * kişiselleştirme tetiklenir.
   */
  afterReview(): void {
    const user = this.activeUser()
    this.updateStreak(user)
    this.engine().persistIntoState()
    this.personalizer.maybeTune(seedReviews(user))
    this.save()
    this.emit()
  }

  recordSession(record: Omit<SessionRecord, 'id'>): void {
    const user = this.activeUser()
    user.history.push({ ...record, id: `s_${record.startedAt.toString(36)}` })
    if (user.history.length > 200) user.history.splice(0, user.history.length - 200)
    this.save()
    this.emit()
  }

  private updateStreak(user: UserState): void {
    const today = dayKey(Date.now())
    if (user.lastStudyDay === today) return
    const yesterday = dayKey(Date.now() - 86_400_000)
    user.streak = user.lastStudyDay === yesterday ? user.streak + 1 : 1
    user.lastStudyDay = today
    user.bestStreak = Math.max(user.bestStreak, user.streak)
  }

  /** Yeni kullanıcıya başlangıç verisi (demo amaçlı değil; boş başlar). */
  private persistActiveEngine(): void {
    const engine = this.engines.get(this.data.activeUserId)
    engine?.persistIntoState()
  }

  // -- kalıcılık ---------------------------------------------------------- //

  save(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.saveNow()
    }, 400)
  }

  saveNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data))
    } catch {
      /* kota dolu ya da localStorage kapalı — bellekte çalışmaya devam */
    }
  }

  /** Diskteki veriyi (başka sekmede değişmiş olabilir) yeniden okur. */
  reload(): void {
    this.engines.clear()
    this.data = read()
    this.emit()
  }

  /** Tüm kullanıcıları (motor durumu dâhil) JSON olarak dışa aktarır. */
  exportData(): string {
    for (const [id, engine] of this.engines) {
      const user = this.data.users[id]
      if (user) engine.persistIntoState()
    }
    return JSON.stringify({ ...this.data, exportedAt: Date.now(), app: 'FastoLearn' }, null, 2)
  }

  /** Dışa aktarılmış bir yedeği geri yükler. Başarılıysa true döner. */
  importData(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as Partial<Persisted>
      if (!parsed.users || typeof parsed.users !== 'object') return false
      const users: Record<string, UserState> = {}
      for (const [id, value] of Object.entries(parsed.users)) {
        if (!value || typeof value !== 'object') continue
        users[id] = migrate({ ...(value as UserState), id })
      }
      const ids = Object.keys(users)
      if (!ids.length) return false
      const activeUserId = parsed.activeUserId && users[parsed.activeUserId] ? parsed.activeUserId : ids[0]
      this.saveNow()
      this.engines.clear()
      this.data = { schema: SCHEMA_VERSION, activeUserId, users }
      this.saveNow()
      this.emit()
      return true
    } catch {
      return false
    }
  }

  statsOverall() {
    const user = this.activeUser()
    return {
      xp: user.xp,
      streak: user.streak,
      bestStreak: user.bestStreak,
      reviews: user.totals.reviews,
      correct: user.totals.correct,
      accuracy: user.totals.reviews ? user.totals.correct / user.totals.reviews : 0,
    }
  }
}

export const store = new AppStore()

/** Bileşenlerde kullanılan kanca: sürüm değişince yeniden çizer. */
export function useStore(): AppStore {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return store
}
