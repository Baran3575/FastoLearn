/**
 * Kısa geri bildirim sesleri (Web Audio API).
 *
 * Ses dosyası yok: doğru/yanlış/tur bitti sinyalleri küçük osilatör
 * tonlarıyla üretilir. Tarayıcı izin vermezse sessizce atlanır.
 */

let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  freq: number,
  delay: number,
  duration: number,
  gain = 0.055,
  type: OscillatorType = 'sine',
): void {
  const ac = audioContext()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(amp)
  amp.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.03)
}

/** Doğru cevap: kısa, parlak iki nota. */
export function sfxCorrect(): void {
  tone(880, 0, 0.11)
  tone(1318.5, 0.075, 0.16)
}

/** Yanlış cevap: yumuşak, alçak iki ton (kırıcı değil). */
export function sfxWrong(): void {
  tone(233.1, 0, 0.16, 0.045, 'triangle')
  tone(174.6, 0.1, 0.2, 0.045, 'triangle')
}

/** Tur bitti: kısa bir arpej. */
export function sfxComplete(): void {
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.095, 0.24))
}

/** Bölüm/kelime tanıtımı: tek yumuşak nota. */
export function sfxPop(): void {
  tone(660, 0, 0.09, 0.04)
}
