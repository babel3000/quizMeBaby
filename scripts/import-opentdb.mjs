/**
 * Import questions from Open Trivia Database and translate to PT-PT.
 * Run from the backend directory:
 *   cd backend && node ../scripts/import-opentdb.mjs
 *
 * Requires backend/.env with SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
 * Inserts English questions into `questions`, PT-PT translations into `question_translations`.
 */

import { config } from 'dotenv'
config() // loads backend/.env when run from backend/

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// ── Clients ────────────────────────────────────────────────────────────────
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Run from backend/: cd backend && node ../scripts/import-opentdb.mjs')
  process.exit(1)
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

if (!anthropic) console.warn('⚠ No ANTHROPIC_API_KEY — questions will be imported in English only.\n')

// ── Config ─────────────────────────────────────────────────────────────────
const OPENTDB        = 'https://opentdb.com'
const OPENTDB_BATCH  = 50    // max per OpenTDB request
const OPENTDB_DELAY  = 5200  // ms between requests (rate limit)
const TRANSLATE_BATCH = 20   // questions per Claude call

// OpenTDB category ID → our category name
const CATEGORY_MAP = {
  9:  'General Knowledge',
  10: 'General Knowledge',   // Books
  11: 'Movies & TV',
  12: 'Music',
  13: 'Movies & TV',         // Musicals & Theatres
  14: 'Movies & TV',         // Television
  15: 'Video Games',
  16: 'General Knowledge',   // Board Games
  17: 'Science',
  18: 'Science',             // Computers
  19: 'Science',             // Mathematics
  20: 'General Knowledge',   // Mythology
  21: 'Sports',
  22: 'Geography',
  23: 'History',
  24: 'General Knowledge',   // Politics
  25: 'General Knowledge',   // Art
  26: 'General Knowledge',   // Celebrities
  27: 'Science',             // Animals
  28: 'General Knowledge',   // Vehicles
  29: 'General Knowledge',   // Comics
  30: 'Science',             // Gadgets
  31: 'General Knowledge',   // Anime & Manga
  32: 'Movies & TV',         // Cartoons
}

const NEW_CATEGORIES = {
  'Geography':   '🌍',
  'History':     '📜',
  'Video Games': '🎮',
}

// ── Helpers ────────────────────────────────────────────────────────────────
function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '…').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&ecirc;/g, 'ê')
    .replace(/&oacute;/g, 'ó').replace(/&uuml;/g, 'ü').replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö').replace(/&ntilde;/g, 'ñ').replace(/&aacute;/g, 'á')
    .replace(/&agrave;/g, 'à').replace(/&iacute;/g, 'í').replace(/&uacute;/g, 'ú')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Translation ────────────────────────────────────────────────────────────
async function translateBatch(questions) {
  if (!anthropic) return null

  // Send text + options indexed by position; track correct_answer by index
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
    // Strip markdown code fences if present
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const translated = JSON.parse(json)

    // Build translation rows
    return translated.map(t => {
      const orig = payload[t.i]
      return {
        text: t.text,
        options: t.options,
        correct_answer: t.options[orig.ci] ?? t.options[0],
      }
    })
  } catch (e) {
    console.warn(`\n  ⚠ Translation error: ${e.message}`)
    return null
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

// 1. Categories
console.log('Loading categories…')
const { data: existingCats } = await supabase.from('categories').select('*')
const catByName = Object.fromEntries(existingCats.map(c => [c.name, c]))

for (const [name, icon] of Object.entries(NEW_CATEGORIES)) {
  if (!catByName[name]) {
    console.log(`  + Creating category: ${name}`)
    const { data, error } = await supabase
      .from('categories').insert({ name, type: 'general', icon }).select().single()
    if (error) console.warn(`  ! Failed: ${error.message}`)
    else catByName[name] = data
  } else {
    console.log(`  ✓ ${name}`)
  }
}
console.log()

// 2. Existing question texts for dedup
console.log('Indexing existing questions…')
let offset = 0
const existingTexts = new Set()
while (true) {
  const { data } = await supabase.from('questions').select('text').range(offset, offset + 499)
  if (!data?.length) break
  data.forEach(q => existingTexts.add(q.text.trim().toLowerCase()))
  if (data.length < 500) break
  offset += 500
}
console.log(`  ✓ ${existingTexts.size} existing questions indexed\n`)

// 3. Existing question IDs with PT-PT translations (for partial-rerun safety)
const { data: existingTranslationIds } = await supabase
  .from('question_translations').select('question_id').eq('locale', 'pt-PT')
const translatedIds = new Set((existingTranslationIds ?? []).map(r => r.question_id))

// 4. OpenTDB session token
console.log('Getting OpenTDB session token…')
const tokenData = await fetch(`${OPENTDB}/api_token.php?command=request`).then(r => r.json())
const token = tokenData.token
console.log(`  ✓ token acquired\n`)

// 5. OpenTDB categories
console.log('Fetching OpenTDB categories…')
const { trivia_categories } = await fetch(`${OPENTDB}/api_category.php`).then(r => r.json())
const opentdbCats = trivia_categories.filter(c => CATEGORY_MAP[c.id])
console.log(`  ✓ ${opentdbCats.length} categories\n`)

// 6. Fetch, insert, translate
let totalInserted = 0, totalSkipped = 0, totalTranslated = 0, totalFailed = 0

for (const cat of opentdbCats) {
  const ourCatName = CATEGORY_MAP[cat.id]
  const ourCat = catByName[ourCatName]
  if (!ourCat) { console.warn(`  ! No category for ${ourCatName}`); continue }

  process.stdout.write(`[${cat.name}] `)
  let exhausted = false

  while (!exhausted) {
    await sleep(OPENTDB_DELAY)

    let data
    try {
      data = await fetch(
        `${OPENTDB}/api.php?amount=${OPENTDB_BATCH}&category=${cat.id}&type=multiple&token=${token}`
      ).then(r => r.json())
    } catch (e) { console.log(`\n  ! fetch error: ${e.message}`); break }

    if (data.response_code === 4 || data.response_code === 1 || !data.results?.length) {
      exhausted = true; break
    }
    if (data.response_code !== 0) break

    // Decode and build question rows
    const newRows = []
    for (const q of data.results) {
      const text = decodeHtml(q.question)
      if (existingTexts.has(text.trim().toLowerCase())) { totalSkipped++; continue }

      const correct = decodeHtml(q.correct_answer)
      const options = shuffle([correct, ...q.incorrect_answers.map(decodeHtml)])

      newRows.push({ text, correct_answer: correct, options, difficulty: q.difficulty,
        type: 'multiple_choice', category_id: ourCat.id, points: 1000, time_limit: 30 })
    }

    if (!newRows.length) {
      if (data.results.length < OPENTDB_BATCH) exhausted = true
      continue
    }

    // Insert English questions
    const { data: inserted, error: insertErr } = await supabase
      .from('questions').insert(newRows).select('id, text, correct_answer, options')

    if (insertErr) {
      console.warn(`\n  ! insert error: ${insertErr.message}`)
      totalFailed += newRows.length
    } else {
      inserted.forEach(q => existingTexts.add(q.text.trim().toLowerCase()))
      totalInserted += inserted.length
      process.stdout.write(`+${inserted.length} `)

      // Translate in sub-batches
      if (anthropic) {
        const toTranslate = inserted.filter(q => !translatedIds.has(q.id))
        for (let i = 0; i < toTranslate.length; i += TRANSLATE_BATCH) {
          const chunk = toTranslate.slice(i, i + TRANSLATE_BATCH)
          const translations = await translateBatch(chunk)
          if (translations) {
            const rows = chunk.map((q, j) => ({
              question_id: q.id,
              locale: 'pt-PT',
              text: translations[j].text,
              correct_answer: translations[j].correct_answer,
              options: translations[j].options,
            }))
            const { error: tErr } = await supabase.from('question_translations').insert(rows)
            if (tErr) console.warn(`\n  ! translation insert error: ${tErr.message}`)
            else { totalTranslated += rows.length; process.stdout.write(`🌍${rows.length} `) }
            rows.forEach(r => translatedIds.add(r.question_id))
          }
        }
      }
    }

    if (data.results.length < OPENTDB_BATCH) exhausted = true
  }
  console.log()
}

console.log('\n─────────────────────────────────────────')
console.log('Done!')
console.log(`  Inserted (EN)  : ${totalInserted}`)
console.log(`  Translated (PT): ${totalTranslated}`)
console.log(`  Skipped (dupe) : ${totalSkipped}`)
console.log(`  Failed         : ${totalFailed}`)
console.log('─────────────────────────────────────────')
