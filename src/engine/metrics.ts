/**
 * Tahmin kalitesi metrikleri — kişiselleştirmenin gerçekten işe yarayıp
 * yaramadığını ölçmek için (dilingo/app/labs/memory.py portu).
 */

export interface PredictionPair {
  p: number
  y: 0 | 1
}

export function brier(pairs: readonly PredictionPair[]): number {
  if (!pairs.length) return 0
  let s = 0
  for (const { p, y } of pairs) s += (p - y) ** 2
  return s / pairs.length
}

export function logLoss(pairs: readonly PredictionPair[]): number {
  if (!pairs.length) return 0
  const eps = 1e-9
  let s = 0
  for (const { p, y } of pairs) {
    const q = Math.min(Math.max(p, eps), 1 - eps)
    s += -Math.log(y ? q : 1 - q)
  }
  return s / pairs.length
}

/** Beklenen kalibrasyon hatası (ECE). */
export function ece(pairs: readonly PredictionPair[], bins = 10): number {
  if (!pairs.length) return 0
  const buckets: PredictionPair[][] = Array.from({ length: bins }, () => [])
  for (const pair of pairs) {
    const b = Math.min(bins - 1, Math.floor(pair.p * bins))
    buckets[b].push(pair)
  }
  let total = 0
  for (const bucket of buckets) {
    if (!bucket.length) continue
    const conf = bucket.reduce((a, { p }) => a + p, 0) / bucket.length
    const acc = bucket.reduce((a, { y }) => a + y, 0) / bucket.length
    total += (bucket.length / pairs.length) * Math.abs(conf - acc)
  }
  return total
}

/** ROC AUC (sıralama kalitesi) — O(n log n). */
export function auc(pairs: readonly PredictionPair[]): number {
  const pos = pairs.filter((x) => x.y === 1).length
  const neg = pairs.length - pos
  if (!pos || !neg) return Number.NaN
  const sorted = [...pairs].sort((a, b) => a.p - b.p)
  let rankSum = 0
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1].p === sorted[i].p) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) if (sorted[k].y === 1) rankSum += avgRank
    i = j + 1
  }
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg)
}

export interface CalibrationBin {
  lo: number
  hi: number
  predicted: number
  actual: number
  n: number
}

export function calibrationCurve(pairs: readonly PredictionPair[], bins = 8): CalibrationBin[] {
  const out: CalibrationBin[] = []
  for (let b = 0; b < bins; b++) {
    const lo = b / bins
    const hi = (b + 1) / bins
    const bucket = pairs.filter((x) => x.p >= lo && (b === bins - 1 ? x.p <= 1 : x.p < hi))
    out.push({
      lo,
      hi,
      predicted: bucket.length ? bucket.reduce((a, x) => a + x.p, 0) / bucket.length : (lo + hi) / 2,
      actual: bucket.length ? bucket.reduce((a, x) => a + x.y, 0) / bucket.length : 0,
      n: bucket.length,
    })
  }
  return out
}

export function summarize(pairs: readonly PredictionPair[]) {
  return {
    n: pairs.length,
    brier: brier(pairs),
    logLoss: logLoss(pairs),
    ece: ece(pairs),
    auc: auc(pairs),
    accuracy: pairs.length ? pairs.filter((x) => x.y === 1).length / pairs.length : 0,
  }
}
