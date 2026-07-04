/**
 * Translates all questions from English into a target language using the DeepL API,
 * storing results in the question_translations table.
 *
 * Prerequisites:
 *   1. Run migrations/001_question_translations.sql in Supabase first.
 *   2. Set DEEPL_API_KEY in .env  (sign up free at https://www.deepl.com/pro-api)
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

// Map our locale codes to DeepL language codes
const DEEPL_LANG_MAP = {
  'pt-PT': 'PT-PT',
  'pt-BR': 'PT-BR',
  'es':    'ES',
  'fr':    'FR',
  'de':    'DE',
  'it':    'IT',
}

const DEEPL_TARGET = DEEPL_LANG_MAP[TARGET_LOCALE]
if (!DEEPL_TARGET) {
  console.error(`Unsupported locale "${TARGET_LOCALE}". Supported: ${Object.keys(DEEPL_LANG_MAP).join(', ')}`)
  process.exit(1)
}

const DEEPL_API_KEY = process.env.DEEPL_API_KEY
if (!DEEPL_API_KEY) {
  console.error('DEEPL_API_KEY is not set in .env')
  process.exit(1)
}

// Free-tier keys end with :fx; paid keys use a different base URL
const DEEPL_BASE = DEEPL_API_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com'
  : 'https://api.deepl.com'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
)

// ── DeepL ─────────────────────────────────────────────────────────────

async function deepLTranslate(texts) {
  const res = await fetch(`${DEEPL_BASE}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      source_lang: 'EN',
      target_lang: DEEPL_TARGET,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepL API error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.translations.map(t => t.text)
}

// ── Batch helpers ─────────────────────────────────────────────────────

// DeepL allows up to 50 text strings per request.
// Each question needs: text + 4 options = 5 strings → 10 questions per batch.
const STRINGS_PER_QUESTION = 5
const MAX_STRINGS_PER_CALL  = 50
const BATCH_SIZE             = Math.floor(MAX_STRINGS_PER_CALL / STRINGS_PER_QUESTION)

async function translateBatch(questions) {
  // Flatten into one array: [q1.text, q1.opt0, q1.opt1, q1.opt2, q1.opt3, q2.text, …]
  const strings = questions.flatMap(q => [q.text, ...q.options])

  const translated = await deepLTranslate(strings)

  return questions.map((q, i) => {
    const base = i * STRINGS_PER_QUESTION
    const tText    = translated[base]
    const tOptions = translated.slice(base + 1, base + STRINGS_PER_QUESTION)

    // Find which translated option corresponds to the correct_answer
    const correctIdx = q.options.indexOf(q.correct_answer)
    const tCorrect   = correctIdx !== -1 ? tOptions[correctIdx] : tOptions[0]

    return {
      question_id:    q.id,
      locale:         TARGET_LOCALE,
      text:           tText,
      correct_answer: tCorrect,
      options:        tOptions,
    }
  })
}

// ── Main ──────────────────────────────────────────────────────────────

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` PubQuiz — Question Translator`)
  console.log(` Target locale : ${TARGET_LOCALE} (${DEEPL_TARGET})`)
  console.log(` DeepL base URL: ${DEEPL_BASE}`)
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
    console.log('All questions already translated for this locale. Nothing to do.')
    return
  }
  console.log(`${existingSet.size} already translated, ${pending.length} to process\n`)

  let totalInserted = 0
  let totalFailed   = 0

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(pending.length / BATCH_SIZE)
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} questions)…`)

    try {
      const rows = await translateBatch(batch)

      const { error: insertError } = await supabase
        .from('question_translations')
        .upsert(rows, { onConflict: 'question_id,locale' })

      if (insertError) throw new Error(insertError.message)

      totalInserted += rows.length
      console.log(` ✓ inserted ${rows.length}`)
    } catch (err) {
      totalFailed += batch.length
      console.log(` ✗ ${err.message}`)
    }

    // Respect DeepL rate limits — short pause between batches
    if (i + BATCH_SIZE < pending.length) await new Promise(r => setTimeout(r, 300))
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` Done! ${totalInserted} inserted, ${totalFailed} failed.`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
