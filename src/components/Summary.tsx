import { useEffect } from 'react'
import { useStore } from '../state/store'
import type { SessionSummary } from '../session'
import { sfxComplete } from '../sfx'
import { IconBolt, IconClock, IconFlame, IconHome, IconRepeat, IconTarget } from './icons'
import { Stat, formatDuration } from './ui'

interface Props {
  summary: SessionSummary
  onHome: () => void
  onAgain: () => void
}

/**
 * Özet bir ders raporu gibi: üstte kaşe, altta sayılar defteri.
 * İyi bir turda "BESTANDEN" damgası vurulur.
 */
export function SummaryScreen({ summary, onHome, onAgain }: Props) {
  const store = useStore()
  const overall = store.statsOverall()
  const passed = summary.accuracy >= 0.8 && summary.reviews >= 5
  const secPerItem = summary.reviews ? summary.avgMs / 1000 : 0
  const headline =
    summary.accuracy >= 0.9 ? 'Harika iş!' : summary.accuracy >= 0.7 ? 'İyi gidiyorsun' : 'Devam et'

  useEffect(() => {
    if (passed && store.activeUser().settings.soundEnabled) sfxComplete()
  }, [passed, store])

  return (
    <div className="stack">
      <div className="report">
        <div className="report-stamp">
          <div className={`stamp${passed ? '' : ' warn'}`}>{passed ? 'Bestanden' : 'Geschafft'}</div>
          <p>{passed ? 'Bu tur geçti sayılır.' : 'Tur tamamlandı; bir sonrakinde daha iyisini yapacaksın.'}</p>
        </div>

        <div className="report-headline">
          <span className="figure k">{Math.round(summary.accuracy * 100)}%</span>
          <div>
            <b style={{ fontSize: 17 }}>{headline}</b>
            <div className="small muted">
              {summary.correct}/{summary.reviews} doğru · {formatDuration(summary.durationMs)} · ortalama{' '}
              {secPerItem.toFixed(1)} sn/cevap
            </div>
          </div>
        </div>

        <div className="stat-strip" style={{ marginTop: 18 }}>
          <Stat label="çalışılan kelime" value={summary.distinctItems} />
          <Stat label="toplam cevap" value={summary.reviews} />
          <Stat label="yeni kelime" value={summary.newItems} />
        </div>

        <div className="ledger">
          <div className="ledger-row">
            <span>
              <IconTarget size={13} /> İlk denemede doğru
            </span>
            <b className="k">{summary.firstTryCorrect}</b>
          </div>
          <div className="ledger-row">
            <span>
              <IconBolt size={13} /> Kazanılan XP
            </span>
            <b className="k">+{summary.xp}</b>
          </div>
          <div className="ledger-row">
            <span>
              <IconFlame size={13} /> Gün serisi
            </span>
            <b className="k">{overall.streak} gün</b>
          </div>
          <div className="ledger-row">
            <span>
              <IconClock size={13} /> Bugüne kadar
            </span>
            <b className="k">
              {overall.reviews} cevap · %{Math.round(overall.accuracy * 100)} doğru
            </b>
          </div>
        </div>

        <div className="report-actions">
          <button className="btn btn-signal btn-block btn-lg" onClick={onHome}>
            <IconHome size={17} />
            Ana sayfa
          </button>
          <button className="btn btn-block btn-lg" onClick={onAgain}>
            <IconRepeat size={17} />
            Yeni tur
          </button>
        </div>

        <p className="report-note">
          Arka planda motor güncellendi: RWKV-Instant bir adım daha öğrendi, FSRS-7 bellek eğrin yeniden hesaplandı
          ve bir sonraki tekrar tarihi kişisel hedef hatırlanma oranına göre kaydırıldı.
        </p>
      </div>
    </div>
  )
}
