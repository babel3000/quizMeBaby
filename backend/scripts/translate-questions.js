/**
 * Translates all questions from English into a target language using LibreTranslate,
 * storing results in the question_translations table.
 *
 * Prerequisites:
 *   1. Run migrations/001_question_translations.sql in Supabase first.
 *   2. Either:
 *      a) Get a free API key (no credit card) at https://libretranslate.com
 *         and set LIBRETRANSLATE_API_KEY in .env, OR
 *      b) Leave LIBRETRANSLATE_API_KEY unset to use a public mirror that
 *         doesn't require a key (less reliable, may hit rate limits).
 *
 * Public mirrors (no signup needed, may be rate-limited):
 *   https://translate.argosopentech.com
 *   https://translate.terraprint.co
 *   https://lt.vern.cc
 * Set LIBRETRANSLATE_URL in .env to use one of these instead of libretranslate.com.
 *
 * Usage:
 *   node scripts/translate-questions.js [locale]
 *
 *   locale defaults to "pt-PT" if omitted.
 *   Example: node scripts/translate-questions.js pt-PT
 *
 * Run from the backend/ directory with Node v18+.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const TARGET_LOCALE = process.argv[2] ?? 'pt-PT'

// Map our locale codes to LibreTranslate language codes (ISO 639-1)
const LIBRE_LANG_MAP = {
  'pt-PT': 'pt',
  'pt-BR': 'pt',
  'es':    'es',
  'fr':    'fr',
  'de':    'de',
  'it':    'it',
  'nl':    'nl',
  'pl':    'pl',
}

const LIBRE_TARGET = LIBRE_LANG_MAP[TARGET_LOCALE]
if (!LIBRE_TARGET) {
  console.error(`Unsupported locale "${TARGET_LOCALE}". Supported: ${Object.keys(LIBRE_LANG_MAP).join(', ')}`)
  process.exit(1)
}

const LIBRE_URL     = (process.env.LIBRETRANSLATE_URL ?? 'https://libretranslate.com').replace(/\/$/, '')
const LIBRE_API_KEY = process.env.LIBRETRANSLATE_API_KEY ?? ''

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
)

// ── LibreTranslate ────────────────────────────────────────────────────

async function libreTranslate(texts) {
  // LibreTranslate accepts q as an array on most instances
  const body = {
    q:      texts,
    source: 'en',
    target: LIBRE_TARGET,
    format: 'text',
  }
  if (LIBRE_API_KEY) body.api_key = LIBRE_API_KEY

  const res = await fetch(`${LIBRE_URL}/translate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LibreTranslate error ${res.status}: ${text}`)
  }

  const data = await res.json()

  // Response is either { translatedText: [...] } (array input)
  // or { translatedText: "..." } (single string input)
  if (Array.isArray(data.translatedText)) return data.translatedText
  if (typeof data.translatedText === 'string') return [data.translatedText]

  // Some instances return an array at top level for array input
  if (Array.isArray(data)) return data.map(d => d.translatedText)

  throw new Error(`Unexpected response format: ${JSON.stringify(data).slice(0, 200)}`)
}

// ── Batch helpers ─────────────────────────────────────────────────────

// Translate one question at a time (5 strings: text + 4 options).
// LibreTranslate public instances are rate-limited — keep batches small.
const STRINGS_PER_QUESTION = 5
const DELAY_MS = 1200   // ~50 req/min conservative limit; increase if you hit 429s

async function translateQuestion(q) {
  const strings = [q.text, ...q.options]   // 5 strings
  const translated = await libreTranslate(strings)

  if (translated.length < STRINGS_PER_QUESTION) {
    throw new Error(`Expected ${STRINGS_PER_QUESTION} translations, got ${translated.length}`)
  }

  const tText    = translated[0]
  const tOptions = translated.slice(1)
  const correctIdx = q.options.indexOf(q.correct_answer)
  const tCorrect   = correctIdx !== -1 ? tOptions[correctIdx] : tOptions[0]

  return {
    question_id:    q.id,
    locale:         TARGET_LOCALE,
    text:           tText,
    correct_answer: tCorrect,
    options:        tOptions,
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` PubQuiz — Question Translator`)
  console.log(` Target locale : ${TARGET_LOCALE} → LibreTranslate "${LIBRE_TARGET}"`)
  console.log(` API URL       : ${LIBRE_URL}`)
  console.log(` API key       : ${LIBRE_API_KEY ? '✓ set' : '✗ not set (using public access)'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Fetch all questions
  const { data: questions, error: fetchError } = await supabase
    .from('questions')
    .select('id, text, correct_answer, options')
    .order('id')

  if (fetchError) throw new Error(`Failed to fetch questions: ${fetchError.message}`)
  console.log(`Found ${questions.length} questions in DB`)

  // Skip ones already translated for this locale
  const { data: existing } = await supabase
    .from('question_translations')
    .select('question_id')
    .eq('locale', TARGET_LOCALE)

  const existingSet = new Set((existing ?? []).map(r => r.question_id))
  const pending = questions.filter(q => !existingSet.has(q.id))

  if (!pending.length) {
    console.log('All questions already translated. Nothing to do.')
    return
  }
  console.log(`${existingSet.size} already translated, ${pending.length} to process`)
  console.log(`Estimated time: ~${Math.ceil(pending.length * DELAY_MS / 60000)} minutes\n`)

  let totalInserted = 0
  let totalFailed   = 0

  for (let i = 0; i < pending.length; i++) {
    const q = pending[i]
    process.stdout.write(`  [${i + 1}/${pending.length}] ${q.text.slice(0, 50).padEnd(50)}… `)

    try {
      const row = await translateQuestion(q)

      const { error: insertError } = await supabase
        .from('question_translations')
        .upsert(row, { onConflict: 'question_id,locale' })

      if (insertError) throw new Error(insertError.message)

      totalInserted++
      console.log('✓')
    } catch (err) {
      totalFailed++
      console.log(`✗  ${err.message}`)

      // Back off on rate limit errors
      if (err.message.includes('429') || err.message.includes('Too Many')) {
        console.log('  Rate limited — waiting 10s…')
        await new Promise(r => setTimeout(r, 10000))
      }
    }

    if (i < pending.length - 1) await new Promise(r => setTimeout(r, DELAY_MS))
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` Done! ${totalInserted} inserted, ${totalFailed} failed.`)
  if (totalFailed > 0) console.log(` Re-run to retry failed questions (already-done ones are skipped).`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
