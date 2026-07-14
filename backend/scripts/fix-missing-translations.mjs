/**
 * Translate any questions that are missing a PT-PT entry in question_translations.
 * Safe to re-run — skips questions that already have a translation.
 *
 * Run from the backend directory:
 *   cd pub-quiz/backend && node scripts/fix-missing-translations.mjs
 */

import { config } from 'dotenv'
config()

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TRANSLATE_BATCH = 20

async function translateBatch(questions) {
  const payload = questions.map((q, i) => ({
    i,
    text: q.text,
    options: q.options,
    ci: q.options.indexOf(q.correct_answer),
  }))

  const prompt = `Translate these pub quiz questions and answer options from English to European Portuguese (PT-PT).

Rules:
- Use European Portuguese (Portugal), NOT Brazilian Portuguese
- Keep proper nouns, film/song/book titles, brand names, and acronyms unchanged
- Keep sports team names and club names unchanged (e.g. "Manchester United", "Los Angeles Lakers", "New Zealand All Blacks")
- Keep numbers and dates unchanged
- Return ONLY valid JSON, no explanation, same array length as input

Input:
${JSON.stringify(payload, null, 2)}

Output format (translate only "text" and "options" values, keep "i" unchanged):
[{"i":0,"text":"<translated>","options":["<opt1>","<opt2>","<opt3>","<opt4>"]},...]`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0].text.trim()
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const translated = JSON.parse(json)

    return translated.map(t => {
      const orig = payload[t.i]
      return {
        text: t.text,
        options: t.options,
        correct_answer: t.options[orig.ci] ?? t.options[0],
      }
    })
  } catch (e) {
    console.warn(`  ⚠ Translation error: ${e.message}`)
    return null
  }
}

// 1. Find all question IDs that already have a PT-PT translation (paginated)
console.log('Loading existing PT-PT translation IDs…')
const translatedIds = new Set()
let tOffset = 0
while (true) {
  const { data, error } = await supabase
    .from('question_translations')
    .select('question_id')
    .eq('locale', 'pt-PT')
    .range(tOffset, tOffset + 999)

  if (error) { console.error(error.message); process.exit(1) }
  if (!data?.length) break
  data.forEach(r => translatedIds.add(r.question_id))
  if (data.length < 1000) break
  tOffset += 1000
}
console.log(`  ✓ ${translatedIds.size} already translated\n`)

// 2. Load all questions not in that set
console.log('Loading untranslated questions…')
const untranslated = []
let offset = 0
while (true) {
  const { data, error } = await supabase
    .from('questions')
    .select('id, text, correct_answer, options')
    .range(offset, offset + 499)

  if (error) { console.error(error.message); process.exit(1) }
  if (!data?.length) break

  for (const q of data) {
    if (!translatedIds.has(q.id)) untranslated.push(q)
  }

  if (data.length < 500) break
  offset += 500
}

if (!untranslated.length) {
  console.log('✓ All questions already have PT-PT translations. Nothing to do.')
  process.exit(0)
}

console.log(`  ✓ ${untranslated.length} questions need translation\n`)

// 3. Translate in batches
let translated = 0, failed = 0

for (let i = 0; i < untranslated.length; i += TRANSLATE_BATCH) {
  const chunk = untranslated.slice(i, i + TRANSLATE_BATCH)
  process.stdout.write(`[${i + 1}–${Math.min(i + TRANSLATE_BATCH, untranslated.length)}/${untranslated.length}] `)

  const translations = await translateBatch(chunk)

  if (!translations) {
    console.log('⚠ skipped (translation failed)')
    failed += chunk.length
    continue
  }

  const rows = chunk.map((q, j) => ({
    question_id: q.id,
    locale: 'pt-PT',
    text: translations[j].text,
    correct_answer: translations[j].correct_answer,
    options: translations[j].options,
  }))

  const { error: insertErr } = await supabase
    .from('question_translations')
    .upsert(rows, { onConflict: 'question_id,locale' })

  if (insertErr) {
    console.log(`⚠ insert error: ${insertErr.message}`)
    failed += chunk.length
  } else {
    translated += chunk.length
    console.log(`🌍${chunk.length}`)
  }
}

console.log('\n─────────────────────────────────────────')
console.log('Done!')
console.log(`  Translated : ${translated}`)
console.log(`  Failed     : ${failed}`)
console.log('─────────────────────────────────────────')
