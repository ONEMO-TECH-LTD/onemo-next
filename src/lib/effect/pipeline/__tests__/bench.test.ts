// Headless performance card for the grid solve. Opt-in: `GRID_BENCH=1 npx vitest run pipeline/__tests__/bench`
// (skipped otherwise so CI stays fast). Prints cold solve ms per cutout × band plus the offers, and
// writes the same to /tmp/grid-bench-<head>.json; set GRID_BENCH_BASE=<that json> to print the delta
// against another head and to FAIL if any offer differs — the same numbers Dan reads on the bench's
// perf card, without a browser.
import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { solveGrid } from '../solve'
import { normMaskContour } from '../../grid-magnet-bridge'
import { BANDS, PROTECTION_PADDING_MM } from '../../grid-magnet-spec'
import type { Contour, GridConfig } from '../../types'

const nodeRequire = createRequire(import.meta.url)
const CUTOUTS = ['DUCK', 'BOT', 'BAT-WOMAN', 'BUTTERFLY'] as const
const cutout = (name: string): Contour => {
  const { PNG } = nodeRequire('pngjs') as { PNG: { sync: { read(d: Buffer): { width: number; height: number; data: Uint8Array } } } }
  const png = PNG.sync.read(readFileSync(join(process.cwd(), 'public/grid-engine/cutouts', name + '.png')))
  const mask = new Uint8Array(png.width * png.height)
  for (let i = 0; i < mask.length; i++) if (png.data[i * 4 + 3] > 128) mask[i] = 1
  return normMaskContour(mask, png.width, png.height)!
}
const ms = () => performance.now()
const cfg: GridConfig = { pitchMM: 48, paddingMM: 12, perimeterOnly: true, centreMode: 2, governor: 0, plan: 'all6' }
type Row = { shape: string; band: number; ms: number; offers: string }

describe.skipIf(!process.env.GRID_BENCH)('grid solve — headless performance card', () => {
  it('cold solve per cutout × band', () => {
    const head = execSync('git rev-parse --short HEAD').toString().trim()
    const rows: Row[] = []
    for (const name of CUTOUTS) {
      const base = cutout(name)
      for (const band of BANDS.slice(0, 5)) {
        const t = ms()
        const solve = solveGrid({ base, offsetMM: 0, cfg, mode: band.id, sizeMM: 0, stepSel: null, settings: { protectionPaddingMM: PROTECTION_PADDING_MM } })
        rows.push({ shape: name, band: band.id, ms: Math.round(ms() - t), offers: JSON.stringify(solve.rungs) })
      }
    }
    const basePath = process.env.GRID_BENCH_BASE
    if (basePath && !existsSync(basePath)) throw new Error(`GRID_BENCH_BASE not found: ${basePath}`)
    const base: Row[] | null = basePath ? JSON.parse(readFileSync(basePath, 'utf8')).rows : null
    if (base) expect(base.map((r) => `${r.shape}/B${r.band}`).sort(), 'baseline must contain exactly this benchmark matrix').toEqual(rows.map((r) => `${r.shape}/B${r.band}`).sort())
    const lines = [`grid solve · head ${head}${base ? ' · vs ' + basePath : ''}`, 'shape      band   ms' + (base ? '   base   delta' : '')]
    let total = 0, baseTotal = 0
    for (const r of rows) {
      total += r.ms
      const b = base?.find((x) => x.shape === r.shape && x.band === r.band)
      if (b) baseTotal += b.ms
      lines.push(`${r.shape.padEnd(10)} B${r.band}  ${String(r.ms).padStart(6)}` + (b ? `  ${String(b.ms).padStart(5)}  ${(((r.ms - b.ms) / b.ms) * 100).toFixed(0).padStart(5)}%` : ''))
    }
    lines.push(`total ${total} ms` + (base ? ` · base ${baseTotal} ms · ${(((total - baseTotal) / baseTotal) * 100).toFixed(1)}%` : ''))
    const out = `/tmp/grid-bench-${head}.json`
    writeFileSync(out, JSON.stringify({ head, rows }, null, 1))
    lines.push(`written ${out}`)
    process.stderr.write('\n' + lines.join('\n') + '\n')
    if (base) for (const r of rows) {
      const b = base.find((x) => x.shape === r.shape && x.band === r.band)
      if (b) expect(r.offers, `${r.shape} B${r.band} offers differ from base`).toBe(b.offers)
    }
  }, 1_800_000)
})
