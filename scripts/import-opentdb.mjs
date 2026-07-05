/**
 * Import questions from the Open Trivia Database (opentdb.com).
 * Run from the repo root: node scripts/import-opentdb.mjs
 *
 * Requires the backend to be running at http://localhost:3001.
 * Fetches all multiple-choice questions across every OpenTDB category,
 * maps them to our category schema, deduplicates against existing questions,
 * and inserts them via the backend REST API.
 */

const API = 'http://localhost:3001'
const OPENTDB = 'https://opentdb.com'
const BATCH = 50      // max questions per OpenTDB request
const DELAY_MS = 5200 // OpenTDB rate limit: 1 request per 5s per token

// Map OpenTDB category IDs → our category names (created if missing)
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
  32: 'Movies & TV',         // Cartoon & Animations
}

// New categories to create (name → icon)
const NEW_CATEGORIES = {
  'Geography':   '🌍',
  'History':     '📜',
  'Video Games': '🎮',
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uuml;/g, 'ü')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function get(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res
}

// ── 1. Check backend is running ────────────────────────────────────────────
console.log('Checking backend…')
try {
  await get(`${API}/api/questions/count`)
} catch {
  console.error('Backend is not running at http://localhost:3001. Start it first with: cd backend && npm run dev')
  process.exit(1)
}
console.log('  ✓ backend online\n')

// ── 2. Load existing categories, create missing ones ───────────────────────
console.log('Loading categories…')
const catsRes = await fetch(`${API}/api/questions/categories`)
const existingCats = await catsRes.json()
const catByName = Object.fromEntries(existingCats.map(c => [c.name, c]))

for (const [name, icon] of Object.entries(NEW_CATEGORIES)) {
  if (!catByName[name]) {
    console.log(`  + Creating category: ${name}`)
    const res = await post('/api/questions/categories', { name, type: 'general', icon })
    if (res.ok) {
      const newCat = await res.json()
      catByName[name] = newCat
    } else {
      console.warn(`  ! Failed to create category ${name}: ${res.status}`)
    }
  } else {
    console.log(`  ✓ ${name}`)
  }
}
console.log()

// ── 3. Load existing question texts for dedup ──────────────────────────────
console.log('Loading existing questions for deduplication…')
const countRes = await get(`${API}/api/questions/count`)
const total = countRes.count
const existingTexts = new Set()
const PAGE = 200
for (let offset = 0; offset < total; offset += PAGE) {
  const page = await get(`${API}/api/questions?limit=${PAGE}&offset=${offset}`)
  for (const q of page) existingTexts.add(q.text.trim().toLowerCase())
}
console.log(`  ✓ ${existingTexts.size} existing questions indexed\n`)

// ── 4. Get OpenTDB session token (ensures no repeat questions per run) ─────
console.log('Getting OpenTDB session token…')
const tokenData = await get(`${OPENTDB}/api_token.php?command=request`)
const token = tokenData.token
console.log(`  ✓ token acquired\n`)

// ── 5. Get OpenTDB categories ──────────────────────────────────────────────
console.log('Fetching OpenTDB categories…')
const catData = await get(`${OPENTDB}/api_category.php`)
const opentdbCats = catData.trivia_categories.filter(c => CATEGORY_MAP[c.id])
console.log(`  ✓ ${opentdbCats.length} categories to import\n`)

// ── 6. Fetch and insert questions per category ────────────────────────────
let totalInserted = 0
let totalSkipped = 0
let totalFailed = 0

for (const cat of opentdbCats) {
  const ourCatName = CATEGORY_MAP[cat.id]
  const ourCat = catByName[ourCatName]
  if (!ourCat) {
    console.warn(`  ! No category found for "${ourCatName}", skipping OpenTDB category ${cat.id}`)
    continue
  }

  process.stdout.write(`[${cat.name}] → ${ourCatName}: `)
  let catInserted = 0
  let catSkipped = 0
  let exhausted = false

  while (!exhausted) {
    await sleep(DELAY_MS)

    let data
    try {
      data = await get(`${OPENTDB}/api.php?amount=${BATCH}&category=${cat.id}&type=multiple&token=${token}`)
    } catch (e) {
      console.log(`\n  ! Fetch error for category ${cat.id}: ${e.message}`)
      break
    }

    // response_code 4 = token exhausted for this category
    if (data.response_code === 4 || data.response_code === 1) {
      exhausted = true
      break
    }
    if (data.response_code !== 0 || !data.results?.length) break

    for (const q of data.results) {
      const text = decodeHtml(q.question)
      const correct = decodeHtml(q.correct_answer)
      const wrong = q.incorrect_answers.map(decodeHtml)

      // Skip if already exists
      if (existingTexts.has(text.trim().toLowerCase())) {
        catSkipped++
        totalSkipped++
        continue
      }

      const options = shuffle([correct, ...wrong])

      const res = await post('/api/questions', {
        text,
        type: 'multiple_choice',
        category_id: ourCat.id,
        correct_answer: correct,
        options,
        points: 1000,
        time_limit: 30,
        difficulty: q.difficulty, // 'easy' | 'medium' | 'hard'
      })

      if (res.ok) {
        existingTexts.add(text.trim().toLowerCase())
        catInserted++
        totalInserted++
      } else {
        totalFailed++
      }
    }

    // If fewer than BATCH returned, we've likely got all questions for this category
    if (data.results.length < BATCH) exhausted = true
  }

  console.log(`${catInserted} inserted, ${catSkipped} skipped`)
}

console.log('\n─────────────────────────────────────')
console.log(`Done!`)
console.log(`  Inserted : ${totalInserted}`)
console.log(`  Skipped  : ${totalSkipped} (already existed)`)
console.log(`  Failed   : ${totalFailed}`)
console.log(`─────────────────────────────────────`)
