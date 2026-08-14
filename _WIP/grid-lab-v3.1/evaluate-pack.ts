// Run the live engine on each walked shape. Print winner vs the picture-oracle
// through the SAME measureProposal keys. Oracle is not imported by the unit.

import { writeFileSync } from 'node:fs'
import { chromium } from '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/node_modules/playwright/index.mjs'
import {
  decidingKey,
  listCandidates,
  measureProposal,
  propose,
} from '../../src/lib/grid-engine/bridge'
import { RELEASED } from '../../src/lib/grid-engine/spec'
import type { Candidate } from '../../src/lib/grid-engine/candidates'
import type { BandId } from '../../src/lib/grid-engine/spec'
import type { PointMM } from '../../src/lib/grid-engine/engine'

const CUT =
  '/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.grok/worktrees/s62-grok-grid-v3.1-build/public/grid-engine/cutouts'

type Target = { n: number; size: number; family?: string; stepMin?: number; note: string }

const ORACLE: Record<string, Partial<Record<BandId, Target>>> = {
  DUCK: {
    1: { n: 1, size: 60, note: 'one disc in the head' },
    2: { n: 2, size: 79, note: 'vertical head+body' },
    3: { n: 4, size: 152, family: 'rectangle-corners', note: 'four corners, skip mid' },
  },
  'BAT-WOMAN': {
    1: { n: 1, size: 60, note: 'head / upper body' },
    2: { n: 2, size: 88, note: 'vertical head+body' },
    3: { n: 3, size: 144, family: 'corner-triangle', note: 'utmost corners' },
  },
  BUTTERFLY: {
    1: { n: 1, size: 60, note: 'body between wings' },
    2: { n: 2, size: 97, note: 'horizontal upper wings' },
    3: { n: 4, size: 130, note: '96x96 wing corners' },
    4: { n: 4, size: 214, stepMin: 90, note: 'four on 96mm' },
  },
  POKE1: {
    1: { n: 1, size: 60, note: 'round head' },
    2: { n: 2, size: 75, note: 'vertical head+body' },
    3: { n: 4, size: 123, note: '96x96 lobes' },
    4: { n: 4, size: 217, stepMin: 90, note: 'four on 96mm' },
  },
  BOT: {
    2: { n: 2, size: 96, note: 'vertical head+belly' },
    3: { n: 4, size: 144, family: 'rectangle-corners', note: 'narrow 96x48' },
  },
  PILL: {
    1: { n: 1, size: 60, note: 'centre of capsule' },
    2: { n: 2, size: 79, note: 'diagonal pair' },
  },
}

function parsePts(pts: string): PointMM[] {
  return pts
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [x, y] = p.split(',').map(Number)
      return [x, y] as PointMM
    })
}

function minStep(c: Candidate): number {
  if (c.sites.length < 2) return 0
  let best = Infinity
  for (let i = 0; i < c.sites.length; i++) {
    for (let j = i + 1; j < c.sites.length; j++) {
      const dx = c.sites[i].x - c.sites[j].x
      const dy = c.sites[i].y - c.sites[j].y
      const d = Math.hypot(dx, dy)
      if (d < best) best = d
    }
  }
  return best
}

function nearestOracle(pool: Candidate[], t: Target): Candidate | null {
  const hit = pool.filter((c) => {
    if (c.sites.length !== t.n) return false
    if (t.family && c.family !== t.family) return false
    if (t.stepMin && minStep(c) < t.stepMin) return false
    return true
  })
  if (!hit.length) return null
  hit.sort((a, b) => Math.abs(a.sizeMM - t.size) - Math.abs(b.sizeMM - t.size))
  return hit[0]
}

function line(c: Candidate | null, outline: PointMM[]) {
  if (!c) return '  MISSING from document'
  const m = measureProposal(RELEASED, c, outline)
  const ys = c.sites.map((s) => s.y.toFixed(0)).join(',')
  return `  ${c.sizeMM}mm ${c.sites.length}pt ${c.family} step=${Math.sqrt(m.step).toFixed(0)} clr=${m.clear.toFixed(1)} ext=${Math.sqrt(m.extremes).toFixed(0)} g=${m.gravity ? 'Y' : 'n'} y=${ys}`
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } })
  await page.goto('http://localhost:4410/grid-engine', { waitUntil: 'networkidle' })

  const report: string[] = []
  for (const shape of Object.keys(ORACLE)) {
    if (await page.locator('button', { hasText: 'clear' }).count()) {
      await page.locator('button', { hasText: 'clear' }).click()
    }
    await page.setInputFiles('input[type=file]', `${CUT}/${shape}.png`)
    await page.waitForSelector('[data-silhouette=outline]', { timeout: 180000 })
    await page.waitForTimeout(1500)
    const pts = await page.locator('[data-silhouette=outline]').getAttribute('points')
    if (!pts) {
      report.push(`${shape}: no outline`)
      continue
    }
    const outline = parsePts(pts)
    const doc = listCandidates(RELEASED, outline)
    report.push(`\n=== ${shape}  verts=${outline.length}  raw=${doc.candidates.length} ===`)
    const bands = Object.keys(ORACLE[shape]).map(Number) as BandId[]
    for (const band of bands) {
      const t = ORACLE[shape][band]!
      const face = propose(RELEASED, doc, band, outline)
      const won = face[0] ?? null
      const want = nearestOracle(
        doc.candidates.filter((c) => c.band === band),
        t,
      )
      report.push(`B${band} picture: ${t.size}mm ${t.n}pt — ${t.note}`)
      report.push(`  WON   ${line(won, outline)}`)
      report.push(`  WANT  ${line(want, outline)}`)
      if (won && want && won.id !== want.id) {
        report.push(
          `  KEY   ${decidingKey(band, measureProposal(RELEASED, won, outline), measureProposal(RELEASED, want, outline))}`,
        )
      } else if (!want) {
        report.push('  KEY   target not in document (fit/collect)')
      } else {
        report.push('  KEY   same candidate')
      }
    }
  }
  await browser.close()
  const text = report.join('\n')
  writeFileSync('/tmp/grid-calibrate-report.txt', text)
  console.log(text)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
