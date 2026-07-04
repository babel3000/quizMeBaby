/**
 * Fetches multiple-choice questions from the Open Trivia Database
 * (https://opentdb.com) and inserts them into Supabase.
 *
 * Usage:
 *   node scripts/seed-questions.js
 *
 * Run from the backend/ directory. Reads credentials from .env.
 * Safe to re-run — skips questions whose text already exists in the DB.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
)

// ── Helpers ──────────────────────────────────────────────────────────

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uuml;/g, 'ü')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Categories to import ─────────────────────────────────────────────
// Each entry maps one OpenTDB category ID to one of our DB categories.
// Multiple OpenTDB IDs can feed the same DB category.

const SOURCES = [
  { dbName: 'General Knowledge', dbIcon: '🧠',  opentdbId: 9  },
  { dbName: 'Geography',         dbIcon: '🌍',  opentdbId: 22 },
  { dbName: 'History',           dbIcon: '📜',  opentdbId: 23 },
  { dbName: 'Science',           dbIcon: '🔬',  opentdbId: 15 },
  { dbName: 'Science',           dbIcon: '🔬',  opentdbId: 17 },
  { dbName: 'Movies & TV',       dbIcon: '🎬',  opentdbId: 11 },
  { dbName: 'Movies & TV',       dbIcon: '🎬',  opentdbId: 14 },
  { dbName: 'Music Trivia',      dbIcon: '🎵',  opentdbId: 12 },
  { dbName: 'Sports',            dbIcon: '⚽',  opentdbId: 21 },
  { dbName: 'Nature & Animals',  dbIcon: '🐾',  opentdbId: 27 },
  { dbName: 'Tech & Computers',  dbIcon: '💻',  opentdbId: 18 },
  { dbName: 'Art & Literature',  dbIcon: '📚',  opentdbId: 10 },
]

const AMOUNT_PER_REQUEST = 50

// ── DB helpers ───────────────────────────────────────────────────────

async function getOrCreateCategory(name, icon) {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('categories')
    .insert({ name, icon, type: 'general' })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create category "${name}": ${error.message}`)
  console.log(`  Created new category: ${icon} ${name}`)
  return data.id
}

async function fetchFromOpenTDB(categoryId) {
  const url = `https://opentdb.com/api.php?amount=${AMOUNT_PER_REQUEST}&category=${categoryId}&type=multiple`
  const res = await fetch(url)
  const data = await res.json()

  if (data.response_code === 1) {
    console.warn(`  Not enough questions available for category ${categoryId}`)
    return []
  }
  if (data.response_code !== 0) {
    console.warn(`  OpenTDB error code ${data.response_code} for category ${categoryId}`)
    return []
  }
  return data.results
}

// ── Main ─────────────────────────────────────────────────────────────

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(' PubQuiz — Question Seeder')
  console.log(' Source: Open Trivia Database (opentdb.com)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const categoryIdCache = new Map()
  let totalInserted = 0
  let totalSkipped = 0

  for (const source of SOURCES) {
    console.log(`\n▸ ${source.dbIcon} ${source.dbName} (OpenTDB #${source.opentdbId})`)

    // Ensure category exists
    if (!categoryIdCache.has(source.dbName)) {
      const id = await getOrCreateCategory(source.dbName, source.dbIcon)
      categoryIdCache.set(source.dbName, id)
    }
    const categoryId = categoryIdCache.get(source.dbName)

    // Fetch from OpenTDB
    const raw = await fetchFromOpenTDB(source.opentdbId)
    console.log(`  Fetched ${raw.length} questions from API`)
    if (!raw.length) continue

    // Decode + shape
    const rows = raw.map(q => ({
      category_id: categoryId,
      text: decodeHtml(q.question),
      type: 'multiple_choice',
      correct_answer: decodeHtml(q.correct_answer),
      options: shuffle([q.correct_answer, ...q.incorrect_answers]).map(decodeHtml),
      points: 1000,
      time_limit: 30,
    }))

    // Deduplicate against what's already in the DB
    const texts = rows.map(r => r.text)
    const { data: existing } = await supabase
      .from('questions')
      .select('text')
      .in('text', texts)

    const existingSet = new Set((existing ?? []).map(r => r.text))
    const fresh = rows.filter(r => !existingSet.has(r.text))
    const skipped = rows.length - fresh.length

    if (skipped > 0) console.log(`  Skipping ${skipped} already in DB`)
    if (!fresh.length) { console.log('  Nothing new to insert'); continue }

    // Insert
    const { error } = await supabase.from('questions').insert(fresh)
    if (error) {
      console.error(`  Insert error: ${error.message}`)
      continue
    }

    console.log(`  ✓ Inserted ${fresh.length} questions`)
    totalInserted += fresh.length
    totalSkipped += skipped

    // OpenTDB rate limit: 1 request per 5 seconds
    await sleep(5500)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` Done! ${totalInserted} inserted, ${totalSkipped} skipped (duplicates).`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
