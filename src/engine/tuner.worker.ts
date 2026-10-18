/**
 * Arka plan ayarlayıcı (Web Worker).
 *
 * Kullanıcı yeni cevaplar verdikçe, FSRS-7'nin 21 parametresi kullanıcının
 * *kendi* gözlem loguna göre yeniden uyarlanır. Bu iş arayüzü bloke etmesin
 * diye worker'da koşar; sonuç gelince motor parametreleri otomatik uygular.
 */

import { optimiseParameters, type ReviewRecord } from './fsrs7'

export interface TuneRequest {
  id: number
  reviews: ReviewRecord[]
  iterations: number
  seed: number
}

export interface TuneResponse {
  id: number
  ok: boolean
  parameters?: number[]
  defaultNll?: number
  tunedNll?: number
  improvement?: number
  error?: string
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<TuneRequest>) => void) | null
  postMessage: (v: unknown) => void
}

ctx.onmessage = (event: MessageEvent<TuneRequest>) => {
  const { id, reviews, iterations, seed } = event.data
  try {
    const result = optimiseParameters(reviews, iterations, 0.06, 0.9, seed)
    const response: TuneResponse = {
      id,
      ok: true,
      parameters: result.parameters,
      defaultNll: result.defaultNll,
      tunedNll: result.tunedNll,
      improvement: result.improvement,
    }
    ctx.postMessage(response)
  } catch (error) {
    const response: TuneResponse = { id, ok: false, error: String(error) }
    ctx.postMessage(response)
  }
}
