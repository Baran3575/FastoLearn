import { useState } from 'react'
import {
  CONTENT_STATS,
  ITEMS_BY_SECTION,
  SECTIONS_WITH_ITEMS,
  SECTION_COUNTS,
  SECTION_ORDER,
  UNITS,
} from '../content'
import { useStore } from '../state/store'
import { IconChevronRight, IconCheck, IconLayers, IconStar, unitIcon } from './icons'
import { Bar } from './ui'

interface Props {
  onStart: (kind: 'lesson', unitId: string) => void
}

export function UnitsScreen({ onStart }: Props) {
  const store = useStore()
  const user = store.activeUser()
  const [query, setQuery] = useState('')
  const now = Date.now()

  const q = query.trim().toLowerCase()
  const matches = (id: string) => {
    const s = SECTIONS_WITH_ITEMS.find((x) => x.id === id)
    if (!s) return false
    return (
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    )
  }

  // Sıradaki bölüm: görülmemiş ilk bölüm
  let nextSectionId: string | null = null
  for (const s of SECTIONS_WITH_ITEMS) {
    const items = ITEMS_BY_SECTION.get(s.id) ?? []
    const touched = items.some((i) => (user.cards[i.id]?.reps ?? 0) > 0)
    if (!touched) {
      nextSectionId = s.id
      break
    }
  }

  return (
    <div className="stack">
      <div>
        <h2>Müfredat</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          {UNITS.length} ünite · {SECTIONS_WITH_ITEMS.length} bölüm · {CONTENT_STATS.items} kelime. Sıfırdan
          başlıyorsun: 1. ünitede selamlaşma, sayılar ve renkler var.
        </p>
      </div>

      <input
        className="text-input"
        placeholder="Bölüm ara (ör. renkler, aile, Zahlen)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%' }}
      />

      {UNITS.map((unit) => {
        const sections = SECTIONS_WITH_ITEMS.filter((s) => s.unitId === unit.id && matches(s.id))
        if (!sections.length) return null
        return (
          <section key={unit.id} className="unit-block" style={{ ['--tint' as string]: unit.tint }}>
            <header className="unit-block-head">
              <div>
                <div className="unit-block-title">
                  <span className="unit-index">{unit.order}</span>
                  <span className="de">{unit.title}</span>
                  <span className="muted small">{unit.subtitle}</span>
                </div>
                <div className="tiny faint" style={{ marginTop: 4 }}>
                  {unit.description}
                </div>
              </div>
              <span className="chip tiny-chip">{SECTIONS_WITH_ITEMS.filter((s) => s.unitId === unit.id).length} bölüm</span>
            </header>

            <div className="stack" style={{ gap: 10 }}>
              {sections.map((section) => {
                const Icon = unitIcon(section.id)
                const items = ITEMS_BY_SECTION.get(section.id) ?? []
                const stat = user.themeStats[section.id]
                const accuracy = stat && stat.n > 0 ? stat.correct / stat.n : null
                let seen = 0
                let stable = 0
                let due = 0
                for (const item of items) {
                  const card = user.cards[item.id]
                  if (!card || card.reps === 0) continue
                  seen += 1
                  if ((card.stability ?? 0) >= 21) stable += 1
                  if (card.due <= now) due += 1
                }
                const progress = items.length ? seen / items.length : 0
                const done = items.length > 0 && seen === items.length
                const isNext = section.id === nextSectionId

                return (
                  <button
                    key={section.id}
                    className={`unit-card${isNext && !q ? ' is-next' : ''}`}
                    onClick={() => onStart('lesson', section.id)}
                  >
                    <div className="unit-emoji">
                      {done ? <IconCheck size={19} /> : <Icon size={20} />}
                    </div>
                    <div className="unit-body">
                      <div className="unit-head">
                        <span className="tiny faint mono">{String(section.order).padStart(2, '0')}</span>
                        <span className="de-title de">{section.title}</span>
                        {isNext && !q ? (
                          <span className="chip tiny-chip accent">
                            <IconStar size={10} /> sırada
                          </span>
                        ) : null}
                        {due > 0 ? (
                          <span className="chip tiny-chip bad">
                            <IconLayers size={10} />
                            {due} tekrar
                          </span>
                        ) : null}
                      </div>
                      <div className="tiny faint">
                        {section.subtitle} · {SECTION_COUNTS[section.id] ?? items.length} kelime
                      </div>
                      <div style={{ marginTop: 7 }}>
                        <Bar value={progress} thin good={done} />
                      </div>
                      <div className="unit-foot">
                        <span>{seen} görüldü</span>
                        <span>{stable} kalıcı</span>
                        {accuracy != null ? <span>%{Math.round(accuracy * 100)} doğru</span> : null}
                      </div>
                    </div>
                    <IconChevronRight size={17} />
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {!UNITS.some((u) => SECTIONS_WITH_ITEMS.some((s) => s.unitId === u.id && matches(s.id))) ? (
        <div className="empty">Aramana uyan bölüm yok.</div>
      ) : null}

      <div className="card tight">
        <div className="tiny faint">
          Sıra numaraları müfredat sırasıdır ({SECTION_ORDER[SECTIONS_WITH_ITEMS[0]?.id ?? ''] ?? 1}–{SECTIONS_WITH_ITEMS.length}).
          Bir bölüme dokununca önce yeni kelimeler tanıtılır, sonra alıştırmalar gelir. Tekrar sıklığını her zaman
          motor belirler.
        </div>
      </div>
    </div>
  )
}
