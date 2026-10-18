/**
 * RWKV-Instant — FastoLearn'in *taban* motoru.
 *
 * Aynı adlı dilingo mimarisinin (linear-attention RNN, O(1) durum güncellemesi)
 * tarayıcıda çalışan sürümü. Farkı: token yerine **kullanıcının cevap olayları**
 * dizisini işler, yani kullanıcının öğrenme geçmişini sabit boyutlu bir
 * durumda özetler.
 *
 *   time-mix :  WKV(q,k,v) — her kafa için *gerçek zamanlı* unutma oranı
 *                 num_h ← d_h·num_h + e^{u_h + k_h}·v_h
 *                 den_h ← d_h·den_h + e^{u_h + k_h}
 *                 d_h   = e^{−rate_h · Δt(gün)}
 *   chan-mix :  kare-ReLU FFN + receptance kapısı
 *
 * Δt'ye bağlı azalma sayesinde kafalar farklı *gerçek zaman* ufuklarını
 * (saatler → aylar) temsil eder: yeni bir cevap geldiğinde durum O(1) maliyetle
 * güncellenir ve "bu kullanıcı neyi, ne zaman unutur" bilgisi kalıcı olur.
 *
 * Öğrenilebilir kısım yalnızca okuma katmanıdır (readout + bias). Ağırlıklar
 * tohumdan (seed) deterministik üretilir; bu yüzden diske sadece küçük
 * tekrarlı durum yazılır ve model yeniden inşa edilebilir.
 */

const EPS = 1e-12

/** Deterministik PRNG (mulberry32). */
export function rngFromSeed(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussFrom(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Dikdörtgen Gauss matrisi: rows × cols, ölçek 1/√cols (Xavier). */
function randomMatrix(rows: number, cols: number, rng: () => number, scale?: number): Float64Array {
  const m = new Float64Array(rows * cols)
  const s = scale ?? 1 / Math.sqrt(cols)
  for (let i = 0; i < m.length; i++) m[i] = gaussFrom(rng) * s
  return m
}

/** Dikdörtgen matrisin satırlarını ortonormal yapar (rows ≤ cols). */
function orthogonalRows(rows: number, cols: number, rng: () => number): Float64Array {
  if (rows > cols) return randomMatrix(rows, cols, rng)
  const m = new Float64Array(rows * cols)
  const row = new Float64Array(cols)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) row[j] = gaussFrom(rng)
    for (let k = 0; k < i; k++) {
      let dot = 0
      for (let j = 0; j < cols; j++) dot += row[j] * m[k * cols + j]
      for (let j = 0; j < cols; j++) row[j] -= dot * m[k * cols + j]
    }
    let norm = 0
    for (let j = 0; j < cols; j++) norm += row[j] * row[j]
    norm = Math.sqrt(norm) || 1
    for (let j = 0; j < cols; j++) m[i * cols + j] = row[j] / norm
  }
  return m
}

/** Ortonormal satırlara sahip kare matris (Gram–Schmidt). */
function orthogonal(size: number, rng: () => number): Float64Array {
  const m = new Float64Array(size * size)
  const row = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) row[j] = gaussFrom(rng)
    for (let k = 0; k < i; k++) {
      let dot = 0
      for (let j = 0; j < size; j++) dot += row[j] * m[k * size + j]
      for (let j = 0; j < size; j++) row[j] -= dot * m[k * size + j]
    }
    let norm = 0
    for (let j = 0; j < size; j++) norm += row[j] * row[j]
    norm = Math.sqrt(norm) || 1
    for (let j = 0; j < size; j++) m[i * size + j] = row[j] / norm
  }
  return m
}

const zeros = (n: number): Float64Array => new Float64Array(n)

/** out = W · x,  W: outDim × inDim */
function matVec(W: Float64Array, x: Float64Array, out: Float64Array): void {
  const inDim = x.length
  const outDim = out.length
  for (let o = 0; o < outDim; o++) {
    let s = 0
    const base = o * inDim
    for (let i = 0; i < inDim; i++) s += W[base + i] * x[i]
    out[o] = s
  }
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))
const tanh = (x: number): number => Math.tanh(x)

/** Yerinde olmayan LayerNorm (sabit gain = 1, bias = 0). */
function layerNorm(x: Float64Array): Float64Array {
  const n = x.length
  let mean = 0
  for (let i = 0; i < n; i++) mean += x[i]
  mean /= n
  let varr = 0
  for (let i = 0; i < n; i++) {
    const d = x[i] - mean
    varr += d * d
  }
  const inv = 1 / Math.sqrt(varr / n + 1e-5)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = (x[i] - mean) * inv
  return out
}

export interface RWKVConfig {
  /** Girdi/çıktı boyutu (özellik vektörü boyutu). */
  nEmbd: number
  /** Çoklu-zaman-ufku kafaları. */
  nHead: number
  /** Blok sayısı. */
  nLayer: number
  /** Ağırlık tohumu — aynı tohum aynı modeli üretir. */
  seed: number
}

export const DEFAULT_RWKV_CONFIG: RWKVConfig = { nEmbd: 64, nHead: 8, nLayer: 2, seed: 0xfa5701 }

/** Kafaların gerçek-zaman ufukları: yarılanma süreleri (gün). */
const HORIZON_HALF_LIVES_DAYS = [0.05, 0.2, 1, 3, 7, 21, 60, 180]

/** UI'da kafa etiketi olarak kullanılır. */
export const HORIZON_LABELS = HORIZON_HALF_LIVES_DAYS.map((d) =>
  d < 1 ? `${Math.round(d * 24)} sa` : d < 30 ? `${d} gün` : `${Math.round(d / 30)} ay`,
)

interface TimeMix {
  Wk: Float64Array
  Wv: Float64Array
  Wr: Float64Array
  Wo: Float64Array
  /** log oran: rate_h = e^{w_h} (gün⁻¹) */
  w: Float64Array
  u: Float64Array
  num: Float64Array
  den: Float64Array
}

interface ChannelMix {
  Wk: Float64Array
  Wr: Float64Array
  Wv: Float64Array
}

interface Block {
  tm: TimeMix
  cm: ChannelMix
  /** channel-mix'in kaydırdığı önceki aktivasyon */
  prevB: Float64Array
}

export interface RWKVStateSnapshot {
  seed: number
  nEmbd: number
  nHead: number
  nLayer: number
  layers: { num: number[]; den: number[]; prevB: number[] }[]
  readout: number[]
  readoutBias: number
  gradSq: number[]
  steps: number
}

export interface StepResult {
  /** Okuma katmanının ham skoru. */
  logit: number
  /** sigmoid(logit) — kişisel hatırlama tahmini. */
  pRecall: number
  /** Kafa başına ortalama |wkv| — "bellek ufku parmak izi". */
  horizons: number[]
  hidden: Float64Array
}

/**
 * RWKV-Instant modeli + kullanıcıya özel çevrimiçi okuma katmanı.
 *
 * Tek `observe()` çağrısı = 1 ileri adım (O(1)) + 1 gradyan adımı (O(C)).
 * Toplu yeniden eğitim yok; bu yüzden "instant".
 */
export class RWKVInstant {
  readonly cfg: RWKVConfig
  private readonly blocks: Block[]
  private readonly residualScale: number
  readout: Float64Array
  readoutBias = 0
  private readonly gradSq: Float64Array
  private gradSqBias = 1e-8
  steps = 0
  learningRate = 0.35
  l2 = 1e-4
  private lastHidden: Float64Array
  private lastInput: Float64Array
  private pendingDt = 1

  constructor(cfg: RWKVConfig = DEFAULT_RWKV_CONFIG) {
    this.cfg = cfg
    const rng = rngFromSeed(cfg.seed)
    const C = cfg.nEmbd
    const H = cfg.nHead
    const D = C / H
    if (!Number.isInteger(D)) throw new Error('nEmbd, nHead ile tam bölünmeli')
    this.residualScale = 0.5 / Math.sqrt(2 * cfg.nLayer)
    this.blocks = []

    for (let l = 0; l < cfg.nLayer; l++) {
      const w = new Float64Array(H)
      const u = new Float64Array(H)
      for (let h = 0; h < H; h++) {
        const halfLife = HORIZON_HALF_LIVES_DAYS[h % HORIZON_HALF_LIVES_DAYS.length]
        w[h] = Math.log(Math.LN2 / halfLife)
        u[h] = gaussFrom(rng) * 0.1
      }
      this.blocks.push({
        tm: {
          Wk: orthogonal(C, rng),
          Wv: orthogonal(C, rng),
          Wr: orthogonal(C, rng),
          Wo: orthogonal(C, rng),
          w,
          u,
          num: zeros(H * D),
          den: zeros(H * D),
        },
        cm: {
          Wk: randomMatrix(4 * C, C, rng),
          Wr: randomMatrix(4 * C, C, rng),
          Wv: orthogonalRows(C, 4 * C, rng),
        },
        prevB: zeros(C),
      })
    }

    this.readout = new Float64Array(C)
    for (let i = 0; i < C; i++) this.readout[i] = gaussFrom(rng) / Math.sqrt(C)
    this.gradSq = new Float64Array(C)
    this.lastHidden = zeros(C)
    this.lastInput = zeros(C)
  }

  /** Eğitilebilir + sabit parametre sayısı. */
  paramCount(): number {
    const C = this.cfg.nEmbd
    const perLayer = C * C * 4 + this.cfg.nHead * 2 + 4 * C * C * 3
    return perLayer * this.cfg.nLayer + C + 1
  }

  /** Kalıcı durumun kaç sayıdan oluştuğu. */
  stateSize(): number {
    return this.cfg.nEmbd * 3 * this.cfg.nLayer + this.cfg.nEmbd + 2
  }

  private forward(input: Float64Array): Float64Array {
    let x = input
    for (const block of this.blocks) {
      const a = layerNorm(x)
      x = this.timeMix(block, a, x)
      const b = layerNorm(x)
      x = this.channelMix(block, b)
      block.prevB = b
    }
    return x
  }

  /** Δt'ye bağlı WKV adımı. */
  private timeMix(block: Block, a: Float64Array, residual: Float64Array): Float64Array {
    const C = this.cfg.nEmbd
    const H = this.cfg.nHead
    const D = C / H
    const { tm } = block
    const dt = this.pendingDt
    const k = zeros(C)
    const v = zeros(C)
    const r = zeros(C)
    matVec(tm.Wk, a, k)
    matVec(tm.Wv, a, v)
    matVec(tm.Wr, a, r)

    const gated = zeros(C)
    for (let h = 0; h < H; h++) {
      const decay = Math.exp(-Math.exp(tm.w[h]) * dt)
      const bonus = Math.exp(tm.u[h])
      const base = h * D
      for (let d = 0; d < D; d++) {
        const idx = base + d
        const ek = bonus * Math.exp(tanh(k[idx]))
        tm.num[idx] = decay * tm.num[idx] + ek * v[idx]
        tm.den[idx] = decay * tm.den[idx] + ek
        gated[idx] = sigmoid(r[idx]) * (tm.num[idx] / (tm.den[idx] + EPS))
      }
    }
    const y = zeros(C)
    matVec(tm.Wo, gated, y)
    const out = new Float64Array(C)
    for (let i = 0; i < C; i++) out[i] = residual[i] + this.residualScale * y[i]
    return out
  }

  private channelMix(block: Block, b: Float64Array): Float64Array {
    const C = this.cfg.nEmbd
    const hid = 4 * C
    const k = zeros(hid)
    const r = zeros(hid)
    matVec(block.cm.Wk, block.prevB, k)
    matVec(block.cm.Wr, b, r)
    const g = zeros(hid)
    for (let i = 0; i < hid; i++) {
      const relu = k[i] > 0 ? k[i] : 0
      g[i] = relu * relu * sigmoid(r[i])
    }
    const y = zeros(C)
    matVec(block.cm.Wv, g, y)
    const out = new Float64Array(C)
    for (let i = 0; i < C; i++) out[i] = b[i] + this.residualScale * y[i]
    return out
  }

  /**
   * Bir cevap olayını işler: durum güncellenir, kişisel tahmin döner.
   * @param input  özellik vektörü (uzunluk nEmbd)
   * @param dtDays son olaydan bu yana geçen gün
   */
  step(input: Float64Array, dtDays = 1): StepResult {
    this.pendingDt = Math.max(0, Math.min(dtDays, 3650))
    this.lastInput = input
    const hidden = this.forward(input)
    let logit = this.readoutBias
    for (let i = 0; i < hidden.length; i++) logit += this.readout[i] * hidden[i]
    this.lastHidden = hidden
    this.steps += 1
    return {
      logit,
      pRecall: sigmoid(logit),
      horizons: this.horizonFingerprint(),
      hidden,
    }
  }

  /** Durumu bozmadan tek adımlık tahmin (sıralama/önizleme için). */
  probe(input: Float64Array, dtDays: number): number {
    const snapshot = this.snapshotState()
    const p = this.step(input, dtDays).pRecall
    this.restoreState(snapshot)
    return p
  }

  /**
   * Çevrimiçi gradyan adımı (AdaGrad + L2 güdümü + adım kırpma).
   * Hedef: kullanıcı bu olayda hatırladı mı (1) yoksa unuttu mu (0)?
   *
   * Kayıp L = −[y·ln p + (1−y)·ln(1−p)], dL/dz = p − y (z = okuma katmanı skoru),
   * dolayısıyla dL/dw = (p − y)·h + λ·w. Maliyet O(nEmbd) — tek adım.
   */
  learn(target: 0 | 1, pRecall: number, lr = this.learningRate): number {
    const dLdz = pRecall - target
    const C = this.cfg.nEmbd
    const eps = 1e-4
    const maxStep = 0.05
    let gradNorm = 0
    for (let i = 0; i < C; i++) {
      const g = dLdz * this.lastHidden[i] + this.l2 * this.readout[i]
      this.gradSq[i] += g * g
      const update = clampStep((lr * g) / (Math.sqrt(this.gradSq[i]) + eps), maxStep)
      this.readout[i] -= update
      gradNorm += update * update
    }
    this.gradSqBias += dLdz * dLdz
    this.readoutBias -= clampStep((lr * dLdz) / (Math.sqrt(this.gradSqBias) + eps), maxStep)
    return Math.sqrt(gradNorm)
  }

  /** Kafa başına ortalama |wkv| — kullanıcıya "bellek ufku" olarak gösterilir. */
  private horizonFingerprint(): number[] {
    const H = this.cfg.nHead
    const D = this.cfg.nEmbd / H
    const out: number[] = []
    for (let h = 0; h < H; h++) {
      let sum = 0
      for (const block of this.blocks) {
        for (let d = 0; d < D; d++) {
          const idx = h * D + d
          sum += Math.abs(block.tm.num[idx]) / (block.tm.den[idx] + EPS)
        }
      }
      out.push(sum / (D * this.blocks.length))
    }
    return out
  }

  // -- kalıcılık --------------------------------------------------------- //

  snapshotState(): RWKVStateSnapshot {
    return {
      seed: this.cfg.seed,
      nEmbd: this.cfg.nEmbd,
      nHead: this.cfg.nHead,
      nLayer: this.cfg.nLayer,
      layers: this.blocks.map((b) => ({
        num: round6(b.tm.num),
        den: round6(b.tm.den),
        prevB: round6(b.prevB),
      })),
      readout: round6(this.readout),
      readoutBias: round6Value(this.readoutBias),
      gradSq: round6(this.gradSq),
      steps: this.steps,
    }
  }

  restoreState(s: RWKVStateSnapshot): void {
    if (s.nLayer !== this.cfg.nLayer || s.nEmbd !== this.cfg.nEmbd || s.seed !== this.cfg.seed) return
    s.layers.forEach((l, i) => {
      const block = this.blocks[i]
      if (!block) return
      copyInto(block.tm.num, l.num)
      copyInto(block.tm.den, l.den)
      copyInto(block.prevB, l.prevB)
    })
    copyInto(this.readout, s.readout)
    this.readoutBias = s.readoutBias
    copyInto(this.gradSq, s.gradSq)
    this.steps = s.steps
  }

  /** Tüm tekrarlı durumu sıfırlar (yeni kullanıcı / sıfırlama). */
  reset(): void {
    for (const block of this.blocks) {
      block.tm.num.fill(0)
      block.tm.den.fill(0)
      block.prevB.fill(0)
    }
    this.lastHidden.fill(0)
    this.lastInput.fill(0)
    this.steps = 0
  }
}

function copyInto(target: Float64Array, source: readonly number[] | undefined): void {
  if (!source) return
  const n = Math.min(target.length, source.length)
  for (let i = 0; i < n; i++) target[i] = source[i]
}

function round6(xs: Float64Array): number[] {
  const out = new Array<number>(xs.length)
  for (let i = 0; i < xs.length; i++) out[i] = Math.round(xs[i] * 1e6) / 1e6
  return out
}

const round6Value = (v: number): number => Math.round(v * 1e6) / 1e6

const clampStep = (v: number, limit: number): number => (v > limit ? limit : v < -limit ? -limit : v)
