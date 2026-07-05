/**
 * Take screenshots of each app screen for documentation.
 * Run: node scripts/screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../docs/screenshots')
const BASE_URL = 'http://localhost:5174'
const VIEWPORT = { width: 1280, height: 800 }

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize(VIEWPORT)

async function shot(path, filename, { waitFor, setup } = {}) {
  console.log(`  → ${filename}`)
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' })
  if (setup) await setup(page)
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 5000 }).catch(() => {})
  await page.screenshot({ path: join(OUT_DIR, filename), fullPage: false })
}

console.log('Taking screenshots…\n')

// Static screens
await shot('/home', 'home.png')
await shot('/join', 'join.png')
await shot('/language', 'language.png')
await shot('/manage', 'manage.png', { waitFor: '.questions-list, .empty-state' })

// Host setup screen — fill in nickname so the form is visible
await shot('/host', 'host-setup.png', {
  waitFor: 'input[type="text"], .host-form',
})

await browser.close()
console.log(`\nDone — screenshots saved to docs/screenshots/`)
