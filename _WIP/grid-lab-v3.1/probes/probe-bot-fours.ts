import { readFileSync, writeFileSync } from 'node:fs'
import { listCandidates } from '../../../src/lib/grid-engine/bridge'
import { RELEASED } from '../../../src/lib/grid-engine/spec'

const outline = readFileSync('/tmp/bot-pts.txt', 'utf8')
  .trim()
  .split(/\s+/)
  .map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [x, y] as [number, number]
  })

const t0 = Date.now()
const doc = listCandidates(RELEASED, outline)
const lines = [`collect ${doc.candidates.length} in ${Date.now() - t0}ms`]

function box(c: (typeof doc.candidates)[0]) {
  const xs = c.sites.map((s) => s.x)
  const ys = c.sites.map((s) => s.y)
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  }
}

for (const band of [3, 4] as const) {
  const fours = doc.candidates.filter((c) => c.band === band && c.family === 'rectangle-corners')
  const by: Record<string, number> = {}
  for (const c of fours) {
    const b = box(c)
    const k = `${c.sizeMM} ${b.w}x${b.h}`
    by[k] = (by[k] || 0) + 1
  }
  lines.push(`\nB${band} fours ${fours.length}`)
  for (const [k, n] of Object.entries(by).sort()) lines.push(`  ${k} ×${n}`)
}

const text = lines.join('\n')
writeFileSync('/tmp/probe-bot-fours.txt', text)
console.log(text)
