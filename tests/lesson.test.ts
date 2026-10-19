// @vitest-environment jsdom
/**
 * Ders akışı: tanıtım → alıştırma → geri bildirim → oturum özeti.
 *
 * Bu test, "Kontrol et" düğmesinin gerçekten geri bildirim ürettiğini ve
 * dersin sonuna kadar ilerleyebildiğini doğrular (geçmişte burada bir hata
 * vardı: `setFeedback` çağrılmıyordu ve ders kilitleniyordu).
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { SessionScreen } from '../src/components/Session'
import { StudySession, type SessionSummary } from '../src/session'
import { store } from '../src/state/store'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function click(el: Element | null) {
  expect(el).not.toBeNull()
  act(() => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('ders akışı', () => {
  it('tanıtımdan alıştırmaya geçer, geri bildirim gösterir ve oturumu bitirir', () => {
    const engine = store.engine()
    const session = new StudySession(engine, {
      kind: 'lesson',
      unitId: 'begruessung',
      limit: 3,
      introSize: 2,
      seed: 7,
    })

    let summary: SessionSummary | null = null
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        createElement(SessionScreen, {
          session,
          speechOk: false,
          showPredictions: true,
          onFinished: (s) => {
            summary = s
          },
          onExit: () => {},
          onGraded: () => {},
        }),
      )
    })

    const q = (sel: string) => container.querySelector(sel)

    let guard = 0
    while (session.phase === 'intro' && guard < 20) {
      guard += 1
      click(q('.answer-bar .btn'))
    }
    expect(q('.ws')).not.toBeNull()

    guard = 0
    while (!summary && guard < 60) {
      guard += 1
      const view = session.current
      expect(view).not.toBeNull()
      if (!view) break

      if (view.choices.length) {
        const correct =
          view.choices.find((c) => engine.evaluate(view.item, view.kind, c).correct) ?? view.choices[0]
        const buttons = Array.from(container.querySelectorAll('.ws-choice'))
        click(buttons[view.choices.indexOf(correct)] ?? buttons[0])
      } else if (view.tiles.length) {
        // Cümleyi doğru sırayla kurmayı dene; bulunamayan karo olursa ilk karo yeter.
        const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:„“"']/g, '')
        const words = norm(view.item.ex ?? '').split(/\s+/).filter(Boolean)
        for (const word of words) {
          const tiles = Array.from(container.querySelectorAll('.ws-bank .ws-tile'))
          const tile = tiles.find((t) => norm(t.textContent ?? '') === word)
          if (tile) click(tile)
        }
        if (!q('.ws-tile.placed')) click(q('.ws-bank .ws-tile'))
      } else {
        const input = q('.ws-answer-input') as HTMLInputElement
        const candidates = [view.item.de, view.item.article ?? '', view.item.ex ?? '', view.item.tr]
        const good =
          candidates.find((c) => c && engine.evaluate(view.item, view.kind, c).correct) ?? view.item.de
        setInput(input, good)
      }

      const check = q('.answer-bar .btn') as HTMLButtonElement
      expect(check.disabled).toBe(false)
      click(check)
      expect(q('.correction')).not.toBeNull()

      const next = q('.answer-bar .btn') as HTMLButtonElement
      click(next)
    }

    expect(summary).not.toBeNull()
    expect(summary!.reviews).toBeGreaterThan(0)
    expect(summary!.correct).toBeGreaterThan(0)

    act(() => root.unmount())
    container.remove()
  })
})
