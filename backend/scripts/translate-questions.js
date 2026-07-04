/**
 * Translates all questions from English into a target language using Claude Haiku,
 * storing results in the question_translations table.
 *
 * Prerequisites:
 *   1. Run migrations/001_question_translations.sql in Supabase first.
 *   2. Add ANTHROPIC_API_KEY to backend/.env
 *      (same key you use for Claude Code — no new account needed)
 *
 * Usage:
 *   node scripts/translate-questions.js [locale]
 *
 *   locale defaults to "pt-PT" if omitted.
 *   Supported: pt-PT, pt-BR, es, fr, de, it, nl, pl
 *
 *   Example: node scripts/translate-questions.js pt-PT
 *
 * Cost: ~$0.001 per question (Haiku pricing). 655 questions ≈ $0.65 total.
 * Safe to re-run — already-translated questions are skipped.
 *
 * Run from the backend/ directory with Node v18+.
 */

import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const TARGET_LOCALE = process.argv[2] ?? 'pt-PT'

const LOCALE_NAMES = {
  'pt-PT': 'European Portuguese (Portugal)',
  'pt-BR': 'Brazilian Portuguese',
  'es':    'Spanish',
  'fr':    'French',
  'de':    'German',
  'it':    'Italian',
  'nl':    'Dutch',
  'pl':    'Polish',
}

const LOCALE_NAME = LOCALE_NAMES[TARGET_LOCALE]
if (!LOCALE_NAME) {
  console.error(`Unsupported locale "${TARGET_LOCALE}". Supported: ${Object.keys(LOCALE_NAMES).join(', ')}`)
  process.exit(1)
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set in .env')
  process.exit(1)
}

const anthropic = new Anthropic()
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// ── Translation ───────────────────────────────────────────────────────

// 20 questions per API call (100 strings). Keeps prompts manageable
// and cost low while minimising total number of API calls.
const BATCH_SIZE          = 20
const STRINGS_PER_QUESTION = 5   // text + 4 options

async function translateBatch(questions) {
  // Flatten: [q1.text, q1.opt0, q1.opt1, q1.opt2, q1.opt3, q2.text, …]
  const strings = questions.flatMap(q => [q.text, ...q.options])

  const message = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: `You are a professional translator specialising in quiz content. \
Translate the provided JSON array of strings from English to ${LOCALE_NAME}. \
Rules:
- Return ONLY a valid JSON array with exactly the same number of elements in the same order.
- Keep proper nouns, brand names, and acronyms as-is unless they have a well-known ${LOCALE_NAME} equivalent.
- Keep the tone natural and conversational, suitable for a pub quiz.
- Do not add any text, explanations, or markdown outside the JSON array.`,
    messages: [{ role: 'user', content: JSON.stringify(strings) }],
  })

  const raw = message.content[0].text.trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array in response: ${raw.slice(0, 300)}`)

  const translated = JSON.parse(match[0])
  if (translated.length !== strings.length) {
    throw new Error(`Expected ${strings.length} strings, got ${translated.length}`)
  }

  return questions.map((q, i) => {
    const base     = i * STRINGS_PER_QUESTION
    const tText    = translated[base]
    const tOptions = translated.slice(base + 1, base + STRINGS_PER_QUESTION)

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
  console.log(` Target  : ${TARGET_LOCALE} (${LOCALE_NAME})`)
  console.log(` Model   : claude-haiku-4-5`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Fetch all questions
  const { data: questions, error: fetchError } = await supabase
    .from('questions')
    .select('id, text, correct_answer, options')
    .order('id')

  if (fetchError) throw new Error(`Failed to fetch questions: ${fetchError.message}`)
  console.log(`Found ${questions.length} questions in DB`)

  // Skip already-translated ones
  const { data: existing } = await supabase
    .from('question_translations')
    .select('question_id')
    .eq('locale', TARGET_LOCALE)

  const existingSet = new Set((existing ?? []).map(r => r.question_id))
  const pending     = questions.filter(q => !existingSet.has(q.id))

  if (!pending.length) {
    console.log('All questions already translated. Nothing to do.')
    return
  }

  const totalBatches = Math.ceil(pending.length / BATCH_SIZE)
  console.log(`${existingSet.size} already done, ${pending.length} to translate`)
  console.log(`${totalBatches} API calls × ~${BATCH_SIZE} questions each\n`)

  let totalInserted = 0
  let totalFailed   = 0

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch    = pending.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    process.stdout.write(`  Batch ${String(batchNum).padStart(3)}/${totalBatches} (${batch.length} questions)… `)

    try {
      const rows = await translateBatch(batch)

      const { error: upsertError } = await supabase
        .from('question_translations')
        .upsert(rows, { onConflict: 'question_id,locale' })

      if (upsertError) throw new Error(upsertError.message)

      totalInserted += rows.length
      console.log(`✓  (${totalInserted} total)`)
    } catch (err) {
      totalFailed += batch.length
      console.log(`✗  ${err.message}`)
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` Done! ${totalInserted} inserted, ${totalFailed} failed.`)
  if (totalFailed > 0) console.log(` Re-run to retry failed batches (done ones are skipped).`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
