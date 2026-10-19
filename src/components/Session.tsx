import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cancelSpeech, speak } from '../audio'
import { RATING_LABELS, humanInterval, type ExerciseView, type SessionSummary, type StudySession, type SubmitResult } from '../session'
import { EXERCISE_LABELS } from '../engine/types'
import { sfxCorrect, sfxPop, sfxWrong } from '../sfx'
import { store } from '../state/store'
import {
  IconBolt,
  IconBulb,
  IconCheck,
  IconClose,
  IconInfo,
  IconVolume,
  posIcon,
} from './icons'
import { WordDe } from './ui'

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

/**
 * Ders, bir çalışma kağıdı gibi çizilir: üstte ince bir ilerleme şeridi,
 * ortada soru yaprağı, altta tek eylem çubuğu. Cevaplar numaralı satırlar
 * hâlinde listelenir; düzeltme şeridi öğretmen notu gibi eklenir.
 */
export function SessionScreen({ session, speechOk, showPredictions, onFinished, onExit, onGraded }: Props) {
  const [view, setView] = useState<ExerciseView | null>(null)
  const [intro, setIntro] = useState(session.currentIntro)
  const [feedback, setFeedback] = useState<SubmitResult | null>(null)
  const correctionRef = useRef<HTMLDivElement | null>(null)
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [bank, setBank] = useState<Tile[]>([])
  const [placed, setPlaced] = useState<Tile[]>([])
  const [playing, setPlaying] = useState(false)
  const [hintLevel, setHintLevel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const advanceRef = useRef<() => void>(() => {})
  const nextCardRef = useRef<() => void>(() => {})
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

  // Tanıtım kartındaki kelime açılır açılmaz okunur.
  useEffect(() => {
    if (speechOk && intro?.item) play(intro.item.de)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro?.item.id, speechOk])

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
    setFeedback(result)
    if (store.activeUser().settings.soundEnabled) {
      if (result.correct) sfxCorrect()
      else sfxWrong()
    }
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
      if (inIntro) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          nextCardRef.current()
        }
        return
      }
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
  }, [feedback, canSubmit, submit, view, play, inIntro])

  /* ---------------------------------------------------------------- */
  /* tanıtım kartları                                                  */
  /* ---------------------------------------------------------------- */

  const nextCard = () => {
    if (store.activeUser().settings.soundEnabled) sfxPop()
    const more = session.nextIntro()
    if (more) setIntro(session.currentIntro)
    else {
      setIntro(null)
      advance()
    }
  }

  useEffect(() => {
    if (!feedback || !correctionRef.current) return
    const el = correctionRef.current
    const id = window.setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    }, 70)
    return () => window.clearTimeout(id)
  }, [feedback])

  nextCardRef.current = nextCard

  if (inIntro && intro) {
    const item = intro.item
    const PosIcon = posIcon(item.pos)
    return (
      <div className="intro-wrap">
        <div className="ws-head">
          <button
            className="icon-btn"
            aria-label="Çıkış"
            onClick={() => {
              cancelSpeech()
              onExit()
            }}
          >
            <IconClose size={18} />
          </button>
          <div className="ws-cells">
            {Array.from({ length: intro.total }, (_, i) => (
              <i key={i} className={i <= intro.index ? 'on' : ''} />
            ))}
          </div>
          <button
            className="link-btn"
            onClick={() => {
              session.skipIntro()
              setIntro(null)
              advance()
            }}
          >
            Atla
          </button>
        </div>

        <div className="wordcard" key={item.id}>
          <div className="wordcard-top">
            <span className="tag">
              <PosIcon size={13} />
              {POS_LABELS[item.pos] ?? item.pos}
            </span>
            <span className="tag tag-signal">yeni kelime</span>
            <span className="tiny faint" style={{ marginLeft: 'auto' }}>
              {intro.index + 1}/{intro.total}
            </span>
          </div>

          <div className="wordcard-word">
            <WordDe item={item} />
            {speechOk ? (
              <button
                className={`speaker${playing ? ' playing' : ''}`}
                onClick={() => play(item.de)}
                aria-label="Dinle"
              >
                <IconVolume size={20} />
              </button>
            ) : null}
          </div>
          <p className="wordcard-tr">{item.tr}</p>

          {(item.plural || item.proper) && (
            <div className="wordcard-meta">
              {item.plural ? <span className="tag">çoğul: {item.plural}</span> : null}
              {item.proper ? <span className="tag">özel isim</span> : null}
            </div>
          )}

          {item.ex ? (
            <div className="wordcard-ex">
              <div className="row between">
                <span className="de-soft">{item.ex}</span>
                {speechOk ? (
                  <button
                    className="icon-btn sm"
                    aria-label="Örneği dinle"
                    onClick={() => play(item.ex ?? '')}
                  >
                    <IconVolume size={15} />
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
          <div className="answer-inner">
            <button className="btn btn-signal btn-block btn-lg" onClick={nextCard}>
              {intro.index + 1 >= intro.total ? 'Alıştırmalara geç' : 'Devam'}
            </button>
            <div className="kbd-hint">
              <kbd>Enter</kbd> devam · <kbd>Boşluk</kbd> dinle
            </div>
          </div>
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
          <IconCheck size={28} />
        </div>
        <h2 className="page-title" style={{ fontSize: 22 }}>
          Şimdilik tekrar edilecek bir şey yok
        </h2>
        <p className="muted small">Yeni kelime eklemek için bir ünite seç ya da yarın tekrar gel.</p>
        <button className="btn btn-signal" onClick={onExit} style={{ marginTop: 14 }}>
          Ana sayfaya dön
        </button>
      </div>
    )
  }

  const PosIcon = posIcon(view.item.pos)
  const askedLabel = view.inputField === 'tr' ? 'Türkçe' : view.inputField === 'article' ? 'Artikel' : 'Almanca'
  const segCount = Math.max(1, Math.min(total, 24))
  const segFilled = Math.round((session.answered / Math.max(1, total)) * segCount)

  return (
    <div>
      <div className="ws-head">
        <button
          className="icon-btn"
          aria-label="Çıkış"
          onClick={() => {
            cancelSpeech()
            onExit()
          }}
        >
          <IconClose size={18} />
        </button>
        <div className="ws-cells">
          {Array.from({ length: segCount }, (_, i) => (
            <i key={i} className={i < segFilled ? 'on' : i === segFilled ? 'now' : ''} />
          ))}
        </div>
        <span className="ws-count k">
          {session.answered}/{total}
        </span>
      </div>

      <div className="ws" key={view.animationKey}>
        <div className="ws-kind">
          <span className="tag tag-strong">{EXERCISE_LABELS[view.kind]}</span>
          <span className="tag">
            <PosIcon size={13} />
            {POS_LABELS[view.item.pos] ?? view.item.pos}
          </span>
          {view.audioText ? (
            <button
              className={`icon-btn sm${playing ? ' playing' : ''}`}
              onClick={() => view.audioText && play(view.audioText)}
              aria-label="Dinle"
            >
              <IconVolume size={16} />
            </button>
          ) : null}
          <span className="tiny faint" style={{ marginLeft: 'auto', textAlign: 'right' }}>
            {view.promptSub}
          </span>
        </div>

        {view.prompt ? <div className="ws-prompt">{view.prompt}</div> : null}

        {view.choices.length ? (
          <div className="ws-choices">
            {view.choices.map((choice, i) => {
              const isSelected = selected === choice
              const state = feedback
                ? choice === feedback.correctAnswer
                  ? ' good'
                  : isSelected
                    ? ' bad'
                    : ' dim'
                : isSelected
                  ? ' on'
                  : ''
              return (
                <button
                  key={choice}
                  className={`ws-choice${state}`}
                  disabled={!!feedback}
                  onClick={() => setSelected(choice)}
                >
                  <span className="ws-choice-key">{i + 1}</span>
                  <span className={view.inputField === 'tr' ? '' : 'de'}>{choice}</span>
                </button>
              )
            })}
          </div>
        ) : view.tiles.length ? (
          <div className="ws-tiles">
            <div className="ws-answer-area" aria-label="Cevap alanı">
              {placed.map((t) => (
                <button
                  key={`p${t.id}`}
                  className="ws-tile placed"
                  disabled={!!feedback}
                  onClick={() => {
                    setPlaced((p) => p.filter((x) => x.id !== t.id))
                    setBank((b) => [...b, t])
                  }}
                >
                  {t.word}
                </button>
              ))}
              {!placed.length ? (
                <span className="ws-placeholder">Kelimelere dokunarak cümleyi kur</span>
              ) : null}
            </div>
            <div className="ws-bank">
              {bank.map((t) => (
                <button
                  key={`b${t.id}`}
                  className="ws-tile"
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
          </div>
        ) : (
          <div>
            <input
              ref={inputRef}
              className={`ws-answer-input${feedback ? (feedback.correct ? ' good' : ' bad') : ''}`}
              value={feedback ? (feedback.given ?? '') : input}
              placeholder={view.placeholder}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={!!feedback}
              onChange={(e) => setInput(e.target.value)}
            />
            {view.hint && !feedback ? (
              <div className="ws-hint">
                <IconBulb size={14} />
                <span>{view.hint}</span>
                {hintLevel === 0 ? (
                  <button className="link-btn" onClick={() => setHintLevel(1)}>
                    harf göster
                  </button>
                ) : (
                  <span className="de-soft" style={{ letterSpacing: '0.08em' }}>
                    {revealHint(view.item.de, hintLevel + 1)}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {feedback ? (
        <div className={`correction ${feedback.correct ? 'good' : 'bad'}`} ref={correctionRef}>
          <div className="correction-head">
            <span className={`fb-badge${feedback.correct ? '' : ' bad'}`}>
              {feedback.correct ? <IconCheck size={17} /> : <IconClose size={17} />}
            </span>
            <span>
              {feedback.correct
                ? feedback.exact
                  ? 'Doğru'
                  : 'Doğru (küçük yazım farkı)'
                : 'Doğru cevap'}
            </span>
            <span className="grow" />
            <span className="tag">{RATING_LABELS[feedback.rating]}</span>
            <span className="tag tag-signal">{humanInterval(feedback.intervalMs)}</span>
          </div>

          {!feedback.correct ? (
            <div className="correction-answer">
              <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div className="de-lg">
                    <WordDe
                      item={{
                        de: feedback.correctAnswer,
                        article: view.article && feedback.correctAnswer.startsWith(view.article) ? view.article : null,
                      }}
                    />
                  </div>
                  <span className="word-tr">{view.item.tr}</span>
                </div>
                {speechOk ? (
                  <button
                    className="icon-btn sm"
                    aria-label="Doğru cevabı dinle"
                    onClick={() => play(feedback.correctAnswer)}
                  >
                    <IconVolume size={15} />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="correction-extra">
            {feedback.correct ? (
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <WordDe item={view.item} />
                  <span className="word-tr">{view.item.tr}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {view.item.plural ? <span className="tag">{view.item.plural}</span> : null}
                  {speechOk ? (
                    <button className="icon-btn sm" aria-label="Kelimeyi dinle" onClick={() => play(view.item.de)}>
                      <IconVolume size={15} />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {view.item.ex ? (
              <div style={{ marginTop: 10 }}>
                <div className="de-soft">{view.item.ex}</div>
                <span className="tiny faint">{view.item.exTr}</span>
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
            <div className="data-line">
              <span>
                RWKV-Instant <b className="k">{(feedback.pRwkv * 100).toFixed(0)}%</b>
              </span>
              <span>
                FSRS-7 <b className="k">{(feedback.pFsrs * 100).toFixed(0)}%</b>
              </span>
              <span>
                karar <b className="k">{(feedback.pFinal * 100).toFixed(0)}%</b>
              </span>
              <span>
                hedef <b className="k">%{Math.round(feedback.targetRetention * 100)}</b>
              </span>
              <span className="tag tag-signal">
                <IconBolt size={12} /> +{feedback.xp} XP
              </span>
              {feedback.requeued ? <span className="tag tag-bad">oturum sonunda tekrar</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!speechOk && view.audioText ? (
        <div className="tiny faint" style={{ marginTop: 10, textAlign: 'center' }}>
          Bu tarayıcıda Almanca ses bulunamadı; alıştırmayı yazarak çözebilirsin.
        </div>
      ) : null}

      <div className="answer-bar">
        <div className="answer-inner">
          {feedback ? (
            <button className="btn btn-signal btn-block btn-lg" onClick={advance}>
              {session.total - session.answered > 0 ? 'Devam' : 'Oturumu bitir'}
            </button>
          ) : (
            <button className="btn btn-signal btn-block btn-lg" disabled={!canSubmit} onClick={submit}>
              {view.tiles.length || view.choices.length ? 'Kontrol et' : `Kontrol et (${askedLabel})`}
            </button>
          )}
          {!feedback && view.choices.length ? (
            <div className="kbd-hint">
              <kbd>Enter</kbd> kontrol et · <kbd>1</kbd>–<kbd>{Math.min(4, view.choices.length)}</kbd> seç
            </div>
          ) : (
            <div className="kbd-hint">
              <kbd>Enter</kbd> {feedback ? 'devam' : 'kontrol et'}
              {view.audioText ? (
                <>
                  {' · '}
                  <kbd>Boşluk</kbd> dinle
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
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
