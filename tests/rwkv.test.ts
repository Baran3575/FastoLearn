import { describe, expect, it } from 'vitest'
import { DEFAULT_RWKV_CONFIG, HORIZON_LABELS, RWKVInstant } from '../src/engine/rwkv'

const C = DEFAULT_RWKV_CONFIG.nEmbd

function inputAt(seed: number): Float64Array {
  const x = new Float64Array(C)
  for (let i = 0; i < C; i++) x[i] = ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1) * 0.5
  x[C - 1] = 1
  return x
}

describe('RWKV-Instant — tekrarlı durum', () => {
  it('Δt ile eski durum söner', () => {
    const model = new RWKVInstant()
    const snapBefore = model.snapshotState()
    model.step(inputAt(1), 1)
    const magnitudeAfterShort = sumAbs(model.snapshotState().layers[0].num)
    model.step(inputAt(1), 200) // çok uzun aradan sonra
    const after = model.snapshotState()
    // ilk ufkun (yarılanma ~1.2 saat) katkısı neredeyse sıfırlanmalı
    const fastHead = after.layers[0].num[0]
    expect(Math.abs(fastHead)).toBeLessThan(magnitudeAfterShort + 1e-9)
    expect(snapBefore.layers[0].num.every((v) => v === 0)).toBe(true)
  })

  it('probe durumu değiştirmez', () => {
    const model = new RWKVInstant()
    model.step(inputAt(3), 1)
    const before = JSON.stringify(model.snapshotState())
    const p = model.probe(inputAt(4), 1)
    const after = JSON.stringify(model.snapshotState())
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
    expect(after).toBe(before)
  })

  it('snapshot/restore aynı durumu geri yükler', () => {
    const a = new RWKVInstant()
    for (let i = 0; i < 5; i++) a.step(inputAt(i), 0.5)
    const snap = a.snapshotState()
    const b = new RWKVInstant()
    b.restoreState(snap)
    expect(b.snapshotState().layers).toEqual(snap.layers)
    expect(b.snapshotState().readout).toEqual(snap.readout)
  })

  it('durum boyutu girdi boyutundan bağımsız sabittir (O(1))', () => {
    const model = new RWKVInstant()
    const before = model.snapshotState().layers[0].num.length
    for (let i = 0; i < 50; i++) model.step(inputAt(i), 0.2)
    expect(model.snapshotState().layers[0].num.length).toBe(before)
    expect(model.stateSize()).toBeLessThan(1000)
  })
})

describe('RWKV-Instant — çevrimiçi öğrenme', () => {
  it('tekrarlanan hedef için tahmin doğru yöne gider', () => {
    const model = new RWKVInstant()
    const x = inputAt(7)
    let logitBefore = 0
    for (let i = 0; i < 40; i++) {
      const r = model.step(x, 1)
      if (i === 0) logitBefore = r.logit
      model.learn(1, r.pRecall, 0.5)
    }
    const after = model.step(x, 1)
    expect(after.logit).toBeGreaterThan(logitBefore)
  })

  it('öğrenme yalnızca okuma katmanına dokunur', () => {
    const model = new RWKVInstant()
    const wKbefore = model.snapshotState().layers.length
    const r = model.step(inputAt(2), 1)
    model.learn(0, r.pRecall, 0.5)
    expect(model.snapshotState().layers.length).toBe(wKbefore)
    expect(model.steps).toBe(1)
  })

  it('ufuk etiketleri kafa sayısıyla eşleşir', () => {
    expect(HORIZON_LABELS.length).toBe(DEFAULT_RWKV_CONFIG.nHead)
    const model = new RWKVInstant()
    expect(model.step(inputAt(1), 1).horizons.length).toBe(DEFAULT_RWKV_CONFIG.nHead)
  })
})

function sumAbs(xs: number[]): number {
  return xs.reduce((a, b) => a + Math.abs(b), 0)
}
