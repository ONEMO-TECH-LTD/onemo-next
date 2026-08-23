import { readFileSync, writeFileSync } from 'node:fs'
import { listCandidates, measureProposal } from '../../../src/lib/grid-engine/bridge'
import { RELEASED } from '../../../src/lib/grid-engine/spec'

const outline = readFileSync('/tmp/bat-pts.txt', 'utf8')
  .trim()
  .split(/\s+/)
  .map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [x, y] as [number, number]
  })

const doc = listCandidates(RELEASED, outline)
const lines: string[] = []
for (const c of doc.candidates.filter((x) => x.band === 3 && x.family === 'corner-triangle')) {
  const m = measureProposal(RELEASED, c, outline)
  const seats = c.sites
    .map((s) => `(${s.x.toFixed(0)},${s.y.toFixed(0)})`)
    .join(' ')
  lines.push(
    `${c.sizeMM} step${c.stepCol}x${c.stepRow} g${m.gravity ? 'Y' : 'n'} masses${m.masses ? 'Y' : 'n'} ext${Math.sqrt(m.extremes).toFixed(0)} clr${m.clear.toFixed(1)} top${m.top.toFixed(0)} bal${Math.sqrt(m.balance).toFixed(0)} ${seats}`,
  )
}
const text = lines.sort().join('\n')
writeFileSync('/tmp/probe-tri.txt', text)
console.log(text)
