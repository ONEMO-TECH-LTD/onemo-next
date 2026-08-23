import { readFileSync } from 'node:fs'
import { scaleToSize } from '../../../src/lib/grid-engine/candidates'
import { discFitsGrid, prepareOutline } from '../../../src/lib/grid-engine/measure'
import { magnetsInRegion } from '../../../src/lib/grid-engine/engine'
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

for (const size of [144, 148, 152, 156, 168, 180, 192, 204, 216]) {
  const prep = prepareOutline(thin(scaleToSize(outline, size)))
  let bestH = 0
  let bestFour = 0
  let n96 = 0
  for (let ox = 0; ox < pitch; ox += pad) {
    for (let oy = 0; oy < pitch; oy += pad) {
      const raw = magnetsInRegion({ ...spec.grid, pitchMM: pitch }, field, 0, [ox, oy])
      const held = raw.filter(([x, y]) => discFitsGrid(prep, [x, y], spec.grid))
      const ys = [...new Set(held.map((p) => p[1]))].sort((a, b) => a - b)
      const xs = [...new Set(held.map((p) => p[0]))].sort((a, b) => a - b)
      if (ys.length >= 2) bestH = Math.max(bestH, ys[ys.length - 1] - ys[0])
      let fours = 0
      for (let i = 0; i < xs.length; i++) {
        for (let j = i + 1; j < xs.length; j++) {
          for (let r = 0; r < ys.length; r++) {
            for (let s = r + 1; s < ys.length; s++) {
              const corners = [
                [xs[i], ys[r]],
                [xs[j], ys[r]],
                [xs[i], ys[s]],
                [xs[j], ys[s]],
              ]
              const ok = corners.every(([x, y]) => held.some((p) => p[0] === x && p[1] === y))
              if (!ok) continue
              fours++
              if (ys[s] - ys[r] >= 96) n96++
              if (ys[s] - ys[r] > bestFour) bestFour = ys[s] - ys[r]
            }
          }
        }
      }
    }
  }
  console.log(`size ${size} heldSpanY=${bestH} bestFourH=${bestFour} fours96+=${n96}`)
}
