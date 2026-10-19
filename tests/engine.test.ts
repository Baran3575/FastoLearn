import { describe, expect, it } from 'vitest'
import { LearningEngine, dayKey } from '../src/engine/engine'
import { Rating } from '../src/engine/fsrs7'
import { FEATURE_DIM, FEATURE_SLOTS } from '../src/engine/features'
import { DEFAULT_RWKV_CONFIG } from '../src/engine/rwkv'
import { ITEMS, SECTION_ORDER, SECTION_BY_ID } from '../src/content'
import { createUserState } from '../src/state/user'
import type { VocabularyItem } from '../src/engine/types'

const DAY = 86_400_000

function deck(): VocabularyItem[] {
  return ITEMS.slice(0, 24)
}

function freshEngine(now: number) {
  const state = createUserState('test', 'Test', now)
  const engine = new LearningEngine(deck(), state)
  return { state, engine }
}

function fullEngine(now: number) {
  const state = createUserState('test', 'Test', now)
  const engine = new LearningEngine(ITEMS, state)
  engine.setSectionOrder(SECTION_ORDER)
  return { state, engine }
}

describe('plan — kişiselleştirilmiş kuyruk', () => {
  it('istenen sayıda öğe döner ve hepsi yeni başlar', () => {
    const { engine } = freshEngine(Date.now())
    const plan = engine.plan({ limit: 10 })
    // yeni öğe kotası (varsayılan 6) oturumu sınırlar
    expect(plan.length).toBe(6)
    expect(plan.length).toBeLessThanOrEqual(10)
    expect(plan.every((p) => p.kind === 'tr_to_de_choice')).toBe(true)
    expect(plan.every((p) => p.pFinal > 0 && p.pFinal < 1)).toBe(true)
  })

  it('ünite kapsamına göre plan yapabilir', () => {
    const { engine } = freshEngine(Date.now())
    const plan = engine.plan({ scope: 'unit', unitId: 'begruessung', limit: 5 })
    expect(plan.length).toBe(5)
    expect(plan.every((p) => p.item.unit === 'begruessung')).toBe(true)
  })
})

describe('sıralı müfredat (0 Almanca başlangıç)', () => {
  it('sıra verildiğinde yeni kelimeler yalnızca ilk bölümden gelir', () => {
    const { engine } = freshEngine(Date.now())
    engine.setSectionOrder(SECTION_ORDER)
    const plan = engine.plan({ limit: 25 })
    expect(plan.length).toBeGreaterThan(0)
    const orders = new Set(plan.map((p) => SECTION_BY_ID[p.item.unit]?.order))
    expect(orders.size).toBe(1)
    expect([...orders][0]).toBe(1)
    expect(plan.every((p) => p.item.unit === 'begruessung')).toBe(true)
  })

  it('ilk bölüm bittiğinde sıradaki bölüme geçer', () => {
    const now = Date.now()
    const { engine, state } = freshEngine(now)
    engine.setSectionOrder(SECTION_ORDER)
    // 1. bölümün tüm kelimelerini bir kez doğru cevapla
    const first = ITEMS.filter((i) => i.unit === 'begruessung')
    first.forEach((item, i) => {
      engine.grade({
        item,
        kind: 'tr_to_de_choice',
        given: item.de,
        ms: 2000,
        sessionId: 's1',
        sessionIndex: i,
        sessionTotal: first.length,
        fromQueue: false,
        now: now + i * 1000,
      })
    })
    expect(first.every((i) => (state.cards[i.id]?.reps ?? 0) > 0)).toBe(true)
    const plan = engine.plan({ limit: 25, now: now + 60_000 })
    expect(plan.length).toBeGreaterThan(0)
    const fresh = plan.filter((p) => p.isNew)
    expect(fresh.every((p) => p.item.unit === 'bekanntschaft')).toBe(true)
  })

  it('ilk ders en temel kelimelerle başlar (Hallo, danke, bitte, ja, nein)', () => {
    const { engine } = fullEngine(Date.now())
    const plan = engine.plan({ limit: 6 })
    expect(plan.map((p) => p.item.de)).toEqual(['Hallo', 'danke', 'ich', 'bitte', 'du', 'ja'])
  })

  it('elle bölüm seçimi sıra kapısını atlar', () => {
    const { engine } = fullEngine(Date.now())
    const plan = engine.plan({ scope: 'unit', unitId: 'stadt', limit: 5 })
    expect(plan.length).toBe(5)
    expect(plan.every((p) => p.item.unit === 'stadt')).toBe(true)
  })

  it('ayar kapatılınca sıra kapısı uygulanmaz', () => {
    const { engine, state } = freshEngine(Date.now())
    engine.setSectionOrder(SECTION_ORDER)
    state.settings.curriculum = false
    const plan = engine.plan({ limit: 25 })
    const units = new Set(plan.map((p) => p.item.unit))
    expect(units.size).toBeGreaterThan(1)
  })
})

describe('grade — otomatik derecelendirme ve güncellemeler', () => {
  it('doğru cevap kartı ilerletir, FSRS durumu oluşur', () => {
    const now = Date.now()
    const { engine, state } = freshEngine(now)
    const item = deck()[0]
    const r = engine.grade({
      item,
      kind: 'tr_to_de_choice',
      given: item.de,
      ms: 2000,
      sessionId: 's1',
      sessionIndex: 0,
      sessionTotal: 10,
      fromQueue: false,
      now,
    })
    expect(r.correct).toBe(true)
    expect(r.rating).toBe(Rating.Good)
    const card = state.cards[item.id]
    expect(card.reps).toBe(1)
    expect(card.stability).toBeGreaterThan(0)
    expect(card.due).toBeGreaterThan(now)
    expect(state.xp).toBeGreaterThan(0)
    expect(state.daily[dayKey(now)].reviews).toBe(1)
    expect(state.events.length).toBe(1)
  })

  it('yanlış cevap Again ile cezalandırılır ve kısa süre sonra tekrar gelir', () => {
    const now = Date.now()
    const { engine, state } = freshEngine(now)
    const item = deck()[1]
    const r = engine.grade({
      item,
      kind: 'tr_to_de_type',
      given: 'yanlış',
      ms: 5000,
      sessionId: 's1',
      sessionIndex: 0,
      sessionTotal: 5,
      fromQueue: false,
      now,
    })
    expect(r.correct).toBe(false)
    expect(r.rating).toBe(Rating.Again)
    expect(r.intervalMs).toBeLessThanOrEqual(15 * 60_000)
    expect(state.cards[item.id].lapses).toBe(1)
  })

  it('hızlı ve emin cevap Easy olarak derecelenir', () => {
    const now = Date.now()
    const { engine, state } = freshEngine(now)
    const item = deck()[2]
    // önce kartı olgunlaştır
    for (let i = 0; i < 3; i++) {
      engine.grade({
        item,
        kind: 'tr_to_de_type',
        given: item.de,
        ms: 3000,
        sessionId: 's1',
        sessionIndex: i,
        sessionTotal: 5,
        fromQueue: false,
        now: now + i * DAY,
      })
    }
    state.medianMs = 4000
    const fast = engine.grade({
      item,
      kind: 'tr_to_de_type',
      given: item.de,
      ms: 900,
      sessionId: 's2',
      sessionIndex: 0,
      sessionTotal: 5,
      fromQueue: true,
      now: now + 10 * DAY,
    })
    expect(fast.rating).toBe(Rating.Easy)
  })

  it('manuel derecelendirme otomatiği geçersiz kılar', () => {
    const now = Date.now()
    const { engine } = freshEngine(now)
    const item = deck()[3]
    const r = engine.grade({
      item,
      kind: 'tr_to_de_choice',
      given: item.de,
      ms: 2000,
      sessionId: 's1',
      sessionIndex: 0,
      sessionTotal: 5,
      fromQueue: false,
      manualRating: Rating.Hard,
      now,
    })
    expect(r.rating).toBe(Rating.Hard)
  })

  it('birleşim ağırlıkları çevrimiçi güncellenir', () => {
    const now = Date.now()
    const { engine, state } = freshEngine(now)
    const before = [...state.mixture]
    for (let i = 0; i < 20; i++) {
      const item = deck()[i % deck().length]
      engine.grade({
        item,
        kind: 'tr_to_de_choice',
        given: i % 3 === 0 ? 'yanlış' : item.de,
        ms: 3000,
        sessionId: 's1',
        sessionIndex: i,
        sessionTotal: 20,
        fromQueue: false,
        now: now + i * 1000,
      })
    }
    expect(state.mixture).not.toEqual(before)
    expect(state.mixture[0]).toBeGreaterThanOrEqual(0)
    expect(state.mixture[0]).toBeLessThanOrEqual(1.6)
  })

  it('öğe yanlılığı hatalı öğelerde negatife gider', () => {
    const now = Date.now()
    const { engine, state } = freshEngine(now)
    const item = deck()[4]
    for (let i = 0; i < 6; i++) {
      engine.grade({
        item,
        kind: 'tr_to_de_type',
        given: 'hatalı',
        ms: 5000,
        sessionId: 's1',
        sessionIndex: i,
        sessionTotal: 6,
        fromQueue: false,
        now: now + i * 1000,
      })
    }
    expect(state.cards[item.id].itemBias).toBeLessThan(0)
  })

  it('hedef hatırlanma oranı kişiselleştirilmiş aralık üretir', () => {
    const now = Date.now()
    const { engine } = freshEngine(now)
    const item = deck()[5]
    const r = engine.grade({
      item,
      kind: 'tr_to_de_choice',
      given: item.de,
      ms: 2000,
      sessionId: 's1',
      sessionIndex: 0,
      sessionTotal: 5,
      fromQueue: false,
      now,
    })
    expect(r.targetRetention).toBeGreaterThanOrEqual(0.78)
    expect(r.targetRetention).toBeLessThanOrEqual(0.95)
  })
})

describe('egzersiz tipi seçimi', () => {
  it('yeni öğe her zaman çoktan seçmeli başlar, olgunlaşınca zorlaşır', () => {
    const now = Date.now()
    const { engine, state } = freshEngine(now)
    const item = ITEMS.find((i) => i.pos === 'noun' && i.article)!
    const card = engine.progress(item.id, now)
    expect(engine.chooseKind(item, card)).toBe('tr_to_de_choice')

    card.reps = 1
    card.lastCorrect = true
    card.stability = 1
    expect(engine.chooseKind(item, card)).toBe('de_to_tr_choice')

    card.reps = 3
    card.lastCorrect = false
    card.missStreak = 2
    expect(engine.chooseKind(item, card)).toBe('article')

    card.reps = 7
    card.lastCorrect = true
    card.missStreak = 0
    card.stability = 8
    expect(['tr_to_de_type', 'listen_choice', 'listen_type', 'article']).toContain(engine.chooseKind(item, card))
    expect(state.settings.listenEnabled).toBe(true)
  })
})

describe('kişiselleştirme raporu', () => {
  it('motor adımlarını ve birleşim ağırlıklarını bildirir', () => {
    const now = Date.now()
    const { engine } = freshEngine(now)
    const item = deck()[6]
    engine.grade({
      item,
      kind: 'tr_to_de_choice',
      given: item.de,
      ms: 1500,
      sessionId: 's1',
      sessionIndex: 0,
      sessionTotal: 3,
      fromQueue: false,
      now,
    })
    const report = engine.personalizationReport()
    expect(report.modelSteps).toBe(1)
    expect(report.horizons.length).toBe(8)
    expect(report.stateSize).toBeLessThan(1000)
    const accuracy = engine.accuracyModelReport()
    expect(accuracy.all.blend.n).toBe(1)
  })

  it('kart dağılımı toplamı öğe sayısına eşit', () => {
    const { engine } = freshEngine(Date.now())
    const stats = engine.cardStats()
    expect(stats.fresh + stats.learning + stats.young + stats.mature).toBe(stats.total)
  })

  it('özellik vektörü boyutu RWKV gizli boyutuyla uyuşur', () => {
    // nEmbd sabittir; KIND_SLOTS genişlerse yedek yuva tüketilmelidir.
    expect(FEATURE_DIM).toBe(DEFAULT_RWKV_CONFIG.nEmbd)
    expect(FEATURE_SLOTS.length).toBe(64)
  })
})
