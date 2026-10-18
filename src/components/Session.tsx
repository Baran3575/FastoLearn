import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cancelSpeech, speak } from '../audio'
import { RATING_LABELS, humanInterval, type ExerciseView, type SessionSummary, type StudySession, type SubmitResult } from '../session'
import { EXERCISE_LABELS } from '../engine/types'
import {
  IconBolt,
  IconBulb,
  IconCheck,
  IconClose,
  IconInfo,
  IconVolume,
  posIcon,
  unitIcon,
} from './icons'

interface Props {
  session: StudySession
  speechOk: boolean
  showPredictions: boolean
  onFinished: (summary: SessionSummary) => void
  onExit: () => void
  onGraded: () => void
}

interface Tile {
  id: number
  word: string
}

const POS_LABELS: Record<string, string> = {
  noun: 'isim',
  verb: 'fiil',
  adj: 'sıfat',
  adv: 'zarf',
  prep: 'edat',
  pron: 'zamir',
  num: 'sayı',
  phrase: 'kalıp',
  other: 'kelime',
}

export function SessionScreen({ session, speechOk, showPredictions, onFinished, onExit, onGraded }: Props) {
  const [view, setView] = useState<ExerciseView | null>(null)
  const [intro, setIntro] = useState(session.currentIntro)
  const [feedback, setFeedback] = useState<SubmitResult | null>(null)
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [bank, setBank] = useState<Tile[]>([])
  const [placed, setPlaced] = useState<Tile[]>([])
  const [playing, setPlaying] = useState(false)
  const [hintLevel, setHintLevel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const advanceRef = useRef<() => void>(() => {})
  const inited = useRef(false)

  const total = session.total
  const inIntro = session.phase === 'intro'

  const advance = useCallback(() => {
    const next = session.advance()
    setFeedback(null)
    setInput('')
    setSelected(null)
    setHintLevel(0)
    setView(next)
    if (!next) onFinished(session.summary())
  }, [session, onFinished])

  advanceRef.current = advance

  useEffect(() => {
    if (inited.current) return
    inited.current = true
    if (session.phase === 'intro') setIntro(session.currentIntro)
    else advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // blok karolarını her yeni alıştırmada kur
  useEffect(() => {
    if (!view) return
    setBank(view.tiles.map((word, id) => ({ id, word })))
    setPlaced([])
  }, [view?.animationKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(
    (text: string) => {
      if (!speechOk) return
      setPlaying(true)
      speak(text, { onEnd: () => setPlaying(false) })
    },
    [speechOk],
  )

  useEffect(() => {
    if (view?.autoplay && view.audioText && !feedback) play(view.audioText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.animationKey])

  useEffect(() => {
    if (view && !feedback && !view.choices.length && !view.tiles.length) inputRef.current?.focus()
  }, [view, feedback])

  useEffect(() => () => cancelSpeech(), [])

  const assembled = useMemo(() => placed.map((t) => t.word).join(' '), [placed])

  const canSubmit = useMemo(() => {
    if (!view) return false
    if (view.tiles.length) return placed.length > 0
    if (view.choices.length) return selected != null
    return input.trim().length > 0
  }, [view, placed, selected, input])

  const submit = useCallback(() => {
    if (!view || feedback) return
    const given = view.tiles.length ? assembled : view.choices.length ? selected : input
    const result = session.submit(given)
    if (!result) return
    onGraded()
  }, [view, feedback, assembled, selected, input, session, onGraded])

  // doğru cevaplarda akışı hızlandır (yanlışta kullanıcı okusun)
  useEffect(() => {
    if (!feedback?.correct) return
    const t = setTimeout(() => advanceRef.current(), 1150)
    return () => clearTimeout(t)
  }, [feedback])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (feedback) advanceRef.current()
        else if (canSubmit) submit()
        return
      }
      if (!feedback && view?.choices.length && /^[1-4]$/.test(e.key)) {
        const idx = Number(e.key) - 1
        if (view.choices[idx]) setSelected(view.choices[idx])
      }
      if (!feedback && e.key === ' ' && view?.audioText) {
        e.preventDefault()
        play(view.audioText)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, canSubmit, submit, view, play])

  /* ---------------------------------------------------------------- */
  /* tanıtım kartları                                                  */
  /* ---------------------------------------------------------------- */

  const nextCard = () => {
    const more = session.nextIntro()
    if (more) setIntro(session.currentIntro)
    else {
      setIntro(null)
      advance()
    }
  }

  if (inIntro && intro) {
    const item = intro.item
    const UnitIcon = unitIcon(item.unit)
    const PosIcon = posIcon(item.pos)
    return (
      <div>
        <div className="session-head">
          <button className="icon-btn" aria-label="Çıkış" onClick={() => { cancelSpeech(); onExit() }}>
            <IconClose size={18} />
          </button>
          <div className="dots">
            {Array.from({ length: intro.total }, (_, i) => (
              <i key={i} className={i <= intro.index ? 'on' : ''} />
            ))}
          </div>
          <button className="link-btn" onClick={() => { session.skipIntro(); setIntro(null); advance() }}>
            Atla
          </button>
        </div>

        <div className="wordcard" key={item.id}>
          <div className="wordcard-top">
            <span className="chip">
              <PosIcon size={14} />
              {POS_LABELS[item.pos] ?? item.pos}
            </span>
            <span className="chip muted">
              <UnitIcon size={14} />
              yeni kelime
            </span>
            <span className="tiny faint" style={{ marginLeft: 'auto' }}>
              {intro.index + 1}/{intro.total}
            </span>
          </div>

          {speechOk ? (
            <button
              className={`speaker${playing ? ' playing' : ''}`}
              onClick={() => play(item.de)}
              aria-label="Dinle"
            >
              <IconVolume size={26} />
            </button>
          ) : null}

          <h2 className={`wordcard-de art-${item.article ?? 'none'}`}>{item.de}</h2>
          <p className="wordcard-tr">{item.tr}</p>

          <div className="wordcard-meta">
            {item.article ? <span className="chip">Artikel: {item.article}</span> : null}
            {item.plural ? <span className="chip">Çoğul: {item.plural}</span> : null}
            {item.proper ? <span className="chip muted">özel isim</span> : null}
          </div>

          {item.ex ? (
            <div className="wordcard-ex">
              <div className="row between">
                <span className="de">{item.ex}</span>
                {speechOk ? (
                  <button className="icon-btn sm" aria-label="Örneği dinle" onClick={() => play(item.ex ?? '')}>
                    <IconVolume size={16} />
                  </button>
                ) : null}
              </div>
              {item.exTr ? <div className="small muted">{item.exTr}</div> : null}
            </div>
          ) : null}

          {item.note ? (
            <div className="wordcard-note">
              <IconInfo size={15} />
              <span>{item.note}</span>
            </div>
          ) : null}
        </div>

        <div className="answer-bar">
          <button className="btn primary block lg" onClick={nextCard}>
            {intro.index + 1 >= intro.total ? 'Alıştırmalara geç' : 'Devam'}
            <IconChevron />
          </button>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* alıştırmalar                                                      */
  /* ---------------------------------------------------------------- */

  if (!view) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <IconCheck size={30} />
        </div>
        <h2>Şimdilik tekrar edilecek bir şey yok</h2>
        <p className="muted small">Yeni kelime eklemek için bir ünite seç ya da yarın tekrar gel.</p>
        <button className="btn primary" onClick={onExit} style={{ marginTop: 14 }}>
          Ana sayfaya dön
        </button>
      </div>
    )
  }

  const askedLabel = view.inputField === 'tr' ? 'Türkçe' : view.inputField === 'article' ? 'Artikel' : 'Almanca'
  const segCount = Math.max(1, Math.min(total, 24))
  const segFilled = Math.round((session.answered / Math.max(1, total)) * segCount)

  return (
    <div>
      <div className="session-head">
        <button className="icon-btn" aria-label="Çıkış" onClick={() => { cancelSpeech(); onExit() }}>
          <IconClose size={18} />
        </button>
        <div className="segbar">
          {Array.from({ length: segCount }, (_, i) => (
            <i key={i} className={i < segFilled ? 'on' : i === segFilled ? 'now' : ''} />
          ))}
        </div>
        <span className="tiny faint mono">
          {session.answered}/{total}
        </span>
      </div>

      <div className="exercise" key={view.animationKey}>
        <div className="exercise-top">
          <span className="chip accent">{EXERCISE_LABELS[view.kind]}</span>
          {view.audioText ? (
            <button
              className={`speaker inline${playing ? ' playing' : ''}`}
              onClick={() => view.audioText && play(view.audioText)}
              aria-label="Dinle"
            >
              <IconVolume size={19} />
            </button>
          ) : null}
          <span className="tiny faint" style={{ marginLeft: 'auto', textAlign: 'right' }}>
            {view.promptSub}
          </span>
        </div>

        {view.prompt ? (
          <div className={`exercise-prompt${view.article ? ` art-${view.article}` : ''}`}>{view.prompt}</div>
        ) : null}

        {view.choices.length ? (
          <div className="choices">
            {view.choices.map((choice, i) => {
              const isSelected = selected === choice
              const state = feedback
                ? choice === feedback.correctAnswer
                  ? 'is-correct'
                  : isSelected
                    ? 'is-wrong'
                    : 'dim'
                : isSelected
                  ? 'is-selected'
                  : ''
              return (
                <button
                  key={choice}
                  className={`choice ${state}`}
                  disabled={!!feedback}
                  onClick={() => setSelected(choice)}
                >
                  <span className="key">{i + 1}</span>
                  <span className={view.inputField === 'tr' ? '' : 'de'}>{choice}</span>
                </button>
              )
            })}
          </div>
        ) : view.tiles.length ? (
          <div className="tiles">
            <div className="tiles-answer" aria-label="Cevap alanı">
              {placed.map((t) => (
                <button
                  key={`p${t.id}`}
                  className="tile placed"
                  disabled={!!feedback}
                  onClick={() => {
                    setPlaced((p) => p.filter((x) => x.id !== t.id))
                    setBank((b) => [...b, t])
                  }}
                >
                  {t.word}
                </button>
              ))}
              {!placed.length ? <span className="tiles-hint">Kelimelere dokunarak cümleyi kur</span> : null}
            </div>
            <div className="tiles-line" />
            <div className="tiles-bank">
              {bank.map((t) => (
                <button
                  key={`b${t.id}`}
                  className="tile"
                  disabled={!!feedback}
                  onClick={() => {
                    setBank((b) => b.filter((x) => x.id !== t.id))
                    setPlaced((p) => [...p, t])
                  }}
                >
                  {t.word}
                </button>
              ))}
            </div>
            {feedback ? (
              <div className="answer-line">
                <span className="tiny faint">Senin cevabın</span>
                <div className="de">{assembled || '—'}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="stack" style={{ marginTop: 18, gap: 8 }}>
            <input
              ref={inputRef}
              className={`answer-input${feedback ? (feedback.correct ? ' is-correct' : ' is-wrong') : ''}`}
              value={feedback ? (feedback.given ?? '') : input}
              placeholder={view.placeholder}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={!!feedback}
              onChange={(e) => setInput(e.target.value)}
            />
            {view.hint && !feedback ? (
              <div className="tiny faint row" style={{ gap: 8 }}>
                <IconBulb size={14} />
                <span>{view.hint}</span>
                {hintLevel === 0 ? (
                  <button className="link-btn" onClick={() => setHintLevel(1)}>
                    harf göster
                  </button>
                ) : (
                  <span className="mono">{revealHint(view.item.de, hintLevel + 1)}</span>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {feedback ? (
        <div className={`feedback ${feedback.correct ? 'good' : 'bad'}`}>
          <div className="feedback-head">
            <span className={`badge ${feedback.correct ? 'good' : 'bad'}`}>
              {feedback.correct ? <IconCheck size={15} /> : <IconClose size={15} />}
            </span>
            <span>{feedback.correct ? (feedback.exact ? 'Doğru!' : 'Doğru (küçük yazım farkı)') : 'Doğru cevap:'}</span>
            <span style={{ flex: 1 }} />
            <span className="pill">{RATING_LABELS[feedback.rating]}</span>
            <span className="pill accent">{humanInterval(feedback.intervalMs)}</span>
          </div>

          {!feedback.correct ? (
            <div className="feedback-answer">
              <span className="de">{feedback.correctAnswer}</span>
              <span className="small muted">{view.item.tr}</span>
            </div>
          ) : null}

          <div className="feedback-example">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className={`de${view.article ? ` art-${view.article}` : ''}`} style={{ fontSize: 16 }}>
                  {view.item.de}
                </div>
                <div className="small muted">{view.item.tr}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {view.item.plural ? <span className="pill">{view.item.plural}</span> : null}
                {speechOk ? (
                  <button className="icon-btn sm" aria-label="Kelimeyi dinle" onClick={() => play(view.item.de)}>
                    <IconVolume size={16} />
                  </button>
                ) : null}
              </div>
            </div>
            {view.item.ex ? (
              <div style={{ marginTop: 10 }}>
                <div className="small de">{view.item.ex}</div>
                <div className="tiny faint">{view.item.exTr}</div>
              </div>
            ) : null}
            {view.item.note ? (
              <div className="row tiny faint" style={{ marginTop: 8, gap: 6 }}>
                <IconInfo size={13} />
                <span>{view.item.note}</span>
              </div>
            ) : null}
          </div>

          {showPredictions ? (
            <div className="predictions">
              <span className="tiny faint">
                RWKV-Instant <b className="mono">{(feedback.pRwkv * 100).toFixed(0)}%</b>
              </span>
              <span className="tiny faint">
                FSRS-7 <b className="mono">{(feedback.pFsrs * 100).toFixed(0)}%</b>
              </span>
              <span className="tiny faint">
                karar <b className="mono">{(feedback.pFinal * 100).toFixed(0)}%</b>
              </span>
              <span className="tiny faint">hedef %{Math.round(feedback.targetRetention * 100)}</span>
              <span className="tiny" style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <IconBolt size={12} /> +{feedback.xp}
              </span>
              {feedback.requeued ? <span className="pill bad">oturum sonunda tekrar</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!speechOk && view.audioText ? (
        <div className="tiny faint" style={{ marginTop: 10, textAlign: 'center' }}>
          Bu tarayıcıda Almanca ses bulunamadı; alıştırmayı yazarak çözebilirsin.
        </div>
      ) : null}

      <div className={`answer-bar${feedback ? (feedback.correct ? ' correct' : ' wrong') : ''}`}>
        {feedback ? (
          <button className="btn primary block lg" onClick={advance}>
            {session.total - session.answered > 0 ? 'Devam' : 'Oturumu bitir'}
          </button>
        ) : (
          <button className="btn primary block lg" disabled={!canSubmit} onClick={submit}>
            {view.tiles.length || view.choices.length ? 'Kontrol et' : `Kontrol et (${askedLabel})`}
          </button>
        )}
      </div>
    </div>
  )
}

function IconChevron() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  )
}

/** Harf harf ipucu: "Apfel" → "A····" */
function revealHint(word: string, shown: number): string {
  const letters = word.replace(/^(der|die|das)\s+/i, '')
  return letters
    .split('')
    .map((c, i) => (i < shown || c === ' ' ? c : '·'))
    .join('')
}
