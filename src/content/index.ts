/**
 * İçerik yükleyici: `units/*.jsonl` dosyalarını (bir satır = bir öğe) tarayıcıda
 * derleme zamanında içeri alır, doğrular ve erişim indeksleri kurar.
 *
 * Dosya adları bölümleri (`SECTIONS`) temsil eder; bölümler iki üniteye dağılır.
 */

import type { PartOfSpeech, VocabularyItem } from '../engine/types'
import { SECTION_BY_ID, SECTIONS, type CourseUnit, type Section } from './units'

const modules = import.meta.glob('./units/*.jsonl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function parseItem(raw: string, file: string, line: number): VocabularyItem {
  const parsed = JSON.parse(raw) as VocabularyItem
  if (!parsed.id || !parsed.de || !parsed.tr || !parsed.pos || !parsed.unit) {
    throw new Error(`${file}:${line} zorunlu alan eksik (id/de/tr/pos/unit)`)
  }
  if (!SECTION_BY_ID[parsed.unit]) {
    throw new Error(`${file}:${line} bilinmeyen bölüm: ${parsed.unit}`)
  }
  if (parsed.pos === 'noun' && !parsed.article && !parsed.proper) {
    throw new Error(`${file}:${line} isim ama artikel yok: ${parsed.de}`)
  }
  return parsed
}

function load(): VocabularyItem[] {
  const items: VocabularyItem[] = []
  const seen = new Set<string>()
  for (const [file, text] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
    text
      .split('\n')
      .forEach((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('//')) return
        const item = parseItem(trimmed, file, idx + 1)
        if (seen.has(item.id)) throw new Error(`Tekrarlanan öğe kimliği: ${item.id} (${file})`)
        seen.add(item.id)
        items.push(item)
      })
  }
  return items
}

export const ITEMS: VocabularyItem[] = load()

export const ITEM_BY_ID: Map<string, VocabularyItem> = new Map(ITEMS.map((i) => [i.id, i]))

/** Bölüm (ders) kimliğine göre öğeler. */
export const ITEMS_BY_SECTION: Map<string, VocabularyItem[]> = new Map(
  SECTIONS.map((s) => [s.id, ITEMS.filter((i) => i.unit === s.id)]),
)

export const SECTION_COUNTS: Record<string, number> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, ITEMS_BY_SECTION.get(s.id)?.length ?? 0]),
)

export const SECTIONS_WITH_ITEMS: Section[] = SECTIONS.filter((s) => (SECTION_COUNTS[s.id] ?? 0) > 0)

/** Çoktan seçmeli çeldiriciler: önce aynı bölüm, sonra aynı tür. */
export function pickDistractors(
  item: VocabularyItem,
  n: number,
  rng: () => number = Math.random,
  field: 'de' | 'tr' = 'de',
): string[] {
  const sameSection = (ITEMS_BY_SECTION.get(item.unit) ?? []).filter((i) => i.id !== item.id)
  const samePos = ITEMS.filter((i) => i.id !== item.id && i.pos === item.pos && i.unit !== item.unit)
  const pool = [...shuffle(sameSection, rng), ...shuffle(samePos, rng)]
  const out: string[] = []
  const seen = new Set<string>([answerKey(item, field)])
  for (const cand of pool) {
    const value = field === 'de' ? cand.de : cand.tr
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= n) break
  }
  return out
}

function answerKey(item: VocabularyItem, field: 'de' | 'tr'): string {
  return (field === 'de' ? item.de : item.tr).toLowerCase()
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

export const CONTENT_STATS = {
  items: ITEMS.length,
  sections: SECTIONS_WITH_ITEMS.length,
  nouns: ITEMS.filter((i) => i.pos === 'noun').length,
  verbs: ITEMS.filter((i) => i.pos === 'verb').length,
  phrases: ITEMS.filter((i) => i.pos === 'phrase').length,
  withExamples: ITEMS.filter((i) => i.ex).length,
}

export {
  SECTIONS,
  SECTION_BY_ID,
  SECTION_ORDER,
  SECTIONS_BY_UNIT,
  UNITS,
  UNIT_BY_ID,
  sectionById,
  sectionOrder,
} from './units'
export type { CourseUnit, Section }
export type { PartOfSpeech }
