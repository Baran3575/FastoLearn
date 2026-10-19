import { useRef, useState } from 'react'
import { germanVoiceName, speak, speechAvailable } from '../audio'
import { CONTENT_STATS } from '../content'
import { useStore } from '../state/store'
import {
  IconBolt,
  IconCheck,
  IconDownload,
  IconFlame,
  IconGear,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUpload,
  IconVolume,
  IconTarget,
  IconMinus,
  IconLayers,
} from './icons'
import { Bar, Field, Stat, Switch, formatRelative } from './ui'

export function ProfileScreen() {
  const store = useStore()
  const user = store.activeUser()
  const users = store.users()
  const overall = store.statsOverall()
  const cards = store.engine().cardStats()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newName, setNewName] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const voice = speechAvailable() ? germanVoiceName() : null
  const share = cards.total ? (cards.young + cards.mature) / cards.total : 0

  const commitRename = (id: string) => {
    if (draft.trim()) store.renameUser(id, draft)
    setEditing(null)
  }

  const exportJson = () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fastolearn-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setNote('Yedek indirildi.')
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const ok = store.importData(String(reader.result ?? ''))
      setNote(ok ? 'Yedek geri yüklendi.' : 'Dosya okunamadı ya da biçim uygun değil.')
    }
    reader.readAsText(file)
  }

  return (
    <div className="stack">
      <div>
        <h2>Profil</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          Her öğrencinin kendi motor durumu, tekrar planı ve istatistikleri ayrı tutulur.
        </p>
      </div>

      <div className="card">
        <div className="stat-row">
          <Stat label="XP" value={user.xp} />
          <Stat label="Seri" value={user.streak} hint={`en iyi ${user.bestStreak}`} />
          <Stat label="Doğruluk" value={`${Math.round(overall.accuracy * 100)}%`} hint={`${overall.reviews} cevap`} />
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="row between tiny faint" style={{ marginBottom: 6 }}>
            <span>Kelime dağarcığı</span>
            <span>
              {cards.total - cards.fresh}/{cards.total}
            </span>
          </div>
          <Bar value={share} good />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Öğrenciler</h3>
        <div className="stack" style={{ gap: 9 }}>
          {users.map((u) => {
            const active = u.id === user.id
            return (
              <div className="user-row" key={u.id}>
                <div className="avatar">{u.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editing === u.id ? (
                    <input
                      className="text-input"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitRename(u.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(u.id)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <>
                      <div className="row" style={{ gap: 6 }}>
                        <span style={{ fontWeight: 620, fontSize: 14 }}>{u.name}</span>
                        {active ? <span className="chip tiny-chip accent">aktif</span> : null}
                      </div>
                      <div className="tiny faint">
                        {u.xp} XP · {u.totals.reviews} cevap · {Object.keys(u.cards).length} kart
                      </div>
                    </>
                  )}
                </div>
                {!active ? (
                  <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => store.setActiveUser(u.id)}>
                    Seç
                  </button>
                ) : null}
                <button
                  className="icon-btn sm"
                  aria-label="Yeniden adlandır"
                  onClick={() => {
                    setEditing(u.id)
                    setDraft(u.name)
                  }}
                >
                  <IconPencil size={15} />
                </button>
                {users.length > 1 ? (
                  <button
                    className="icon-btn sm"
                    aria-label="Sil"
                    onClick={() => {
                      if (confirm(`${u.name} adlı öğrencinin tüm ilerlemesi silinecek. Emin misin?`)) store.deleteUser(u.id)
                    }}
                  >
                    <IconTrash size={15} />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <input
            className="text-input"
            placeholder="Yeni öğrenci adı"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn"
            onClick={() => {
              store.addUser(newName || `Öğrenci ${users.length + 1}`)
              setNewName('')
            }}
          >
            <IconPlus size={16} />
            Ekle
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">
          <IconTarget size={13} /> Günlük hedef
        </h3>
        <div className="row between">
          <div>
            <div style={{ fontWeight: 620 }}>{user.dailyGoal} cevap / gün</div>
            <div className="tiny faint">Hedefe ulaşınca seri sürer; tekrar planını yine motor ayarlar.</div>
          </div>
        </div>
        <input
          type="range"
          min={10}
          max={150}
          step={5}
          value={user.dailyGoal}
          onChange={(e) => store.setDailyGoal(Number(e.target.value))}
          style={{ width: '100%', marginTop: 10, accentColor: '#58cc02' }}
        />
      </div>

      <div className="card">
        <h3 className="card-title">
          <IconGear size={13} /> Tercihler
        </h3>
        <Field label="Dinleme alıştırmaları" hint="Almanca telaffuz (Web Speech) kullanılsın">
          <Switch
            on={user.settings.listenEnabled}
            onChange={(v) => store.updateSettings({ listenEnabled: v })}
            label="Dinleme alıştırmaları"
          />
        </Field>
        <Field label="Otomatik derecelendirme" hint="Zorluk/kolaylık cevap hızından çıkarılsın (önerilir)">
          <Switch
            on={user.settings.autoRating}
            onChange={(v) => store.updateSettings({ autoRating: v })}
            label="Otomatik derecelendirme"
          />
        </Field>
        <Field label="Motor tahminlerini göster" hint="Cevap sonrası RWKV/FSRS olasılıkları görünsün">
          <Switch
            on={user.settings.showPredictions}
            onChange={(v) => store.updateSettings({ showPredictions: v })}
            label="Tahminleri göster"
          />
        </Field>
        <Field
          label="Sıralı müfredat"
          hint="Sıfırdan başla: yeni kelimeler sıradaki bölümden gelsin (önerilir)"
        >
          <Switch
            on={user.settings.curriculum}
            onChange={(v) => store.updateSettings({ curriculum: v })}
            label="Sıralı müfredat"
          />
        </Field>
        <Field label="Sesli geri bildirim" hint="Doğru/yanlış cevaplarda kısa bir ses çalsın">
          <Switch
            on={user.settings.soundEnabled}
            onChange={(v) => store.updateSettings({ soundEnabled: v })}
            label="Sesli geri bildirim"
          />
        </Field>
        <Field label="Oturum başına yeni kelime" hint={`Şu an: ${user.settings.newPerSession}`}>
          <div className="stepper">
            <button
              className="icon-btn sm"
              aria-label="Azalt"
              onClick={() => store.updateSettings({ newPerSession: Math.max(0, user.settings.newPerSession - 1) })}
            >
              <IconMinus size={14} />
            </button>
            <span className="mono">{user.settings.newPerSession}</span>
            <button
              className="icon-btn sm"
              aria-label="Arttır"
              onClick={() => store.updateSettings({ newPerSession: Math.min(20, user.settings.newPerSession + 1) })}
            >
              <IconPlus size={14} />
            </button>
          </div>
        </Field>
      </div>

      <div className="card">
        <h3 className="card-title">
          <IconVolume size={13} /> Almanca ses
        </h3>
        <div className="row between">
          <div>
            <div style={{ fontWeight: 620 }}>
              {voice ? voice : speechAvailable() ? 'Almanca ses bulunamadı' : 'Tarayıcı desteklemiyor'}
            </div>
            <div className="tiny faint">
              {voice
                ? 'Dinleme ve dikte alıştırmaları bu sesle okunur.'
                : 'Chrome/Edge/Safari’de çalışır. Ses yoksa alıştırmalar yazarak çözülebilir.'}
            </div>
          </div>
          <button className="btn ghost" disabled={!voice} onClick={() => speak('Hallo! Ich lerne Deutsch. Wie geht es dir?')}>
            <IconVolume size={16} />
            Test
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">
          <IconLayers size={13} /> Veri
        </h3>
        <div className="grid-2">
          <button className="btn" onClick={exportJson}>
            <IconDownload size={16} />
            Yedek indir
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <IconUpload size={16} />
            Geri yükle
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importJson(file)
            e.target.value = ''
          }}
        />
        <button
          className="btn ghost block"
          style={{ marginTop: 10 }}
          onClick={() => {
            if (confirm('Bu öğrencinin tüm ilerlemesi, kartları ve motor durumu sıfırlanacak. Emin misin?')) {
              store.resetProgress()
              setNote('İlerleme sıfırlandı.')
            }
          }}
        >
          <IconTrash size={16} />
          İlerlemeyi sıfırla
        </button>
        {note ? (
          <div className="row tiny faint" style={{ marginTop: 10, gap: 6 }}>
            <IconCheck size={13} />
            <span>{note}</span>
          </div>
        ) : null}
      </div>

      <div className="card tight">
        <div className="card-title">İçerik</div>
        <div className="legend">
          <span>
            <IconLayers size={12} /> {CONTENT_STATS.items} kelime
          </span>
          <span>
            <IconTarget size={12} /> {CONTENT_STATS.sections} bölüm
          </span>
          <span>{CONTENT_STATS.nouns} isim</span>
          <span>{CONTENT_STATS.verbs} fiil</span>
          <span>{CONTENT_STATS.withExamples} örnek cümle</span>
        </div>
        <div className="tiny faint" style={{ marginTop: 10 }}>
          Tüm veriler yalnızca bu cihazda (localStorage) tutulur; hiçbir sunucuya gönderilmez.
          {user.createdAt ? ` Hesap açılışı: ${formatRelative(user.createdAt)}.` : ''}
        </div>
      </div>

      <div className="card tight">
        <div className="legend">
          <span>
            <IconFlame size={12} /> {user.streak} günlük seri
          </span>
          <span>
            <IconBolt size={12} /> {user.xp} XP
          </span>
        </div>
      </div>
    </div>
  )
}
