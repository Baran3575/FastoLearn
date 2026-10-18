/**
 * Cevap değerlendirme: normalizasyon, Levenshtein benzerliği ve
 * "neredeyse doğru" tespiti. Yazma alıştırmalarında Alman klavyesi olmayan
 * kullanıcıyı cezalandırmamak için ä/ö/ü/ß katlanır ama ayırt edilir.
 */

export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'`´„“”()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Umlaut/ß katlanmış biçim: "äpfel" -> "apfel" */
export function fold(s: string): string {
  return normalize(s)
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array<number>(b.length + 1)
  let cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    const tmp = prev
    prev = cur
    cur = tmp
  }
  return prev[b.length]
}

export function similarity(a: string, b: string): number {
  const x = fold(a)
  const y = fold(b)
  if (!x && !y) return 1
  const d = levenshtein(x, y)
  return 1 - d / Math.max(x.length, y.length, 1)
}

export interface TypedGrade {
  correct: boolean
  /** Tam yazım (umlaut dahil) doğru mu */
  exact: boolean
  similarity: number
}

/**
 * Yazılı cevabı değerlendirir.
 * - `exact`  : umlaut dahil tam eşleşme
 * - `correct`: katlanmış biçimde eşleşme veya benzerlik ≥ 0.85
 */
export function gradeTyped(given: string, accepted: readonly string[]): TypedGrade {
  const g = normalize(given)
  if (!g) return { correct: false, exact: false, similarity: 0 }
  let best = 0
  let exact = false
  for (const a of accepted) {
    if (normalize(a) === g) {
      exact = true
      best = 1
      break
    }
    const s = similarity(g, a)
    if (s > best) best = s
  }
  return { correct: exact || best >= 0.85, exact, similarity: best }
}

/** Bir öğe için kabul edilebilir Almanca yanıt biçimleri. */
export function acceptedForms(de: string, extra: readonly string[] = []): string[] {
  const forms = new Set<string>()
  const stripped = de.replace(/^(der|die|das)\s+/i, '').trim()
  forms.add(de)
  if (stripped !== de) forms.add(stripped)
  // "sich freuen" -> "freuen" da kabul edilir
  if (/^sich\s+/i.test(de)) {
    forms.add(de.replace(/^sich\s+/i, ''))
    forms.add(stripped.replace(/^sich\s+/i, ''))
  }
  // "anrufen (jdn.)" gibi parantezli ipuçlarını at
  const clean = (s: string) => s.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
  forms.add(clean(de))
  forms.add(clean(stripped))
  for (const e of extra) forms.add(e)
  return [...forms].filter(Boolean)
}
