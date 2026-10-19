import {
  CONTENT_STATS,
  SECTION_COUNTS,
  SECTIONS_WITH_ITEMS,
  UNITS,
  ITEMS_BY_SECTION,
  type Section,
} from '../content'
import { useStore } from '../state/store'
import {
  IconCheck,
  IconLayers,
  IconLock,
  IconOwl,
  IconSparkles,
  IconStar,
  unitIcon,
} from './icons'
import { Bar } from './ui'

interface Props {
  onStart: (kind: 'lesson', unitId: string) => void
}

/** Yol (path) düzeni: düğümler hafifçe sağa/sola kayarak iner. */
const PATH_OFFSETS = [0, 58, 92, 58, 0, -58, -92, -58]

interface SectionState {
  section: Section
  seen: number
  due: number
  done: boolean
  progress: number
  accuracy: number | null
  unlocked: boolean
}

export function UnitsScreen({ onStart }: Props) {
  const store = useStore()
  const user = store.activeUser()
  const now = Date.now()

  const states: SectionState[] = SECTIONS_WITH_ITEMS.map((section) => {
    const items = ITEMS_BY_SECTION.get(section.id) ?? []
    let seen = 0
    let due = 0
    for (const item of items) {
      const card = user.cards[item.id]
      if (!card || card.reps === 0) continue
      seen += 1
      if (card.due <= now) due += 1
    }
    const stat = user.themeStats[section.id]
    return {
      section,
      seen,
      due,
      done: items.length > 0 && seen === items.length,
      progress: items.length ? seen / items.length : 0,
      accuracy: stat && stat.n > 0 ? stat.correct / stat.n : null,
      unlocked: false,
    }
  })

  // Sıralı açılım: tamamlanan bölümlerin bir sonrakini açar. Daha önce elle
  // çalışılmış bölümler de açık kalır (geriye dönük uyumluluk).
  let maxUnlocked = 1
  for (const st of states) {
    if (st.done) maxUnlocked = Math.min(SECTIONS_WITH_ITEMS.length, st.section.order + 1)
    else break
  }
  for (const st of states) {
    if (st.seen > 0) maxUnlocked = Math.max(maxUnlocked, st.section.order)
  }
  for (const st of states) st.unlocked = st.section.order <= maxUnlocked

  const active = states.find((st) => st.unlocked && !st.done && st.section.order === maxUnlocked) ?? null
  const doneSections = states.filter((st) => st.done).length

  return (
    <div className="stack">
      <div className="path-head">
        <div>
          <h2>Müfredat</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            A0'dan başla: {UNITS.length} ünite · {SECTIONS_WITH_ITEMS.length} bölüm · {CONTENT_STATS.items}{' '}
            kelime. Her bölümde önce kelimeler tanıtılır, sonra sorular gelir.
          </p>
        </div>
        <div className="path-head-progress">
          <div className="tiny faint">Bölüm</div>
          <div className="path-head-count">
            <b>{doneSections}</b>
            <span>/{SECTIONS_WITH_ITEMS.length}</span>
          </div>
        </div>
      </div>

      {UNITS.map((unit) => {
        const sections = states.filter((st) => st.section.unitId === unit.id)
        const unitDone = sections.filter((st) => st.done).length
        const unitItems = sections.reduce(
          (n, st) => n + (ITEMS_BY_SECTION.get(st.section.id)?.length ?? 0),
          0,
        )
        return (
          <section key={unit.id} className="path-unit" style={{ ['--tint' as string]: unit.tint }}>
            <header className="path-unit-head">
              <div className="path-unit-eyebrow">
                <IconSparkles size={11} /> Ünite {unit.order}
              </div>
              <div className="path-unit-title">
                <span className="de">{unit.title}</span>
                <span className="path-unit-sub">{unit.subtitle}</span>
              </div>
              <div className="path-unit-desc tiny faint">{unit.description}</div>
              <div className="path-unit-progress">
                <Bar value={sections.length ? unitDone / sections.length : 0} thin good={unitDone === sections.length} />
                <span>
                  {unitDone}/{sections.length} bölüm
                </span>
              </div>
            </header>

            <div className="path">
              {sections.map((st, i) => {
                const Icon = unitIcon(st.section.id)
                const isActive = active?.section.id === st.section.id
                const offset = PATH_OFFSETS[i % PATH_OFFSETS.length]
                const label = st.done ? 'tekrar et' : isActive ? 'başla' : st.unlocked ? 'çalış' : 'kilitli'
                return (
                  <div
                    key={st.section.id}
                    className={`path-row${isActive ? ' is-active' : ''}${st.done ? ' is-done' : ''}`}
                    style={{ ['--x' as string]: `${offset}px`, animationDelay: `${i * 35}ms` }}
                  >
                    <button
                      className={`path-node ${st.done ? 'done' : isActive ? 'active' : st.unlocked ? 'open' : 'locked'}`}
                      style={{ ['--p' as string]: `${Math.round(st.progress * 100)}%` }}
                      disabled={!st.unlocked}
                      onClick={() => onStart('lesson', st.section.id)}
                      aria-label={`${st.section.title} — ${label}`}
                    >
                      <span className="path-node-ring" aria-hidden />
                      <span className="path-node-core">
                        {st.done ? <IconCheck size={27} /> : st.unlocked ? <Icon size={26} /> : <IconLock size={22} />}
                      </span>
                      {st.due > 0 && st.unlocked ? <span className="path-badge">{st.due}</span> : null}
                    </button>

                    <div className="path-label">
                      <div className="path-label-title de">{st.section.title}</div>
                      <div className="path-label-sub">{st.section.subtitle}</div>
                      {isActive ? (
                        <span className="chip accent path-chip">
                          <IconStar size={10} /> Sırada
                        </span>
                      ) : st.done ? (
                        <span className="path-chip tiny faint">
                          <IconLayers size={10} /> %{Math.round(st.progress * 100)} tamam
                        </span>
                      ) : !st.unlocked ? (
                        <span className="path-chip tiny faint">
                          <IconLock size={10} /> Kilitli
                        </span>
                      ) : null}
                      {st.accuracy != null && st.unlocked ? (
                        <span className="path-chip tiny faint">%{Math.round(st.accuracy * 100)} doğru</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="path-unit-foot">
              <span className="tiny faint">
                {unitItems} kelime · bölüm {sections[0]?.section.order ?? '—'}–
                {sections[sections.length - 1]?.section.order ?? '—'}
              </span>
              <span className="tiny faint">
                {unitDone === sections.length ? 'ünite tamamlandı' : `${sections.length - unitDone} bölüm kaldı`}
              </span>
            </div>
          </section>
        )
      })}

      <div className="card tight mascot-card">
        <div className="mascot">
          <IconOwl size={38} />
        </div>
        <div>
          <b>Sıfırdan başlıyorsun, endişelenme.</b>
          <div className="tiny faint" style={{ marginTop: 3, lineHeight: 1.5 }}>
            İlk bölüm yalnızca {SECTION_COUNTS['begruessung'] ?? 20} temel kelimeyle başlar: merhaba, teşekkür,
            evet/hayır. Yeni bölümler, öncekini tamamlayınca açılır.
          </div>
        </div>
      </div>
    </div>
  )
}
