import { useCallback, useEffect, useState } from 'react'
import { primeVoices } from './audio'
import { EnginePanel } from './components/EnginePanel'
import { HomeScreen } from './components/Home'
import {
  IconBolt,
  IconBrain,
  IconFlame,
  IconHome,
  IconTarget,
  IconUser,
  type IconComponent,
} from './components/icons'
import { ProfileScreen } from './components/Profile'
import { SessionScreen } from './components/Session'
import { SummaryScreen } from './components/Summary'
import { UnitsScreen } from './components/Units'
import { Bar, WeekStrip } from './components/ui'
import { dayKey } from './engine/engine'
import { StudySession, type SessionSummary } from './session'
import { useStore } from './state/store'

type Tab = 'home' | 'units' | 'engine' | 'profile'

/**
 * Ray, dosya dolabı gibi çalışır: her sekmenin küçük bir harfi vardır ve
 * açık olan sekme sayfa zeminine “çekilmiş” görünür.
 */
const TABS: { id: Tab; Icon: IconComponent; label: string; key: string }[] = [
  { id: 'home', Icon: IconHome, label: 'Öğren', key: 'A' },
  { id: 'units', Icon: IconTarget, label: 'Müfredat', key: 'B' },
  { id: 'engine', Icon: IconBrain, label: 'Motor', key: 'C' },
  { id: 'profile', Icon: IconUser, label: 'Profil', key: 'D' },
]

export function App() {
  const store = useStore()
  const user = store.activeUser()
  const [tab, setTab] = useState<Tab>('home')
  const [session, setSession] = useState<StudySession | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [speechOk, setSpeechOk] = useState(false)

  useEffect(() => {
    primeVoices(setSpeechOk)
  }, [])

  useEffect(() => {
    if (session) window.scrollTo({ top: 0 })
  }, [session])

  useEffect(() => {
    if (summary) window.scrollTo({ top: 0 })
  }, [summary])

  const start = useCallback(
    (kind: 'mixed' | 'review' | 'lesson', unitId?: string) => {
      setSummary(null)
      setSession(
        new StudySession(store.engine(), {
          kind,
          unitId,
          limit: kind === 'review' ? 30 : 14,
        }),
      )
    },
    [store],
  )

  const finish = useCallback(
    (s: SessionSummary) => {
      setSession(null)
      setTab('home')
      if (s.reviews > 0) {
        store.recordSession({
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          reviews: s.reviews,
          correct: s.correct,
          xp: s.xp,
          newItems: s.newItems,
          kind: s.kind,
        })
        store.afterReview()
        setSummary(s)
      } else {
        setSummary(null)
      }
    },
    [store],
  )

  const exitSession = useCallback(() => {
    setSession(null)
    setTab('home')
  }, [])

  const graded = useCallback(() => {
    store.afterReview()
  }, [store])

  /* Ders ve özet, gezinme olmadan tam ekran odak modunda gösterilir. */
  if (session || summary) {
    return (
      <div className="focus">
        <main className="focus-shell">
          {session ? (
            <SessionScreen
              session={session}
              speechOk={speechOk}
              showPredictions={user.settings.showPredictions}
              onFinished={finish}
              onExit={exitSession}
              onGraded={graded}
            />
          ) : summary ? (
            <SummaryScreen
              summary={summary}
              onHome={() => setSummary(null)}
              onAgain={() => {
                setSummary(null)
                start('mixed')
              }}
            />
          ) : null}
        </main>
      </div>
    )
  }

  const initial = user.name.slice(0, 1).toLocaleUpperCase('tr-TR')
  const today = store.todayStats()
  const goalValue = today.goal > 0 ? Math.min(1, today.reviews / today.goal) : 0
  const days = Array.from({ length: 7 }, (_, i) => {
    const ts = Date.now() - (6 - i) * 86_400_000
    const key = dayKey(ts)
    return { key, on: (user.daily[key]?.reviews ?? 0) > 0, today: i === 6 }
  })

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-brand">
          <span className="rail-mark" aria-hidden>
            F
          </span>
          <span className="rail-brand-text">
            <b>FastoLearn</b>
            <span>Türkçe → Almanca A1</span>
          </span>
        </div>

        <nav className="rail-nav" aria-label="Ana menü">
          {TABS.map(({ id, Icon, label, key }) => (
            <button
              key={id}
              className={`rail-tab${tab === id ? ' on' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <span className="tab-key" aria-hidden>
                {key}
              </span>
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="rail-goal">
            <span>Bugün</span>
            <span className="k">
              {today.reviews}/{today.goal}
            </span>
          </div>
          <Bar value={goalValue} good={goalValue >= 1} thin />
          <WeekStrip days={days} />
          <div className="rail-user">
            <span className="rail-user-mark">{initial}</span>
            <span className="rail-user-text">
              <b>{user.name}</b>
              <span>
                {user.streak} gün seri · {user.xp} XP
              </span>
            </span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="m-top">
          <span className="rail-mark" aria-hidden>
            F
          </span>
          <span className="rail-brand-text">
            <b>FastoLearn</b>
          </span>
          <div className="m-top-right">
            <span className="tag" title="Gün serisi">
              <IconFlame size={13} />
              {user.streak}
            </span>
            <span className="tag" title="Toplam XP">
              <IconBolt size={13} />
              {user.xp}
            </span>
          </div>
        </header>

        <main className="shell">
          {tab === 'home' ? (
            <HomeScreen
              onStart={start}
              onOpenUnits={() => setTab('units')}
              onOpenEngine={() => setTab('engine')}
            />
          ) : tab === 'units' ? (
            <UnitsScreen onStart={(kind, unitId) => start(kind, unitId)} />
          ) : tab === 'engine' ? (
            <EnginePanel />
          ) : (
            <ProfileScreen />
          )}
        </main>

        <nav className="m-nav" aria-label="Alt menü">
          {TABS.map(({ id, Icon, label }) => (
            <button
              key={id}
              className={`m-tab${tab === id ? ' on' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
