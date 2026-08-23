import { readFileSync, writeFileSync } from 'node:fs'
import { listCandidates, measureProposal, propose } from '../../../src/lib/grid-engine/bridge'
import { RELEASED } from '../../../src/lib/grid-engine/spec'

function parse(path: string) {
  return readFileSync(path, 'utf8')
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [x, y] = p.split(',').map(Number)
      return [x, y] as [number, number]
    })
}

const shape = process.argv[2] === 'duck' ? '/tmp/walk-duck-pts.txt' : '/tmp/bat-pts.txt'
const outline = parse(shape)
const lines: string[] = [`file ${shape}`, `verts ${outline.length}`]
const t0 = Date.now()
const doc = listCandidates(RELEASED, outline)
lines.push(`candidates ${doc.candidates.length} ms ${Date.now() - t0}`)

for (const band of [1, 2, 3, 4] as const) {
  const pool = doc.candidates.filter((c) => c.band === band)
  const byN: Record<number, number> = {}
  for (const c of pool) byN[c.sites.length] = (byN[c.sites.length] || 0) + 1
  const pairs = pool.filter((c) => c.sites.length === 2)
  const tris = pool.filter((c) => c.family === 'corner-triangle')
  const fours = pool.filter((c) => c.family === 'rectangle-corners')
  const pairSizes = [...new Set(pairs.map((c) => c.sizeMM))].sort((a, b) => a - b)
  const triSizes = [...new Set(tris.map((c) => c.sizeMM))].sort((a, b) => a - b)
  const fourSizes = [...new Set(fours.map((c) => c.sizeMM))].sort((a, b) => a - b)
  const vertPairs = pairs.filter((c) => {
    const dx = Math.abs(c.sites[0].x - c.sites[1].x)
    const dy = Math.abs(c.sites[0].y - c.sites[1].y)
    return dx < 2 && Math.abs(dy - 48) < 2
  })
  const vertSizes = [...new Set(vertPairs.map((c) => c.sizeMM))].sort((a, b) => a - b)
  lines.push(`\nBAND ${band} pool ${pool.length} byN ${JSON.stringify(byN)}`)
  lines.push(`  pair sizes ${pairSizes.join(',')} count ${pairs.length}`)
  lines.push(`  vert48 pair sizes ${vertSizes.join(',')}`)
  lines.push(`  tri sizes ${triSizes.join(',')} count ${tris.length}`)
  lines.push(`  four sizes ${fourSizes.join(',')} count ${fours.length}`)
  const face = propose(RELEASED, doc, band, outline)
  const w = face[0]
  if (w) {
    const m = measureProposal(RELEASED, w, outline)
    lines.push(
      `  WON ${w.sizeMM} ${w.sites.length}pt ${w.family} ext${Math.sqrt(m.extremes).toFixed(1)} clr${m.clear.toFixed(1)} g${m.gravity ? 'Y' : 'n'} top${m.top.toFixed(0)}`,
    )
    lines.push(`  seats ${w.sites.map((s) => `(${s.x.toFixed(0)},${s.y.toFixed(0)})`).join(' ')}`)
  }
  const scored = pool
    .map((c) => ({ c, m: measureProposal(RELEASED, c, outline) }))
    .filter((x) => x.m.gravity)
  scored.sort(
    (a, b) => a.m.extremes - b.m.extremes || a.m.size - b.m.size || a.m.balance - b.m.balance,
  )
  lines.push(
    `  BEST-FLAP ${scored
      .slice(0, 8)
      .map(
        (x) =>
          `${x.c.sizeMM}/${x.c.sites.length}pt/${x.c.family}/ext${Math.sqrt(x.m.extremes).toFixed(0)}`,
      )
      .join(' | ')}`,
  )
}

const text = lines.join('\n')
writeFileSync('/tmp/probe-bat-select.txt', text)
console.log(text)
