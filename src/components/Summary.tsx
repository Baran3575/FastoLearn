import { useEffect } from 'react'
import { useStore } from '../state/store'
import type { SessionSummary } from '../session'
import { sfxComplete } from '../sfx'
import { IconBolt, IconCheck, IconClock, IconFlame, IconHome, IconLayers, IconRepeat, IconSparkles, IconTarget } from './icons'
import { Confetti, Ring, Stat, formatDuration } from './ui'

interface Props {
  summary: SessionSummary
  onHome: () => void
  onAgain: () => void
}

export function SummaryScreen({ summary, onHome, onAgain }: Props) {
  const store = useStore()
  const overall = store.statsOverall()
  const celebrate = summary.accuracy >= 0.8 && summary.reviews >= 5
  const secPerItem = summary.reviews ? summary.avgMs / 1000 : 0
  const headline =
    summary.accuracy >= 0.9 ? 'Harika iş!' : summary.accuracy >= 0.7 ? 'İyi gidiyorsun' : 'Devam et'

  useEffect(() => {
    if (celebrate && store.activeUser().settings.soundEnabled) sfxComplete()
  }, [celebrate, store])

  return (
    <div className="stack">
      {celebrate ? <Confetti /> : null}

      <div className="card summary-hero">
        <Ring value={summary.accuracy} size={140} stroke={11}>
          <b>
            <span className="score-big">{Math.round(summary.accuracy * 100)}</span>
            <span className="faint" style={{ fontSize: 20 }}>
              %
            </span>
          </b>
          <small>
            {summary.correct}/{summary.reviews} doğru
          </small>
        </Ring>
        <h2>{headline}</h2>
        <p className="muted small">
          <IconClock size={14} /> {formatDuration(summary.durationMs)} · ortalama {secPerItem.toFixed(1)} sn/cevap
        </p>
        <div className="hero-chips" style={{ justifyContent: 'center' }}>
          <span className="chip">
            <IconBolt size={14} /> +{summary.xp} XP
          </span>
          <span className="chip">
            <IconFlame size={14} /> {overall.streak} gün
          </span>
          <span className="chip">
            <IconTarget size={14} /> {summary.firstTryCorrect} ilk denemede
          </span>
        </div>
      </div>

      <div className="card">
        <div className="stat-row">
          <Stat label="Çalışılan kelime" value={summary.distinctItems} />
          <Stat label="Toplam cevap" value={summary.reviews} />
          <Stat label="Yeni kelime" value={summary.newItems} />
        </div>
      </div>

      <div className="card">
        <div className="kv">
          <span className="faint">
            <IconCheck size={13} /> Doğru cevap
          </span>
          <span className="mono">
            {summary.correct}/{summary.reviews}
          </span>
        </div>
        <div className="kv">
          <span className="faint">
            <IconLayers size={13} /> Bugüne kadar
          </span>
          <span className="mono">{overall.reviews} cevap</span>
        </div>
        <div className="kv">
          <span className="faint">
            <IconSparkles size={13} /> Genel doğruluk
          </span>
          <span className="mono">%{Math.round(overall.accuracy * 100)}</span>
        </div>
      </div>

      <div className="answer-bar static">
        <div className="grid-2">
          <button className="btn primary lg" onClick={onHome}>
            <IconHome size={18} />
            Ana sayfa
          </button>
          <button className="btn lg" onClick={onAgain}>
            <IconRepeat size={18} />
            Yeni tur
          </button>
        </div>
      </div>

      <div className="card tight">
        <div className="tiny faint">
          Arka planda motor güncellendi: RWKV-Instant bir adım daha öğrendi, FSRS-7 bellek eğrin yeniden hesaplandı
          ve bir sonraki tekrar tarihi kişisel hedef hatırlanma oranına göre kaydırıldı.
        </div>
      </div>
    </div>
  )
}
