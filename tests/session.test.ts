/**
 * Oturum akışı: planlama → alıştırma üretimi → cevaplama → özet.
 * Bu testler UI'ın gördüğü sözleşmeyi (ExerciseView / SubmitResult) korur.
 */

import { describe, expect, it } from 'vitest'
import { ITEMS, ITEM_BY_ID } from '../src/content'
import { LearningEngine } from '../src/engine/engine'
import { Rating } from '../src/engine/fsrs7'
import type { ExerciseKind } from '../src/engine/types'
import { createUserState } from '../src/state/user'
import { StudySession, humanInterval, type ExerciseView } from '../src/session'

const T0 = 1_700_000_000_000

function makeEngine(seed = 1, newPerSession = 12) {
  const state = createUserState('u_test', 'Test', T0 - 86_400_000)
  state.settings.newPerSession = newPerSession
  const engine = new LearningEngine(ITEMS, state)
  return { engine, state, seed }
}

/** Bir alıştırmanın doğru cevabını üretir. */
function correctAnswer(view: ExerciseView): string {
  if (view.kind === 'article') return view.item.article ?? 'der'
  if (view.kind === 'de_to_tr_choice') return view.item.tr
  if (view.kind === 'sentence_build') return view.item.ex ?? view.item.de
  return view.item.de
}

function wrongAnswer(view: ExerciseView): string {
  const correct = correctAnswer(view)
  if (view.choices.length) {
    const other = view.choices.find((c) => c !== correct)
    return other ?? ''
  }
  return 'zzz'
}

describe('StudySession — doğru cevaplarla', () => {
  it('12 alıştırmalık bir turu tamamlar ve özet üretir', () => {
    const { engine } = makeEngine()
    const session = new StudySession(engine, { kind: 'mixed', limit: 12, now: T0, seed: 42 })
    expect(session.total).toBeGreaterThan(0)
    expect(session.empty).toBe(false)

    let guard = 0
    let view = session.advance(T0)
    const kinds = new Set<ExerciseKind>()
    while (view && guard < 400) {
      guard += 1
      kinds.add(view.kind)
      expect(view.item).toBeTruthy()
      expect(ITEM_BY_ID.get(view.item.id)).toBe(view.item)
      expect(view.label.length).toBeGreaterThan(0)
      expect(view.prompt || view.audioText).toBeTruthy()

      const answer = correctAnswer(view)
      if (view.choices.length) {
        expect(view.choices.length).toBeGreaterThanOrEqual(3)
        expect(new Set(view.choices).size).toBe(view.choices.length)
        expect(view.choices).toContain(answer)
      }
      if (view.audioText) expect(view.audioText).toBe(view.item.de)
      if (view.tiles.length) {
        // cümledeki her kelime karolar arasında bulunmalı
        for (const word of (view.item.ex ?? '').replace(/[.!?]+$/, '').split(/\s+/)) {
          expect(view.tiles).toContain(word)
        }
      }

      const result = session.submit(answer, T0 + guard * 4000)
      expect(result).toBeTruthy()
      expect(result!.correct).toBe(true)
      expect(result!.intervalMs).toBeGreaterThan(0)
      expect(result!.xp).toBeGreaterThan(0)
      view = session.advance(T0 + guard * 4000)
    }

    expect(guard).toBeGreaterThanOrEqual(12)
    // Yeni kelimeler tanıtıldıktan sonra ilk karşılaşma Türkçe→Almanca seçmedir.
    expect(kinds.has('tr_to_de_choice')).toBe(true)

    const summary = session.summary(T0 + 600_000)
    expect(summary.reviews).toBe(guard)
    expect(summary.correct).toBe(guard)
    expect(summary.accuracy).toBe(1)
    expect(summary.xp).toBeGreaterThan(0)
    expect(summary.newItems).toBeGreaterThan(0)
    expect(summary.distinctItems).toBeGreaterThan(0)
    expect(summary.avgMs).toBeGreaterThan(0)
  })
})

describe('StudySession — yanlış cevaplarla', () => {
  it('yanlışları oturum içinde bir kez daha sorar', () => {
    const { engine } = makeEngine()
    const session = new StudySession(engine, { kind: 'mixed', limit: 8, now: T0, seed: 7 })
    const initialTotal = session.total

    let guard = 0
    let view = session.advance(T0)
    while (view && guard < 400) {
      guard += 1
      const result = session.submit(wrongAnswer(view), T0 + guard * 3000)
      expect(result!.correct).toBe(false)
      expect(result!.rating).toBe(Rating.Again)
      view = session.advance(T0 + guard * 3000)
      if (guard === 1) {
        // ilk yanlıştan sonra kuyruk büyümüş olmalı
        expect(session.total).toBeGreaterThan(initialTotal)
      }
    }

    const summary = session.summary(T0 + 900_000)
    expect(summary.accuracy).toBeLessThan(0.5)
    // aynı öğe en fazla 2 kez sorulur
    expect(summary.reviews).toBeLessThanOrEqual(initialTotal * 2)
    expect(summary.newItems).toBeGreaterThan(0)
  })

  it('boş cevap yanlış sayılır ve doğru cevabı bildirir', () => {
    const { engine } = makeEngine()
    const session = new StudySession(engine, { kind: 'mixed', limit: 1, now: T0, seed: 3 })
    const view = session.advance(T0)
    expect(view).toBeTruthy()
    const result = session.submit(null, T0 + 1000)
    expect(result!.correct).toBe(false)
    expect(result!.correctAnswer).toBeTruthy()
    expect(result!.requeued).toBe(true)
  })
})

describe('ders tanıtımı (yeni kelimeler)', () => {
  it('önce kelime kartlarını gösterir, sonra alıştırmaya geçer', () => {
    const { engine } = makeEngine(9)
    const session = new StudySession(engine, { kind: 'lesson', unitId: 'begruessung', limit: 12, now: T0, seed: 9 })
    expect(session.phase).toBe('intro')
    expect(session.intro.length).toBeGreaterThanOrEqual(2)

    const first = session.currentIntro
    expect(first).toBeTruthy()
    expect(first!.total).toBe(session.intro.length)
    expect(first!.index).toBe(0)
    expect(first!.item.ex).toBeTruthy()

    let guard = 0
    while (session.phase === 'intro' && guard < 40) {
      guard += 1
      session.nextIntro()
    }
    expect(guard).toBe(session.intro.length)
    expect(session.phase).toBe('practice')
    expect(session.currentIntro).toBeNull()
  })

  it('tekrar oturumunda tanıtım yapılmaz', () => {
    const { engine } = makeEngine(10)
    const session = new StudySession(engine, { kind: 'review', limit: 12, now: T0, seed: 10 })
    expect(session.phase).toBe('practice')
    expect(session.intro.length).toBe(0)
  })

  it('tanıtım atlanabilir', () => {
    const { engine } = makeEngine(12)
    const session = new StudySession(engine, { kind: 'mixed', limit: 12, now: T0, seed: 12 })
    expect(session.phase).toBe('intro')
    session.skipIntro()
    expect(session.phase).toBe('practice')
  })
})

describe('blok yerleştirme (cümle kurma)', () => {
  it('örnek cümleden karolar üretir ve cümleyi değerlendirir', () => {
    const { engine, state } = makeEngine(13, 0)
    const unitId = 'begruessung'
    const items = ITEMS.filter((i) => i.unit === unitId && i.ex)

    // Her öğeyi 4 kez doğru cevapla: 4. tekrarda motor cümle kurmayı seçer.
    for (const item of items) {
      for (let k = 0; k < 4; k += 1) {
        const card = state.cards[item.id]
        const kind = card ? engine.chooseKind(item, card) : 'tr_to_de_choice'
        const given =
          kind === 'article'
            ? (item.article ?? 'der')
            : kind === 'de_to_tr_choice'
              ? item.tr
              : kind === 'sentence_build'
                ? (item.ex ?? item.de)
                : item.de
        engine.grade({
          item,
          kind,
          given,
          ms: 2500,
          sessionId: 's1',
          sessionIndex: k,
          sessionTotal: 4,
          fromQueue: true,
          now: T0 + k * 60_000,
        })
      }
    }

    const session = new StudySession(engine, { kind: 'lesson', unitId, limit: 20, now: T0 + 600_000, seed: 5 })
    const view = session.advance(T0 + 600_000)
    expect(view).toBeTruthy()
    expect(view!.kind).toBe('sentence_build')
    expect(view!.tiles.length).toBeGreaterThan(0)
    expect(view!.choices.length).toBe(0)
    expect(view!.prompt).toBe(view!.item.exTr)

    // doğru cümle kabul edilir
    const ok = session.submit(view!.item.ex ?? '', T0 + 601_000)
    expect(ok!.correct).toBe(true)
    expect(ok!.correctAnswer).toBe(view!.item.ex)

    // karışık karo sırası yanlış sayılır
    const next = session.advance(T0 + 602_000)
    if (next && next.kind === 'sentence_build') {
      const reversed = next.tiles.slice().reverse().join(' ')
      const bad = session.submit(reversed, T0 + 603_000)
      expect(bad!.correct).toBe(false)
    }
  })
})

describe('egzersiz tipi seçimi', () => {
  it('kart geçmişine göre tüm tipler erişilebilir', () => {
    const { engine, state } = makeEngine()
    const item = ITEMS.find((i) => i.article)!

    const kinds = new Set<ExerciseKind>()
    for (let reps = 0; reps < 12; reps += 1) {
      const card = state.cards[item.id]
      if (!card) {
        state.cards[item.id] = {
          ...engine.progress(item.id, T0),
          reps: 0,
        }
      } else {
        card.reps = reps
      }
      kinds.add(engine.chooseKind(item, state.cards[item.id]))
      // yanlış geçmişi olan kart daha kolay tipe düşmeli
      state.cards[item.id].lastCorrect = false
      state.cards[item.id].missStreak = 3
      kinds.add(engine.chooseKind(item, state.cards[item.id]))
      state.cards[item.id].lastCorrect = true
      state.cards[item.id].missStreak = 0
    }

    expect(kinds.has('tr_to_de_choice')).toBe(true)
    expect(kinds.has('article')).toBe(true)
    expect(kinds.has('de_to_tr_choice')).toBe(true)
    expect(kinds.has('tr_to_de_type')).toBe(true)
  })
})

describe('humanInterval', () => {
  it('aralıkları okunur biçime çevirir', () => {
    expect(humanInterval(30_000)).toBe('şimdi')
    expect(humanInterval(5 * 60_000)).toContain('dakika')
    expect(humanInterval(3 * 3_600_000)).toContain('saat')
    expect(humanInterval(4 * 86_400_000)).toContain('gün')
    expect(humanInterval(90 * 86_400_000)).toContain('ay')
    expect(humanInterval(800 * 86_400_000)).toContain('yıl')
  })
})
