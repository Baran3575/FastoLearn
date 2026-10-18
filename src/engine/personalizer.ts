/**
 * Arka plan kişiselleştirme servisi.
 *
 * `Personalizer` gözlem logunu izler ve yeterli veri biriktiğinde (varsayılan:
 * her 25 yeni gözlemde bir, en az 80 gözlemle) FSRS-7 parametrelerini
 * worker'da yeniden uyarlar. Worker kurulamazsa aynı işi ana iş parçacığında,
 * `requestIdleCallback` (yoksa setTimeout) ile boşta çalıştırır.
 */

import { optimiseParameters, type ReviewRecord } from './fsrs7'
import type { TuneRequest, TuneResponse } from './tuner.worker'

export interface TuneOutcome {
  parameters: number[]
  defaultNll: number
  tunedNll: number
  improvement: number
  nReviews: number
}

export type TuneListener = (outcome: TuneOutcome) => void

const MIN_REVIEWS = 80
const EVERY_N = 25
const ITERATIONS = 40

export class Personalizer {
  private worker: Worker | null = null
  private nextId = 1
  private lastTunedAtCount = 0
  private running = false
  private listeners = new Set<TuneListener>()

  constructor() {
    try {
      this.worker = new Worker(new URL('./tuner.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onerror = () => {
        this.worker?.terminate()
        this.worker = null
      }
    } catch {
      this.worker = null
    }
  }

  onTuned(listener: TuneListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Yeni gözlem geldiğinde çağrılır; gerekirse arka planda uyarlamayı başlatır. */
  maybeTune(reviews: ReviewRecord[]): void {
    if (this.running) return
    if (reviews.length < MIN_REVIEWS) return
    if (reviews.length - this.lastTunedAtCount < EVERY_N) return
    this.lastTunedAtCount = reviews.length
    void this.run(reviews)
  }

  private async run(reviews: ReviewRecord[]): Promise<void> {
    this.running = true
    const seed = 7 + reviews.length
    try {
      const outcome = this.worker
        ? await this.askWorker(reviews, seed)
        : await this.askIdle(reviews, seed)
      if (outcome) {
        for (const listener of this.listeners) listener(outcome)
      }
    } finally {
      this.running = false
    }
  }

  private askWorker(reviews: ReviewRecord[], seed: number): Promise<TuneOutcome | null> {
    return new Promise((resolve) => {
      const worker = this.worker
      if (!worker) return resolve(null)
      const id = this.nextId++
      const onMessage = (e: MessageEvent<TuneResponse>) => {
        if (e.data.id !== id) return
        worker.removeEventListener('message', onMessage)
        resolve(this.toOutcome(e.data, reviews.length))
      }
      worker.addEventListener('message', onMessage)
      const request: TuneRequest = { id, reviews, iterations: ITERATIONS, seed }
      worker.postMessage(request)
      // Güvenlik ağı: worker takılırsa ana akışı bekletme
      setTimeout(() => {
        worker.removeEventListener('message', onMessage)
        resolve(null)
      }, 20_000)
    })
  }

  private askIdle(reviews: ReviewRecord[], seed: number): Promise<TuneOutcome | null> {
    return new Promise((resolve) => {
      const work = () => {
        try {
          const r = optimiseParameters(reviews, ITERATIONS, 0.06, 0.9, seed)
          resolve({
            parameters: r.parameters,
            defaultNll: r.defaultNll,
            tunedNll: r.tunedNll,
            improvement: r.improvement,
            nReviews: reviews.length,
          })
        } catch {
          resolve(null)
        }
      }
      const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
      if (ric) ric(work)
      else setTimeout(work, 50)
    })
  }

  private toOutcome(data: TuneResponse, n: number): TuneOutcome | null {
    if (!data.ok || !data.parameters) return null
    return {
      parameters: data.parameters,
      defaultNll: data.defaultNll ?? 0,
      tunedNll: data.tunedNll ?? 0,
      improvement: data.improvement ?? 0,
      nReviews: n,
    }
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.listeners.clear()
  }
}
