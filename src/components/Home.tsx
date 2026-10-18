import { ITEMS, SECTIONS, SECTION_BY_ID, UNITS } from '../content'
import { dayKey } from '../engine/engine'
import { useStore } from '../state/store'
import {
  IconBolt,
  IconChevronRight,
  IconClock,
  IconFlame,
  IconLayers,
  IconPlay,
  IconStar,
  IconTarget,
  unitIcon,
} from './icons'
import { Bar, Ring, Sparkline, Stat } from './ui'

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

  const nextUp = engine.plan({ limit: 4 })
  const weakest = report.weakestThemes[0]
  const weakestUnit = weakest ? SECTION_BY_ID[weakest.unit] : undefined
  const learnedShare = cards.total ? (cards.young + cards.mature) / cards.total : 0
  const touched = cards.total - cards.fresh
  const goalLeft = Math.max(0, today.goal - today.reviews)

  // Sıradaki bölüm: hiç görülmemiş kelimesi olan en erken bölüm
  const nextSection = SECTIONS.find((s) =>
    ITEMS.some((i) => i.unit === s.id && (user.cards[i.id]?.reps ?? 0) === 0),
  )

  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-main">
          <div className="hero-eyebrow">{greeting(Date.now())}</div>
          <h1>Merhaba {user.name.split(' ')[0]}</h1>
          <p>
            {goalLeft > 0
              ? `Günlük hedefe ${goalLeft} cevap kaldı. ${touched > 0 ? 'Kaldığın yerden devam et.' : 'Hazırsan başlayalım.'}`
              : 'Bugünkü hedefini tamamladın. İstersen biraz daha tekrar yapabilirsin.'}
          </p>
          <div className="hero-chips">
            <span className="chip">
              <IconFlame size={14} />
              {user.streak} gün seri
            </span>
            <span className="chip">
              <IconBolt size={14} />
              {user.xp} XP
            </span>
            <span className="chip">
              <IconLayers size={14} />
              {touched}/{ITEMS.length} kelime
            </span>
          </div>
        </div>
        <Ring value={today.goal ? today.reviews / today.goal : 0} size={104}>
          <b>
            {today.reviews}
            <span className="faint" style={{ fontSize: 15 }}>
              /{today.goal}
            </span>
          </b>
          <small>günlük hedef</small>
        </Ring>
      </section>

      <div className="cta-grid">
        <button className="cta" onClick={() => onStart('mixed')}>
          <span className="cta-icon primary">
            <IconPlay size={22} />
          </span>
          <span className="cta-body">
            <b>Öğrenmeye başla</b>
            <small>
              {nextUp.filter((p) => p.isNew).length > 0
                ? `${nextUp.filter((p) => p.isNew).length} yeni kelime + tekrar`
                : 'Kişiselleştirilmiş tur'}
            </small>
          </span>
          <IconChevronRight size={18} />
        </button>

        <button className="cta" disabled={cards.dueNow === 0} onClick={() => onStart('review')}>
          <span className="cta-icon">
            <IconClock size={20} />
          </span>
          <span className="cta-body">
            <b>Tekrar</b>
            <small>{cards.dueNow > 0 ? `${cards.dueNow} kelimenin vakti geldi` : 'Şu an tekrar yok'}</small>
          </span>
          <IconChevronRight size={18} />
        </button>

        <button className="cta" onClick={onOpenUnits}>
          <span className="cta-icon">
            <IconTarget size={20} />
          </span>
          <span className="cta-body">
            <b>Müfredat</b>
            <small>
              {UNITS.length} ünite · {SECTIONS.length} bölüm
            </small>
          </span>
          <IconChevronRight size={18} />
        </button>
      </div>

      {nextSection ? (
        <div className="card next-section" style={{ ['--tint' as string]: SECTION_BY_ID[nextSection.id]?.unitId === 'temel' ? '#7c9cff' : '#b58cff' }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="row" style={{ gap: 12 }}>
              <div className="next-icon">
                {(() => {
                  const Icon = unitIcon(nextSection.id)
                  return <Icon size={18} />
                })()}
              </div>
              <div>
                <div className="tiny faint">
                  Sıradaki bölüm · {nextSection.order}/{SECTIONS.length}
                </div>
                <div className="de" style={{ fontSize: 17 }}>
                  {nextSection.title}
                </div>
                <div className="tiny faint">{nextSection.subtitle}</div>
              </div>
            </div>
            <button className="btn primary" onClick={() => onStart('lesson', nextSection.id)}>
              Başla
            </button>
          </div>
          <div className="tiny faint" style={{ marginTop: 10 }}>
            {nextSection.description}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="stat-row">
          <Stat label="Tekrar sırası" value={cards.dueNow} hint="vadesi geldi" />
          <Stat label="Kalıcı" value={`${Math.round(learnedShare * 100)}%`} hint={`${cards.mature} kelime`} />
          <Stat label="Doğruluk" value={`${Math.round(overall.accuracy * 100)}%`} hint={`${overall.reviews} cevap`} />
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h3 className="card-title" style={{ margin: 0 }}>
            Son 14 gün
          </h3>
          <span className="tiny faint">
            {last14.reduce((a, b) => a + b, 0)} cevap · en iyi gün {maxDay}
          </span>
        </div>
        <div style={{ marginTop: 12 }}>
          <Sparkline points={last14} max={maxDay} height={64} />
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h3 className="card-title" style={{ margin: 0 }}>
            Sıradaki kelimeler
          </h3>
          <button className="link-btn" onClick={onOpenEngine}>
            motoru gör
          </button>
        </div>
        <div className="stack" style={{ marginTop: 12, gap: 8 }}>
          {nextUp.map((p) => {
            const Icon = unitIcon(p.item.unit)
            return (
              <div key={p.item.id} className="next-row">
                <div className="next-icon">
                  <Icon size={17} />
                </div>
                <div className="unit-body">
                  <div className="de-title de">{p.item.de}</div>
                  <div className="tiny faint">{p.item.tr}</div>
                </div>
                <div className="next-meta">
                  <div className="tiny mono accent">
                    <IconStar size={11} /> {Math.round(p.pFinal * 100)}%
                  </div>
                  <div className="tiny faint">
                    {p.isNew ? 'yeni' : `${Math.max(0, Math.round(p.overdueDays))} gün gecikme`}
                  </div>
                </div>
              </div>
            )
          })}
          {!nextUp.length ? <div className="tiny faint">Şu an için plan boş.</div> : null}
        </div>
        <div className="tiny faint" style={{ marginTop: 12 }}>
          Yüzdeler, cevabı doğru verme olasılığına dair motorun o anki tahminidir (RWKV-Instant + FSRS-7).
        </div>
      </div>

      {weakestUnit ? (
        <div className="card">
          <h3 className="card-title">Zayıf halka</h3>
          <div className="row between">
            <div className="row" style={{ gap: 12 }}>
              <div className="next-icon">{(() => {
                const Icon = unitIcon(weakestUnit.id)
                return <Icon size={17} />
              })()}</div>
              <div>
                <div className="de" style={{ fontSize: 16 }}>
                  {weakestUnit.title}
                </div>
                <div className="tiny faint">
                  {weakestUnit.subtitle} · {weakest!.n} cevapta %{Math.round(weakest!.accuracy * 100)} doğru
                </div>
              </div>
            </div>
            <button className="btn" onClick={() => onStart('lesson', weakestUnit.id)}>
              Çalış
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <Bar value={weakest!.accuracy} thin />
          </div>
        </div>
      ) : null}
    </div>
  )
}
