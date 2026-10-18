/**
 * Kullanıcı durumu üretimi (DOM'dan bağımsız — testlerde de kullanılır).
 */

import { DEFAULT_SETTINGS, type UserState } from '../engine/types'

export const SCHEMA_VERSION = 1

export function createUserState(id: string, name: string, now = Date.now()): UserState {
  return {
    version: SCHEMA_VERSION,
    id,
    name,
    createdAt: now,
    xp: 0,
    streak: 0,
    bestStreak: 0,
    lastStudyDay: null,
    dailyGoal: 40,
    fsrsParameters: null,
    fsrsTunedAt: null,
    fsrsTuningNll: null,
    rwkv: null,
    // FSRS-7 kalibre olduğu için başlangıçta ağırlık onda; RWKV-Instant
    // kanıt topladıkça çevrimiçi olarak ağırlık kazanır.
    mixture: [0.25, 0.85, 0],
    cards: {},
    events: [],
    history: [],
    daily: {},
    themeStats: {},
    posStats: {},
    medianMs: 0,
    lastEventAt: 0,
    totals: { reviews: 0, correct: 0 },
    settings: { ...DEFAULT_SETTINGS },
  }
}

/** Eksik alanları tamamlayarak eski kayıtları günceller. */
export function migrate(raw: Partial<UserState> & { id: string; name?: string }): UserState {
  const base = createUserState(raw.id, raw.name ?? 'Öğrenci')
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    mixture: raw.mixture ?? base.mixture,
    cards: raw.cards ?? {},
    events: raw.events ?? [],
    history: raw.history ?? [],
    daily: raw.daily ?? {},
    themeStats: raw.themeStats ?? {},
    posStats: raw.posStats ?? {},
    totals: raw.totals ?? { reviews: 0, correct: 0 },
    version: SCHEMA_VERSION,
  }
}

/** Basit yerel kimlik üretimi. */
export function newUserId(): string {
  return `u_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}
