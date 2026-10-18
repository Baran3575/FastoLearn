/**
 * Almanca telaffuz: tarayıcının Web Speech API'si kullanılır.
 *
 * Yüklenen sesler arasından Almanca (de-DE / de-AT / de-CH) bir ses seçilir;
 * hiç ses yoksa konuşma sessizce atlanır ve arayüz kullanıcıyı bilgilendirir.
 */

export interface SpeakOptions {
  rate?: number
  pitch?: number
  onStart?: () => void
  onEnd?: () => void
}

let cachedVoice: SpeechSynthesisVoice | null | undefined
let voicesReady = false

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickGermanVoice(): SpeechSynthesisVoice | null {
  if (!speechAvailable()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const german = voices.filter((v) => /^de(-|_|$)/i.test(v.lang))
  if (!german.length) return null
  // de-DE tercih edilir, sonra yerel ses
  return (
    german.find((v) => /^de[-_]DE/i.test(v.lang) && v.localService) ??
    german.find((v) => /^de[-_]DE/i.test(v.lang)) ??
    german[0]
  )
}

/** Ses listesi gecikmeli gelebilir; bir kez yüklenmesini bekler. */
export function primeVoices(onReady?: (found: boolean) => void): void {
  if (!speechAvailable()) {
    onReady?.(false)
    return
  }
  const ready = () => {
    cachedVoice = pickGermanVoice()
    voicesReady = true
    onReady?.(cachedVoice != null)
  }
  if (window.speechSynthesis.getVoices().length) {
    ready()
    return
  }
  const handler = () => {
    window.speechSynthesis.removeEventListener('voiceschanged', handler)
    ready()
  }
  window.speechSynthesis.addEventListener('voiceschanged', handler)
  // Bazı tarayıcılarda olay tetiklenmez
  setTimeout(handler, 800)
}

export function germanVoiceName(): string | null {
  if (!voicesReady) cachedVoice = pickGermanVoice()
  return cachedVoice?.name ?? null
}

export function cancelSpeech(): void {
  if (speechAvailable()) window.speechSynthesis.cancel()
}

/** Almanca metni okur. Söz dizisi (SSML) kullanılmaz — geniş tarayıcı desteği. */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!speechAvailable() || !text.trim()) {
    options.onEnd?.()
    return
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = cachedVoice ?? pickGermanVoice()
  cachedVoice = voice
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang ?? 'de-DE'
  utterance.rate = options.rate ?? 0.92
  utterance.pitch = options.pitch ?? 1
  let ended = false
  const end = () => {
    if (ended) return
    ended = true
    options.onEnd?.()
  }
  utterance.onend = end
  utterance.onerror = end
  options.onStart?.()
  synth.speak(utterance)
}

/** Artikelli isimleri doğal okumak için: "der Apfel" -> "der Apfel" */
export function speakable(text: string): string {
  return text.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
}
