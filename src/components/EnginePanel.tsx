import { useState } from 'react'
import { ITEM_BY_ID, SECTION_BY_ID } from '../content'
import type { AccuracyModelReport, CardStats, PersonalizationReport } from '../engine/engine'
import { DEFAULT_PARAMETERS } from '../engine/fsrs7'
import { calibrationCurve, type PredictionPair } from '../engine/metrics'
import { HORIZON_LABELS } from '../engine/rwkv'
import type { ReviewEvent } from '../engine/types'
import { useStore } from '../state/store'
import {
  IconBolt,
  IconBrain,
  IconBulb,
  IconChart,
  IconCheck,
  IconClock,
  IconEye,
  IconInfo,
  IconLayers,
  IconSparkles,
  IconStar,
  IconTarget,
} from './icons'
import { Bar, CalibrationChart, MiniBar, Stat, formatRelative } from './ui'

type Mode = 'basit' | 'gelismis'

const MIN_TUNE_REVIEWS = 80
const RATING_NAMES = ['Tekrar', 'Zor', 'İyi', 'Kolay']

/**
 * Motor ekranı iki katmanlıdır:
 *  - **Basit**: sıradan kullanıcıya sade dille “sistem beni tanıyor mu?”.
 *  - **Gelişmiş**: tüm ölçütler, kalibrasyon, ağırlıklar, FSRS parametreleri.
 *
 * Hiçbir ayar zorunlu değildir; motor arka planda her cevapta güncellenir.
 */
export function EnginePanel() {
  const [mode, setMode] = useState<Mode>('basit')
  const store = useStore()
  const user = store.activeUser()
  const engine = store.engine()
  const report = engine.accuracyModelReport()
  const personal = engine.personalizationReport()
  const cards = engine.cardStats()

  return (
    <div className="stack">
      <div>
        <h2>Motor</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          Her cevabında iki model birlikte çalışır: <b>RWKV-Instant</b> (taban) cevap geçmişini tek adımda
          işleyip kişisel hatırlama olasılığını üretir, <b>FSRS-7</b> (ikincil) tekrar tarihini hesaplar. Hiçbir
          ayar yapmana gerek yok.
        </p>
      </div>

      <div className="seg-toggle" role="tablist" aria-label="Motor görünümü">
        <button
          role="tab"
          aria-selected={mode === 'basit'}
          className={mode === 'basit' ? 'on' : ''}
          onClick={() => setMode('basit')}
        >
          <IconSparkles size={15} /> Basit
        </button>
        <button
          role="tab"
          aria-selected={mode === 'gelismis'}
          className={mode === 'gelismis' ? 'on' : ''}
          onClick={() => setMode('gelismis')}
        >
          <IconChart size={15} /> Gelişmiş
        </button>
      </div>

      {mode === 'basit' ? (
        <NormalView
          reviews={user.totals.reviews}
          events={user.events}
          report={report}
          personal={personal}
          dailyGoal={user.dailyGoal}
          dueNow={cards.dueNow}
          newLeft={cards.fresh}
        />
      ) : (
        <AdvancedView
          report={report}
          personal={personal}
          parameters={user.fsrsParameters}
          events={user.events}
          cards={cards}
        />
      )}
    </div>
  )
}

/* ====================================================================== */
/* BASİT GÖRÜNÜM — sıradan kullanıcı                                       */
/* ====================================================================== */

function NormalView({
  reviews,
  events,
  report,
  personal,
  dailyGoal,
  dueNow,
  newLeft,
}: {
  reviews: number
  events: ReviewEvent[]
  report: AccuracyModelReport
  personal: PersonalizationReport
  dailyGoal: number
  dueNow: number
  newLeft: number
}) {
  const progress = Math.min(1, reviews / MIN_TUNE_REVIEWS)
  const blend = report.recent.blend
  const rwkv = report.recent.rwkv
  const fsrs = report.recent.fsrs
  const accuracy = events.length ? events.filter((e) => e.correct).length / events.length : 0
  const avgTarget = events.length
    ? events.reduce((a, e) => a + (e.targetRetention || 0.9), 0) / events.length
    : 0.9

  const hardest = personal.biases.filter((b) => b.bias > 0.1).slice(0, 3)
  const easiest = personal.biases.filter((b) => b.bias < -0.1).slice(0, 3)
  const weak = personal.weakestThemes[0]

  const groups = [
    { label: 'Saatler', from: 0, to: 2 },
    { label: 'Günler', from: 2, to: 5 },
    { label: 'Haftalar', from: 5, to: 8 },
  ].map((g) => ({
    label: g.label,
    value: Math.max(0, ...personal.horizons.slice(g.from, g.to).map((h) => h.value)),
  }))
  const groupMax = Math.max(0.001, ...groups.map((g) => g.value))

  const better = rwkv.brier <= fsrs.brier ? 'RWKV-Instant' : 'FSRS-7'
  const calibration = blend.n >= 30 ? blend.ece : null

  return (
    <div className="stack">
      <div className="card">
        <h3 className="card-title">
          <IconBrain size={13} /> Sistem seni tanıyor mu?
        </h3>
        <div className="row between tiny faint" style={{ marginBottom: 8 }}>
          <span>{reviews} cevap toplandı</span>
          <span>{MIN_TUNE_REVIEWS} cevapta tam kişiselleştirme</span>
        </div>
        <Bar value={progress} good={progress >= 1} />
        <p className="small muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
          {reviews === 0
            ? 'Henüz veri yok. İlk alıştırmaları yaptığında RWKV-Instant seni tanımaya hemen başlar.'
            : personal.fsrsTunedAt
              ? `Tekrar aralıkların sana göre ayarlandı (${formatRelative(personal.fsrsTunedAt)}). Zamanla daha da isabetli olacak.`
              : `${Math.max(0, MIN_TUNE_REVIEWS - reviews)} cevap sonra tekrar aralıkları senin hızına göre yeniden ayarlanacak — şu an öğreniyor.`}
        </p>
        <div className="plain-list">
          <span>
            <IconCheck size={13} /> Her cevapta RWKV-Instant bir adım öğrenir (cihazında, anında).
          </span>
          <span>
            <IconClock size={13} /> FSRS-7 unutma eğrine göre “bu kelimeyi ne zaman tekrar sorayım?” sorusunu
            hesaplar.
          </span>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">
          <IconTarget size={13} /> Tahminler ne kadar tutuyor?
        </h3>
        {blend.n < 10 ? (
          <p className="small muted">
            En az 10 cevap gerekiyor. Şu an {blend.n} cevap var — birkaç tur daha yap.
          </p>
        ) : (
          <>
            <p className="small muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
              Son {blend.n} cevapta birleşik model, doğru cevap vereceğini{' '}
              <b>%{Math.round(blend.accuracy * 100)}</b> isabetle tahmin etti. Şu an daha isabetli olan taraf:{' '}
              <b>{better}</b>.
            </p>
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              <MiniBar label="Birleşim" value={blend.accuracy} max={1} suffix={`%${Math.round(blend.accuracy * 100)}`} />
              <MiniBar label="RWKV" value={rwkv.accuracy} max={1} suffix={`%${Math.round(rwkv.accuracy * 100)}`} />
              <MiniBar label="FSRS" value={fsrs.accuracy} max={1} suffix={`%${Math.round(fsrs.accuracy * 100)}`} />
            </div>
            <div className="plain-list" style={{ marginTop: 12 }}>
              <span>
                <IconEye size={13} /> Gerçek doğruluğun: %{Math.round(accuracy * 100)}
                {calibration != null
                  ? ` · yanılma payı ${calibration < 0.05 ? 'çok düşük' : calibration < 0.12 ? 'düşük' : 'yüksek'}`
                  : ''}
              </span>
              <span>
                <IconTarget size={13} /> Plan her kelimeyi ortalama %{Math.round(avgTarget * 100)} olasılıkla
                hatırlayacağın şekilde ayarlıyor.
              </span>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">
          <IconBolt size={13} /> Şu an senin için ne yapıyor?
        </h3>
        <div className="plain-list">
          <span>
            <IconClock size={13} /> Şu an <b>{dueNow}</b> kelimenin tekrar vakti geldi, <b>{newLeft}</b> kelime hiç
            görülmedi.
          </span>
          <span>
            <IconStar size={13} /> Zorlandığın kelimeleri daha sık, kolay bulduklarını daha seyrek soruyor.
          </span>
        </div>

        {hardest.length ? (
          <div style={{ marginTop: 14 }}>
            <div className="tiny faint" style={{ marginBottom: 6 }}>
              Sana en zor gelenler
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {hardest.map((b) => (
                <div key={b.item} className="row between">
                  <span className="de" style={{ fontSize: 14.5 }}>
                    {b.item}
                  </span>
                  <span className="tiny faint">{b.tr}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {easiest.length ? (
          <div style={{ marginTop: 12 }}>
            <div className="tiny faint" style={{ marginBottom: 6 }}>
              Kolay buldukların
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {easiest.map((b) => (
                <div key={b.item} className="row between">
                  <span className="de" style={{ fontSize: 14.5 }}>
                    {b.item}
                  </span>
                  <span className="tiny faint">{b.tr}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {weak ? (
          <div className="plain-list" style={{ marginTop: 14 }}>
            <span>
              <IconInfo size={13} /> En zayıf bölümün{' '}
              <b>{SECTION_BY_ID[weak.unit]?.title ?? weak.unit}</b> (%{Math.round(weak.accuracy * 100)}). Öğren
              ekranındaki öneriye dokunup tekrar edebilirsin.
            </span>
          </div>
        ) : null}

        <div className="tiny faint" style={{ marginTop: 12 }}>
          Günlük hedefin: {dailyGoal} cevap
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">
          <IconLayers size={13} /> Unutma eğrisini öğreniyor
        </h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Model, senin unutma hızını üç ayrı ölçekte öğrenir. Çubuk büyüdükçe o ölçek daha etkin kullanılıyor.
        </p>
        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
          {groups.map((g) => (
            <MiniBar key={g.label} label={g.label} value={g.value} max={groupMax} />
          ))}
        </div>
        <div className="tiny faint" style={{ marginTop: 12 }}>
          {personal.modelSteps} cevap işlendi · gizli durum boyutu {personal.stateSize} · {personal.paramCount}{' '}
          öğrenilebilir ağırlık (hepsi cihazında).
        </div>
      </div>

      <div className="card tight">
        <div className="tiny faint">
          <IconBulb size={12} /> Bu ekranı okumak zorunda değilsin: motor arka planda çalışır. Daha fazla sayı
          görmek istersen yukarıdaki <b>Gelişmiş</b> sekmesine geç.
        </div>
      </div>
    </div>
  )
}

/* ====================================================================== */
/* GELİŞMİŞ GÖRÜNÜM                                                       */
/* ====================================================================== */

function AdvancedView({
  report,
  personal,
  parameters,
  events,
  cards,
}: {
  report: AccuracyModelReport
  personal: PersonalizationReport
  parameters: number[] | null
  events: ReviewEvent[]
  cards: CardStats
}) {
  const models = ['fsrs', 'rwkv', 'blend'] as const
  const names: Record<(typeof models)[number], string> = {
    fsrs: 'FSRS-7',
    rwkv: 'RWKV-Instant',
    blend: 'Birleşim',
  }

  const rows = [
    { label: 'Brier ↓', pick: (m: typeof report.recent.blend) => m.brier, better: 'low' as const, fmt: (v: number) => v.toFixed(3) },
    { label: 'Log-loss ↓', pick: (m: typeof report.recent.blend) => m.logLoss, better: 'low' as const, fmt: (v: number) => v.toFixed(3) },
    { label: 'Kalibrasyon hatası ↓', pick: (m: typeof report.recent.blend) => m.ece, better: 'low' as const, fmt: (v: number) => v.toFixed(3) },
    { label: 'AUC ↑', pick: (m: typeof report.recent.blend) => m.auc, better: 'high' as const, fmt: (v: number) => v.toFixed(3) },
    { label: 'Doğruluk', pick: (m: typeof report.recent.blend) => m.accuracy, better: 'high' as const, fmt: (v: number) => `${Math.round(v * 100)}%` },
  ]

  const pairs: PredictionPair[] = events.slice(-200).map((e) => ({ p: e.pFinal, y: (e.correct ? 1 : 0) as 0 | 1 }))
  const bins = calibrationCurve(pairs, 8)
  const horizonMax = Math.max(0.001, ...personal.horizons.map((h) => h.value))
  const [a, b, c] = personal.mixture
  const params = parameters ?? [...DEFAULT_PARAMETERS]
  const lastEvents = events.slice(-8).reverse()

  return (
    <div className="stack">
      <div className="grid-2">
        <div className="card tight">
          <div className="card-title">RWKV-Instant (taban)</div>
          <div className="tiny muted">
            Cevapları tek adımlı, sabit boyutlu yinelemeli durumda işler (O(1)). Her kafa farklı bir unutma
            ufkunu öğrenir; yalnızca okuma katmanı çevrimiçi eğitilir.
          </div>
          <div className="kv" style={{ marginTop: 10 }}>
            <span className="faint">Gizli durum</span>
            <span className="mono">{personal.stateSize}</span>
          </div>
          <div className="kv">
            <span className="faint">Öğrenilebilir ağırlık</span>
            <span className="mono">{personal.paramCount}</span>
          </div>
          <div className="kv">
            <span className="faint">İşlenen adım</span>
            <span className="mono">{personal.modelSteps}</span>
          </div>
        </div>
        <div className="card tight">
          <div className="card-title">FSRS-7 (ikincil)</div>
          <div className="tiny muted">
            21 parametreli bellek modeli. Arka planda cevap geçmişine göre yeniden uyarlanır ve tekrar aralığını
            belirler.
          </div>
          <div className="kv" style={{ marginTop: 10 }}>
            <span className="faint">Parametre</span>
            <span className="mono">{params.length}</span>
          </div>
          <div className="kv">
            <span className="faint">Kişiselleştirildi</span>
            <span className="mono">{personal.fsrsTuned ? 'evet' : 'varsayılan'}</span>
          </div>
          <div className="kv">
            <span className="faint">Son uyarlama</span>
            <span className="mono">{personal.fsrsTunedAt ? formatRelative(personal.fsrsTunedAt) : '—'}</span>
          </div>
          <div className="kv">
            <span className="faint">Kayıp (NLL)</span>
            <span className="mono">{personal.fsrsTuningNll != null ? personal.fsrsTuningNll.toFixed(4) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Tahmin doğruluğu (son 200 cevap)</h3>
        <table className="metrics">
          <thead>
            <tr>
              <th>Ölçüt</th>
              {models.map((m) => (
                <th key={m}>{names[m]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = models.map((m) => row.pick(report.recent[m]))
              const best = row.better === 'low' ? Math.min(...values) : Math.max(...values)
              return (
                <tr key={row.label}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {row.label}
                  </th>
                  {models.map((m, i) => (
                    <td key={m} className={values[i] === best && report.recent[m].n > 0 ? 'best' : ''}>
                      {row.fmt(values[i])}
                    </td>
                  ))}
                </tr>
              )
            })}
            <tr>
              <th scope="row" style={{ fontWeight: 500 }}>
                Gözlem sayısı
              </th>
              <td className="mono" colSpan={3} style={{ textAlign: 'right' }}>
                {report.all.blend.n} (tümü) / {report.recent.blend.n} (son 200)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="card-title">Son kararlar</h3>
        {lastEvents.length ? (
          <table className="metrics">
            <thead>
              <tr>
                <th>Kelime</th>
                <th>Tahmin</th>
                <th>Sonuç</th>
                <th>Derece</th>
                <th>Hedef</th>
              </tr>
            </thead>
            <tbody>
              {lastEvents.map((e) => (
                <tr key={`${e.itemId}-${e.at}`}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {ITEM_BY_ID.get(e.itemId)?.de ?? e.itemId}
                  </th>
                  <td className="mono">%{Math.round(e.pFinal * 100)}</td>
                  <td style={{ color: e.correct ? 'var(--good)' : 'var(--bad)' }}>{e.correct ? 'doğru' : 'yanlış'}</td>
                  <td>{RATING_NAMES[e.rating - 1] ?? e.rating}</td>
                  <td className="mono">%{Math.round((e.targetRetention || 0.9) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="tiny faint">Henüz karar yok.</div>
        )}
        <div className="tiny faint" style={{ marginTop: 8 }}>
          “Tahmin”, cevabı doğru vereceğine dair birleşik modelin o anki olasılığıdır. “Hedef”, tekrar aralığının
          dayandığı kişisel hatırlanma oranıdır.
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h3 className="card-title" style={{ margin: 0 }}>
            Birleşim ağırlıkları (logit uzayı)
          </h3>
          <span className="tiny faint mono">
            α {a.toFixed(3)} · β {b.toFixed(3)} · γ {c.toFixed(3)}
          </span>
        </div>
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          <MiniBar label="RWKV" value={a} max={1.6} suffix={a.toFixed(3)} />
          <MiniBar label="FSRS" value={b} max={1.6} suffix={b.toFixed(3)} />
          <MiniBar label="sapma" value={Math.abs(c)} max={1.5} suffix={c.toFixed(3)} />
        </div>
        <div className="tiny faint" style={{ marginTop: 8 }}>
          logit(p) = α·logit(p_RWKV) + β·logit(p_FSRS) + γ — her cevapta çevrimiçi güncellenir (lr 0.08, clamp
          0..1.6).
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Unutma ufukları (kafa yarılanma süreleri)</h3>
        <div className="stack" style={{ gap: 7 }}>
          {personal.horizons.map((h, i) => (
            <MiniBar key={h.label} label={HORIZON_LABELS[i] ?? h.label} value={h.value} max={horizonMax} />
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Kalibrasyon</h3>
        <div className="row" style={{ gap: 18, alignItems: 'center' }}>
          <CalibrationChart bins={bins} />
          <div className="tiny faint" style={{ flex: 1 }}>
            Nokta büyüklüğü örnek sayısı. Köşegene yakınlık “%70 dediğinde gerçekten %70 doğru” demektir.
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Öğe bazlı yanlılık (itemBias)</h3>
        {personal.biases.length ? (
          <div className="stack" style={{ gap: 8 }}>
            {personal.biases.map((b) => (
              <div key={b.item} className="row between">
                <div>
                  <div className="de" style={{ fontSize: 15 }}>
                    {b.item}
                  </div>
                  <div className="tiny faint">{b.tr}</div>
                </div>
                <span className={`pill ${b.bias > 0 ? 'bad' : 'good'}`}>
                  {b.bias > 0 ? 'bekleneden zor' : 'beklenenden kolay'} {b.bias > 0 ? '+' : ''}
                  {b.bias.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="tiny faint">Belirgin sapma yok.</div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">FSRS-7 parametreleri</h3>
        <div className="param-grid">
          {params.map((p, i) => (
            <div key={i} className="param">
              <span className="faint">w{i}</span>
              <span className="mono">{p.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div className="tiny faint" style={{ marginTop: 10 }}>
          {parameters
            ? 'Bu kullanıcı için arka planda uyarlanmış 21 parametre.'
            : 'Henüz kişiselleştirilmedi: FSRS-7 sürüm varsayılanları kullanılıyor.'}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Kart dağılımı</h3>
        <div className="stat-row">
          <Stat label="Yeni" value={cards.fresh} />
          <Stat label="Öğreniliyor" value={cards.learning + cards.young} />
          <Stat label="Kalıcı" value={cards.mature} hint="≥ 21 gün" />
        </div>
        <div style={{ marginTop: 10 }}>
          <Bar value={cards.total ? (cards.total - cards.fresh) / cards.total : 0} />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Tema performansı</h3>
        <div className="grid-2">
          <div>
            <div className="tiny faint" style={{ marginBottom: 6 }}>
              En zayıf
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {personal.weakestThemes.map((t) => (
                <div key={t.unit} className="row between tiny">
                  <span>{SECTION_BY_ID[t.unit]?.title ?? t.unit}</span>
                  <span className="mono">%{Math.round(t.accuracy * 100)}</span>
                </div>
              ))}
              {!personal.weakestThemes.length ? <span className="tiny faint">Veri yok</span> : null}
            </div>
          </div>
          <div>
            <div className="tiny faint" style={{ marginBottom: 6 }}>
              En güçlü
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {personal.strongestThemes.map((t) => (
                <div key={t.unit} className="row between tiny">
                  <span>{SECTION_BY_ID[t.unit]?.title ?? t.unit}</span>
                  <span className="mono">%{Math.round(t.accuracy * 100)}</span>
                </div>
              ))}
              {!personal.strongestThemes.length ? <span className="tiny faint">Veri yok</span> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
