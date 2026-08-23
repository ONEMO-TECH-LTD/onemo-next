import { readFileSync, writeFileSync } from 'node:fs'
import { collectCandidates, scaleToSize } from '../../../src/lib/grid-engine/candidates'
import { discFitsGrid, prepareOutline } from '../../../src/lib/grid-engine/measure'
import { magnetsInRegion } from '../../../src/lib/grid-engine/engine'
import { RELEASED } from '../../../src/lib/grid-engine/spec'
import { enumerateArrangements } from '../../../src/lib/grid-engine/enumerate'

const outline = readFileSync('/tmp/bat-pts.txt', 'utf8')
  .trim()
  .split(/\s+/)
  .map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [x, y] as [number, number]
  })

const spec = RELEASED
const pitch = spec.grid.basePitchMM
const pad = spec.grid.paddingMM
const half = ((spec.grid.positionsPerAxis - 1) * pitch) / 2
const field = { x: -half, y: -half, w: half * 2, h: half * 2 }
const origins: Array<[number, number]> = []
for (let x = 0; x < pitch; x += pad) for (let y = 0; y < pitch; y += pad) origins.push([x, y])

function thin(verts: Array<[number, number]>) {
  const min2 = 1
  const out: Array<[number, number]> = []
  for (const p of verts) {
    const last = out[out.length - 1]
    if (last) {
      const dx = p[0] - last[0]
      const dy = p[1] - last[1]
      if (dx * dx + dy * dy < min2) continue
    }
    out.push(p)
  }
  return out.length >= 3 ? out : verts
}

const lines: string[] = []
for (const size of [72, 84, 88, 96, 100, 108, 120, 132, 144, 156, 168]) {
  const scaled = thin(scaleToSize(outline, size))
  const prep = prepareOutline(scaled)
  let singles = 0
  let vert48 = 0
  let any2 = 0
  let tri = 0
  let four = 0
  for (const origin of origins) {
    const raw = magnetsInRegion({ ...spec.grid, pitchMM: pitch }, field, 0, origin)
    const measured = raw.map(([x, y]) => ({
      col: Math.round((x - origin[0]) / pitch),
      row: Math.round((y - origin[1]) / pitch),
      x,
      y,
      fits: discFitsGrid(prep, [x, y], spec.grid),
    }))
    const held = measured.filter((s) => s.fits)
    singles += held.length
    for (const a of held) {
      for (const b of held) {
        if (a === b) continue
        const dx = Math.abs(a.x - b.x)
        const dy = Math.abs(a.y - b.y)
        if (dx < 1 && Math.abs(dy - 48) < 1) vert48++
        if ((dx === 48 && dy === 0) || (dy === 48 && dx === 0) || (dx === 48 && dy === 48)) any2++
      }
    }
    const arr = enumerateArrangements(measured, 'base', { windows: false })
    tri += arr.filter((a) => a.family === 'corner-triangle').length
    four += arr.filter((a) => a.family === 'rectangle-corners').length
  }
  lines.push(
    `size ${size} singles=${singles} vert48-pairs=${vert48 / 2} adj-pairs=${any2 / 2} tri=${tri} four=${four}`,
  )
}

const doc = collectCandidates(spec, outline)
const b2pairs = doc.candidates.filter((c) => c.band === 2 && c.sites.length === 2)
const b3tri = doc.candidates.filter((c) => c.band === 3 && c.family === 'corner-triangle')
lines.push(`\ndoc B2 pairs ${b2pairs.length} sizes ${[...new Set(b2pairs.map((c) => c.sizeMM))]}`)
lines.push(`doc B3 tri ${b3tri.length} sizes ${[...new Set(b3tri.map((c) => c.sizeMM))]}`)

const text = lines.join('\n')
writeFileSync('/tmp/probe-wrap.txt', text)
console.log(text)
