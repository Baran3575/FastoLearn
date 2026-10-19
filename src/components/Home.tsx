import { ITEMS, SECTIONS, SECTION_BY_ID, UNITS } from '../content'
import { dayKey } from '../engine/engine'
import { useStore } from '../state/store'
import {
  IconChevronRight,
  IconClock,
  IconOwl,
  IconPlay,
  IconTarget,
  unitIcon,
} from './icons'
import { Ring, Sparkline, Stat, WordDe } from './ui'

interface Props {
  onStart: (kind: 'mixed' | 'review' | 'lesson', unitId?: string) => void
  onOpenUnits: () => void
  onOpenEngine: () => void
}

function greeting(now: number): string {
  const h = new Date(now).getHours()
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

export function HomeScreen({ onStart, onOpenUnits, onOpenEngine }: Props) {
  const store = useStore()
  const user = store.activeUser()
  const engine = store.engine()
  const today = store.todayStats()
  const cards = engine.cardStats()
  const overall = store.statsOverall()
  const report = engine.personalizationReport()

  const last14: number[] = []
  for (let i = 13; i >= 0; i -= 1) {
    last14.push(user.daily[dayKey(Date.now() - i * 86_400_000)]?.reviews ?? 0)
  }
  const maxDay = Math.max(1, ...last14)
  const total14 = last14.reduce((a, b) => a + b, 0)

  const nextUp = engine.plan({ limit: 5 })
  const weak = report.weakestThemes[0]
  const weakSection = weak ? SECTION_BY_ID[weak.unit] : undefined

  const touched = cards.total - cards.fresh
  const goalLeft = Math.max(0, today.goal - today.reviews)
  const goalDone = today.goal > 0 ? Math.min(1, today.reviews / today.goal) : 0

  // Sıradaki bölüm: hiç görülmemiş kelimesi olan en erken bölüm (A0 sırası).
  const nextSection = SECTIONS.find((s) =>
    ITEMS.some((i) => i.unit === s.id && (user.cards[i.id]?.reps ?? 0) === 0),
  )

  const message =
    touched === 0
      ? 'Sıfırdan başlıyoruz. İlk ders yalnızca birkaç temel kelime sürüyor — hazır olduğunda başla.'
      : goalLeft > 0
        ? `Günlük hedefe ${goalLeft} cevap kaldı. Kaldığın yerden devam edebilirsin.`
        : 'Bugünkü hedefini tamamladın. İstersen birkaç tekrar daha yapabilirsin.'

  const firstName = user.name.split(' ')[0]

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="page-title">
            {greeting(Date.now())}, {firstName}.
          </h1>
          <p className="page-note">{message}</p>
        </div>
        <div className="page-meta">
          <label>Bugünkü hedef</label>
          <b className="k">
            {today.reviews}
            <span>/{today.goal}</span>
          </b>
          <label>{today.done ? 'tamamlandı' : `${goalLeft} cevap kaldı`}</label>
        </div>
      </header>

      <button
        className="continue-plate"
        onClick={() => (nextSection ? onStart('lesson', nextSection.id) : onStart('mixed'))}
      >
        <span className="continue-mark">
          {nextSection ? <IconPlay size={22} /> : <IconClock size={22} />}
        </span>
        <span className="continue-copy">
          <span>
            {nextSection ? `Sıradaki bölüm ${nextSection.order}/${SECTIONS.length}` : 'Günlük tekrar'}
          </span>
          <b>{nextSection ? nextSection.title : 'Kişiselleştirilmiş tur'}</b>
          <small>{nextSection ? nextSection.subtitle : 'Motorun senin için seçtiği kelimeler'}</small>
        </span>
        <span className="continue-go">
          Devam
          <IconChevronRight size={15} />
        </span>
      </button>

      <div className="stat-strip">
        <Stat label="gün seri" value={user.streak} hint={`en iyi ${user.bestStreak}`} />
        <Stat label="toplam XP" value={user.xp} hint={`%${Math.round(overall.accuracy * 100)} doğruluk`} />
        <Stat label="kelime" value={touched} hint={`${ITEMS.length} kelimeden`} />
      </div>

      <div className="action-grid">
        <button className="action-plate" disabled={cards.dueNow === 0} onClick={() => onStart('review')}>
          <span className="action-mark">
            <IconClock size={18} />
          </span>
          <span>
            <b>Tekrar turu</b>
            <small>{cards.dueNow > 0 ? `${cards.dueNow} kelimenin vakti geldi` : 'Şu an tekrar yok'}</small>
          </span>
        </button>

        <button className="action-plate" onClick={onOpenUnits}>
          <span className="action-mark">
            <IconTarget size={18} />
          </span>
          <span>
            <b>Müfredat</b>
            <small>
              {UNITS.length} ünite, {SECTIONS.length} bölüm
            </small>
          </span>
        </button>
      </div>

      <section className="block">
        <div className="sheet-head">
          <h2 className="sheet-title">Sıradaki kelimeler</h2>
          <button className="link-btn" onClick={onOpenEngine}>
            motoru gör
          </button>
        </div>
        <div className="list">
          {nextUp.map((p) => (
            <div key={p.item.id} className="word-row">
              <div className="word-main">
                <WordDe item={p.item} />
                <span>{p.item.tr}</span>
              </div>
              <div className="word-score">
                <b className="k">%{Math.round(p.pFinal * 100)}</b>
                <span>{p.isNew ? 'yeni kelime' : `${Math.max(0, Math.round(p.overdueDays))} gün gecikme`}</span>
                <div className="word-meter" aria-hidden>
                  <i style={{ width: `${Math.max(2, Math.round(p.pFinal * 100))}%` }} />
                </div>
              </div>
            </div>
          ))}
          {!nextUp.length ? <div className="small faint">Şu an için plan boş.</div> : null}
        </div>
        <p className="small faint" style={{ marginTop: 12, lineHeight: 1.5 }}>
          Yüzdeler, cevabı doğru verme olasılığına dair motorun o anki tahminidir (RWKV-Instant + FSRS-7).
        </p>
      </section>

      <div className="grid2">
        <section className="block">
          <div className="sheet-head">
            <h2 className="sheet-title">Bugünün planı</h2>
            <span className="tiny faint">%{Math.round(goalDone * 100)}</span>
          </div>
          <div className="gauge-holder">
            <Ring value={goalDone} size={112} stroke={13} color={goalDone >= 1 ? '#58cc02' : '#1cb0f6'}>
              <b className="k">
                {today.reviews}
                <span className="faint" style={{ fontSize: 14 }}>
                  /{today.goal}
                </span>
              </b>
              <span>günlük hedef</span>
            </Ring>
            <div className="plain-list" style={{ marginTop: 0 }}>
              <span>
                <IconClock size={13} /> {cards.dueNow} kelimenin tekrar vakti geldi.
              </span>
              <span>
                <IconTarget size={13} /> Bugün için {Math.min(cards.fresh, 6)} yeni kelime planlandı.
              </span>
              <span>
                <IconPlay size={13} /> Bir tur yaklaşık {Math.max(2, Math.round(user.settings.newPerSession * 1.6 + 3))}{' '}
                dakika sürer.
              </span>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="sheet-head">
            <h2 className="sheet-title">Son 14 gün</h2>
            <span className="tiny faint">
              {total14} cevap · en iyi gün {maxDay}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Sparkline points={last14} max={maxDay} height={78} ticks />
          </div>
          <p className="small faint" style={{ marginTop: 10 }}>
            Her çubuk bir gün. Boş günler sorun değil — motor kaldığı yerden devam eder.
          </p>
        </section>
      </div>

      {weakSection ? (
        <section className="block">
          <div className="weak-row">
            <span className="action-mark">
              {(() => {
                const Icon = unitIcon(weakSection.id)
                return <Icon size={18} />
              })()}
            </span>
            <div className="grow">
              <WordDe item={{ de: weakSection.title }} />
              <div className="small muted">{weakSection.subtitle}</div>
            </div>
            <div className="word-score" style={{ marginRight: 6 }}>
              <b className="k">%{Math.round(weak!.accuracy * 100)}</b>
              <span>{weak!.n} cevapta</span>
            </div>
            <button className="btn btn-sm" onClick={() => onStart('lesson', weakSection.id)}>
              Çalış
            </button>
          </div>
          <p className="small faint" style={{ marginTop: 10 }}>
            Bu bölümde doğruluk oranın ortalamanın altında; motor buradan gelen kelimeleri daha sık soracak.
          </p>
        </section>
      ) : null}

      <div className="tip-block">
        <span className="tip-mark" aria-hidden>
          <IconOwl size={30} />
        </span>
        <div>
          <b>Küçük adımlar, büyük fark.</b>
          <p>
            Günde 10 cevap bile bir ayda yüzlerce tekrar demek. Seriyi kırmamaya çalış — tekrar tarihlerini motor
            ayarlar.
          </p>
        </div>
      </div>
    </div>
  )
}
