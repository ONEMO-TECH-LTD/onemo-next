import { readFileSync } from 'node:fs'
import { scaleToSize } from '../../../src/lib/grid-engine/candidates'
import { discFitsGrid, prepareOutline } from '../../../src/lib/grid-engine/measure'
import { magnetsInRegion } from '../../../src/lib/grid-engine/engine'
import { enumerateArrangements } from '../../../src/lib/grid-engine/enumerate'
import { RELEASED } from '../../../src/lib/grid-engine/spec'

const outline = readFileSync('/tmp/bot-pts.txt', 'utf8')
  .trim()
  .split(/\s+/)
  .map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [x, y] as [number, number]
  })

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

const spec = RELEASED
const pitch = 48
const pad = 12
const half = ((9 - 1) * pitch) / 2
const field = { x: -half, y: -half, w: half * 2, h: half * 2 }

for (const size of [147, 156, 168, 180, 192, 204, 216]) {
  const prep = prepareOutline(thin(scaleToSize(outline, size)))
  let bestWin = ''
  let bestN = 0
  for (let ox = 0; ox < pitch; ox += pad) {
    for (let oy = 0; oy < pitch; oy += pad) {
      const raw = magnetsInRegion({ ...spec.grid, pitchMM: pitch }, field, 0, [ox, oy])
      const measured = raw.map(([x, y], i) => ({
        col: Math.round((x - ox) / pitch),
        row: Math.round((y - oy) / pitch),
        x,
        y,
        fits: discFitsGrid(prep, [x, y], spec.grid),
      }))
      const held = measured.filter((s) => s.fits)
      const wins = enumerateArrangements(measured, 'base', { windows: true, tees: false }).filter(
        (a) => a.family === 'full-window' && a.sites.length >= 4,
      )
      for (const w of wins) {
        const xs = w.sites.map((s) => s.x)
        const ys = w.sites.map((s) => s.y)
        const box = `${Math.max(...xs) - Math.min(...xs)}x${Math.max(...ys) - Math.min(...ys)}`
        const tag = `${w.sites.length}pt ${box} o(${ox},${oy})`
        if (w.sites.length > bestN) {
          bestN = w.sites.length
          bestWin = tag
        }
      }
      if (held.length >= 4 && ox === 0 && oy === 0) {
        console.log(
          `size ${size} o(0,0) held=${held.length} ${held.map((s) => `(${s.x},${s.y})`).join(' ')}`,
        )
      }
    }
  }
  console.log(`size ${size} bestWindow ${bestWin || 'none'}`)
}
