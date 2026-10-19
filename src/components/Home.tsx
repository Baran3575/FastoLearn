import { ITEMS, SECTIONS, SECTION_BY_ID, UNITS } from '../content'
import { dayKey } from '../engine/engine'
import { useStore } from '../state/store'
import {
  IconBolt,
  IconChevronRight,
  IconClock,
  IconFlame,
  IconLayers,
  IconOwl,
  IconPlay,
  IconStar,
  IconTarget,
  unitIcon,
} from './icons'
import { Bar, Ring, Sparkline } from './ui'

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

  const nextUp = engine.plan({ limit: 4 })
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

  return (
    <div className="stack">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">{greeting(Date.now())}</span>
          <h1>
            {user.name.split(' ')[0]}, hazır mısın?
          </h1>
          <p>{message}</p>
        </div>
        <div className="home-hero-side">
          <Ring value={goalDone} size={94} stroke={9}>
            <b>
              {today.reviews}
              <span className="faint" style={{ fontSize: 13 }}>
                /{today.goal}
              </span>
            </b>
            <small>günlük hedef</small>
          </Ring>
        </div>
      </section>

      <button
        className="continue-card"
        onClick={() => (nextSection ? onStart('lesson', nextSection.id) : onStart('mixed'))}
      >
        <span className="continue-icon">
          {nextSection ? <IconPlay size={24} /> : <IconClock size={24} />}
        </span>
        <span className="continue-copy">
          <small>
            {nextSection ? `Sıradaki bölüm · ${nextSection.order}/${SECTIONS.length}` : 'Günlük tekrar'}
          </small>
          <b>{nextSection ? nextSection.title : 'Kişiselleştirilmiş tur'}</b>
          <span>{nextSection ? nextSection.subtitle : 'Motorun senin için seçtiği kelimeler'}</span>
        </span>
        <span className="continue-go">
          Devam
          <IconChevronRight size={16} />
        </span>
      </button>

      <div className="stat-cards">
        <div className="mini-stat flame">
          <IconFlame size={17} />
          <b>{user.streak}</b>
          <span>gün seri</span>
        </div>
        <div className="mini-stat xp">
          <IconBolt size={17} />
          <b>{user.xp}</b>
          <span>toplam XP</span>
        </div>
        <div className="mini-stat words">
          <IconLayers size={17} />
          <b>
            {touched}
            <span style={{ fontSize: 13, color: 'var(--faint)' }}>/{ITEMS.length}</span>
          </b>
          <span>kelime</span>
        </div>
      </div>

      <div className="action-grid">
        <button className="action-card blue" disabled={cards.dueNow === 0} onClick={() => onStart('review')}>
          <span className="action-icon">
            <IconClock size={19} />
          </span>
          <span style={{ minWidth: 0 }}>
            <b>Tekrar</b>
            <small>{cards.dueNow > 0 ? `${cards.dueNow} kelimenin vakti geldi` : 'Şu an tekrar yok'}</small>
          </span>
        </button>

        <button className="action-card yellow" onClick={onOpenUnits}>
          <span className="action-icon">
            <IconTarget size={19} />
          </span>
          <span style={{ minWidth: 0 }}>
            <b>Müfredat</b>
            <small>
              {UNITS.length} ünite · {SECTIONS.length} bölüm
            </small>
          </span>
        </button>
      </div>

      <div className="card">
        <div className="row between">
          <h3 className="card-title" style={{ margin: 0 }}>
            <IconTarget size={13} /> Bugünün planı
          </h3>
          <span className="tiny faint">
            %{Math.round(goalDone * 100)}
          </span>
        </div>
        <Bar value={goalDone} good={goalDone >= 1} />
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="tiny faint">
            {today.reviews}/{today.goal} cevap
          </span>
          <span className="tiny faint">
            {cards.dueNow} tekrar · {Math.min(cards.fresh, 6)} yeni kelime
          </span>
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
        <div className="word-list" style={{ marginTop: 10 }}>
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
        <div className="tiny faint" style={{ marginTop: 10, lineHeight: 1.5 }}>
          Yüzdeler, cevabı doğru verme olasılığına dair motorun o anki tahminidir (RWKV-Instant + FSRS-7).
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h3 className="card-title" style={{ margin: 0 }}>
            Son 14 gün
          </h3>
          <span className="tiny faint">
            {total14} cevap · en iyi gün {maxDay}
          </span>
        </div>
        <div style={{ marginTop: 12 }}>
          <Sparkline points={last14} max={maxDay} height={64} />
        </div>
      </div>

      {weakSection ? (
        <div className="card">
          <h3 className="card-title">Biraz tekrar isteyen</h3>
          <div className="row between">
            <div className="row" style={{ gap: 12 }}>
              <div className="next-icon">
                {(() => {
                  const Icon = unitIcon(weakSection.id)
                  return <Icon size={17} />
                })()}
              </div>
              <div>
                <div className="de" style={{ fontSize: 16 }}>
                  {weakSection.title}
                </div>
                <div className="tiny faint">
                  {weakSection.subtitle} · {weak!.n} cevapta %{Math.round(weak!.accuracy * 100)} doğru
                </div>
              </div>
            </div>
            <button className="btn" onClick={() => onStart('lesson', weakSection.id)}>
              Çalış
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <Bar value={weak!.accuracy} thin />
          </div>
        </div>
      ) : null}

      <div className="card tight mascot-card">
        <div className="mascot">
          <IconOwl size={34} />
        </div>
        <div>
          <b style={{ fontSize: 14 }}>Küçük adımlar, büyük fark.</b>
          <div className="tiny faint" style={{ marginTop: 2, lineHeight: 1.5 }}>
            Günde 10 cevap bile bir ayda {Math.max(1, overall.reviews > 0 ? 300 : 300)} kelimeye yakın tekrar
            demek. Seriyi kırmamaya çalış — motor gerisini halleder.
          </div>
        </div>
      </div>
    </div>
  )
}
