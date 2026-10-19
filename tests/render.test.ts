/**
 * Duman testi: ekranlar sunucu tarafında (DOM'suz) hatasız çizilebilmeli.
 * Amaç görsel doğrulama değil, çalışma zamanı hatası yakalamaktır.
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EnginePanel } from '../src/components/EnginePanel'
import { HomeScreen } from '../src/components/Home'
import { ProfileScreen } from '../src/components/Profile'
import { SessionScreen } from '../src/components/Session'
import { SummaryScreen } from '../src/components/Summary'
import { UnitsScreen } from '../src/components/Units'
import { StudySession } from '../src/session'
import { store } from '../src/state/store'

const T0 = Date.UTC(2026, 0, 12, 9, 0, 0)

describe('ekran duman testi', () => {
  it('Öğren ekranı çizilir ve sıradaki bölümü önerir', () => {
    const html = renderToStaticMarkup(
      createElement(HomeScreen, { onStart: () => {}, onOpenUnits: () => {}, onOpenEngine: () => {} }),
    )
    expect(html).toContain('continue-card')
    expect(html).toContain('Sıradaki bölüm')
    expect(html).toContain('Hallo!')
    expect(html).toContain('günlük hedef')
  })

  it('Müfredat ekranı 2 ünite ve 10+10 bölümü yol olarak gösterir', () => {
    const html = renderToStaticMarkup(createElement(UnitsScreen, { onStart: () => {} }))
    expect(html).toContain('Erste Schritte')
    expect(html).toContain('Mein Alltag')
    expect(html).toContain('10 bölüm')
    expect(html.match(/path-node/g)?.length).toBeGreaterThanOrEqual(20)
    // A0 başlangıcı: ilk bölüm açık, sonrakiler kilitli
    expect(html).toContain('Hallo!')
    expect(html).toContain('Kilitli')
  })

  it('Motor ekranı basit görünümde sade dille anlatır', () => {
    const html = renderToStaticMarkup(createElement(EnginePanel))
    expect(html).toContain('Seni tanıyor mu?')
    expect(html).toContain('Tekrar takvimi')
    expect(html).toContain('RWKV-Instant')
  })

  it('Profil ekranı sıralı müfredat anahtarını içerir', () => {
    const html = renderToStaticMarkup(createElement(ProfileScreen))
    expect(html).toContain('Sıralı müfredat')
  })

  it('ders oturumu önce kelime kartını çizer', () => {
    const engine = store.engine()
    const session = new StudySession(engine, { kind: 'lesson', unitId: 'begruessung', limit: 12, now: T0 })
    expect(session.phase).toBe('intro')
    const html = renderToStaticMarkup(
      createElement(SessionScreen, {
        session,
        speechOk: false,
        showPredictions: true,
        onFinished: () => {},
        onExit: () => {},
        onGraded: () => {},
      }),
    )
    expect(html.length).toBeGreaterThan(200)
    expect(html).toContain('Hallo')
  })

  it('özet ekranı çizilir', () => {
    const engine = store.engine()
    const session = new StudySession(engine, { kind: 'mixed', limit: 4, now: T0 })
    let view = session.advance(T0)
    let guard = 0
    while (view && guard < 60) {
      guard += 1
      session.submit(view.item.de, T0 + guard * 2000)
      view = session.advance(T0 + guard * 2000)
    }
    const summary = session.summary(T0 + 600_000)
    const html = renderToStaticMarkup(
      createElement(SummaryScreen, { summary, onHome: () => {}, onAgain: () => {} }),
    )
    expect(html).toContain('%')
    expect(html.length).toBeGreaterThan(200)
  })
})
