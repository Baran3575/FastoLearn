import { useCallback, useEffect, useState } from 'react'
import { primeVoices } from './audio'
import { EnginePanel } from './components/EnginePanel'
import { HomeScreen } from './components/Home'
import { IconBolt, IconBrain, IconFlame, IconHome, IconTarget, IconUser, type IconComponent } from './components/icons'
import { ProfileScreen } from './components/Profile'
import { SessionScreen } from './components/Session'
import { SummaryScreen } from './components/Summary'
import { UnitsScreen } from './components/Units'
import { StudySession, type SessionSummary } from './session'
import { useStore } from './state/store'

type Tab = 'home' | 'units' | 'engine' | 'profile'

const TABS: { id: Tab; Icon: IconComponent; label: string }[] = [
  { id: 'home', Icon: IconHome, label: 'Öğren' },
  { id: 'units', Icon: IconTarget, label: 'Müfredat' },
  { id: 'engine', Icon: IconBrain, label: 'Motor' },
  { id: 'profile', Icon: IconUser, label: 'Profil' },
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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <IconBrain size={19} />
          </span>
          <span className="brand-text">
            FastoLearn
            <small>Türkçe → Almanca A1</small>
          </span>
        </div>

        <nav className="side-nav" aria-label="Ana menü">
          {TABS.map(({ id, Icon, label }) => (
            <button
              key={id}
              className={`side-link${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div className="side-hud">
            <span className="hud-chip flame" title="Gün serisi">
              <IconFlame size={14} />
              {user.streak}
            </span>
            <span className="hud-chip xp" title="Toplam XP">
              <IconBolt size={14} />
              {user.xp}
            </span>
          </div>
          <button className="side-user" onClick={() => setTab('profile')}>
            <span className="avatar">{initial}</span>
            <span style={{ minWidth: 0 }}>
              <b>{user.name}</b>
              <small>A0 · Yeni başlayan</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="brand-mark">
                <IconBrain size={17} />
              </span>
              <span className="brand-text">FastoLearn</span>
            </div>
            <div className="topbar-spacer" />
            <div className="hud">
              <span className="hud-chip flame" title="Gün serisi">
                <IconFlame size={14} />
                {user.streak}
              </span>
              <span className="hud-chip xp" title="Toplam XP">
                <IconBolt size={14} />
                {user.xp}
              </span>
            </div>
          </div>
        </header>

        <main className="shell">
          {tab === 'home' ? (
            <HomeScreen onStart={start} onOpenUnits={() => setTab('units')} onOpenEngine={() => setTab('engine')} />
          ) : tab === 'units' ? (
            <UnitsScreen onStart={(kind, unitId) => start(kind, unitId)} />
          ) : tab === 'engine' ? (
            <EnginePanel />
          ) : (
            <ProfileScreen />
          )}
        </main>

        <nav className="nav" aria-label="Alt menü">
          <div className="nav-inner">
            {TABS.map(({ id, Icon, label }) => (
              <button
                key={id}
                className={`nav-btn${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
