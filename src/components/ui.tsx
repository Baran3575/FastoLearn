/** Küçük, tekrar kullanılabilir arayüz parçaları.
 *
 * Tasarım dili: yuvarlak köşeler, dolgun kenarlar, hap biçimli ölçüler.
 */

import type { ReactNode } from 'react'

const INK_2 = '#737373'
const INK_4 = '#a5a5a5'
const RULE = '#e5e9ef'
const BLUE = '#1cb0f6'

/** Halka göstergesi: yuvarlak uçlu, dolgun ilerleme. */
export function Ring({
  value,
  size = 104,
  stroke = 12,
  color = '#58cc02',
  track = '#e5e9ef',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {clamped > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * clamped} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)' }}
          />
        ) : null}
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}

/** Haftalık şerit: hangi gün çalışıldı. */
export function WeekStrip({ days }: { days: { key: string; on: boolean; today: boolean }[] }) {
  return (
    <div className="week-row" role="img" aria-label="Son yedi gün">
      {days.map((d) => (
        <span key={d.key} className={`week-cell${d.on ? ' on' : ''}${d.today ? ' today' : ''}`} />
      ))}
    </div>
  )
}

/**
 * Almanca sözcük: artikel, cinsiyet renginde yuvarlak bir plakada.
 * der/die/das renk kodu A1 derslerinin standardıdır (mavi/kırmızı/yeşil).
 */
export function WordDe({
  item,
  size,
}: {
  item: { de: string; article?: string | null }
  size?: number
}) {
  const art = item.article ?? null
  const rest =
    art && item.de.toLowerCase().startsWith(`${art.toLowerCase()} `)
      ? item.de.slice(art.length + 1)
      : item.de
  return (
    <span className="de" style={size ? { fontSize: size } : undefined}>
      {art ? <span className={`article art-${art}`}>{art}</span> : null}
      {rest}
    </span>
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
      <b className="k">{value}</b>
      <span>{label}</span>
      {hint ? <span className="faint">{hint}</span> : null}
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
    <div className="settings-row">
      <div>
        <b>{label}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
      {children}
    </div>
  )
}

/** Çizgi grafiği (trend / unutma eğrisi). */
export function Sparkline({
  points,
  height = 54,
  color = BLUE,
  max = 1,
  baseline,
  ticks = false,
}: {
  points: number[]
  height?: number
  color?: string
  max?: number
  baseline?: number
  ticks?: boolean
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
      {ticks
        ? [0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1="0"
              x2={w}
              y1={height * t}
              y2={height * t}
              stroke={RULE}
              strokeWidth="0.6"
              vectorEffect="non-scaling-stroke"
            />
          ))
        : null}
      {baseline != null ? (
        <line
          x1="0"
          x2={w}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke={INK_2}
          strokeOpacity="0.45"
          strokeDasharray="3 3"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Kalibrasyon grafiği: tahmin edilen olasılık ↔ gerçekleşen oran. */
export function CalibrationChart({ bins }: { bins: { predicted: number; actual: number; n: number }[] }) {
  const size = 138
  const pad = 16
  const scale = (v: number) => pad + v * (size - pad * 2)
  const maxN = Math.max(1, ...bins.map((b) => b.n))
  return (
    <svg width={size} height={size} aria-label="Kalibrasyon grafiği">
      <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} fill="none" stroke={RULE} />
      <line
        x1={pad}
        y1={size - pad}
        x2={size - pad}
        y2={pad}
        stroke={INK_2}
        strokeOpacity="0.5"
        strokeDasharray="3 3"
        strokeWidth="0.8"
      />
      <text x={size / 2} y={size - 3} fontSize="8.5" fill={INK_4} textAnchor="middle">
        tahmin
      </text>
      <text
        x={7}
        y={size / 2}
        fontSize="8.5"
        fill={INK_4}
        transform={`rotate(-90 7 ${size / 2})`}
        textAnchor="middle"
      >
        gerçek
      </text>
      {bins
        .filter((b) => b.n > 0)
        .map((b, i) => (
          <circle
            key={i}
            cx={scale(b.predicted)}
            cy={size - scale(b.actual)}
            r={2 + 5 * (b.n / maxN)}
            fill={BLUE}
            fillOpacity="0.3"
            stroke={BLUE}
            strokeWidth="1"
          />
        ))}
    </svg>
  )
}

export function MiniBar({
  label,
  value,
  max,
  suffix,
}: {
  label: string
  value: number
  max: number
  suffix?: string
}) {
  const pct = max > 0 ? value / max : 0
  return (
    <div className="horizon">
      <span className="faint">{label}</span>
      <Bar value={Math.min(1, pct)} thin />
      <span className="k faint" style={{ textAlign: 'right' }}>
        {suffix ?? value.toFixed(2)}
      </span>
    </div>
  )
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 60_000) return 'az önce'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} dk önce`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} saat önce`
  const days = Math.round(diff / 86_400_000)
  if (days === 1) return 'dün'
  if (days < 30) return `${days} gün önce`
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (!m) return `${s} sn`
  return `${m} dk ${s} sn`
}
