import { useState } from 'react'
import { ITEM_BY_ID, ITEMS, SECTIONS, SECTION_BY_ID } from '../content'
import type { AccuracyModelReport, CardStats, PersonalizationReport } from '../engine/engine'
import { DEFAULT_PARAMETERS } from '../engine/fsrs7'
import {
  dueForecast,
  recallCurve,
  rollingSeries,
  sectionMastery,
  type ForecastBucket,
  type MasteryRow,
  type RollingSeries,
} from '../engine/insights'
import { calibrationCurve, type PredictionPair } from '../engine/metrics'
import { HORIZON_LABELS } from '../engine/rwkv'
import type { ReviewEvent } from '../engine/types'
import { useStore } from '../state/store'
import {
  IconBolt,
  IconBrain,
  IconBulb,
  IconCalendar,
  IconChart,
  IconClock,
  IconEye,
  IconInfo,
  IconLayers,
  IconSparkles,
  IconTarget,
} from './icons'
import { Bar, CalibrationChart, MiniBar, Ring, Sparkline, Stat, formatRelative } from './ui'

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
  const now = Date.now()
  const cardMap = user.cards
  const forecast = dueForecast(Object.values(cardMap), now)
  const mastery = sectionMastery({
    sections: SECTIONS,
    items: ITEMS,
    cards: cardMap,
    themeStats: user.themeStats,
    now,
  })
  const curve = recallCurve(Object.values(cardMap), engine.scheduler, now)
  const trend = rollingSeries(user.events, 20)

  return (
    <div className="stack">
      <header className="page-head">
        <div>
        <h1 className="page-title">Motor</h1>
        <p className="page-note">
          Her cevabında iki model birlikte çalışır: <b>RWKV-Instant</b> (taban) cevap geçmişini tek adımda
          işleyip kişisel hatırlama olasılığını üretir, <b>FSRS-7</b> (ikincil) tekrar tarihini hesaplar. Hiçbir
          ayar yapmana gerek yok.
        </p>
        </div>
      </header>

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
          forecast={forecast}
          mastery={mastery}
          curve={curve}
          trend={trend}
        />
      ) : (
        <AdvancedView
          report={report}
          personal={personal}
          parameters={user.fsrsParameters}
          events={user.events}
          cards={cards}
          trend={trend}
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
  forecast,
  mastery,
  curve,
  trend,
}: {
  reviews: number
  events: ReviewEvent[]
  report: AccuracyModelReport
  personal: PersonalizationReport
  dailyGoal: number
  dueNow: number
  newLeft: number
  forecast: ForecastBucket[]
  mastery: MasteryRow[]
  curve: number[]
  trend: RollingSeries
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
  const maxForecast = Math.max(1, ...forecast.map((b) => b.count))
  const activeSections = mastery.filter((m) => m.seen > 0).slice(0, 6)
  const nextSection = mastery.find((m) => m.seen === 0)
  const trendAcc = trend.accuracy
  const fresh = reviews === 0

  return (
    <div className="stack">
      <div className="eng-hero">
        <div className="eng-hero-copy">
          <span className="eyebrow">
            <IconBrain size={13} /> kişisel motor
          </span>
          <h2 className="eng-hero-title">Seni tanıyor mu?</h2>
          <p className="small muted">
            {reviews === 0
              ? 'Henüz veri yok. İlk alıştırmalarda RWKV-Instant seni tanımaya başlar; hiçbir ayar gerekmez.'
              : personal.fsrsTunedAt
                ? `Tekrar aralıkların sana göre ayarlandı (${formatRelative(personal.fsrsTunedAt)}). Zamanla daha isabetli olacak.`
                : `${Math.max(0, MIN_TUNE_REVIEWS - reviews)} cevap sonra tekrar aralıkları senin hızına göre yeniden ayarlanacak.`}
          </p>
          <div className="tag-row">
            <span className="tag tag-strong">
              <IconTarget size={12} /> {blend.n >= 10 ? `%${Math.round(blend.accuracy * 100)} isabet` : 'ölçülüyor'}
            </span>
            <span className="tag">
              <IconBolt size={12} /> {reviews} cevap
            </span>
            <span className="tag">
              <IconEye size={12} /> hedef %{Math.round(avgTarget * 100)}
            </span>
          </div>
        </div>
        <Ring value={progress} size={116} stroke={13} color="#ce82ff">
          <b className="k">%{Math.round(progress * 100)}</b>
          <span>kişiselleştirme</span>
        </Ring>
      </div>

      <div className="card">
        <div className="row between">
          <h2 className="sheet-title">
            <IconCalendar size={13} /> Tekrar takvimi
          </h2>
          <span className="tiny faint">önümüzdeki 7 gün</span>
        </div>
        {fresh ? (
          <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
            İlk dersini tamamladığında burada önümüzdeki 7 günün tekrar yükü görünecek.
          </p>
        ) : (
          <div className="forecast">
            {forecast.map((b) => (
              <div
                key={b.key}
                className={`forecast-col${b.key === 'overdue' ? ' is-overdue' : ''}${b.count === 0 ? ' is-empty' : ''}`}
              >
                <span className="forecast-count">{b.count || ''}</span>
                <div className="forecast-bar" style={{ height: `${Math.max(b.count === 0 ? 2 : 6, (b.count / maxForecast) * 100)}%` }} />
                <span className="forecast-label">{b.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="tiny faint" style={{ marginTop: 10 }}>
          Şu an <b>{dueNow}</b> kelimenin vakti geldi; <b>{newLeft}</b> kelime hiç görülmedi.
        </div>
      </div>

      {fresh ? (
        <div className="card">
          <h2 className="sheet-title">
            <IconSparkles size={13} /> Bu ekranda zamanla ne göreceksin?
          </h2>
          <div className="plan-list">
            {[
              {
                icon: <IconCalendar size={14} />,
                title: 'Tekrar takvimi',
                text: 'Önümüzdeki günlerde hangi kelimelerin tekrarı gelecek.',
              },
              {
                icon: <IconLayers size={14} />,
                title: 'Bölüm ustalığı',
                text: 'Her bölümün ne kadar oturduğunu gösteren çubuklar.',
              },
              {
                icon: <IconChart size={14} />,
                title: 'Unutma eğrisi',
                text: 'FSRS-7\u2019nin senin için çıkardığı ortalama hatırlama eğrisi.',
              },
              {
                icon: <IconTarget size={14} />,
                title: 'Tahmin isabeti',
                text: 'RWKV-Instant ve FSRS-7\u2019nin doğru cevabını ne kadar tuttuğu.',
              },
            ].map((row) => (
              <div key={row.title} className="plan-item">
                <span className="plan-icon">{row.icon}</span>
                <div>
                  <b>{row.title}</b>
                  <span className="tiny faint">{row.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="tiny faint" style={{ marginTop: 12 }}>
            Hiçbir ayar gerekmez: motor her cevapta kendini günceller, veriler yalnızca bu cihazda kalır.
          </div>
        </div>
      ) : (
        <>
      <div className="card">
        <div className="row between">
          <h2 className="sheet-title">
            <IconLayers size={13} /> Bölüm ustalığı
          </h2>
          <span className="tiny faint">stabiliteye göre</span>
        </div>
        <div className="mastery-list">
          {activeSections.map((m) => (
            <div key={m.id} className="mastery-row">
              <div className="row between">
                <span className="mastery-name">{m.title}</span>
                <span className="tiny mono faint">%{Math.round(m.mastery * 100)}</span>
              </div>
              <Bar value={m.mastery} thin good={m.mastery >= 0.7} />
              <div className="tiny faint">
                {m.seen}/{m.total} kelime
                {m.due > 0 ? ` · ${m.due} tekrar` : ''}
                {m.accuracy != null ? ` · %${Math.round(m.accuracy * 100)} doğru` : ''}
              </div>
            </div>
          ))}
          {!activeSections.length && nextSection ? (
            <div className="tiny muted">
              Henüz öğrenilmiş kelime yok. <b>{nextSection.title}</b> ile başlayınca burada ustalık çubukları
              görünecek.
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h2 className="sheet-title">
            <IconChart size={13} /> Unutma eğrisi
          </h2>
          <span className="tiny faint">tekrar etmezsen</span>
        </div>
        {curve.length ? (
          <>
            <Sparkline points={curve} max={1} height={84} />
            <div className="row between tiny faint" style={{ marginTop: 4 }}>
              <span>bugün %{Math.round(curve[0] * 100)}</span>
              <span>7 gün %{Math.round(curve[7] * 100)}</span>
              <span>30 gün %{Math.round(curve[30] * 100)}</span>
            </div>
          </>
        ) : (
          <p className="small muted" style={{ marginTop: 0 }}>
            İlk kelimeleri öğrendiğinde FSRS-7 unutma eğrin burada görünecek.
          </p>
        )}
        <div className="plain-list">
          <span>
            <IconInfo size={13} /> Eğri, öğrendiğin kelimelerin ortalama hatırlanma olasılığıdır; motor tekrar
            tarihini buna göre seçer.
          </span>
        </div>
      </div>

      {hardest.length || easiest.length || weak ? (
        <div className="card">
          <h2 className="sheet-title">
            <IconSparkles size={13} /> Sana özel ipuçları
          </h2>
          {hardest.length ? (
            <div style={{ marginBottom: 12 }}>
              <div className="tiny faint" style={{ marginBottom: 6 }}>
                Daha sık sorulacaklar
              </div>
              <div className="tag-row">
                {hardest.map((b) => (
                  <span key={b.item} className="word-chip hard">
                    <b className="de">{b.item}</b>
                    <span>{b.tr}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {easiest.length ? (
            <div style={{ marginBottom: weak ? 12 : 0 }}>
              <div className="tiny faint" style={{ marginBottom: 6 }}>
                Daha seyrek sorulacaklar
              </div>
              <div className="tag-row">
                {easiest.map((b) => (
                  <span key={b.item} className="word-chip easy">
                    <b className="de">{b.item}</b>
                    <span>{b.tr}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {weak ? (
            <div className="tiny muted">
              En zayıf bölümün <b>{SECTION_BY_ID[weak.unit]?.title ?? weak.unit}</b> (%
              {Math.round(weak.accuracy * 100)}). Öğren ekranındaki öneriden tekrar edebilirsin.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <h2 className="sheet-title">
          <IconTarget size={13} /> Tahminler ne kadar tutuyor?
        </h2>
        {blend.n < 10 ? (
          <p className="small muted">
            En az 10 cevap gerekiyor. Şu an {blend.n} cevap var — birkaç tur daha yap.
          </p>
        ) : (
          <>
            <p className="small muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
              Son {blend.n} cevapta birleşik model, doğru cevap vereceğini{' '}
              <b>%{Math.round(blend.accuracy * 100)}</b> isabetle tahmin etti. Daha isabetli olan taraf:{' '}
              <b>{better}</b>.
            </p>
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              <MiniBar label="Birleşim" value={blend.accuracy} max={1} suffix={`%${Math.round(blend.accuracy * 100)}`} />
              <MiniBar label="RWKV" value={rwkv.accuracy} max={1} suffix={`%${Math.round(rwkv.accuracy * 100)}`} />
              <MiniBar label="FSRS" value={fsrs.accuracy} max={1} suffix={`%${Math.round(fsrs.accuracy * 100)}`} />
            </div>
            {trendAcc.length >= 2 ? (
              <div style={{ marginTop: 14 }}>
                <div className="row between tiny faint">
                  <span>Kayan doğruluk (20 cevap)</span>
                  <span className="mono">son %{Math.round(trendAcc[trendAcc.length - 1] * 100)}</span>
                </div>
                <Sparkline points={trendAcc} max={1} height={56} baseline={accuracy} color="#1cb0f6" />
              </div>
            ) : null}
            <div className="plain-list" style={{ marginTop: 12 }}>
              <span>
                <IconEye size={13} /> Gerçek doğruluğun: %{Math.round(accuracy * 100)}
                {calibration != null
                  ? ` · yanılma payı ${calibration < 0.05 ? 'çok düşük' : calibration < 0.12 ? 'düşük' : 'yüksek'}`
                  : ''}
              </span>
              <span>
                <IconTarget size={13} /> Plan, her kelimeyi ortalama %{Math.round(avgTarget * 100)} olasılıkla
                hatırlayacağın şekilde ayarlıyor.
              </span>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="sheet-title">
          <IconClock size={13} /> Tekrar ufukları
        </h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          RWKV-Instant üç ayrı ölçekte unutma hızını öğrenir. Çubuk büyüdükçe o ufuk daha etkin kullanılıyor.
        </p>
        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
          {groups.map((g) => (
            <MiniBar key={g.label} label={g.label} value={g.value} max={groupMax} />
          ))}
        </div>
        <div className="tiny faint" style={{ marginTop: 12 }}>
          {personal.modelSteps} cevap işlendi · gizli durum boyutu {personal.stateSize} · {personal.paramCount}{' '}
          öğrenilebilir ağırlık (hepsi cihazında) · günlük hedef {dailyGoal} cevap.
        </div>
      </div>
        </>
      )}

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
  trend,
}: {
  report: AccuracyModelReport
  personal: PersonalizationReport
  parameters: number[] | null
  events: ReviewEvent[]
  cards: CardStats
  trend: RollingSeries
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
    { label: 'AUC ↑', pick: (m: typeof report.recent.blend) => m.auc, better: 'high' as const, fmt: (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '—') },
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
          <div className="sheet-title">RWKV-Instant (taban)</div>
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
          <div className="sheet-title">FSRS-7 (ikincil)</div>
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
        <div className="row between">
          <h2 className="sheet-title">
            Model trendi (kayan 20 cevap)
          </h2>
          <span className="tiny faint mono">{events.length} olay</span>
        </div>
        {trend.accuracy.length >= 2 ? (
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div>
              <div className="tiny faint">Doğruluk (yüksek iyi)</div>
              <Sparkline points={trend.accuracy} max={1} height={58} />
            </div>
            <div>
              <div className="tiny faint">Brier (düşük iyi)</div>
              <Sparkline points={trend.brier} max={0.5} height={58} color="#ff4b4b" />
            </div>
          </div>
        ) : (
          <div className="tiny faint">Trend için en az 20 cevap gerekiyor.</div>
        )}
      </div>

      <div className="card">
        <h2 className="sheet-title">Tahmin doğruluğu (son 200 cevap)</h2>
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
        <h2 className="sheet-title">Son kararlar</h2>
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
          <h2 className="sheet-title">
            Birleşim ağırlıkları (logit uzayı)
          </h2>
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
        <h2 className="sheet-title">Unutma ufukları (kafa yarılanma süreleri)</h2>
        <div className="stack" style={{ gap: 7 }}>
          {personal.horizons.map((h, i) => (
            <MiniBar key={h.label} label={HORIZON_LABELS[i] ?? h.label} value={h.value} max={horizonMax} />
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="sheet-title">Kalibrasyon</h2>
        <div className="row" style={{ gap: 18, alignItems: 'center' }}>
          <CalibrationChart bins={bins} />
          <div className="tiny faint" style={{ flex: 1 }}>
            Nokta büyüklüğü örnek sayısı. Köşegene yakınlık “%70 dediğinde gerçekten %70 doğru” demektir.
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="sheet-title">Öğe bazlı yanlılık (itemBias)</h2>
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
                <span className={`tag ${b.bias > 0 ? 'tag-bad' : 'tag-good'}`}>
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
        <h2 className="sheet-title">FSRS-7 parametreleri</h2>
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
        <h2 className="sheet-title">Kart dağılımı</h2>
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
        <h2 className="sheet-title">Tema performansı</h2>
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
