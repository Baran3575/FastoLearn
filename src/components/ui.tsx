/** Küçük, tekrar kullanılabilir arayüz parçaları. */

import type { ReactNode } from 'react'

export function Ring({
  value,
  size = 92,
  stroke = 8,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e5e5" strokeWidth={stroke} />
        {clamped > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#ringgrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * clamped} ${c}`}
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)' }}
          />
        ) : null}
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#58cc02" />
            <stop offset="100%" stopColor="#89e219" />
          </linearGradient>
        </defs>
      </svg>
      {children ? <div className="ring-label">{children}</div> : null}
    </div>
  )
}

export function Bar({ value, good = false, thin = false }: { value: number; good?: boolean; thin?: boolean }) {
  return (
    <div className={`bar${good ? ' good' : ''}${thin ? ' thin' : ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <b className="num">{value}</b>
      <small>{label}</small>
      {hint ? <div className="tiny faint">{hint}</div> : null}
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {hint ? <div className="tiny faint">{hint}</div> : null}
      </div>
      {children}
    </div>
  )
}

/** Basit çizgi grafiği (kalibrasyon / trend). */
export function Sparkline({
  points,
  height = 54,
  color = '#58cc02',
  max = 1,
  baseline,
}: {
  points: number[]
  height?: number
  color?: string
  max?: number
  baseline?: number
}) {
  if (points.length < 2) return <div className="tiny faint">Yeterli veri yok</div>
  const w = 100
  const step = w / (points.length - 1)
  const y = (v: number) => height - (Math.max(0, Math.min(max, v)) / max) * (height - 6) - 3
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      aria-hidden
    >
      {baseline != null ? (
        <line x1="0" x2={w} y1={y(baseline)} y2={y(baseline)} stroke="rgba(0,0,0,0.14)" strokeDasharray="3 3" strokeWidth="0.6" />
      ) : null}
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Kalibrasyon grafiği: tahmin edilen olasılık ↔ gerçekleşen oran. */
export function CalibrationChart({
  bins,
}: {
  bins: { predicted: number; actual: number; n: number }[]
}) {
  const size = 132
  const pad = 14
  const scale = (v: number) => pad + v * (size - pad * 2)
  const maxN = Math.max(1, ...bins.map((b) => b.n))
  return (
    <svg width={size} height={size} aria-label="Kalibrasyon grafiği">
      <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} fill="#f7f7f7" rx="10" />
      <line x1={pad} y1={size - pad} x2={size - pad} y2={pad} stroke="rgba(0,0,0,0.16)" strokeDasharray="3 3" strokeWidth="0.8" />
      <text x={size / 2} y={size - 2} fontSize="8" fill="#afafaf" textAnchor="middle">
        tahmin
      </text>
      <text x={6} y={size / 2} fontSize="8" fill="#afafaf" transform={`rotate(-90 6 ${size / 2})`} textAnchor="middle">
        gerçek
      </text>
      {bins
        .filter((b) => b.n > 0)
        .map((b, i) => (
          <circle
            key={i}
            cx={scale(b.predicted)}
            cy={size - scale(b.actual)}
            r={2.5 + 5 * (b.n / maxN)}
            fill="#1cb0f6"
            fillOpacity="0.35"
            stroke="#1899d6"
            strokeWidth="1"
          />
        ))}
    </svg>
  )
}

/** Oturum sonunda küçük bir kutlama. */
export function Confetti() {
  const colors = ['#7c9cff', '#b58cff', '#4bd6a0', '#ffcc66', '#ff7189']
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 9) * 90}ms`,
            animationDuration: `${1200 + (i % 5) * 220}ms`,
          }}
        />
      ))}
    </div>
  )
}

export function MiniBar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? value / max : 0
  return (
    <div className="horizon">
      <span className="faint">{label}</span>
      <div className="horizon-bar">
        <i style={{ width: `${Math.max(2, Math.min(1, pct) * 100)}%` }} />
      </div>
      <span className="mono faint" style={{ textAlign: 'right' }}>
        {suffix ?? value.toFixed(2)}
      </span>
    </div>
  )
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 60_000) return 'az önce'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} dk önce`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} sa önce`
  const days = Math.round(diff / 86_400_000)
  if (days === 1) return 'dün'
  if (days < 30) return `${days} gün önce`
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (!m) return `${s} sn`
  return `${m} dk ${s} sn`
}
