/**
 * Re-categorise all questions:
 *   1. Creates "Video Games" and "Food & Drink" categories if they don't exist
 *   2. Moves game-specific questions out of Science → Video Games
 *   3. Moves clearly misclassified General Knowledge questions to proper categories
 *
 * Usage:
 *   node scripts/recategorize.mjs            # apply changes
 *   node scripts/recategorize.mjs --dry-run  # preview only
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const DRY = process.argv.includes('--dry-run')
if (DRY) console.log('--- DRY RUN (no writes) ---\n')

// ── 1. Ensure new categories exist ───────────────────────────────────────────

const NEW_CATEGORIES = [
  { name: 'Video Games',  type: 'general', icon: '🎮' },
  { name: 'Food & Drink', type: 'general', icon: '🍺' },
]

async function ensureCategories() {
  const { data: existing } = await supabase.from('categories').select('id, name')
  const byName = Object.fromEntries(existing.map(c => [c.name, c.id]))

  for (const cat of NEW_CATEGORIES) {
    if (byName[cat.name]) {
      console.log(`  ✓ "${cat.name}" already exists`)
    } else if (DRY) {
      console.log(`  [dry] Would create category "${cat.name}"`)
      byName[cat.name] = `__dry_${cat.name}__`  // placeholder so classify still works
    } else {
      const { data, error } = await supabase.from('categories').insert(cat).select().single()
      if (error) throw new Error(`Create category "${cat.name}": ${error.message}`)
      byName[cat.name] = data.id
      console.log(`  ✅ Created "${cat.name}" (${data.id})`)
    }
  }
  return byName
}

// ── 2. Load every question ────────────────────────────────────────────────────

async function loadAll() {
  const rows = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, text, category_id, categories(name)')
      .range(offset, offset + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

// ── 3. Classification rules ───────────────────────────────────────────────────
//
//  Returns the TARGET category name, or null to leave unchanged.

function classify(q, catByName) {
  const t = q.text
  const cur = q.categories?.name ?? 'NONE'

  // ── Video Games ─────────────────────────────────────────────────────────────
  // (catch game-specific content wherever it lives)
  const gameHits = [
    'Bethesda', 'Brotherhood of Nod', 'Command and Conquer',
    'Sonic the Hedgehog', 'Knuckles the Echidna',
    'Danganronpa', 'Last Guardian',
    'Skylanders', 'Paper Mario', 'Nintendo 64',
    'League of Legends', 'DOTA 2', 'Smite', 'Heroes of the Storm',
    'Runescape', 'PAYDAY', 'Ice Climbers',
    'Team Fortress 2',
    '"Bubsy"',
    'Portal', "Portal 2",
    "Tom Clancy's The Division",
    'M.U.G.E.N',
    'Half Life 2', '"Half-Life" logo',
    'Sly Cooper',
    '"Crysis"',
    'Final Fantasy XIV',
    'Jetpack Joyride',
    'Super Mario Sunshine',
    'Counter-Strike',
    'Dark Souls', 'Dark Sun Gwyndolin',
    'Stardew Valley',
    'Entertainment Software Ratings Board', 'ESRB',
    '"Mega Man"',
    'Overwatch',
    'Touhou Project',
    'Night in the Woods',
    'Dead Rising 3',
    'Ace Attorney', 'KG-8 incident',
    'Turok: Dinosaur Hunter',
    'Cook, Serve, Delicious',
    'Minecraft',
    'Source engine',
    'Kerbal Space Program',
    'Ghost Trick: Phantom Detective',
    'Miitopia',
    'Animal Crossing',
    'Porygon-Z', 'National Pokedex',
    'Left 4 Dead',
    'Hidetaka Miyazaki',
    'Danganronpa: Trigger Happy Havoc',
    'Waluigi',
    'Lethal Company',
    'Fallout: New Vegas',
    '"The Sims"',
    'Playstation 2', 'PlayStation 2',
    'rhythm games', 'Harmonix',
    'Marvel games',
  ]
  if (gameHits.some(p => t.includes(p))) return 'Video Games'

  // Extra game patterns that need the current category guard to avoid false positives
  if (['Science', 'General Knowledge', 'NONE'].includes(cur)) {
    if (t.includes('Gabe Newell') && t.includes('Valve')) return 'Video Games'
    if (t.includes('Playstation 3') || t.includes('PlayStation 3')) return 'Video Games'
    if (t.includes('video game streaming platform') && t.includes('Twitch')) return 'Tech & Computers'
    if (t.includes('TwitchTV')) return 'Tech & Computers'
  }

  // ── Only reclassify General Knowledge beyond this point ─────────────────────
  if (cur !== 'General Knowledge') return null

  // Tech & Computers
  if (t.includes('tenth-century ruler of Denmark and Norway')) return 'Tech & Computers' // Bluetooth
  if (t.includes('Valve cooperate') && t.includes('Vive'))    return 'Tech & Computers'
  if (t.includes('WhatsApp founded'))                          return 'Tech & Computers'
  if (t.includes('first video uploaded to YouTube'))           return 'Tech & Computers'
  if (t.includes('Oculus VR'))                                 return 'Tech & Computers'
  if (t.includes('Nokia') && t.includes('originally sell'))    return 'Tech & Computers'
  if (t.includes('original name of the search engine'))        return 'Tech & Computers' // BackRub
  if (t.includes('SIM card') || (t.includes('SIM') && t.includes('abbreviation'))) return 'Tech & Computers'
  if (t.includes('most-visited website'))                      return 'Tech & Computers'

  // Food & Drink
  if (t.includes('juniper berries'))                           return 'Food & Drink' // gin
  if (t.includes('potatoes or grains') && t.includes('beverage')) return 'Food & Drink' // vodka
  if (t.includes('Scotch whisky') && t.includes('Drambuie'))   return 'Food & Drink'
  if (t.includes('100 pounds of') && t.includes('per second')) return 'Food & Drink' // chocolate
  if (t.includes('most common pub name'))                       return 'Food & Drink'
  if (t.includes('clay oven') || t.includes('tandoor'))         return 'Food & Drink'
  if (t.includes("Mountain Dew's original slogan"))             return 'Food & Drink'
  if (t.includes('fast food chain has the most locations'))     return 'Food & Drink'

  // History
  if (t.includes('NOT a belligerent in World War I'))           return 'History'
  if (t.includes('Hughes H-4 Hercules'))                        return 'History'
  if (t.includes('Goth Subculture'))                            return 'History'
  if (t.includes('Pablo Escobar'))                              return 'History'
  if (t.includes('first ever London Underground line'))         return 'History'
  if (t.includes('Michelin') && t.includes('1889'))             return 'History'

  // Geography
  if (t.includes('connects the Mediterranean Sea with the Red Sea')) return 'Geography' // Suez Canal
  if (t.includes('highest peak in Africa'))                     return 'Geography'
  if (t.includes('longest bridge in the world'))                return 'Geography'
  if (t.includes('Badwater Basin'))                             return 'Geography'
  if (t.includes("Cuba's official") && t.includes('language'))  return 'Geography'

  // Science
  if (t.includes('H2O') && !t.includes('Fallout'))             return 'Science'
  if (t.includes('perimeter of a circle'))                      return 'Science'
  if (t.includes('aerodynamics') && t.includes('upwards'))      return 'Science'
  if (t.includes("Halley's Comet"))                             return 'Science'
  if (t.includes('Fields Medal') && t.includes('mathematics')) return 'Science'

  // Nature & Animals
  if (t.includes('largest living species of penguin'))          return 'Nature & Animals'

  // Art & Literature
  if (t.includes('Le Corbusier') && t.includes('architect'))   return 'Art & Literature'
  if (t.includes('first book of the Old Testament'))            return 'Art & Literature'
  if (t.includes('27th letter of the alphabet'))                return 'Art & Literature' // ampersand / &
  if (t.includes('Little Jack Horner'))                         return 'Art & Literature'

  // Movies & TV
  if (t.includes('Shrek') && t.includes('voices Donkey'))       return 'Movies & TV'
  if (t.includes('Nicktoons') && t.includes('Oh Yeah! Cartoons')) return 'Movies & TV'
  if (t.includes('Terry Gilliam') && t.includes('comedy group')) return 'Movies & TV'

  // History (from History category - wrongly classified questions)
  // (handled below for non-GK)

  return null
}

// ── Also fix a couple of History questions ────────────────────────────────────
function classifyHistory(q) {
  const t = q.text
  if (q.categories?.name !== 'History') return null
  if (t.includes('Game of the Year in 2018')) return 'Video Games'  // Red Dead Redemption 2 question
  return null
}

// ── 4. Apply updates ──────────────────────────────────────────────────────────

async function run() {
  console.log('Loading categories…')
  const catByName = await ensureCategories()
  console.log()

  console.log('Loading questions…')
  const questions = await loadAll()
  console.log(`  ${questions.length} questions loaded\n`)

  const changes = []

  for (const q of questions) {
    let target = classify(q, catByName) ?? classifyHistory(q)
    if (!target) continue

    const targetId = catByName[target]
    if (!targetId) { console.warn(`  ⚠️  Unknown target category "${target}" (skipping)`); continue }
    // In dry-run, placeholder IDs won't match real IDs — always treat as a change
    if (!DRY && q.category_id === targetId) continue

    const from = q.categories?.name ?? 'NONE'
    changes.push({ id: q.id, text: q.text.slice(0, 80), from, to: target, targetId })
  }

  if (changes.length === 0) {
    console.log('✅ Nothing to change — all questions already correctly categorised.')
    return
  }

  // Summary by (from → to)
  const summary = {}
  for (const c of changes) {
    const key = `${c.from} → ${c.to}`
    summary[key] = (summary[key] ?? 0) + 1
  }
  console.log(`📋 ${changes.length} questions to update:\n`)
  for (const [k, n] of Object.entries(summary).sort()) {
    console.log(`   ${n.toString().padStart(3)}  ${k}`)
  }
  console.log()

  if (DRY) {
    console.log('--- DRY RUN: listing individual changes ---\n')
    for (const c of changes) {
      console.log(`  [${c.from}] → [${c.to}]\n  "${c.text}…"\n`)
    }
    return
  }

  // Batch update in groups of 50
  let done = 0
  for (let i = 0; i < changes.length; i += 50) {
    const batch = changes.slice(i, i + 50)
    // Group by target category for efficient upsert
    const byTarget = {}
    for (const c of batch) {
      if (!byTarget[c.targetId]) byTarget[c.targetId] = []
      byTarget[c.targetId].push(c.id)
    }
    for (const [catId, ids] of Object.entries(byTarget)) {
      const { error } = await supabase
        .from('questions')
        .update({ category_id: catId })
        .in('id', ids)
      if (error) throw new Error(`Update failed: ${error.message}`)
    }
    done += batch.length
    process.stdout.write(`\r  Updated ${done}/${changes.length}…`)
  }
  console.log(`\n\n✅ Done — ${changes.length} questions re-categorised.`)
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
