import {
  CONTENT_STATS,
  SECTION_COUNTS,
  SECTIONS_WITH_ITEMS,
  UNITS,
  ITEMS_BY_SECTION,
  type Section,
} from '../content'
import { useStore } from '../state/store'
import { IconCheck, IconLock, IconOwl, unitIcon } from './icons'
import { Bar } from './ui'

interface Props {
  onStart: (kind: 'lesson', unitId: string) => void
}

/** Yol düzeni: düğümler hafifçe sağa/sola kayarak iner (yuvarlak izlek). */
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

/**
 * Müfredat, yuvarlak düğümlerden oluşan bir izlek gibi çizilir: her ünite
 * renkli bir başlıkla başlar, bölümler sırayla açılan düğümlerdir.
 */
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
      <header className="page-head">
        <div>
          <h1 className="page-title">Müfredat</h1>
          <p className="page-note">
            A0'dan başla: {UNITS.length} ünite, {SECTIONS_WITH_ITEMS.length} bölüm, {CONTENT_STATS.items} kelime.
            Her bölümde önce kelimeler tanıtılır, sonra sorular gelir.
          </p>
        </div>
        <div className="page-meta">
          <label>Tamamlanan bölüm</label>
          <b className="k">
            {doneSections}
            <span>/{SECTIONS_WITH_ITEMS.length}</span>
          </b>
          <label>{active ? `sırada ${active.section.title}` : 'hepsi tamam'}</label>
        </div>
      </header>

      {UNITS.map((unit) => {
        const sections = states.filter((st) => st.section.unitId === unit.id)
        const unitDone = sections.filter((st) => st.done).length
        const unitItems = sections.reduce(
          (n, st) => n + (ITEMS_BY_SECTION.get(st.section.id)?.length ?? 0),
          0,
        )
        return (
          <section key={unit.id} className="unit" style={{ ['--tint' as string]: unit.tint }}>
            <header className="unit-banner">
              <span className="unit-badge">Ünite {unit.order}</span>
              <div className="unit-banner-copy">
                <div className="unit-title">
                  <span className="de">{unit.title}</span>
                  <span>{unit.subtitle}</span>
                </div>
                <p className="unit-desc">{unit.description}</p>
                <div className="unit-progress">
                  <Bar
                    value={sections.length ? unitDone / sections.length : 0}
                    thin
                  />
                  <span>
                    {unitDone}/{sections.length} bölüm
                  </span>
                </div>
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
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="path-row-inner" style={{ ['--x' as string]: `${offset}px` }}>
                      <div className="path-node-wrap">
                        {isActive ? <span className="path-bubble">Sırada</span> : null}
                        <button
                          className={`path-node ${st.done ? 'done' : isActive ? 'active' : st.unlocked ? 'open' : 'locked'}`}
                          disabled={!st.unlocked}
                          onClick={() => onStart('lesson', st.section.id)}
                          aria-label={`${st.section.title} — ${label}`}
                        >
                          <span className="path-node-ring" aria-hidden />
                          <span className="path-node-core">
                            {st.done ? (
                              <IconCheck size={30} />
                            ) : st.unlocked ? (
                              <Icon size={29} />
                            ) : (
                              <IconLock size={23} />
                            )}
                          </span>
                        </button>
                        {st.due > 0 && st.unlocked ? <span className="path-badge">{st.due}</span> : null}
                      </div>

                      <div className="path-caption">
                        <span className="de">{st.section.title}</span>
                        <span>{st.section.subtitle}</span>
                        <span className="path-chip">
                          {st.done
                            ? `%${Math.round(st.progress * 100)} tamamlandı`
                            : isActive
                              ? 'Devam ediyor'
                              : st.unlocked
                                ? st.accuracy != null
                                  ? `%${Math.round(st.accuracy * 100)} doğru`
                                  : 'Yeni bölüm'
                                : 'Kilitli'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="unit-foot">
              <span>
                {unitItems} kelime · bölüm {sections[0]?.section.order ?? '—'}–
                {sections[sections.length - 1]?.section.order ?? '—'}
              </span>
              <span>
                {unitDone === sections.length ? 'ünite tamamlandı' : `${sections.length - unitDone} bölüm kaldı`}
              </span>
            </div>
          </section>
        )
      })}

      <div className="tip-block">
        <span className="tip-mark" aria-hidden>
          <IconOwl size={30} />
        </span>
        <div>
          <b>Sıfırdan başlıyorsun, endişelenme.</b>
          <p>
            İlk bölüm yalnızca {SECTION_COUNTS['begruessung'] ?? 20} temel kelimeyle başlar: merhaba, teşekkür,
            evet/hayır. Yeni bölümler, öncekini tamamlayınca açılır.
          </p>
        </div>
      </div>
    </div>
  )
}
