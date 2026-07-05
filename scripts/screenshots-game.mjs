/**
 * Capture in-game screenshots by running a real session with two browser contexts.
 * Run: node scripts/screenshots-game.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../docs/screenshots')
const BASE_URL = 'http://localhost:5174'
const VIEWPORT = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch()

// ── Host context ──────────────────────────────────────────────────────────────
const hostCtx = await browser.newContext({ viewport: VIEWPORT })
const host = await hostCtx.newPage()

// ── Player context (mobile-ish) ───────────────────────────────────────────────
const playerCtx = await browser.newContext({ viewport: MOBILE })
const player = await playerCtx.newPage()

async function shot(page, filename) {
  console.log(`  → ${filename}`)
  await page.screenshot({ path: join(OUT_DIR, filename), fullPage: false })
}

console.log('Setting up game session…\n')

// 1. Host creates a room
await host.goto(`${BASE_URL}/host`, { waitUntil: 'networkidle' })
await host.fill('input[type="text"]', 'Quiz Master')
await host.click('button:has-text("Create Room")')

// Wait for the room code element specifically
await host.waitForSelector('span.room-code', { timeout: 10000 })

// Extract room code using the specific class
const roomCode = (await host.locator('span.room-code').textContent()).trim()
console.log(`  Room code: ${roomCode}`)

await shot(host, 'host-lobby.png')

// 2. Player joins
await player.goto(`${BASE_URL}/join`, { waitUntil: 'networkidle' })
// Room code input
await player.locator('input').first().fill(roomCode)
// Team name input
await player.locator('input').nth(1).fill('The Brains')
await player.click('button:has-text("Join")')

// Wait for player to appear in host's lobby (start button becomes enabled)
await host.waitForSelector('button:not([disabled]):has-text("Start")', { timeout: 10000 })

// Wait for player lobby view to render
await new Promise(r => setTimeout(r, 800))
await shot(player, 'play-lobby.png')

// 3. Host round setup screenshot (already in lobby)
await shot(host, 'host-round-setup.png')

// Start the game
await host.click('button:has-text("Start")')

// Wait for question to appear on host
await host.waitForSelector('.question-card, [class*="question"], .timer', { timeout: 10000 })
await new Promise(r => setTimeout(r, 800))
await shot(host, 'host-question.png')

// Wait for question on player side
await player.waitForSelector('.question-card, [class*="question"], .answer-options, button[class*="option"]', { timeout: 10000 }).catch(() => {})
await new Promise(r => setTimeout(r, 500))
await shot(player, 'play-question.png')

// 4. Player submits an answer (click first option)
const firstOption = await player.$('.option-btn, button[class*="option"], .answer-option, [class*="choice"]')
if (firstOption) {
  await firstOption.click()
  await new Promise(r => setTimeout(r, 600))
  await shot(player, 'play-answered.png')
}

// 5. Results — auto-triggered when all players answer; wait for results panel
await host.waitForSelector('.results-panel, button:has-text("Next Question")', { timeout: 10000 })
await new Promise(r => setTimeout(r, 500))
await shot(host, 'host-results.png')
await shot(player, 'play-results.png')

await browser.close()
console.log(`\nDone — game screenshots saved to docs/screenshots/`)
