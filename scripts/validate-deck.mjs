#!/usr/bin/env node
/**
 * Deck doğrulama: JSONL satırlarını, kimlik tekilliğini ve Almanca isim
 * alanlarının (artikel/çoğul) tutarlılığını kontrol eder.
 *
 *   node scripts/validate-deck.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'src/content/units')
const unitsSrc = readFileSync(join(root, 'src/content/units.ts'), 'utf8')
// Bölüm kimlikleri `const SECTION_DATA: Row[] = [...]` bloğundan okunur
// (satır biçimi: ['begruessung', 'temel', 1, ...]).
const sectionBlock = unitsSrc.slice(unitsSrc.indexOf('const SECTION_DATA'))
const unitIds = new Set([...sectionBlock.matchAll(/^\s*\['([a-z]+)',/gm)].map((m) => m[1]))

const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()
const POS = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'pron', 'num', 'phrase', 'other'])
const ARTICLES = new Set(['der', 'die', 'das'])

const errors = []
const warnings = []
const ids = new Set()
const pairs = new Map()
const stats = { items: 0, nouns: 0, verbs: 0, phrases: 0, examples: 0, units: new Set() }

for (const file of files) {
  const lines = readFileSync(join(dir, file), 'utf8').split('\n')
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const where = `${file}:${i + 1}`
    let item
    try {
      item = JSON.parse(trimmed)
    } catch (e) {
      errors.push(`${where} geçersiz JSON: ${e.message}`)
      return
    }
    stats.items++
    if (!item.id || !item.de || !item.tr || !item.pos || !item.unit) {
      errors.push(`${where} zorunlu alan eksik`)
      return
    }
    if (ids.has(item.id)) errors.push(`${where} tekrarlanan id: ${item.id}`)
    ids.add(item.id)
    const pairKey = `${item.de.toLowerCase()}::${item.tr.toLowerCase()}`
    if (pairs.has(pairKey)) errors.push(`${where} tekrarlanan anlam çifti: ${item.de} = ${item.tr} (önce: ${pairs.get(pairKey)})`)
    pairs.set(pairKey, where)
    if (!POS.has(item.pos)) errors.push(`${where} bilinmeyen pos: ${item.pos}`)
    if (!unitIds.has(item.unit)) errors.push(`${where} bilinmeyen ünite: ${item.unit}`)
    stats.units.add(item.unit)

    if (item.pos === 'noun') {
      stats.nouns++
      if (!ARTICLES.has(item.article) && !item.proper) {
        errors.push(`${where} isimde artikel yok/yanlış: ${item.de}`)
      }
      if (!item.plural && !item.proper && !item.pluralOnly) warnings.push(`${where} çoğul yok: ${item.de}`)
      if (item.plural && !/^die /.test(item.plural)) errors.push(`${where} çoğul "die " ile başlamalı: ${item.plural}`)
      if (item.article && !item.de.startsWith(item.article + ' ')) {
        warnings.push(`${where} artikel ile kelime uyuşmuyor: ${item.de}`)
      }
    }
    if (item.pos === 'verb') stats.verbs++
    if (item.pos === 'phrase') stats.phrases++
    if (item.ex) stats.examples++
    else warnings.push(`${where} örnek cümle yok: ${item.de}`)
    if (item.ex && !item.exTr) warnings.push(`${where} örnek cümlesinin çevirisi yok: ${item.de}`)
    if (/[a-zA-Zçğıöşü]/.test(item.tr) === false) warnings.push(`${where} şüpheli Türkçe: ${item.tr}`)
  })
}

console.log(`Dosya: ${files.length} ünite · Öğe: ${stats.items}`)
console.log(`  isim ${stats.nouns} · fiil ${stats.verbs} · kalıp ${stats.phrases} · örnek cümle ${stats.examples}`)
console.log(`  kapsanan ünite: ${stats.units.size}/${unitIds.size}`)

const missing = [...unitIds].filter((u) => !stats.units.has(u))
if (missing.length) warnings.push(`içeriksiz ünite: ${missing.join(', ')}`)

if (warnings.length) {
  console.log(`\n${warnings.length} uyarı:`)
  for (const w of warnings.slice(0, 25)) console.log(`  ! ${w}`)
  if (warnings.length > 25) console.log(`  … ${warnings.length - 25} uyarı daha`)
}
if (errors.length) {
  console.error(`\n${errors.length} HATA:`)
  for (const e of errors) console.error(`  x ${e}`)
  process.exit(1)
}
console.log('\nDeck geçerli.')
