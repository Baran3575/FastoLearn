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
  { id: 'units', Icon: IconTarget, label: 'Üniteler' },
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

  const inSession = session != null

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">
              <IconBrain size={17} />
            </span>
            <span className="brand-text">
              FastoLearn
              <small>Türkçe → Almanca A1</small>
            </span>
          </div>

          <div className="topbar-spacer" />

          <div className="hud">
            <span className="hud-chip flame" title="Gün serisi">
              <IconFlame size={15} />
              {user.streak}
            </span>
            <span className="hud-chip xp" title="Toplam XP">
              <IconBolt size={15} />
              {user.xp}
            </span>
          </div>

          {!inSession && !summary ? (
            <nav className="topnav">
              {TABS.map(({ id, Icon, label }) => (
                <button key={id} className={`nav-btn${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      <main className="shell">
        {inSession && session ? (
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
        ) : tab === 'home' ? (
          <HomeScreen onStart={start} onOpenUnits={() => setTab('units')} onOpenEngine={() => setTab('engine')} />
        ) : tab === 'units' ? (
          <UnitsScreen onStart={(kind, unitId) => start(kind, unitId)} />
        ) : tab === 'engine' ? (
          <EnginePanel />
        ) : (
          <ProfileScreen />
        )}
      </main>

      {!inSession && !summary ? (
        <nav className="nav">
          <div className="nav-inner">
            {TABS.map(({ id, Icon, label }) => (
              <button key={id} className={`nav-btn${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
